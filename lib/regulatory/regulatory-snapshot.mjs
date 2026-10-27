/**
 * @file regulatory-snapshot.mjs
 * 
 * PackSignal Regulatory Snapshot System
 * Generates immutable, cryptographic snapshots of regulatory rulebooks and knowledge bases
 * to ensure historical reproducibility of time-machine evaluations.
 */

import { createHash } from 'node:crypto';

export const REGULATORY_KNOWLEDGE_DATE = '2026-10-25';
export const REGULATORY_ENGINE_VERSION = '2026.10-temporal.v1';

/**
 * Computes deterministic SHA-256 fingerprint for a rule record.
 */
export function hashRuleRecord(rule) {
  const normalized = {
    id: rule.id,
    jurisdiction: rule.jurisdiction || rule.market,
    category: rule.productCategory || rule.category || 'all',
    effectiveDate: rule.effectiveDate || null,
    complianceDate: rule.complianceDate || null,
    enforcementDate: rule.enforcementDate || null,
    expirationDate: rule.expirationDate || null,
    withdrawalDate: rule.withdrawalDate || null,
    legalStatus: rule.legalStatus || 'IN_FORCE',
    requirementType: rule.requirementType || 'ARTWORK_LABEL_CHECK',
    citation: rule.citation || rule.originalSource || '',
    name: rule.name || rule.title || ''
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

/**
 * Creates an immutable regulatory snapshot record for a specific market, category, and evaluation date.
 */
export function createRegulatorySnapshot({
  market = 'india',
  productCategory = 'food',
  launchDate = '2026-10-25',
  rules = [],
  knowledgeDate = REGULATORY_KNOWLEDGE_DATE
} = {}) {
  const marketCode = String(market).toLowerCase();
  const categoryCode = String(productCategory).toLowerCase();
  const targetDate = String(launchDate).slice(0, 10);

  const ruleHashes = {};
  for (const r of rules) {
    if (r.id) {
      ruleHashes[r.id] = hashRuleRecord(r);
    }
  }

  const rawPayload = `${marketCode}:${categoryCode}:${targetDate}:${knowledgeDate}:${JSON.stringify(ruleHashes)}`;
  const snapshotId = `reg-snap-${createHash('sha256').update(rawPayload).digest('hex').slice(0, 16)}`;

  return {
    snapshotId,
    rulePackVersion: REGULATORY_ENGINE_VERSION,
    knowledgeDate,
    market: marketCode,
    productCategory: categoryCode,
    launchDate: targetDate,
    ruleCount: rules.length,
    ruleRecordHashes: ruleHashes,
    createdAt: new Date().toISOString()
  };
}
