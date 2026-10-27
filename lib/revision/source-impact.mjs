/**
 * PackSignal Source & Rule Impact Analysis (lib/revision/source-impact.mjs)
 * Evaluates whether reference specifications, rulebooks, or market presets
 * remained frozen or changed between two revision reviews.
 */

import { createHash } from 'node:crypto';

export const COMPARISON_MODES = {
  MODE_A_FROZEN_BASIS: 'MODE_A_FROZEN_BASIS',
  MODE_B_SOURCE_OR_RULES_CHANGED: 'MODE_B_SOURCE_OR_RULES_CHANGED',
  MODE_C_MARKET_OR_VARIANT_CHANGED: 'MODE_C_MARKET_OR_VARIANT_CHANGED',
};

function sha256(val) {
  return createHash('sha256').update(String(val || '')).digest('hex');
}

/**
 * Computes hash of all specification documents and approved facts
 */
export function computeSourceHash(review = {}) {
  const specs = (review.documents || []).filter(d => d.role === 'spec' || d.role === 'rules');
  const specParts = specs.map(s => `${s.id}:${s.sha256 || ''}:${s.name || ''}`).sort().join('||');
  const facts = (review.facts || []).map(f => `${f.field}:${f.value}:${f.sourceRole || ''}`).sort().join('||');
  return sha256(`${specParts}:::${facts}`);
}

/**
 * Computes hash of compiled rulebooks and active market preset
 */
export function computeRuleBasisHash(review = {}) {
  const preset = review.options?.marketPreset || review.market || 'none';
  const rules = (review.rulebook?.rules || review.rules || []).map(r => `${r.id}:${r.version || ''}`).sort().join('||');
  return sha256(`${preset}:::${rules}`);
}

/**
 * Detects whether the comparison basis changed between Revision A and Revision B
 */
export function evaluateComparisonBasis(reviewA = {}, reviewB = {}) {
  const sourceHashA = computeSourceHash(reviewA);
  const sourceHashB = computeSourceHash(reviewB);
  const sourcesUnchanged = sourceHashA === sourceHashB;

  const ruleHashA = computeRuleBasisHash(reviewA);
  const ruleHashB = computeRuleBasisHash(reviewB);
  const rulesUnchanged = ruleHashA === ruleHashB;

  const marketA = reviewA.options?.marketPreset || reviewA.market || 'none';
  const marketB = reviewB.options?.marketPreset || reviewB.market || 'none';
  const marketUnchanged = marketA === marketB;

  // SKU / Brand check
  const skuA = reviewA.facts?.find(f => f.field === 'sku')?.value || reviewA.options?.sku;
  const skuB = reviewB.facts?.find(f => f.field === 'sku')?.value || reviewB.options?.sku;
  const brandA = reviewA.facts?.find(f => f.field === 'brand_name')?.value?.toLowerCase();
  const brandB = reviewB.facts?.find(f => f.field === 'brand_name')?.value?.toLowerCase();
  const skuMismatch = (skuA && skuB && skuA !== skuB) || (brandA && brandB && brandA !== brandB);

  let mode = COMPARISON_MODES.MODE_A_FROZEN_BASIS;
  let explanation = 'Approved specifications and rules are frozen between revisions. Direct designer correction verification is supported.';
  let requiresConfirmation = false;

  if (skuMismatch) {
    mode = COMPARISON_MODES.MODE_C_MARKET_OR_VARIANT_CHANGED;
    explanation = `Warning: Product / SKU identity mismatch detected (${brandA || skuA} vs ${brandB || skuB}). Confirm cross-product comparison intent.`;
    requiresConfirmation = true;
  } else if (!marketUnchanged) {
    mode = COMPARISON_MODES.MODE_C_MARKET_OR_VARIANT_CHANGED;
    explanation = `Jurisdiction or market preset changed (${marketA} → ${marketB}). Findings reflect differing statutory baselines.`;
    requiresConfirmation = true;
  } else if (!sourcesUnchanged || !rulesUnchanged) {
    mode = COMPARISON_MODES.MODE_B_SOURCE_OR_RULES_CHANGED;
    const changedParts = [];
    if (!sourcesUnchanged) changedParts.push('reference specification');
    if (!rulesUnchanged) changedParts.push('rulebook');
    explanation = `Notice: ${changedParts.join(' and ')} updated between revisions. Status changes may stem from updated references rather than purely artwork corrections.`;
  }

  return {
    mode,
    frozenBasis: mode === COMPARISON_MODES.MODE_A_FROZEN_BASIS,
    sourcesUnchanged,
    rulesUnchanged,
    marketUnchanged,
    skuMismatch,
    requiresConfirmation,
    explanation,
    sourceHashA,
    sourceHashB,
    ruleHashA,
    ruleHashB,
  };
}
