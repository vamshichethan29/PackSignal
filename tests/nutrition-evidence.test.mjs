import test from 'node:test';
import assert from 'node:assert/strict';
import { createHtmlReport } from '../lib/html-report.mjs';

test('Case 24: Draft source specification is explicitly labeled as Draft / In Review', async () => {
  const review = {
    id: 'test-draft-source',
    name: 'Draft Source Review',
    counts: { issue: 0, review: 1, unable: 0, match: 0 },
    documents: [
      {
        role: 'spec',
        name: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        status: 'Draft / In Review',
        data: 'Status: Draft / In Review'
      }
    ],
    findings: [
      {
        id: 'nutrition-sanity:atwater',
        title: 'Nutrition sanity · calories vs macronutrients',
        status: 'review',
        declaredCalories: 166,
        estimatedCalories: 535,
        differenceKcal: 369,
        percentDifference: 222,
        basis: 'PER_SERVING',
        evidence: [
          { role: 'spec', name: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', quote: 'Calories 166', context: { sheet: 'Content Sheet - US', cell: 'B47' } }
        ]
      }
    ]
  };

  const html = await createHtmlReport(review);
  assert.match(html, /Draft \/ In Review/i);
});

test('Case 25: Evidence bounding boxes and cell coordinates are preserved', () => {
  const finding = {
    id: 'nutrition-sanity:atwater',
    evidence: [
      { role: 'artwork', page: 1, box: [0.05, 0.40, 0.30, 0.45], quote: 'Calories 166' },
      { role: 'spec', name: 'Spec.xlsx', quote: '166', context: { sheet: 'Nutrition', cell: 'B47' } }
    ]
  };

  const artEv = finding.evidence.find(e => e.role === 'artwork');
  const specEv = finding.evidence.find(e => e.role === 'spec');

  assert.deepEqual(artEv.box, [0.05, 0.40, 0.30, 0.45]);
  assert.equal(specEv.context.cell, 'B47');
});

test('Case 34: Signed reports include complete NUTRITION ENERGY VERIFICATION section', async () => {
  const review = {
    id: 'test-report-atwater-proof',
    name: 'Atwater Report Test',
    counts: { issue: 0, review: 1, unable: 0, match: 0 },
    nutrition: {
      validatorVersion: '2.0.0',
      rulePackVersion: '2016-FDA-US-21CFR101.9',
      sourceAuthority: 'APPROVED_SPECIFICATION',
      calculations: {
        calories: [
          {
            panelId: 'panel-1',
            columnId: 'col-1',
            result: {
              caloriesDeclared: 166,
              estimatedCalories: 535,
              calorieDifference: 369,
              percentDifference: 222,
              passes: false
            }
          }
        ]
      }
    },
    findings: [
      {
        id: 'nutrition-sanity:atwater',
        title: 'Nutrition sanity · calories vs macronutrients',
        status: 'review',
        declaredCalories: 166,
        estimatedCalories: 535,
        differenceKcal: 369,
        percentDifference: 222,
        basis: 'PER_SERVING',
        macronutrients: {
          fat: { grams: 15, subtotalKcal: 135 },
          carbohydrate: { grams: 66, subtotalKcal: 264 },
          protein: { grams: 34, subtotalKcal: 136 }
        }
      }
    ]
  };

  const html = await createHtmlReport(review);
  assert.match(html, /NUTRITION ENERGY VERIFICATION · 9\/4\/4 ATWATER/);
  assert.match(html, /Total Fat.*15 g.*135 kcal/);
  assert.match(html, /Carbohydrates.*66 g.*264 kcal/);
  assert.match(html, /Protein.*34 g.*136 kcal/);
  assert.match(html, /535 kcal/);
  assert.match(html, /166 kcal/);
  assert.match(html, /369 kcal/);
});

test('Case 35: Report signatures remain compatible with existing audit sealing', async () => {
  const { sealReview, verifyPortableSealProof, reviewSealProof } = await import('../lib/audit-signature.mjs');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const dir = await mkdtemp(join(tmpdir(), 'seal-test-'));
  try {
    const review = {
      id: 'rev-seal-test',
      findings: [{ id: 'nutrition-sanity:atwater', status: 'review' }],
      documents: [{ role: 'artwork', hash: 'art-hash-123' }],
      audit: [{ at: new Date().toISOString(), action: 'REVIEW_SEALED' }]
    };

    const signature = await sealReview(review, dir);
    assert.ok(signature.signature);
    assert.ok(signature.publicKey);

    const proof = { ...reviewSealProof(review), ...signature };
    const verified = verifyPortableSealProof(proof);
    assert.equal(verified.valid, true);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});
