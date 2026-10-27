/**
 * PackSignal Mathematical Proof Records (lib/nutrition/proof.mjs)
 * Generates immutable, inspectable mathematical proofs for every executed calculation.
 */

import { createHash } from 'node:crypto';

export function createCalculationProof({
  checkId,
  nutrientId,
  formulaId,
  formulaVersion = 1,
  inputValues = {},
  inputUnits = {},
  normalizedValues = {},
  conversionSteps = [],
  dailyValueReference = null,
  servingBasis = 'per_serving',
  roundingSteps = [],
  unroundedResult = null,
  displayedExpectedResult = null,
  printedResult = null,
  comparisonOutcome = 'review',
  limitations = '',
  sourceEvidence = null,
  artworkEvidence = null
}) {
  const hashPayload = JSON.stringify({
    checkId,
    nutrientId,
    formulaId,
    inputValues,
    normalizedValues,
    displayedExpectedResult,
    printedResult
  });

  const proofId = 'proof_' + createHash('sha256').update(hashPayload).digest('hex').slice(0, 16);

  return {
    proofId,
    checkId,
    nutrientId,
    formulaId,
    formulaVersion,
    inputValues,
    inputUnits,
    normalizedValues,
    conversionSteps,
    dailyValueReference,
    servingBasis,
    roundingSteps,
    unroundedResult,
    displayedExpectedResult,
    printedResult,
    comparisonOutcome,
    limitations,
    sourceEvidence,
    artworkEvidence,
    generatedAt: new Date().toISOString()
  };
}

export function formatProofAsText(proof) {
  if (!proof) return 'No proof record available.';
  const lines = [
    `PROOF [${proof.proofId}]: ${proof.nutrientId.toUpperCase()} (${proof.formulaId})`,
    `Outcome: ${String(proof.comparisonOutcome).toUpperCase()}`,
    `Inputs: ${Object.entries(proof.inputValues || {}).map(([k, v]) => `${k}=${v} ${proof.inputUnits?.[k] || ''}`).join(', ')}`
  ];

  if (proof.conversionSteps?.length) {
    lines.push(`Conversions: ${proof.conversionSteps.join(' -> ')}`);
  }

  if (proof.dailyValueReference) {
    lines.push(`Reference Standard: ${proof.dailyValueReference.standardValue} ${proof.dailyValueReference.unit} (${proof.dailyValueReference.cfr})`);
  }

  lines.push(`Unrounded Calculated: ${proof.unroundedResult}`);
  lines.push(`Expected Display: ${proof.displayedExpectedResult}`);
  lines.push(`Printed on Artwork: ${proof.printedResult}`);

  if (proof.roundingSteps?.length) {
    lines.push(`Rounding: ${proof.roundingSteps.join('; ')}`);
  }

  if (proof.limitations) {
    lines.push(`Limitations: ${proof.limitations}`);
  }

  return lines.join('\n');
}
