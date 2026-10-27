/**
 * Architecture Regression Test: Market Isolation (tests/architecture/market-isolation.test.mjs)
 * Implements Phase 18:
 * Verifies that market-specific regulatory citations (e.g. 21 CFR, FSSAI)
 * and Daily Value numbers live strictly in market modules or rulesets,
 * never hardcoded in the generic core engine (lib/engine.mjs).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

test('generic engine (lib/engine.mjs) must not hardcode market-specific logic or legal citations', async () => {
  const enginePath = resolve(REPO_ROOT, 'lib/engine.mjs');
  const engineText = await readFile(enginePath, 'utf8');

  const forbiddenPatterns = [
    { pattern: /\b21\s*CFR\b/i, label: '21 CFR statutory citation' },
    { pattern: /\bFSSAI\b/i, label: 'FSSAI statutory reference' },
    { pattern: /\bEUR-Lex\b/i, label: 'EUR-Lex European reference' },
    { pattern: /\bmarket\s*===?\s*['"](?:us|eu|in)['"]/i, label: 'Hardcoded market branching' },
  ];

  const violations = [];
  for (const { pattern, label } of forbiddenPatterns) {
    if (pattern.test(engineText)) {
      violations.push(`Found forbidden pattern in lib/engine.mjs: ${label}`);
    }
  }

  assert.deepEqual(violations, [], `Market isolation violated in lib/engine.mjs:\n${violations.join('\n')}`);
});

test('market regulatory references must be defined in lib/regulatory/ or rulesets/', async () => {
  const usRefsPath = resolve(REPO_ROOT, 'lib/regulatory/us/references.mjs');
  const usRefs = await readFile(usRefsPath, 'utf8');

  assert.ok(usRefs.includes('21 CFR 101.9'), 'US references module must contain statutory citations');
  assert.ok(usRefs.includes('FDA_DAILY_VALUES_ADULT'), 'US references must contain reference Daily Values');
});
