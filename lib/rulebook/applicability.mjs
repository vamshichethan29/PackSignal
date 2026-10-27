/**
 * PackSignal Rulebook Applicability Engine (lib/rulebook/applicability.mjs)
 * Implements Step 8: Evaluates whether a verified rule applies to the inspected package.
 */

import { normal } from '../engine.mjs';
import { APPLICABILITY_STATUS } from './schema.mjs';

/**
 * Determines whether a rule is applicable to a specific package review context.
 */
export function evaluateRuleApplicability(rule, packageContext = {}) {
  const ruleMarket = normal(rule.applicability?.market || 'universal');
  const pkgMarket = normal(packageContext.market || 'us');

  // 1. Market Jurisdiction Gate
  if (ruleMarket !== 'universal' && ruleMarket !== 'global' && ruleMarket !== pkgMarket) {
    return {
      isApplicable: false,
      status: APPLICABILITY_STATUS.NOT_APPLICABLE,
      reason: `Rule market jurisdiction (${ruleMarket.toUpperCase()}) does not match package market (${pkgMarket.toUpperCase()}).`,
    };
  }

  // 2. Product Category / Scope Gate
  const ruleScope = normal(rule.applicability?.productScope || '');
  const pkgCategory = normal(packageContext.foodCategory || packageContext.productCategory || '');
  if (ruleScope && pkgCategory && ruleScope !== 'all' && ruleScope !== 'universal') {
    if (!pkgCategory.includes(ruleScope) && !ruleScope.includes(pkgCategory)) {
      return {
        isApplicable: false,
        status: APPLICABILITY_STATUS.NOT_APPLICABLE,
        reason: `Rule product scope (${rule.applicability.productScope}) does not apply to package category (${packageContext.foodCategory || packageContext.productCategory}).`,
      };
    }
  }

  // 3. SKU Applicability Gate
  if (rule.applicability?.requiresSku) {
    const ruleSku = normal(rule.applicability.sku || '');
    const pkgSku = normal(packageContext.productSku || packageContext.sku || '');
    if (ruleSku && pkgSku && ruleSku !== pkgSku) {
      return {
        isApplicable: false,
        status: APPLICABILITY_STATUS.NOT_APPLICABLE,
        reason: `Rule is SKU-specific (${rule.applicability.sku}) and does not match inspected SKU (${packageContext.productSku}).`,
      };
    }
  }

  return {
    isApplicable: true,
    status: APPLICABILITY_STATUS.APPLICABLE,
    reason: 'Rule satisfies package market, category, and SKU scope.',
  };
}
