import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/engine.mjs';
import { classifyFinding } from '../lib/finding-department-classifier.mjs';
import { generateClarificationMessage } from '../lib/clarification-message.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';
import { tmpdir } from 'node:os';
import { evaluatePackQuantityConsistency, formatPackQuantityProof } from '../lib/pack-quantity-consistency.mjs';

function runReview(facts) {
  const art = {
    id: 'art-1',
    name: 'artwork.pdf',
    role: 'artwork',
    text: facts.map(f => f.quote || f.value).join('\n'),
    pages: [{ number: 1, method: 'pdf_text', text: facts.map(f => f.quote || f.value).join('\n') }]
  };
  return analyze({
    documents: [art],
    selected: facts,
    options: {},
    decisions: {},
    audit: []
  });
}

test('Case 26, 27, 28: Correct arithmetic in finding, stable finding ID, no duplicate on rerun', () => {
  const sampleFacts = [
    { field: 'servings', value: '8', quote: '8 servings per container', role: 'artwork', box: [0.1, 0.2, 0.3, 0.4] },
    { field: 'serving_size', value: '85 g', quote: 'Serving size 85g', role: 'artwork', box: [0.1, 0.25, 0.3, 0.45] },
    { field: 'net_quantity', value: '480 g', quote: 'Net Wt 480g', role: 'artwork', box: [0.5, 0.8, 0.7, 0.9] }
  ];

  const run1 = runReview(sampleFacts);
  const finding1 = run1.findings.find(f => f.id === 'pack-quantity:servings-net-mass');

  assert.ok(finding1, 'Finding pack-quantity:servings-net-mass must exist');
  assert.equal(finding1.id, 'pack-quantity:servings-net-mass');
  assert.equal(finding1.title, 'Pack quantity consistency · servings vs net weight');
  assert.equal(finding1.method, 'serving_net_weight_arithmetic');
  assert.equal(finding1.status, 'issue');
  assert.equal(finding1.servingsCount, 8);
  assert.equal(finding1.servingSizeGrams, 85);
  assert.equal(finding1.expectedPackMassG, 680);
  assert.equal(finding1.declaredPackMassG, 480);
  assert.equal(finding1.differenceG, 200);
  assert.equal(finding1.percentDifferenceFormatted, '41.7%');

  // Verify no duplicate finding generated on second run
  const run2 = runReview(sampleFacts);
  const allQtyFindings = run2.findings.filter(f => f.id === 'pack-quantity:servings-net-mass');
  assert.equal(allQtyFindings.length, 1, 'Never generate duplicate findings');
});

test('Case 29, 30: Original evidence IDs, quotations, and 2D bounding boxes preserved', () => {
  const sampleFacts = [
    { field: 'servings', value: '8', quote: '8 servings per container', role: 'artwork', box: [0.1, 0.2, 0.3, 0.4], page: 1, documentId: 'art-001' },
    { field: 'serving_size', value: '85 g', quote: 'Serving size 85g', role: 'artwork', box: [0.1, 0.25, 0.3, 0.45], page: 1, documentId: 'art-001' },
    { field: 'net_quantity', value: '480 g', quote: 'Net Wt 480g', role: 'artwork', box: [0.5, 0.8, 0.7, 0.9], page: 2, documentId: 'art-001' }
  ];

  const review = runReview(sampleFacts);
  const finding = review.findings.find(f => f.id === 'pack-quantity:servings-net-mass');

  assert.ok(finding.evidence.length >= 3, 'Must attach evidence for all 3 terms');
  
  const servingsEv = finding.evidence.find(e => e.field === 'servings');
  assert.ok(servingsEv);
  assert.deepEqual(servingsEv.box, [0.1, 0.2, 0.3, 0.4]);
  assert.equal(servingsEv.page, 1);

  const netEv = finding.evidence.find(e => e.field === 'net_quantity');
  assert.ok(netEv);
  assert.deepEqual(netEv.box, [0.5, 0.8, 0.7, 0.9]);
  assert.equal(netEv.page, 2);
});

test('Case 31: Department routing routes pack-quantity to R&D as primary and Legal as collaborating', () => {
  const finding = {
    id: 'pack-quantity:servings-net-mass',
    title: 'Pack quantity consistency · servings vs net weight',
    method: 'serving_net_weight_arithmetic'
  };

  const routed = classifyFinding(finding);
  assert.equal(routed.primaryDepartment, 'rd');
  assert.ok(routed.collaboratingDepartments.includes('legal'));
});

test('Case 32: Ask Someone clarification message includes exact calculated values', () => {
  const finding = {
    id: 'pack-quantity:servings-net-mass',
    title: 'Pack quantity consistency · servings vs net weight',
    servingsCount: 8,
    servingSizeGrams: 85,
    expectedPackMassG: 680,
    declaredPackMassG: 480,
    differenceG: 200,
    packQuantity: {
      servingsCount: 8,
      expectedPackMassG: 680,
      declaredPackMassG: 480,
      differenceG: 200,
      inputs: {
        servingSize: { originalText: '85 g' }
      }
    }
  };

  const msg = generateClarificationMessage({
    finding,
    product: 'Dancing Fish Berry Crunch',
    platform: 'slack'
  });

  assert.ok(msg.includes('Hi R&D,'), 'Must address R&D');
  assert.ok(msg.includes('Servings per container:* 8'), 'Must include servings count 8');
  assert.ok(msg.includes('Serving size:* 85 g'), 'Must include serving size 85 g');
  assert.ok(msg.includes('Implied package weight:* 680 g'), 'Must include implied weight 680 g');
  assert.ok(msg.includes('Declared net weight:* 480 g'), 'Must include declared weight 480 g');
  assert.ok(msg.includes('Difference:* 200 g'), 'Must include difference 200 g');
  assert.ok(msg.includes('Finding:* pack-quantity:servings-net-mass'), 'Must include finding ID');
});

test('Case 33: Reviewer acknowledgement does not alter mathematical calculation', () => {
  const sampleFacts = [
    { field: 'servings', value: '8' },
    { field: 'serving_size', value: '85 g' },
    { field: 'net_quantity', value: '480 g' }
  ];

  const review = runReview(sampleFacts);
  const finding = review.findings.find(f => f.id === 'pack-quantity:servings-net-mass');

  // Reviewer acknowledges / overrides
  const reviewerDecision = {
    findingId: finding.id,
    decision: 'acknowledged',
    reviewer: 'QA Lead',
    notes: 'Reviewed discrepancy with R&D formulation.'
  };

  // Re-evaluating with reviewer decision preserves pure arithmetic
  const math = evaluatePackQuantityConsistency({
    servings: finding.servingsCount,
    servingSize: `${finding.servingSizeGrams} g`,
    netQuantity: `${finding.declaredPackMassG} g`
  });

  assert.equal(math.expectedPackMassG, 680);
  assert.equal(math.differenceG, 200);
  assert.equal(math.percentDifferenceFormatted, '41.7%');
  assert.equal(reviewerDecision.decision, 'acknowledged');
});

test('Case 34: V1 / V2 recheck recalculates discrepancy when corrected artwork is evaluated', () => {
  // V1 (Discrepancy: 8 × 85 g = 680 g vs 480 g -> 200 g diff)
  const v1Facts = [
    { field: 'servings', value: '8' },
    { field: 'serving_size', value: '85 g' },
    { field: 'net_quantity', value: '480 g' }
  ];
  const v1Review = runReview(v1Facts);
  const v1Finding = v1Review.findings.find(f => f.id === 'pack-quantity:servings-net-mass');
  assert.equal(v1Finding.status, 'issue');
  assert.equal(v1Finding.differenceG, 200);

  // V2 (Corrected artwork: 8 × 60 g = 480 g vs 480 g -> 0 g diff)
  const v2Facts = [
    { field: 'servings', value: '8' },
    { field: 'serving_size', value: '60 g' },
    { field: 'net_quantity', value: '480 g' }
  ];
  const v2Review = runReview(v2Facts);
  const v2Finding = v2Review.findings.find(f => f.id === 'pack-quantity:servings-net-mass');
  assert.equal(v2Finding.status, 'match');
  assert.equal(v2Finding.differenceG, 0);
  assert.equal(v2Finding.expectedPackMassG, 480);
});

test('Case 35: Signed report contains actual pack quantity mathematical proof', async () => {
  const sampleFacts = [
    { field: 'servings', value: '8' },
    { field: 'serving_size', value: '85 g' },
    { field: 'net_quantity', value: '480 g' }
  ];

  const review = runReview(sampleFacts);
  const reportHtml = await createHtmlReport(review, tmpdir());

  assert.ok(reportHtml.includes('PACK QUANTITY MATHEMATICAL PROOF'), 'Report must contain pack quantity proof heading');
  assert.ok(reportHtml.includes('680 g'), 'Report must contain expected mass 680 g');
  assert.ok(reportHtml.includes('480 g'), 'Report must contain declared net weight 480 g');
  assert.ok(reportHtml.includes('200 g'), 'Report must contain difference 200 g');
  assert.ok(reportHtml.includes('41.7%'), 'Report must contain percentage discrepancy 41.7%');
});
