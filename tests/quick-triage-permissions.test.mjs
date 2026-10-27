import test from 'node:test';
import assert from 'node:assert/strict';
import { canReviewFinding, setFindingAssignment } from '../lib/team-review.mjs';

const admin = { id: 'admin-user', displayName: 'Workspace Admin', role: 'admin' };
const reviewer1 = { id: 'rev-1', displayName: 'Assigned Reviewer', role: 'reviewer' };
const reviewer2 = { id: 'rev-2', displayName: 'Unassigned Reviewer', role: 'reviewer' };
const readOnlyUser = { id: 'viewer-1', displayName: 'Guest Auditor', role: 'viewer' };

const finding1 = { id: 'nut-01', title: 'Sugar declaration', evidence: [] };
const finding2 = { id: 'bar-01', title: 'Barcode check', evidence: [] };

const createReview = () => ({
  id: 'triage-review-1',
  findings: [finding1, finding2],
  decisions: {},
  team: {
    createdBy: 'admin-user',
    assignments: {
      'nut-01': { reviewerIds: ['rev-1'] }
    },
    comments: [],
    approvals: [],
    assignmentHistory: []
  }
});

test('Quick Triage Permissions: Admin has triage permission for all findings', () => {
  const r = createReview();
  assert.equal(canReviewFinding(r, 'nut-01', admin), true);
  assert.equal(canReviewFinding(r, 'bar-01', admin), true);
});

test('Quick Triage Permissions: Assigned reviewer has permission only for assigned findings', () => {
  const r = createReview();
  assert.equal(canReviewFinding(r, 'nut-01', reviewer1), true);
  assert.equal(canReviewFinding(r, 'bar-01', reviewer1), false);
});

test('Quick Triage Permissions: Unassigned reviewer cannot mutate decisions on unassigned findings', () => {
  const r = createReview();
  assert.equal(canReviewFinding(r, 'nut-01', reviewer2), false);
  assert.equal(canReviewFinding(r, 'bar-01', reviewer2), false);
});

test('Quick Triage Permissions: Read-only viewer is denied decision mutation on all findings', () => {
  const r = createReview();
  assert.equal(canReviewFinding(r, 'nut-01', readOnlyUser), false);
  assert.equal(canReviewFinding(r, 'bar-01', readOnlyUser), false);
});

test('Quick Triage Permissions: Reassignment grants access immediately', () => {
  const r = createReview();
  assert.equal(canReviewFinding(r, 'bar-01', reviewer2), false);
  setFindingAssignment(r, 'bar-01', [reviewer2.id], admin, [reviewer1, reviewer2]);
  assert.equal(canReviewFinding(r, 'bar-01', reviewer2), true);
});
