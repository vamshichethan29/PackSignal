/**
 * PackSignal Review Intelligence — Explicit Dependency Descriptors
 * (lib/review-intelligence/dependencies.mjs)
 *
 * Implements Step 10 & Step 11:
 * Explicit mapping between checks/findings and their controlling source facts,
 * rules, artwork, panel mappings, and nutrition bases.
 */

import { normal } from '../engine.mjs';

/**
 * Extracts explicit controlling dependencies for a finding or check.
 */
export function getFindingDependencies(finding = {}, review = {}) {
  const docIds = new Set();
  const factFields = new Set();
  const ruleIds = new Set();

  // 1. Evidence and source document dependencies
  for (const ev of finding.evidence || []) {
    if (ev.documentId) docIds.add(ev.documentId);
  }
  for (const s of finding.sources || []) {
    if (s.documentId || s.id) docIds.add(s.documentId || s.id);
    if (s.field) factFields.add(s.field);
  }

  // 2. Rule document and ID dependencies
  if (finding.rule) {
    if (finding.rule.id) ruleIds.add(finding.rule.id);
    if (finding.rule.source?.documentId) docIds.add(finding.rule.source.documentId);
    if (finding.rule.field) factFields.add(finding.rule.field);
  }

  // 3. Finding field dependency
  if (finding.field) {
    factFields.add(finding.field);
  }

  // 4. Inferred key dependencies (for standard checks)
  const key = finding.key || '';
  if (key.includes('quantity')) factFields.add('net_quantity');
  if (key.includes('nutrition') || key.startsWith('nutrition.')) {
    factFields.add('nutrition.basis');
    if (finding.field) factFields.add(finding.field);
  }
  if (key.includes('allergen')) factFields.add('allergen_statement');
  if (key.includes('storage')) factFields.add('storage_statement');
  if (key.includes('ingredient')) factFields.add('ingredients');

  const isNutrition = [...factFields].some(f => f.startsWith('nutrition.') || f === 'nutrition.basis');
  const isPlacement = key.includes('placement') || key.includes('panel') || (finding.rule?.panel);
  const isNetQty = factFields.has('net_quantity');

  return {
    findingId: finding.id,
    key: finding.key,
    documentIds: Array.from(docIds),
    factFields: Array.from(factFields),
    ruleIds: Array.from(ruleIds),
    isNutrition,
    isPlacement,
    isNetQty,
    dependsOnArtwork: true,
    targetPanel: finding.rule?.panel || finding.panelId || null,
    nutritionVariant: isNutrition ? (review.options?.nutritionVariant || '') : null
  };
}

/**
 * Determines whether a finding or check is affected by a changed item.
 */
export function isFindingAffectedByChange(finding, change = {}, review = {}) {
  const deps = getFindingDependencies(finding, review);

  // Case 1: Document changed
  if (change.changedDocumentIds && change.changedDocumentIds.length > 0) {
    const docSet = new Set(change.changedDocumentIds);
    if (deps.documentIds.some(id => docSet.has(id))) return true;
  }

  // Case 2: Specific fact field changed
  if (change.changedFactFields && change.changedFactFields.length > 0) {
    const fieldSet = new Set(change.changedFactFields);
    if (deps.factFields.some(f => fieldSet.has(f))) return true;
  }

  // Case 3: Rule changed
  if (change.changedRuleIds && change.changedRuleIds.length > 0) {
    const ruleSet = new Set(change.changedRuleIds);
    if (deps.ruleIds.some(r => ruleSet.has(r))) return true;
  }

  // Case 4: Nutrition basis / variant changed
  if (change.nutritionBasisChanged && deps.isNutrition) {
    return true;
  }

  // Case 5: Panel mapping / zones changed
  if (change.panelMappingChanged && deps.isPlacement) {
    return true;
  }

  // Case 6: Whole artwork revised
  if (change.artworkRevised && deps.dependsOnArtwork) {
    return true;
  }

  return false;
}
