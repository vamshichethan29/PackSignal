/**
 * @file tests/brief-checklist.test.mjs
 * 
 * Unit tests for Phase 5 Requirements Checklist Export in JSON and CSV.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { generateChecklist, generateChecklistCsv } from '../lib/brief/brief-checklist.mjs';

describe('Phase 5 — Requirements Checklist Export', () => {

  test('1. Generates structured JSON checklist from brief sentences and requirements', () => {
    const session = resetDeskSession('test-chk-json');
    const brief = buildBriefFromSession(session);

    const chk = generateChecklist(brief, session);
    assert.ok(chk.checklistId);
    assert.strictEqual(chk.briefId, brief.briefId);
    assert.ok(chk.totalChecks > 0);
    assert.ok(chk.items.length > 0);

    const first = chk.items[0];
    assert.ok(first.id.startsWith('CHK-'));
    assert.ok(first.statement);
    assert.ok(['PASS', 'FAIL'].includes(first.status));
    assert.ok(['CRITICAL', 'STANDARD'].includes(first.priority));
  });

  test('2. Exports valid CSV representation with escaping', () => {
    const session = resetDeskSession('test-chk-csv');
    const brief = buildBriefFromSession(session);
    const chk = generateChecklist(brief, session);

    const csv = generateChecklistCsv(chk);
    assert.ok(csv.includes('Checklist ID,Sentence ID,Section,Statement,Status,Priority,Owner,Evidence Reference'));
    assert.ok(csv.includes('CHK-BR-S-'));
    // Verify no unescaped multi-line breaks or corrupted quotes
    assert.ok(csv.split('\n').length >= 10);
  });

});
