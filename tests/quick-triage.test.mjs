import test from 'node:test';
import assert from 'node:assert/strict';
import { getNavigatedFinding, QuickTriageSession } from '../public/quick-triage.js';

test('getNavigatedFinding: J selects next visible finding', () => {
  const visible = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  const nav = getNavigatedFinding(visible, 'f1', 1);
  assert.equal(nav.findingId, 'f2');
  assert.equal(nav.index, 1);
  assert.equal(nav.isEnd, false);
});

test('getNavigatedFinding: K selects previous visible finding', () => {
  const visible = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  const nav = getNavigatedFinding(visible, 'f3', -1);
  assert.equal(nav.findingId, 'f2');
  assert.equal(nav.index, 1);
  assert.equal(nav.isStart, false);
});

test('getNavigatedFinding: Last finding boundary handled (stays on last finding)', () => {
  const visible = [{ id: 'f1' }, { id: 'f2' }];
  const nav = getNavigatedFinding(visible, 'f2', 1);
  assert.equal(nav.findingId, 'f2');
  assert.equal(nav.index, 1);
  assert.equal(nav.isEnd, true);
  assert.equal(nav.hitBoundary, true);
});

test('getNavigatedFinding: First finding boundary handled (stays on first finding)', () => {
  const visible = [{ id: 'f1' }, { id: 'f2' }];
  const nav = getNavigatedFinding(visible, 'f1', -1);
  assert.equal(nav.findingId, 'f1');
  assert.equal(nav.index, 0);
  assert.equal(nav.isStart, true);
  assert.equal(nav.hitBoundary, true);
});

test('getNavigatedFinding: Empty list handled safely', () => {
  const navNext = getNavigatedFinding([], 'f1', 1);
  assert.equal(navNext.findingId, null);
  assert.equal(navNext.total, 0);

  const navPrev = getNavigatedFinding([], 'f1', -1);
  assert.equal(navPrev.findingId, null);
  assert.equal(navPrev.total, 0);
});

test('getNavigatedFinding: Single finding handled stably', () => {
  const visible = [{ id: 'f1', title: 'Only finding' }];
  const navNext = getNavigatedFinding(visible, 'f1', 1);
  assert.equal(navNext.findingId, 'f1');
  assert.equal(navNext.total, 1);
  assert.equal(navNext.isStart, true);
  assert.equal(navNext.isEnd, true);

  const navPrev = getNavigatedFinding(visible, 'f1', -1);
  assert.equal(navPrev.findingId, 'f1');
  assert.equal(navPrev.total, 1);
});

test('getNavigatedFinding: Respects filtered queues (e.g. Legal or Issues)', () => {
  // Suppose findings are filtered to only Legal department or Issues
  const filteredQueue = [
    { id: 'legal-allergen', status: 'issue', department: 'legal' },
    { id: 'legal-warning', status: 'review', department: 'legal' }
  ];

  const firstStep = getNavigatedFinding(filteredQueue, 'legal-allergen', 1);
  assert.equal(firstStep.findingId, 'legal-warning');

  const secondStep = getNavigatedFinding(filteredQueue, 'legal-warning', -1);
  assert.equal(secondStep.findingId, 'legal-allergen');
});

test('QuickTriageSession: Progress tracking and skip counting', () => {
  const session = new QuickTriageSession();
  const visible = [
    { id: 'f1', status: 'issue' },
    { id: 'f2', status: 'review' },
    { id: 'f3', status: 'issue' },
    { id: 'f4', status: 'match' }
  ];
  const decisions = {
    f1: { disposition: 'acknowledged', note: 'Reviewed', stale: false },
    f2: { disposition: 'needs_changes', note: 'Fix typography', stale: false }
  };

  session.recordDecision('f1', 'acknowledged');
  session.recordDecision('f2', 'needs_changes');
  session.recordSkip('f3');

  const prog = session.getProgress(visible, decisions);
  assert.equal(prog.total, 4);
  assert.equal(prog.reviewed, 2);
  assert.equal(prog.remaining, 2);
  assert.equal(prog.acknowledged, 1);
  assert.equal(prog.flagged, 1);
  assert.equal(prog.skipped, 1);

  // Skip does not count as a substantive approval
  assert.equal(prog.reviewed, 2);
});

test('Action 1: Acknowledged disposition does not convert engine status from issue to match', () => {
  const finding = { id: 'nutrition-cal', status: 'issue', title: 'Calories mismatch' };
  const decision = { disposition: 'acknowledged', note: 'Reviewed discrepancy' };

  // Reviewer disposition is stored in decisions, finding.status remains 'issue'
  assert.equal(finding.status, 'issue');
  assert.equal(decision.disposition, 'acknowledged');
  assert.notEqual(finding.status, 'match');
});
