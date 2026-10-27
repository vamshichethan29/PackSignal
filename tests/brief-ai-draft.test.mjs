/**
 * @file tests/brief-ai-draft.test.mjs
 * 
 * Unit tests for Phase 5 AI Brief Drafting and Fallback validation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { draftBriefWithAi, BRIEF_DRAFTING_SYSTEM_PROMPT } from '../lib/brief/ai-brief-draft.mjs';

describe('Phase 5 — AI Brief Drafting & Strict Grounding', () => {

  test('1. System drafting prompt enforces strict grounding and forbids hallucination', () => {
    assert.match(BRIEF_DRAFTING_SYSTEM_PROMPT, /using ONLY the supplied structured facts/i);
    assert.match(BRIEF_DRAFTING_SYSTEM_PROMPT, /Do not invent product values/i);
    assert.match(BRIEF_DRAFTING_SYSTEM_PROMPT, /Reference the exact supporting fact IDs/i);
  });

  test('2. Falls back cleanly to deterministic builder when AI is not configured', async () => {
    const session = resetDeskSession('test-ai-fallback');
    const brief = await draftBriefWithAi(session);

    assert.ok(brief);
    assert.strictEqual(brief.sections.length, 11);
    assert.ok(brief.sentences.length > 0);
  });

  test('3. Rejects hallucinated AI response failing schema and executes fallback', async () => {
    const session = resetDeskSession('test-ai-malformed');
    const mockAiService = {
      generateBrief: async () => {
        // Return malformed object without required sections
        return { invalid: true, hallucinated: 'text' };
      }
    };

    const brief = await draftBriefWithAi(session, { aiService: mockAiService });
    assert.ok(brief);
    assert.strictEqual(brief.sections.length, 11, 'Must fallback to valid 11-section brief');
  });

});
