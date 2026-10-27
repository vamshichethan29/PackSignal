/**
 * PackSignal Structured Fact Catalog & Conflict Engine (lib/regulatory/facts.mjs)
 * Implements Phase 18, 19, 20: "What We Read" Fact Review, Authority, and Conflict Resolution.
 */

import { createHash } from 'node:crypto';
import { normal, equalQuantity } from '../engine.mjs';

const hashId = s => createHash('sha256').update(s).digest('hex').slice(0, 14);

export const FACT_GROUPS = {
  identity: { title: 'Product Identity', icon: '🏷️', fields: ['brand', 'product_name', 'variant', 'statement_of_identity'] },
  quantity: { title: 'Net Quantity', icon: '⚖️', fields: ['net_quantity', 'servings', 'serving_size'] },
  ingredients: { title: 'Ingredients', icon: '🌿', fields: ['ingredients', 'composition', 'honey_percentage'] },
  allergens: { title: 'Allergens', icon: '🥜', fields: ['allergens', 'allergen_statement', 'contains', 'may_contain'] },
  nutrition: { title: 'Nutrition', icon: '📊', fields: ['nutrition.basis', 'nutrition.calories', 'nutrition.energy_kcal', 'nutrition.totalfat', 'nutrition.sodium', 'nutrition.protein', 'nutrition.totalcarbohydrate', 'nutrition.added_sugars'] },
  claims: { title: 'Claims & Dietary', icon: '✨', fields: ['claims', 'marketing_copy', 'recycling_copy'] },
  storage: { title: 'Storage & Handling', icon: '❄️', fields: ['storage_statement', 'handling_instructions'] },
  business: { title: 'Manufacturer & Distributor', icon: '🏢', fields: ['manufacturer', 'customer_care', 'distributor'] },
  barcode: { title: 'Barcodes & Identifiers', icon: '📶', fields: ['barcode', 'sku', 'upc', 'gtin'] },
};

export function getFactGroup(field) {
  for (const [groupKey, meta] of Object.entries(FACT_GROUPS)) {
    if (meta.fields.includes(field) || meta.fields.some(f => field.startsWith(f))) {
      return groupKey;
    }
  }
  return 'identity';
}

/**
 * Builds structured facts from review documents with full provenance and conflict tracking.
 */
export function buildStructuredFactCatalog(review) {
  const isArr = Array.isArray(review);
  const docs = isArr ? [] : (review?.documents || []);
  const rawFacts = isArr ? review : (review?.facts || []);
  const storedApprovals = isArr ? {} : (review?.factApprovals || {});
  const storedResolutions = isArr ? {} : (review?.options?.factChoices || {});

  const structuredFacts = [];

  for (const f of rawFacts) {
    const doc = docs.find(d => d.id === f.documentId) || { name: f.documentName || 'Source Document', role: f.sourceRole || 'spec' };
    const factId = f.id || hashId(`${f.documentId || doc.id || 'doc'}:${f.field}:${f.value}`);
    const approval = storedApprovals[factId] || null;

    let approvalState = f.aiProposed ? 'AI_SUGGESTED' : 'EXTRACTED';
    if (approval?.state) {
      approvalState = approval.state;
    } else if (f.verified) {
      approvalState = 'SOURCE_CONFIRMED';
    }

    structuredFacts.push({
      factId,
      field: f.field,
      label: f.label || f.field,
      value: String(f.value ?? ''),
      unit: f.unit || null,
      version: f.version || null,
      documentId: f.documentId || doc.id || 'doc-1',
      documentName: f.documentName || doc.name,
      documentSha256: doc.sha256 || null,
      sourceRole: doc.role,
      sourcePage: f.evidence?.page || f.sourcePage || 1,
      sourceLocation: f.sourceLocation || f.evidence?.location || (f.cell ? `${f.sheet}!${f.cell}` : 'Specification document'),
      sourceQuote: f.sourceQuote || f.evidence?.quote || f.value,
      extractionMethod: f.aiProposed ? 'ai_structured_extraction' : 'deterministic_parser',
      approvalState,
      conflictState: 'UNCHECKED',
      verifiedBy: approval?.actorName || null,
      verifiedAt: approval?.at || null,
      group: getFactGroup(f.field),
    });
  }

  // Detect conflicts across documents for the same field
  const groupedByField = Map.groupBy(structuredFacts, f => f.field);
  const conflicts = [];

  for (const [field, list] of groupedByField) {
    if (list.length <= 1) continue;

    const uniqueValues = [];
    for (const f of list) {
      const alreadyHave = uniqueValues.some(existing =>
        field === 'net_quantity' ? equalQuantity(existing.value, f.value) : normal(existing.value) === normal(f.value)
      );
      if (!alreadyHave) uniqueValues.push(f);
    }

    if (uniqueValues.length > 1) {
      const chosenFactId = storedResolutions[field];
      for (const f of list) {
        f.conflictState = 'CONFLICTED';
        if (!chosenFactId) {
          f.approvalState = 'CONFLICTED';
        } else if (f.factId === chosenFactId) {
          f.approvalState = 'REVIEWER_APPROVED';
          f.conflictState = 'RESOLVED_AUTHORITATIVE';
        } else {
          f.approvalState = 'SUPERSEDED';
          f.conflictState = 'SUPERSEDED';
        }
      }

      conflicts.push({
        field,
        label: list[0].label,
        group: getFactGroup(field),
        facts: list,
        resolved: Boolean(chosenFactId),
        authoritativeFactId: chosenFactId || null,
        competingValues: uniqueValues.map(u => ({
          factId: u.factId,
          value: u.value,
          documentName: u.documentName,
          sourceLocation: u.sourceLocation,
        })),
      });
    }
  }

  return {
    facts: structuredFacts,
    conflicts,
    counts: {
      total: structuredFacts.length,
      conflicted: conflicts.filter(c => !c.resolved).length,
      resolved: conflicts.filter(c => c.resolved).length,
      approved: structuredFacts.filter(f => f.approvalState === 'REVIEWER_APPROVED').length,
    },
  };
}

/**
 * Resolves a fact conflict by designating an authoritative source fact.
 */
export function resolveFactConflict(reviewOrCatalog, field, chosenFactId, actor = null, reason = '') {
  const actorName = typeof actor === 'string' ? actor : (actor?.displayName || 'Authorized Reviewer');
  const actorId = typeof actor === 'object' && actor ? (actor.id || 'reviewer') : 'reviewer';
  const reasonText = typeof reason === 'string' && reason ? reason : (typeof actor === 'string' ? actor : 'Reviewer confirmed source authority.');

  if (Array.isArray(reviewOrCatalog.facts)) {
    for (const f of reviewOrCatalog.facts) {
      if (f.field === field) {
        if (f.factId === chosenFactId || f.id === chosenFactId) {
          f.approvalState = 'REVIEWER_APPROVED';
          f.conflictState = 'RESOLVED_AUTHORITATIVE';
          f.verifiedBy = actorName;
          f.verifiedAt = new Date().toISOString();
        } else {
          f.approvalState = 'SUPERSEDED';
          f.conflictState = 'SUPERSEDED';
        }
      }
    }
    if (reviewOrCatalog.conflicts) {
      const c = reviewOrCatalog.conflicts.find(item => item.field === field);
      if (c) {
        c.resolved = true;
        c.authoritativeFactId = chosenFactId;
      }
    }
  }

  reviewOrCatalog.options ||= {};
  reviewOrCatalog.options.factChoices ||= {};
  reviewOrCatalog.options.factChoices[field] = chosenFactId;

  reviewOrCatalog.factApprovals ||= {};
  reviewOrCatalog.factApprovals[chosenFactId] = {
    state: 'REVIEWER_APPROVED',
    actorId,
    actorName,
    at: new Date().toISOString(),
    reason: reasonText,
  };

  return reviewOrCatalog;
}
