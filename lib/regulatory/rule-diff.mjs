/**
 * @file rule-diff.mjs
 * 
 * PackSignal Regulatory Time Machine — Date A vs Date B Comparison Engine
 * 
 * Computes exact delta between two regulatory dates:
 * - Newly effective requirements
 * - Retired or superseded requirements
 * - Changed check requirements
 * - Proposed initiatives
 * - Reviewer revalidation requirements
 */

import { evaluateRulesAtDate, VERIFIED_TEMPORAL_RULES } from './temporal-rules.mjs';

/**
 * Compares regulatory state between Date A and Date B.
 */
export function compareRegulatoryDates({
  rules = VERIFIED_TEMPORAL_RULES,
  dateA = '2026-10-25',
  dateB = '2027-07-01',
  market = 'india',
  productCategory = 'food',
  productFacts = {}
} = {}) {
  const evalA = evaluateRulesAtDate({
    rules,
    launchDate: dateA,
    market,
    productCategory,
    productFacts
  });

  const evalB = evaluateRulesAtDate({
    rules,
    launchDate: dateB,
    market,
    productCategory,
    productFacts
  });

  const activeAIds = new Set(evalA.categorized.applicableNow.map(r => r.ruleId || r.id));
  const activeBIds = new Set(evalB.categorized.applicableNow.map(r => r.ruleId || r.id));

  // Newly active at Date B (taking effect between A and B)
  const newlyApplicable = evalB.categorized.applicableNow.filter(r => !activeAIds.has(r.ruleId || r.id));

  // Retired / Superseded / Expired by Date B
  const retired = evalA.categorized.applicableNow.filter(r => !activeBIds.has(r.ruleId || r.id));

  // Still active across both
  const persistent = evalB.categorized.applicableNow.filter(r => activeAIds.has(r.ruleId || r.id));

  // Proposed initiatives
  const proposed = evalB.categorized.proposedInitiatives;

  // Affected check types
  const affectedCheckTypes = [...new Set(newlyApplicable.map(r => r.checkType).filter(Boolean))];

  return {
    dateA: evalA.launchDate,
    dateB: evalB.launchDate,
    market: evalA.market,
    productCategory: evalA.productCategory,
    snapshotIdA: evalA.snapshotId,
    snapshotIdB: evalB.snapshotId,
    summary: {
      activeAtDateA: activeAIds.size,
      activeAtDateB: activeBIds.size,
      newlyApplicableCount: newlyApplicable.length,
      retiredCount: retired.length,
      persistentCount: persistent.length,
      proposedCount: proposed.length
    },
    newlyApplicable,
    retired,
    persistent,
    proposed,
    categorizedChanges: {
      newlyEffective: newlyApplicable.map(r => ({ ...r, changeCategory: 'NEWLY EFFECTIVE' })),
      noLongerApplicable: retired.map(r => ({ ...r, changeCategory: 'NO LONGER APPLICABLE' })),
      unchanged: persistent.map(r => ({ ...r, changeCategory: 'UNCHANGED' })),
      conditionallyApplicable: proposed.map(r => ({ ...r, changeCategory: 'CONDITIONALLY APPLICABLE' }))
    },
    affectedCheckTypes,
    narrative: newlyApplicable.length > 0
      ? `Moving launch date from ${evalA.launchDate} to ${evalB.launchDate} activates ${newlyApplicable.length} additional regulatory requirement(s): ${newlyApplicable.map(r => r.title || r.name).join('; ')}.`
      : `No verified applicable rule changes were identified for the selected period in the currently loaded rule packs.`
  };
}
