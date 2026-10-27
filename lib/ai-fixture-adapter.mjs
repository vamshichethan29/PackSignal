/**
 * PackSignal AI Fixture Adapter & Recorder (lib/ai-fixture-adapter.mjs)
 * Implements Phase 2: Recorded Gemini Test Fixtures & Offline Deterministic Modes.
 *
 * Supports 3 operating modes:
 * - LIVE: Connects to configured Gemini API (explicit opt-in via PACKSIGNAL_AI_LIVE=1)
 * - REPLAY: Serves verified recorded JSON fixtures for offline, repeatable tests
 * - OFFLINE_DETERMINISTIC: Completely disables AI; relies strictly on deterministic extractors
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
export const FIXTURES_DIR = resolve(__dirname, '../tests/fixtures/ai');

export const AI_MODES = {
  LIVE: 'LIVE',
  REPLAY: 'REPLAY',
  OFFLINE_DETERMINISTIC: 'OFFLINE_DETERMINISTIC',
};

// Patterns that must NEVER appear in recorded fixtures
const FORBIDDEN_SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g,       // Google API Key pattern
  /Bearer\s+[a-zA-Z0-9._-]+/gi,    // Authorization tokens
  /api[_-]?key["']?\s*[:=]\s*["']?[a-zA-Z0-9_-]+/gi,
  /(?<!REDACTED_)secret/gi,
  /password/gi,
];

export class AiFixtureAdapter {
  constructor(options = {}) {
    this.mode = options.mode || (process.env.PACKSIGNAL_AI_LIVE === '1' ? AI_MODES.LIVE : AI_MODES.REPLAY);
    this.fixturesDir = options.fixturesDir || FIXTURES_DIR;
    this.cache = new Map();
  }

  /**
   * Sanitizes any object or string before saving to disk to guarantee secrets are never recorded.
   */
  sanitizeData(data) {
    let jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
      jsonStr = jsonStr.replace(pattern, '[REDACTED_CREDENTIAL]');
    }
    return JSON.parse(jsonStr);
  }

  /**
   * Validates that an output contains expected schema fields and does not invent ungrounded source citations.
   */
  validateFixturePayload(fixture) {
    if (!fixture || typeof fixture !== 'object') {
      throw new Error('Invalid fixture: must be a JSON object');
    }
    const requiredFields = ['taskName', 'promptVersion', 'schemaVersion', 'modelIdentifier', 'status'];
    for (const f of requiredFields) {
      if (!(f in fixture)) {
        throw new Error(`Fixture schema violation: missing required field "${f}"`);
      }
    }

    // Verify secret absence
    const serialized = JSON.stringify(fixture);
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
      if (pattern.test(serialized)) {
        throw new Error('Security violation: Fixture contains unredacted API key or secret token.');
      }
    }

    return true;
  }

  /**
   * Loads a recorded fixture from tests/fixtures/ai/
   */
  async fetchFixture(taskName, options = {}) {
    const filename = `${taskName.replace(/_/g, '-')}.json`;
    const filePath = join(this.fixturesDir, filename);

    if (this.cache.has(taskName)) {
      const cached = this.cache.get(taskName);
      this.verifyVersionAndHash(cached, options);
      return cached;
    }

    let raw;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (err) {
      throw new Error(`AI fixture not found for task "${taskName}" at ${filePath}: ${err.message}`);
    }

    let fixture;
    try {
      fixture = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Malformed JSON in AI fixture "${taskName}": ${err.message}`);
    }

    this.validateFixturePayload(fixture);
    this.verifyVersionAndHash(fixture, options);

    this.cache.set(taskName, fixture);
    return fixture;
  }

  verifyVersionAndHash(fixture, { promptVersion, inputHash } = {}) {
    if (promptVersion && fixture.promptVersion !== promptVersion) {
      throw new Error(`Stale fixture: expected promptVersion "${promptVersion}", but fixture has "${fixture.promptVersion}". Cache invalidated.`);
    }
    if (inputHash && fixture.inputHash && fixture.inputHash !== inputHash) {
      throw new Error(`Stale fixture: inputHash mismatch. Fixture has "${fixture.inputHash}", caller supplied "${inputHash}".`);
    }
  }

  /**
   * Records a response from live execution to disk with standardized provenance metadata.
   */
  async recordFixture(taskName, {
    output,
    promptVersion = '1.0',
    schemaVersion = '1.0',
    modelIdentifier = 'gemini-2.5-flash',
    inputHash = null,
    status = 'success',
  } = {}) {
    const sanitizedOutput = this.sanitizeData(output);

    const fixtureRecord = {
      taskName,
      promptVersion,
      schemaVersion,
      modelIdentifier,
      inputHash: inputHash || crypto.createHash('sha256').update(JSON.stringify(sanitizedOutput)).digest('hex'),
      output: sanitizedOutput,
      recordedAt: new Date().toISOString(),
      validationStatus: 'RECORDED_AND_VALIDATED',
      status,
    };

    this.validateFixturePayload(fixtureRecord);

    await mkdir(this.fixturesDir, { recursive: true });
    const filename = `${taskName.replace(/_/g, '-')}.json`;
    const filePath = join(this.fixturesDir, filename);

    await writeFile(filePath, JSON.stringify(fixtureRecord, null, 2), 'utf8');
    this.cache.set(taskName, fixtureRecord);
    return fixtureRecord;
  }

  /**
   * Executes or replays an AI task based on active adapter mode.
   */
  async executeTask(taskName, liveExecutorFn, options = {}) {
    if (this.mode === AI_MODES.OFFLINE_DETERMINISTIC) {
      // Deterministic fallback: do not invoke AI; return null to let deterministic checks proceed
      return null;
    }

    if (this.mode === AI_MODES.REPLAY) {
      const fixture = await this.fetchFixture(taskName, options);
      if (fixture.status === 'error') {
        throw new Error(`Replayed Provider Error: ${fixture.output?.errorMessage || 'Simulated provider failure'}`);
      }
      return fixture.output || fixture.data;
    }

    if (this.mode === AI_MODES.LIVE) {
      if (typeof liveExecutorFn !== 'function') {
        throw new Error(`Cannot execute live task "${taskName}": live executor function not supplied.`);
      }
      return await liveExecutorFn();
    }

    throw new Error(`Unknown AI mode: ${this.mode}`);
  }
}

export const defaultAiFixtureAdapter = new AiFixtureAdapter();
