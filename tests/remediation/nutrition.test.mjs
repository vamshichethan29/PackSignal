import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  remediateNutritionFacts,
  remediateCalorieFacts,
  identifyNutrientKey,
  FDA_2016_DAILY_VALUES,
  EU_1169_REFERENCE_INTAKES,
  FSSAI_DAILY_VALUES,
} from '../../lib/remediation/nutrition.mjs';
import { generateRemediation } from '../../lib/remediation/index.mjs';

test('Nutrition Remediation: CASE 5 — Sodium 230 mg, applicable DV 2300 mg, artwork showing 15% DV computes 10% DV with formula', async () => {
  const finding = {
    id: 'f-sodium-dv',
    title: 'Sodium Daily Value Discrepancy',
    observed: 'Sodium 230 mg — 15% DV',
    expected: 'Sodium 230 mg',
  };

  const review = {
    documents: [{ id: 'spec-1', role: 'spec', name: 'Product Spec.pdf' }],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-sodium-dv');

  assert.equal(proposal.mode, 'DETERMINISTIC_CALCULATION');
  assert.equal(proposal.proposedText, 'Sodium 230 mg — 10% DV');
  assert.ok(proposal.calculation);
  assert.equal(proposal.calculation.nutrient, 'Sodium');
  assert.equal(proposal.calculation.computedPercent, 10);
  assert.equal(proposal.calculation.dailyValueRef, '2300 mg');
  assert.ok(proposal.calculation.formula.includes('230 mg / 2300 mg × 100 = 10.0%'));
  assert.ok(proposal.calculation.citation.includes('21 CFR 101.9'));
});

test('Nutrition Remediation: CASE 6 — Nutrition serving basis unknown refuses to invent percentage and returns NEEDS_EVIDENCE', async () => {
  const finding = {
    id: 'f-unknown-basis',
    title: 'Sodium %DV (Serving basis unknown)',
    observed: 'Sodium 230 mg — 15% DV',
    servingBasisUnknown: true,
  };

  const review = {
    documents: [{ id: 'spec-1', role: 'spec', name: 'Spec.pdf' }],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-unknown-basis');

  assert.equal(proposal.status, 'NEEDS_EVIDENCE');
  assert.equal(proposal.proposedText, '');
  assert.ok(proposal.reasoningSummary.includes('serving basis unknown'));
  assert.ok(proposal.blockers.length >= 1);
});

test('Nutrition Remediation: CASE 7 — Calories differ from 4-4-9 estimate produces screening result not legal failure', async () => {
  const finding = {
    id: 'f-cal-plausibility',
    title: 'Calorie Plausibility Variance',
    observed: '250 Calories',
  };

  const review = {
    documents: [{ id: 'spec-1', role: 'spec', name: 'Spec.pdf' }],
    findings: [finding],
    deepVerification: {
      nutritionAudit: {
        macronutrients: { fat: 10, carbohydrate: 25, protein: 5 }, // 10*9 + 25*4 + 5*4 = 90 + 100 + 20 = 210
      },
    },
  };

  const proposal = await generateRemediation(review, 'f-cal-plausibility');

  assert.equal(proposal.mode, 'CALORIE_ESTIMATE');
  assert.ok(proposal.proposedText.includes('210 Calories'));
  assert.equal(proposal.calculation.isScreeningEstimate, true);
  assert.ok(proposal.calculation.toleranceNote.includes('screening heuristic'));
  assert.ok(proposal.reasoningSummary.includes('Reviewer screening result, not a definitive legal failure'));
});

test('Nutrition Remediation: Confirmed specification calories directly used as APPROVED_CALORIE_VALUE', async () => {
  const finding = {
    id: 'f-cal-approved',
    title: 'Calorie Count Discrepancy',
    observed: '180 Calories',
    expected: '200',
  };

  const review = {
    documents: [{ id: 'spec-1', role: 'spec', name: 'Nutrition Spec.pdf' }],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-cal-approved');

  assert.equal(proposal.mode, 'APPROVED_CALORIE_VALUE');
  assert.equal(proposal.proposedText, '200 Calories');
});

test('Nutrition Remediation: EU and India Daily Reference Values applied correctly', () => {
  // EU Total Fat: 70g
  const euFinding = { id: 'f-eu', observed: 'Fat 35g — 60% RI' };
  const euResult = remediateNutritionFacts(euFinding, {}, { targetMarket: 'EU', amount: 35, unit: 'g' });
  assert.equal(euResult.success, true);
  assert.equal(euResult.calculation.computedPercent, 50);
  assert.ok(euResult.calculation.citation.includes('Regulation (EU) 1169/2011'));

  // India FSSAI Total Fat: 67g
  const inFinding = { id: 'f-in', observed: 'Fat 33.5g' };
  const inResult = remediateNutritionFacts(inFinding, {}, { targetMarket: 'IN', amount: 33.5, unit: 'g' });
  assert.equal(inResult.success, true);
  assert.equal(inResult.calculation.computedPercent, 50);
  assert.ok(inResult.calculation.citation.includes('FSSAI 2020'));
});
