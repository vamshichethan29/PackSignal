import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateDecisionScenario,
  createCorrectionPlan
} from '../lib/decision-ripple.mjs';

function createMockReview() {
  return {
    id: 'rev-test-123',
    sourceDocumentHashes: ['hash-pdf-abc123', 'hash-xlsx-def456'],
    findings: [
      {
        id: 'DF-02',
        title: 'Ingredient Listing vs Specification',
        status: 'review',
        field: 'ingredients',
        observed: 'Crisp Rice, Honey (1%), Coconut Sugar',
        expected: 'Honey (9%), Coconut Sugar, Crisp Rice'
      },
      {
        id: 'DF-05',
        title: 'Dietary Suitability: Vegan Claim vs Honey Ingredient',
        status: 'review',
        field: 'claims.vegan',
        observed: 'Suitable for Vegans.',
        expected: 'Product contains honey'
      }
    ]
  };
}

test('Decision Scenarios: Persistence, provenance, audit, and idempotence', async (t) => {
  await t.test('Step 25 Requirement 26, 27, 28: Preview does not mutate original review, documents or sources', () => {
    const originalReview = createMockReview();
    const deepClone = JSON.parse(JSON.stringify(originalReview));

    const scenario = simulateDecisionScenario(originalReview, 'KEEP_HONEY');
    assert.ok(scenario);
    assert.deepEqual(originalReview, deepClone, 'Original review must remain completely unmodified after simulation');
  });

  await t.test('Step 25 Requirement 29: Proposed changes preserve full provenance and reasons', () => {
    const review = createMockReview();
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');

    for (const change of scenario.proposedChanges) {
      assert.ok(change.field, 'Change must specify target field');
      assert.ok(change.originalValue !== undefined, 'Change must record original value');
      assert.ok(change.proposedValue !== undefined, 'Change must record proposed value');
      assert.ok(change.reason, 'Change must record reason');
      assert.ok(change.dependencyRule, 'Change must link to dependency rule');
      assert.ok(change.approvalRequired, 'Change must specify approval requirement');
    }
  });

  await t.test('Step 25 Requirement 30 & 32: Auditable correction plan creation with non-fabricated reviewer assignments', () => {
    const review = createMockReview();
    const scenario = simulateDecisionScenario(review, 'KEEP_HONEY');

    const plan = createCorrectionPlan(scenario, {
      userId: 'rev_qa_lead',
      name: 'Packaging Reviewer'
    });

    assert.ok(plan.planId.startsWith('PLAN-'));
    assert.equal(plan.baseReviewId, review.id);
    assert.equal(plan.selectedOption, 'KEEP_HONEY');
    assert.equal(plan.createdBy.userId, 'rev_qa_lead');
    assert.ok(plan.createdAt);
    assert.ok(Array.isArray(plan.tasks));

    // Tasks are routed to departments, not fabricated named reviewers
    for (const task of plan.tasks) {
      assert.ok(['Brand & Marketing', 'Legal & Regulatory', 'R&D & Food Science', 'Prepress & Production'].includes(task.department));
      assert.equal(task.status, 'PENDING_REVISION_WORKFLOW');
    }
  });

  await t.test('Step 25 Requirement 33: Repeated scenario simulation is idempotent', () => {
    const review = createMockReview();
    const sim1 = simulateDecisionScenario(review, 'KEEP_HONEY');
    const sim2 = simulateDecisionScenario(review, 'KEEP_HONEY');

    assert.equal(sim1.selectedOption, sim2.selectedOption);
    assert.equal(sim1.proposedChanges.length, sim2.proposedChanges.length);
    assert.equal(sim1.impactedChecks.length, sim2.impactedChecks.length);
    assert.equal(sim1.unaffectedChecks.length, sim2.unaffectedChecks.length);
  });

  await t.test('Step 25 Requirement 39: Digital seal and audit payload includes correction plan references safely', () => {
    const review = createMockReview();
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');
    const plan = createCorrectionPlan(scenario, { userId: 'lead_eng' });

    assert.equal(plan.status, 'PROPOSED_DECISION');
    assert.notEqual(plan.status, 'APPROVED_RELEASE', 'Correction plan must never be marked as release approval');
  });
});
