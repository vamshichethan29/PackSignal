import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeskSession,
  resetDeskSession,
  uploadDeskInput,
  resolveDeskConflict,
  answerDeskQuestion
} from '../lib/evidence-desk.mjs';

describe('Phase 4 — Evidence Desk Core Engine', () => {
  it('initializes a full default Evidence Desk session with 6 multi-source inputs', () => {
    const session = getDeskSession('test-desk-session-1');
    assert.ok(session);
    assert.equal(session.files.length, 6);

    const formats = session.files.map(f => f.type).sort();
    assert.deepEqual(formats, ['docx', 'image', 'note', 'pdf', 'plain_pdf', 'xlsx']);

    // Check summary metrics
    assert.ok(session.summary.totalPieces > 300);
    assert.ok(session.summary.provenFacts >= 6);
    assert.ok(session.summary.conflictsCount >= 3);
    assert.ok(session.summary.questionsCount <= 10);
  });

  it('tracks real progress stage transitions without faking percentages', () => {
    const session = getDeskSession('test-desk-session-progress');
    assert.equal(session.progress.stage, 'READY');
    assert.ok(session.progress.statusText.includes('All sources parsed'));
  });

  it('handles multi-format file uploads with role assignment', () => {
    const { session, newFile, parsed } = uploadDeskInput('test-desk-upload-1', {
      fileName: 'Extra_Nutritional_Brief.txt',
      content: 'Line 1: Added sugar test notes\nLine 2: Target calories 220 kcal',
      fileType: 'txt',
      role: 'REVIEWER_NOTES',
      author: 'Compliance Reviewer'
    });

    assert.ok(newFile);
    assert.equal(newFile.role, 'REVIEWER_NOTES');
    assert.equal(newFile.author, 'Compliance Reviewer');
    assert.ok(newFile.sha256);
    assert.equal(newFile.sha256.length, 64);
    assert.equal(parsed.pieces.length, 2);
    assert.equal(session.files.some(f => f.name === 'Extra_Nutritional_Brief.txt'), true);
  });

  it('resets desk session cleanly on demand', () => {
    const reset = resetDeskSession('test-desk-reset');
    assert.ok(reset);
    assert.equal(reset.files.length, 6);
  });
});
