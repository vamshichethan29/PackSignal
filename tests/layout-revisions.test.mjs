/**
 * @file layout-revisions.test.mjs
 * 
 * Unit tests for layout state persistence, audit trail revisions, and JSON proof export.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  buildLayoutState, 
  saveLayoutRevision, 
  getSavedLayoutRevisions, 
  generateLayoutProposalExport 
} from '../lib/pack-canvas/layout-state.mjs';

test('Layout State & Revisions: buildLayoutState handles standard, overflow, and India scenarios', () => {
  // Scenario 1: Standard
  const stdState = buildLayoutState({ scenario: 'standard' });
  assert.equal(stdState.hasOverflow, false);
  assert.equal(stdState.validation.valid, true);

  // Scenario 2: Controlled Overflow
  const ovState = buildLayoutState({ scenario: 'overflow' });
  assert.equal(ovState.hasOverflow, true);
  assert.equal(ovState.overflowPanelId, 'panel-back');
  assert.ok(ovState.suggestedFixes.length >= 2);

  // Scenario 3: India
  const inState = buildLayoutState({ market: 'IN' });
  assert.equal(inState.market, 'IN');
  const netQty = inState.blocks.find(b => b.category === 'NET_QUANTITY');
  assert.ok(netQty.text.includes('480 g'));
  assert.ok(!netQty.text.includes('16.9 OZ'), 'US customary units must be removed for India');
});

test('Layout State & Revisions: saveLayoutRevision stores immutable snapshot in registry', () => {
  const state = buildLayoutState({ scenario: 'standard' });
  const revision = saveLayoutRevision(state, 'Senior Packaging Reviewer', 'Signoff on standard US layout');

  assert.ok(revision.revisionId.startsWith('REV-PACK-CANVAS-'));
  assert.equal(revision.author, 'Senior Packaging Reviewer');
  assert.equal(revision.validationPassed, true);
  assert.ok(revision.checksum.length === 64);

  const allRevisions = getSavedLayoutRevisions();
  assert.ok(allRevisions.some(r => r.revisionId === revision.revisionId));
});

test('Layout State & Revisions: generateLayoutProposalExport creates complete prepress manifest', () => {
  const state = buildLayoutState({ scenario: 'standard' });
  const exportDoc = generateLayoutProposalExport(state);

  assert.equal(exportDoc.exportType, 'PACKSIGNAL_PACK_CANVAS_PROPOSAL_V1');
  assert.ok(exportDoc.sha256.length === 64);
  assert.equal(exportDoc.specification.package, 'Dancing Fish Berry Crunch Granola Folding Carton');
  assert.equal(exportDoc.panelMetrics.length, 6);
  assert.equal(exportDoc.placedBlocksSummary.length, 10);
  assert.equal(exportDoc.validationReport.passed, true);
});
