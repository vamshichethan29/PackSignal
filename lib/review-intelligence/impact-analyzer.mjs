/**
 * PackSignal Review Intelligence — Source-Change Impact Analyzer
 * (lib/review-intelligence/impact-analyzer.mjs)
 *
 * Implements Step 10 & Step 11:
 * Deterministic detection of changed documents, facts, rules, and artwork,
 * and computation of downstream affected vs unaffected checks and decisions.
 */

import { normal, equalQuantity } from '../engine.mjs';
import { buildTraceabilityGraph } from './provenance.mjs';
import { getFindingDependencies } from './dependencies.mjs';

/**
 * Analyzes the impact of changed inputs on an existing review.
 */
export function analyzeChangeImpact(previousReview = {}, updatedInputs = {}) {
  const prevDocs = previousReview.documents || [];
  const updatedDocs = updatedInputs.documents || previousReview.documents || [];

  const prevSourcesMap = new Map(prevDocs.filter(d => ['spec', 'rules', 'claims', 'dieline'].includes(d.role)).map(d => [d.id, d]));
  const nextSourcesMap = new Map(updatedDocs.filter(d => ['spec', 'rules', 'claims', 'dieline'].includes(d.role)).map(d => [d.id, d]));

  const prevArt = prevDocs.find(d => d.role === 'artwork');
  const nextArt = updatedDocs.find(d => d.role === 'artwork');

  // 1. Detect Changed Documents
  const allSourceIds = new Set([...prevSourcesMap.keys(), ...nextSourcesMap.keys()]);
  const changedSourceIds = new Set();
  const changedDocuments = [];

  for (const docId of allSourceIds) {
    const before = prevSourcesMap.get(docId);
    const after = nextSourcesMap.get(docId);

    if (!before) {
      changedSourceIds.add(docId);
      changedDocuments.push({
        id: docId,
        name: after.name,
        role: after.role,
        change: 'added',
        beforeHash: null,
        afterHash: after.sha256 || ''
      });
    } else if (!after) {
      changedSourceIds.add(docId);
      changedDocuments.push({
        id: docId,
        name: before.name,
        role: before.role,
        change: 'removed',
        beforeHash: before.sha256 || '',
        afterHash: null
      });
    } else if (before.sha256 !== after.sha256) {
      changedSourceIds.add(docId);
      changedDocuments.push({
        id: docId,
        name: after.name || before.name,
        role: after.role || before.role,
        change: 'updated',
        beforeHash: before.sha256 || '',
        afterHash: after.sha256 || ''
      });
    }
  }

  // Artwork change
  const artworkRevised = Boolean(prevArt && nextArt && prevArt.sha256 !== nextArt.sha256);

  // 2. Detect Changed Facts
  const prevFacts = previousReview.facts || [];
  const nextFacts = updatedInputs.facts || prevFacts;
  const changedFactFields = new Set();
  const changedFacts = [];

  const prevFactGroups = Map.groupBy(prevFacts, f => f.field);
  const nextFactGroups = Map.groupBy(nextFacts, f => f.field);

  const allFields = new Set([...prevFactGroups.keys(), ...nextFactGroups.keys()]);
  for (const field of allFields) {
    const beforeList = prevFactGroups.get(field) || [];
    const afterList = nextFactGroups.get(field) || [];

    // Compare selected or primary value
    const beforeVal = beforeList[0]?.value ?? null;
    const afterVal = afterList[0]?.value ?? null;

    let hasChanged = false;
    if (beforeVal === null && afterVal !== null) hasChanged = true;
    else if (beforeVal !== null && afterVal === null) hasChanged = true;
    else if (field === 'net_quantity') {
      hasChanged = !equalQuantity(beforeVal, afterVal);
    } else {
      hasChanged = normal(beforeVal) !== normal(afterVal);
    }

    if (hasChanged) {
      changedFactFields.add(field);
      changedFacts.push({
        field,
        label: afterList[0]?.label || beforeList[0]?.label || field,
        beforeValue: beforeVal,
        afterValue: afterVal,
        documentId: afterList[0]?.documentId || beforeList[0]?.documentId
      });
    }
  }

  // 3. Detect Changed Rules
  const prevRules = previousReview.rules || [];
  const nextRules = updatedInputs.rules || prevRules;
  const changedRuleIds = new Set();
  const changedRules = [];

  const prevRuleMap = new Map(prevRules.map(r => [r.id, r]));
  const nextRuleMap = new Map(nextRules.map(r => [r.id, r]));

  const allRuleIds = new Set([...prevRuleMap.keys(), ...nextRuleMap.keys()]);
  for (const rId of allRuleIds) {
    const before = prevRuleMap.get(rId);
    const after = nextRuleMap.get(rId);

    if (!before) {
      changedRuleIds.add(rId);
      changedRules.push({ id: rId, title: after.title, change: 'added' });
    } else if (!after) {
      changedRuleIds.add(rId);
      changedRules.push({ id: rId, title: before.title, change: 'removed' });
    } else {
      const textChanged = normal(before.text) !== normal(after.text);
      const expectedChanged = normal(before.literal_expected) !== normal(after.literal_expected);
      const authChanged = Boolean(before.applicable) !== Boolean(after.applicable);

      if (textChanged || expectedChanged || authChanged) {
        changedRuleIds.add(rId);
        changedRules.push({
          id: rId,
          title: after.title || before.title,
          change: 'updated',
          textChanged,
          expectedChanged,
          authChanged
        });
      }
    }
  }

  // 4. Detect Option & Basis Changes
  const prevOpts = previousReview.options || {};
  const nextOpts = updatedInputs.options || prevOpts;

  const nutritionBasisChanged = prevOpts.nutritionVariant !== nextOpts.nutritionVariant ||
    prevOpts.nutritionBasisConfirmed !== nextOpts.nutritionBasisConfirmed;

  const panelMappingChanged = JSON.stringify(prevOpts.panelZones || {}) !== JSON.stringify(nextOpts.panelZones || {});

  // 5. Partition Findings & Checks into Affected vs Unaffected
  const affectedCheckIds = new Set();
  const affectedFindingIds = new Set();
  const affectedDecisionIds = new Set();
  const unaffectedCheckIds = new Set();
  const unaffectedFindingIds = new Set();
  const reasoning = [];

  const changeDescriptor = {
    changedDocumentIds: Array.from(changedSourceIds),
    changedFactFields: Array.from(changedFactFields),
    changedRuleIds: Array.from(changedRuleIds),
    artworkRevised,
    nutritionBasisChanged,
    panelMappingChanged
  };

  const findings = previousReview.findings || [];
  const decisions = previousReview.decisions || {};

  for (const finding of findings) {
    const deps = getFindingDependencies(finding, previousReview);
    let isAffected = false;
    let reason = '';

    if (artworkRevised && deps.dependsOnArtwork) {
      isAffected = true;
      reason = 'Artwork document was revised; artwork evidence must be reinspected.';
    } else if (deps.documentIds.some(id => changedSourceIds.has(id))) {
      isAffected = true;
      const matchedDoc = changedDocuments.find(d => deps.documentIds.includes(d.id));
      reason = `Underlying source document "${matchedDoc?.name || 'spec'}" was ${matchedDoc?.change || 'changed'}.`;
    } else if (deps.factFields.some(f => changedFactFields.has(f))) {
      isAffected = true;
      const matchedField = changedFacts.find(f => deps.factFields.includes(f.field));
      reason = `Specification value for "${matchedField?.label || matchedField?.field}" changed from "${matchedField?.beforeValue}" to "${matchedField?.afterValue}".`;
    } else if (deps.ruleIds.some(r => changedRuleIds.has(r))) {
      isAffected = true;
      const matchedRule = changedRules.find(r => deps.ruleIds.includes(r.id));
      reason = `Controlling rule "${matchedRule?.title || matchedRule?.id}" was ${matchedRule?.change}.`;
    } else if (deps.isNutrition && nutritionBasisChanged) {
      isAffected = true;
      reason = 'Nutrition basis or serving size confirmation changed.';
    } else if (deps.isPlacement && panelMappingChanged) {
      isAffected = true;
      reason = 'Panel zones or carton mapping geometry changed.';
    }

    if (isAffected) {
      affectedFindingIds.add(finding.id);
      if (finding.rule?.id) affectedCheckIds.add(finding.rule.id);
      else affectedCheckIds.add(finding.id);

      reasoning.push({
        findingId: finding.id,
        checkId: finding.rule?.id || finding.id,
        title: finding.title,
        status: finding.status,
        affected: true,
        reason
      });

      if (decisions[finding.id]) {
        affectedDecisionIds.add(finding.id);
      }
    } else {
      unaffectedFindingIds.add(finding.id);
      if (finding.rule?.id) unaffectedCheckIds.add(finding.rule.id);
      else unaffectedCheckIds.add(finding.id);

      reasoning.push({
        findingId: finding.id,
        checkId: finding.rule?.id || finding.id,
        title: finding.title,
        status: finding.status,
        affected: false,
        reason: 'Independent check; controlling sources, rules, and artwork remain unchanged.'
      });
    }
  }

  return {
    changedDocuments,
    changedFacts,
    changedRules,
    artworkRevised,
    nutritionBasisChanged,
    panelMappingChanged,
    affectedCheckIds: Array.from(affectedCheckIds),
    affectedFindingIds: Array.from(affectedFindingIds),
    affectedDecisionIds: Array.from(affectedDecisionIds),
    unaffectedCheckIds: Array.from(unaffectedCheckIds),
    unaffectedFindingIds: Array.from(unaffectedFindingIds),
    unaffectedDecisionIds: Object.keys(decisions).filter(id => !affectedDecisionIds.has(id)),
    reasoning,
    blockingDependencies: []
  };
}
