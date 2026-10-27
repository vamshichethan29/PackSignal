/**
 * PackSignal Finding Basis Classifier (lib/finding-basis.mjs)
 * Implements Phase 14: Distinguishes deterministic code, AI extraction, AI interpretation, and human review.
 */

export const FINDING_BASIS = {
  DETERMINISTIC_CHECK: 'DETERMINISTIC_CHECK',
  AI_EXTRACTION_PLUS_DETERMINISTIC_CHECK: 'AI_EXTRACTION_PLUS_DETERMINISTIC_CHECK',
  AI_ASSISTED_INTERPRETATION: 'AI_ASSISTED_INTERPRETATION',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  TECHNICAL_SCREENING: 'TECHNICAL_SCREENING',
  UNSUPPORTED: 'UNSUPPORTED',
};

/**
 * Assigns an explicit finding basis record to a finding.
 */
export function classifyFindingBasis({
  findingType = '',
  extractionMethod = 'pdf_text', // pdf_text, ocr, ai_vision
  evaluator = 'deterministic',   // deterministic, screening, ai_prompt, human
  reviewerConfirmed = false,
  unresolved = false,
}) {
  let basis = FINDING_BASIS.DETERMINISTIC_CHECK;

  if (unresolved) {
    basis = FINDING_BASIS.HUMAN_REVIEW;
  } else if (evaluator === 'human' || reviewerConfirmed) {
    basis = FINDING_BASIS.HUMAN_REVIEW;
  } else if (evaluator === 'screening' || findingType.startsWith('PVP_')) {
    basis = FINDING_BASIS.TECHNICAL_SCREENING;
  } else if (evaluator === 'ai_prompt') {
    basis = FINDING_BASIS.AI_ASSISTED_INTERPRETATION;
  } else if (['ocr', 'ai_vision', 'vision_needed'].includes(extractionMethod)) {
    basis = FINDING_BASIS.AI_EXTRACTION_PLUS_DETERMINISTIC_CHECK;
  } else if (evaluator === 'deterministic') {
    basis = FINDING_BASIS.DETERMINISTIC_CHECK;
  } else {
    basis = FINDING_BASIS.UNSUPPORTED;
  }

  return {
    basis,
    machineExtracted: extractionMethod === 'pdf_text' ? 'Native PDF text and vector coordinates' : 'Vision or OCR transcription',
    codeCalculated: evaluator === 'deterministic' ? 'Deterministic arithmetic or token comparison' : 'Screening heuristic or threshold check',
    aiSuggested: ['ocr', 'ai_vision', 'ai_prompt'].includes(extractionMethod) || evaluator === 'ai_prompt',
    reviewerConfirmed,
    unresolved,
  };
}
