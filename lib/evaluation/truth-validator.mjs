/**
 * PackSignal Ground Truth & Fixture Validator (lib/evaluation/truth-validator.mjs)
 * Phase 8: Rigorously verifies that planted mutations actually occurred in input artifacts,
 * clean controls remain unmutated, and protected keys are never leaked to public inputs.
 */

import { EXPECTED_OUTCOMES } from './case-schema.mjs';

/**
 * Validates a generated case against mutation integrity criteria.
 *
 * @param {Object} evalCase
 * @returns {{ valid: boolean, reasons: string[], isEligible: boolean }}
 */
export function validateFixtureIntegrity(evalCase) {
  const reasons = [];

  if (!evalCase || typeof evalCase !== 'object') {
    return { valid: false, reasons: ['Case object is missing or null'], isEligible: false };
  }

  // Check 1: Mandatory Schema Identity
  if (!evalCase.caseId) {
    reasons.push('Missing caseId');
  }
  if (!evalCase.expectedOutcome) {
    reasons.push('Missing expectedOutcome');
  }

  // Check 2: Mutation verification
  const manifest = evalCase.metadata?.mutationManifest;
  if (manifest) {
    if (evalCase.expectedOutcome === EXPECTED_OUTCOMES.ISSUE) {
      if (manifest.originalHash && manifest.generatedHash && manifest.originalHash === manifest.generatedHash) {
        reasons.push('Mutation failed: Generated content hash is identical to original baseline hash for a planted defect');
      }
    } else if (evalCase.expectedOutcome === EXPECTED_OUTCOMES.MATCH) {
      // For clean controls, ensure no unintended defect text
      if (evalCase.artwork && evalCase.reference) {
        const artText = Array.isArray(evalCase.artwork) ? evalCase.artwork.join(' ') : String(evalCase.artwork);
        // Clean controls should not have obvious defect banners like [HIDDEN_LAYER]
        if (artText.includes('[HIDDEN_LAYER]')) {
          reasons.push('Unintended defect token found in clean control fixture');
        }
      }
    }
  }

  // Check 3: Artwork presence
  if (evalCase.kind !== 'revision') {
    if (!evalCase.artwork || (Array.isArray(evalCase.artwork) && evalCase.artwork.length === 0)) {
      reasons.push('Artwork lines array is empty or undefined');
    }
  } else {
    if (!evalCase.before || !evalCase.after) {
      reasons.push('Revision case requires both before and after artwork states');
    }
  }

  const valid = reasons.length === 0;
  return {
    valid,
    reasons,
    isEligible: valid,
  };
}

/**
 * Checks that a review or model input does NOT contain leaked ground truth.
 *
 * @param {Object} modelInput
 * @returns {{ leaked: boolean, violations: string[] }}
 */
export function checkGroundTruthProtection(modelInput) {
  const violations = [];
  const serialized = JSON.stringify(modelInput || {});

  const forbiddenKeys = [
    'expectedOutcome',
    'expectedRuleId',
    'mutationManifest',
    'scoringKey',
    'goldenAnswers',
    'plantedDefect',
  ];

  for (const key of forbiddenKeys) {
    if (serialized.includes(`"${key}"`)) {
      violations.push(`Leaked protected evaluation field in model input: "${key}"`);
    }
  }

  return {
    leaked: violations.length > 0,
    violations,
  };
}
