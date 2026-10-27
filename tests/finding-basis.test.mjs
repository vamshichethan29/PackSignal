import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFindingBasis, FINDING_BASIS } from '../lib/finding-basis.mjs';

test('classifyFindingBasis distinguishes deterministic checks, AI extraction, and technical screening', () => {
  const detBasis = classifyFindingBasis({
    extractionMethod: 'pdf_text',
    evaluator: 'deterministic',
  });
  assert.equal(detBasis.basis, FINDING_BASIS.DETERMINISTIC_CHECK);
  assert.equal(detBasis.aiSuggested, false);

  const aiDetBasis = classifyFindingBasis({
    extractionMethod: 'ai_vision',
    evaluator: 'deterministic',
  });
  assert.equal(aiDetBasis.basis, FINDING_BASIS.AI_EXTRACTION_PLUS_DETERMINISTIC_CHECK);
  assert.equal(aiDetBasis.aiSuggested, true);

  const screeningBasis = classifyFindingBasis({
    findingType: 'PVP_002',
    evaluator: 'screening',
  });
  assert.equal(screeningBasis.basis, FINDING_BASIS.TECHNICAL_SCREENING);

  const humanBasis = classifyFindingBasis({
    unresolved: true,
  });
  assert.equal(humanBasis.basis, FINDING_BASIS.HUMAN_REVIEW);
});
