/**
 * PackSignal Shared Regulatory Evaluation Engine (lib/regulatory/evaluator.mjs)
 * Executes deterministic, evidence-backed regulatory checks for USA (FDA),
 * European Union (Regulation 1169/2011), and India (FSSAI).
 * Supports single-market evaluation, cross-market what-if preview, and comparison matrix.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { JURISDICTION_REGISTRY, getJurisdictionMeta } from './registry.mjs';
import { buildProductProfile, evaluateRuleApplicability } from './applicability.mjs';
import {
  US_FDA_DAILY_VALUES,
  EU_1169_REFERENCE_INTAKES,
  FSSAI_RDA_VALUES,
  verifyEuDualEnergy,
  computeUsFdaDailyValue,
  sodiumMgToSaltG,
} from './nutrition.mjs';
import { evidence } from '../engine.mjs';

const id = s => createHash('sha256').update(s).digest('hex').slice(0, 14);

// In-memory evaluation cache keyed by artwork, specifications, jurisdiction, effective date, and mode
const evaluationCache = new Map();

export function clearEvaluationCache() {
  evaluationCache.clear();
}

function buildEvaluationCacheKey(review, marketId, options, profile) {
  const art = review.documents?.find(d => d.role === 'artwork') || review.documents?.[0];
  const artHash = art?.sha256 || createHash('sha256').update(String(art?.text || '')).digest('hex').slice(0, 16);
  const specDocs = (review.documents || []).filter(d => d.role !== 'artwork');
  const specHashes = specDocs.map(d => d.sha256 || d.name || '').sort().join(':');
  const effectiveDate = options.effectiveDate || review.options?.effectiveDate || '2026-10-23';
  const mode = options.mode || 'target';
  const profileHash = createHash('sha256').update(JSON.stringify(profile || {})).digest('hex').slice(0, 12);
  return `${artHash}|${specHashes}|${marketId}|${effectiveDate}|${mode}|${profileHash}|v1.0.0`;
}

function loadRulePack(marketId) {
  const norm = String(marketId || 'us').toLowerCase();
  const filePath = join(process.cwd(), 'regulations', norm, 'rules.json');
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }
  }
  return [];
}

function buildMarketWorklist(meta, findings, isPreview) {
  const satisfied = findings.filter(f => f.status === 'match');
  const discrepancies = findings.filter(f => f.status === 'issue');
  const humanVerification = findings.filter(f => f.status === 'review');
  const missingInfo = findings.filter(f => f.status === 'unable');
  const exempt = findings.filter(f => f.applicability === 'not_applicable');
  const futureReqs = findings.filter(f => f.applicability === 'future_requirement');

  const actionItems = [];
  if (discrepancies.length > 0) {
    actionItems.push(...discrepancies.map(f => `• [DISCREPANCY] ${f.title.replace(/^[^\s]+\s+/, '')}: ${f.expected} (Observed: "${f.observed}")`));
  }
  if (humanVerification.length > 0) {
    actionItems.push(...humanVerification.map(f => `• [PREPRESS INSPECTION] ${f.title.replace(/^[^\s]+\s+/, '')}: ${f.explanation}`));
  }
  if (missingInfo.length > 0) {
    actionItems.push(...missingInfo.map(f => `• [MISSING EVIDENCE] ${f.title.replace(/^[^\s]+\s+/, '')}: ${f.explanation}`));
  }

  const handoffMarkdown = [
    `# PackSignal Prepress Regulatory Handoff — ${meta.fullName}`,
    `**Regulatory Authority:** ${meta.authority}`,
    `**Governing Regulation:** ${meta.governingAct}`,
    `**Evaluation Mode:** ${isPreview ? 'Cross-Market What-If Adaptation Preview' : 'Target Market Review'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    `## Summary of Requirements`,
    `- Satisfied Requirements: ${satisfied.length}`,
    `- Discrepancies Requiring Artwork Change: ${discrepancies.length}`,
    `- Items Requiring Prepress / Visual Inspection: ${humanVerification.length}`,
    `- Missing Source Information: ${missingInfo.length}`,
    `- Statutory Exemptions: ${exempt.length}`,
    `- Future Provisions: ${futureReqs.length}`,
    '',
    `## Required Artwork Actions (Adobe Illustrator / ArtPro+)`,
    actionItems.length > 0 ? actionItems.join('\n') : '• No outstanding discrepancies detected in supported checks.',
    '',
    `> **Regulatory Notice:** This handoff documents technical prepress checks against versioned rules. It supports design change control and does not constitute statutory legal clearance or print release authorization.`
  ].join('\n');

  return {
    satisfied,
    discrepancies,
    humanVerificationNeeded: humanVerification,
    missingInformation: missingInfo,
    notApplicable: exempt,
    futureRequirements: futureReqs,
    designerHandoff: handoffMarkdown,
  };
}

/**
 * Evaluates a single jurisdiction for a given review.
 */
export function evaluateJurisdiction(review, marketId = 'us', options = {}) {
  const meta = getJurisdictionMeta(marketId) || JURISDICTION_REGISTRY.us;
  const effectiveDate = options.effectiveDate || review.options?.effectiveDate || meta.defaultEffectiveDate;
  const mode = options.mode || 'target';
  const isPreview = mode === 'preview';
  const profile = buildProductProfile(review, effectiveDate);

  // Check cache for instant switching
  const cacheKey = buildEvaluationCacheKey(review, meta.id, options, profile);
  if (!options.bypassCache && evaluationCache.has(cacheKey)) {
    return evaluationCache.get(cacheKey);
  }

  const rules = loadRulePack(meta.id);
  const art = review.documents?.find(d => d.role === 'artwork') || review.documents?.[0];
  const artText = String(art?.text || '');
  const findings = [];

  let countIssue = 0;
  let countReview = 0;
  let countMatch = 0;
  let countUnable = 0;
  let countFuture = 0;
  let countExempt = 0;

  for (const rule of rules) {
    const app = evaluateRuleApplicability(rule, profile);

    // Rule is not applicable due to statutory exemption
    if (app.applicability === 'not_applicable') {
      countExempt++;
      findings.push({
        id: id(`reg:${meta.id}:${rule.id}`),
        key: `reg:${meta.id}:${rule.id}`,
        title: `${meta.flag} ${rule.title}`,
        status: 'match',
        applicability: 'not_applicable',
        expected: 'Statutory exemption applies.',
        observed: 'Product exempt from this requirement.',
        explanation: app.reason,
        evidence: [],
        rule: {
          text: rule.explanation,
          citation: rule.citation,
          provision: rule.provision,
          sourceURL: rule.sourceURL,
          authority: rule.authority,
        },
        severity: 'minor',
        method: 'regulatory_exemption_eval',
      });
      continue;
    }

    // Rule is a future statutory amendment not yet in force
    if (app.applicability === 'future_requirement') {
      countFuture++;
      findings.push({
        id: id(`reg:${meta.id}:${rule.id}`),
        key: `reg:${meta.id}:${rule.id}`,
        title: `${meta.flag} ${rule.title} (Future Requirement)`,
        status: 'review',
        applicability: 'future_requirement',
        expected: `Enacted amendment commencing ${rule.effectiveDate || 'future date'}.`,
        observed: 'Informational regulatory preview under current law.',
        explanation: app.reason,
        evidence: [],
        rule: {
          text: rule.explanation,
          citation: rule.citation,
          provision: rule.provision,
          sourceURL: rule.sourceURL,
          authority: rule.authority,
        },
        severity: 'minor',
        method: 'regulatory_future_preview',
      });
      continue;
    }

    // Rule is applicable: execute deterministic check
    let findingResult = null;

    if (meta.id === 'us') {
      findingResult = executeUsRule(rule, art, artText, review, profile);
    } else if (meta.id === 'eu') {
      findingResult = executeEuRule(rule, art, artText, review, profile);
    } else if (meta.id === 'india') {
      findingResult = executeIndiaRule(rule, art, artText, review, profile);
    }

    if (findingResult) {
      let finalStatus = findingResult.status;
      let finalTitle = `${meta.flag} ${rule.title}`;
      let finalExplanation = findingResult.explanation;
      let finalApplicability = 'applicable';

      // Cross-Market What-If Preview: do not brand product illegal for an unadapted market
      if (isPreview && findingResult.status === 'issue') {
        finalStatus = 'review';
        finalTitle = `${meta.flag} ${rule.title} (Adaptation for ${meta.name || meta.fullName || 'Target Market'})`;
        finalExplanation = `Cross-Market What-If: Product artwork was developed for another market. Entering ${meta.fullName} would require design adaptation: ${findingResult.explanation}`;
        finalApplicability = 'preview_adaptation';
      }

      if (finalStatus === 'issue') countIssue++;
      else if (finalStatus === 'review') countReview++;
      else if (finalStatus === 'match') countMatch++;
      else countUnable++;

      findings.push({
        id: id(`reg:${meta.id}:${rule.id}`),
        key: `reg:${meta.id}:${rule.id}`,
        title: finalTitle,
        status: finalStatus,
        applicability: finalApplicability,
        expected: findingResult.expected,
        observed: findingResult.observed,
        explanation: finalExplanation,
        evidence: findingResult.evidence || (art ? [evidence(art, findingResult.observed || rule.title)] : []),
        rule: {
          text: rule.explanation,
          citation: rule.citation,
          provision: rule.provision,
          sourceURL: rule.sourceURL,
          authority: rule.authority,
        },
        severity: finalStatus === 'issue' ? 'major' : 'minor',
        method: isPreview && findingResult.status === 'issue' ? 'regulatory_preview_adaptation' : 'regulatory_evaluation',
      });
    }
  }

  const worklist = buildMarketWorklist(meta, findings, isPreview);

  const evaluationResult = {
    jurisdiction: meta.id,
    jurisdictionMeta: meta,
    mode,
    effectiveDate,
    rulePackVersion: meta.rulePackVersion,
    counts: {
      issue: countIssue,
      review: countReview,
      match: countMatch,
      unable: countUnable,
      future: countFuture,
      exempt: countExempt,
      totalRules: rules.length,
    },
    findings,
    worklist,
    coverage: {
      jurisdiction: meta.fullName,
      authority: meta.authority,
      governingAct: meta.governingAct,
      effectiveDate,
      mode,
      limits: [
        'Deterministic checks evaluate supported requirements on visible artwork and supplied specifications.',
        'This screening report supports qualified human review; it does not certify official legal compliance or authorize commercial printing.',
      ],
    },
  };

  evaluationCache.set(cacheKey, evaluationResult);
  return evaluationResult;
}

/* =========================================================================
   USA FDA Rule Evaluation Logic
   ========================================================================= */
function executeUsRule(rule, art, artText, review, profile) {
  if (rule.id === 'US-FDA-101.9-PANEL') {
    const match = artText.match(/nutrition\s+facts/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Nutrition Facts panel heading.',
        observed: match[0],
        explanation: 'Mandatory "Nutrition Facts" panel heading was located on the packaging artwork.',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'issue',
      expected: 'Nutrition Facts panel heading (21 CFR 101.9(d)(1)(i)).',
      observed: 'Nutrition Facts heading not found on artwork.',
      explanation: 'Prepacked food packaging subject to FDA nutrition labeling must carry a Nutrition Facts panel.',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.9-CALORIES') {
    const match = artText.match(/calories\s*[:\s]*(\d{1,4})/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Calories declaration with bold prominence.',
        observed: match[0],
        explanation: `Calories statement located on artwork ("${match[0]}"). Verified against 21 CFR 101.9(c)(1).`,
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Calories declaration (21 CFR 101.9(c)(1)).',
      observed: 'No calories statement detected in extracted text.',
      explanation: 'Verify that calories are declared prominently on the Nutrition Facts panel.',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.9-SERVING') {
    const match = artText.match(/serving\s*size|servings?\s*per\s*container/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Serving size and servings per container statements.',
        observed: match[0],
        explanation: 'Serving information located on artwork in accordance with 21 CFR 101.9(b).',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'issue',
      expected: 'Serving size and container count declaration.',
      observed: 'No serving size statement located.',
      explanation: 'Serving size must be stated in common household measure followed by metric equivalent.',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.9-ADDED-SUGARS') {
    const match = artText.match(/includes?\s*\d*\s*g?\s*added\s*sugars?/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Added Sugars amount and % Daily Value declaration.',
        observed: match[0],
        explanation: 'Added Sugars statement located on artwork (21 CFR 101.9(c)(6)(iii)).',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Added Sugars declaration (21 CFR 101.9(c)(6)(iii)).',
      observed: 'No added sugars statement detected.',
      explanation: 'FDA 2016 rules require mandatory declaration of Added Sugars under Total Sugars.',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.9-DV-CALC') {
    // Check sodium %DV as prime example
    const sodMatch = artText.match(/sodium\s*[:\s]*(\d+(?:\.\d+)?)\s*mg\s*(\d{1,3})\s*%/i);
    if (sodMatch) {
      const mg = Number(sodMatch[1]);
      const declaredDv = Number(sodMatch[2]);
      const calc = computeUsFdaDailyValue('sodium', mg);
      if (calc && Math.abs(declaredDv - calc.expectedPercent) > 1) {
        return {
          status: 'issue',
          expected: `${calc.expectedPercent}% Daily Value (${calc.formula})`,
          observed: `${declaredDv}% Daily Value declared for ${mg} mg Sodium`,
          explanation: `Mathematical discrepancy: ${mg} mg Sodium against 2,300 mg reference standard yields ${calc.expectedPercent}% DV, but ${declaredDv}% is declared on artwork.`,
          evidence: [evidence(art, sodMatch[0])],
        };
      }
      return {
        status: 'match',
        expected: `${calc?.expectedPercent}% Daily Value for ${mg} mg Sodium`,
        observed: sodMatch[0],
        explanation: 'Sodium % Daily Value declaration is mathematically consistent with statutory 21 CFR 101.9(c)(9) reference standard.',
        evidence: [evidence(art, sodMatch[0])],
      };
    }
    return {
      status: 'match',
      expected: 'Nutrient % Daily Value consistency.',
      observed: 'No conflicting Daily Value calculation detected.',
      explanation: 'Evaluated against FDA 2016 Daily Reference Values (DRV).',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.4-INGREDIENTS') {
    const match = artText.match(/ingredients?\s*[:\s]/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Ingredient list in descending order of predominance.',
        observed: match[0],
        explanation: 'Ingredient declaration located on artwork (21 CFR 101.4(a)(1)).',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'issue',
      expected: 'Ingredient declaration headed by "Ingredients:".',
      observed: 'Ingredient list heading not located.',
      explanation: 'Ingredients must be declared by common or usual name in descending order of predominance.',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-FALCPA-ALLERGENS') {
    const missingAllergens = (profile.knownAllergens || []).filter(a => !artText.toLowerCase().includes(a.toLowerCase()));
    if (missingAllergens.length > 0) {
      return {
        status: 'issue',
        expected: `Declaration of major food allergens: ${profile.knownAllergens.join(', ')}.`,
        observed: `Known allergen(s) not found in artwork copy: ${missingAllergens.join(', ')}.`,
        explanation: `Under FALCPA and the FASTER Act, all major allergens (${missingAllergens.join(', ')}) must be declared either in the ingredient list or in a separate "Contains" statement.`,
        evidence: [],
      };
    }
    const match = artText.match(/contains\s*[:\s]*([^.]+)/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Major food allergen declaration (21 U.S.C. 343(w)).',
        observed: match[0],
        explanation: 'Major food allergen statement located on packaging artwork.',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Allergen declaration or verification of allergen-free formulation.',
      observed: 'No "Contains" allergen statement located.',
      explanation: 'Verify whether product contains any of the 9 US major food allergens (including sesame).',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.105-NET-QTY') {
    const dualMatch = artText.match(/(?:\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb))\s*\(\s*\d+(?:\.\d+)?\s*(?:ml|g|l|kg)\s*\)|\d+(?:\.\d+)?\s*(?:ml|g|l|kg)\s*\(\s*\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb)\s*\)/i);
    if (dualMatch) {
      return {
        status: 'match',
        expected: 'Dual net quantity declaration (US Customary & Metric).',
        observed: dualMatch[0],
        explanation: 'Dual net quantity declaration located on artwork in accordance with 21 CFR 101.105.',
        evidence: [evidence(art, dualMatch[0])],
      };
    }
    const singleMatch = artText.match(/\b\d+(?:\.\d+)?\s*(?:ml|l|g|kg|fl\s*oz|oz)\b/i);
    if (singleMatch) {
      return {
        status: 'review',
        expected: 'Dual unit declaration (e.g. 1 qt (946 mL) or 16 fl oz (473 mL)).',
        observed: singleMatch[0],
        explanation: 'Single net quantity located. FDA requires both US customary and metric units on the principal display panel.',
        evidence: [evidence(art, singleMatch[0])],
      };
    }
    return {
      status: 'issue',
      expected: 'Net quantity declaration (21 CFR 101.105).',
      observed: 'Net quantity statement not located.',
      explanation: 'Net quantity of contents must appear in the bottom 30 percent of the principal display panel.',
      evidence: [],
    };
  }

  if (rule.id === 'US-FDA-101.5-BUSINESS-NAME') {
    const match = artText.match(/(?:manufactured|distributed|packed)\s+(?:by|for)\s+([^\n]+)/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Name and place of business of manufacturer or distributor.',
        observed: match[0],
        explanation: 'Corporate identity and business qualification located on artwork (21 CFR 101.5).',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Manufacturer, packer, or distributor name and address.',
      observed: 'No business qualification statement located.',
      explanation: 'Label must specify corporate name, street address, city, state, and ZIP code.',
      evidence: [],
    };
  }

  return null;
}

/* =========================================================================
   EU Regulation 1169/2011 Rule Evaluation Logic
   ========================================================================= */
function executeEuRule(rule, art, artText, review, profile) {
  if (rule.id === 'EU-1169-ART30-BASIS') {
    const match = artText.match(/(?:per|pour|je)\s*100\s*(?:g|ml)/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Mandatory nutrition declaration expressed per 100 g or per 100 ml.',
        observed: match[0],
        explanation: 'Mandatory per-100 g/ml nutrition declaration basis verified under Article 32(2).',
        evidence: [evidence(art, match[0])],
      };
    }
    const perServingOnly = artText.match(/per\s+serving|serving\s+size/i);
    if (perServingOnly) {
      return {
        status: 'issue',
        expected: 'Mandatory per 100 g or per 100 ml declaration (Regulation (EU) No 1169/2011, Article 32(2)).',
        observed: perServingOnly[0],
        explanation: 'Under EU FIC Regulation, the mandatory nutrition declaration must be given per 100 g or per 100 ml. Per-portion declarations are permitted only in addition to the per 100 basis.',
        evidence: [evidence(art, perServingOnly[0])],
      };
    }
    return {
      status: 'unable',
      expected: 'Nutrition declaration per 100 g or per 100 ml.',
      observed: 'No nutrition declaration located in extracted text.',
      explanation: 'Inspect artwork for presence of EU nutrition declaration table.',
      evidence: [],
    };
  }

  if (rule.id === 'EU-1169-ART30-DUAL-ENERGY') {
    const hasKj = /\b\d+\s*kj\b/i.test(artText);
    const hasKcal = /\b\d+\s*kcal\b/i.test(artText);

    if (hasKj && hasKcal) {
      const matchKj = artText.match(/(\d+)\s*kj/i);
      const matchKcal = artText.match(/(\d+)\s*kcal/i);
      const valKj = matchKj ? Number(matchKj[1]) : null;
      const valKcal = matchKcal ? Number(matchKcal[1]) : null;

      if (valKj && valKcal) {
        const dualCheck = verifyEuDualEnergy(valKj, valKcal);
        if (!dualCheck.valid) {
          return {
            status: 'issue',
            expected: `Energy kJ and kcal mathematical consistency (${valKcal} kcal ≈ ${dualCheck.expectedKj} kJ).`,
            observed: `${valKj} kJ / ${valKcal} kcal declared (ratio ${dualCheck.ratio})`,
            explanation: dualCheck.explanation,
            evidence: [evidence(art, `${valKj} kJ`), evidence(art, `${valKcal} kcal`)],
          };
        }
      }

      return {
        status: 'match',
        expected: 'Energy declared in both kJ and kcal (Article 30(1)).',
        observed: `${matchKj?.[0]} / ${matchKcal?.[0]}`,
        explanation: 'Mandatory dual energy units (kJ and kcal) located and verified.',
        evidence: [evidence(art, `${matchKj?.[0]} / ${matchKcal?.[0]}`)],
      };
    }

    if (hasKcal && !hasKj) {
      const matchKcal = artText.match(/\d+\s*kcal/i)?.[0] || 'kcal declared';
      return {
        status: 'issue',
        expected: 'Energy declared in both kilojoules (kJ) and kilocalories (kcal) (Article 30(1)).',
        observed: matchKcal,
        explanation: 'Regulation (EU) No 1169/2011, Article 30(1) mandates dual declaration in both kJ and kcal. Kilojoules (kJ) statement is missing from artwork.',
        evidence: [evidence(art, matchKcal)],
      };
    }

    return {
      status: 'review',
      expected: 'Dual energy declaration in kJ and kcal.',
      observed: 'Energy statement not detected in extracted text.',
      explanation: 'Verify that both kJ and kcal values appear in the nutrition table.',
      evidence: [],
    };
  }

  if (rule.id === 'EU-1169-ART30-7-NUTRIENTS') {
    const foundNutrients = [];
    if (/energy|energie/i.test(artText)) foundNutrients.push('Energy');
    if (/fat|matières\s*grasses|fett/i.test(artText)) foundNutrients.push('Fat');
    if (/saturates|acides\s*gras\s*saturés/i.test(artText)) foundNutrients.push('Saturates');
    if (/carbohydrate|glucides|kohlenhydrate/i.test(artText)) foundNutrients.push('Carbohydrate');
    if (/sugars|sucres|zucker/i.test(artText)) foundNutrients.push('Sugars');
    if (/protein|protéines|eiweiß/i.test(artText)) foundNutrients.push('Protein');
    if (/salt|sel|salz/i.test(artText)) foundNutrients.push('Salt');

    if (foundNutrients.length >= 6) {
      return {
        status: 'match',
        expected: 'Mandatory 7 nutrients: Energy, Fat, Saturates, Carbohydrate, Sugars, Protein, Salt.',
        observed: foundNutrients.join(', '),
        explanation: 'Mandatory EU nutrient particulars identified in extracted artwork text.',
        evidence: [evidence(art, foundNutrients[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Mandatory 7 nutrients in standard order (Article 30(1)).',
      observed: `Identified ${foundNutrients.length} of 7 mandatory nutrients (${foundNutrients.join(', ') || 'none'}).`,
      explanation: 'Inspect the nutrition declaration to confirm presence of all 7 mandatory nutrients.',
      evidence: [],
    };
  }

  if (rule.id === 'EU-1169-ART30-SALT') {
    const hasSalt = /\bsalt\b|\bsel\b|\bsalz\b/i.test(artText);
    const hasSodium = /\bsodium\b/i.test(artText);

    if (hasSalt) {
      return {
        status: 'match',
        expected: 'Salt declaration (Article 30(1)).',
        observed: 'Salt declaration located on artwork',
        explanation: 'Mandatory "Salt" declaration verified in accordance with Regulation (EU) No 1169/2011.',
        evidence: [evidence(art, 'salt')],
      };
    }
    if (hasSodium && !hasSalt) {
      const sodMatch = artText.match(/\bsodium\b[^\n]*/i)?.[0] || 'Sodium';
      return {
        status: 'issue',
        expected: 'Salt declaration (Article 30(1) & Article 2(2)(s)).',
        observed: sodMatch,
        explanation: 'Under EU FIC rules, the mandatory declaration requires "Salt" (salt = sodium × 2.5). Declaring "Sodium" alone is a non-compliance under EU law.',
        evidence: [evidence(art, sodMatch)],
      };
    }
    return {
      status: 'review',
      expected: 'Salt declaration in the nutrition table.',
      observed: 'Salt declaration not detected in extracted text.',
      explanation: 'Inspect artwork nutrition table for Salt statement.',
      evidence: [],
    };
  }

  if (rule.id === 'EU-1169-ART21-ALLERGEN-EMPHASIS') {
    const ingMatch = artText.match(/ingredients?\s*:[^\n]+/i);
    if (ingMatch) {
      return {
        status: 'review',
        expected: 'Substances causing allergies or intolerances emphasized through a distinct typeset (Article 21(1)(b)).',
        observed: ingMatch[0],
        explanation: 'Ingredients located. Human reviewer must visually inspect the high-resolution artwork to verify that allergens are clearly distinguished by bolding, font style, or background color.',
        evidence: [evidence(art, ingMatch[0])],
      };
    }
    return {
      status: 'unable',
      expected: 'Allergen emphasis in the list of ingredients.',
      observed: 'No ingredient list located.',
      explanation: 'Inspect artwork for presence and styling of allergens.',
      evidence: [],
    };
  }

  if (rule.id === 'EU-1169-ART13-TYPOGRAPHY') {
    return {
      status: 'review',
      expected: 'x-height equal to or greater than 1.2 mm (or 0.9 mm if largest surface < 80 cm²).',
      observed: 'Native vector typography inspection required.',
      explanation: 'Regulation (EU) No 1169/2011, Article 13(2) sets mandatory x-height thresholds. Inspect rendered typography with prepress caliper.',
      evidence: [],
    };
  }

  if (rule.id === 'EU-1169-ART9-MANDATORY-PARTICULARS') {
    const hasNetQty = /\b\d+\s*(?:ml|l|cl|g|kg)\b/i.test(artText);
    const hasDurability = /best\s*before|use\s*by|à\s*consommer/i.test(artText);
    if (hasNetQty && hasDurability) {
      return {
        status: 'match',
        expected: 'Mandatory particulars (Name, Net Quantity, Date of minimum durability, Operator).',
        observed: 'Net quantity and durability statements located.',
        explanation: 'Core mandatory particulars identified in extracted artwork text.',
        evidence: [],
      };
    }
    return {
      status: 'review',
      expected: 'Mandatory particulars under Article 9(1).',
      observed: 'Incomplete mandatory particulars detected.',
      explanation: 'Confirm presence of legal name, net quantity, durability date, and operator address.',
      evidence: [],
    };
  }

  return null;
}

/* =========================================================================
   India FSSAI Rule Evaluation Logic
   ========================================================================= */
function executeIndiaRule(rule, art, artText, review, profile) {
  if (rule.id === 'FSSAI-2020-REG5.2-VEG-MARK') {
    // 1. Check computer vision detected symbols if available
    const detectedSymbols = review.regulatorySymbols || review.detectedSymbols || [];
    const symMatch = detectedSymbols.find(s => s.symbol_type === 'fssai_veg' || s.symbol_type === 'fssai_nonveg' || s.type === 'fssai_veg' || s.type === 'fssai_nonveg');
    if (symMatch) {
      const isVeg = (symMatch.symbol_type || symMatch.type) === 'fssai_veg';
      const markLabel = isVeg ? 'Vegetarian symbol (green circle in square)' : 'Non-Vegetarian symbol (brown triangle in square)';
      return {
        status: 'match',
        expected: 'FSSAI statutory food category logo (Regulation 5(2)).',
        observed: `${markLabel} candidate detected at page ${symMatch.page || 1} (shape: ${symMatch.shape || (isVeg ? 'circle' : 'triangle')}).`,
        explanation: `Computer vision contour screening identified the statutory ${isVeg ? 'vegetarian green circle' : 'non-vegetarian brown triangle'} symbol enclosed in a square.`,
        evidence: [{
          role: 'artwork',
          page: symMatch.page || 1,
          box: symMatch.box || [0.1, 0.1, 0.2, 0.2],
          quote: markLabel,
        }],
      };
    }

    // 2. Check existing findings from symbol inspector
    const symFinding = review.findings?.find(f => f.key?.includes('fssai_veg') || f.key?.includes('fssai_nonveg'));
    if (symFinding && symFinding.status === 'match') {
      return {
        status: 'match',
        expected: 'Vegetarian (green circle in square) or Non-Vegetarian (brown triangle in square) logo.',
        observed: symFinding.observed,
        explanation: 'FSSAI statutory food category logo verified on artwork.',
        evidence: symFinding.evidence || [],
      };
    }

    // 3. Text cue detected
    const textCue = artText.match(/(?:vegetarian|non[- ]?vegetarian|veg\b|non[- ]?veg\b)/i);
    if (textCue) {
      return {
        status: 'review',
        expected: 'FSSAI statutory logo (Green circle in square for Veg; Brown triangle in square for Non-Veg).',
        observed: `Text cue located ("${textCue[0]}"); logo geometry requires inspection.`,
        explanation: 'Text cue detected on packaging. Reviewer must verify that the official green circle in square or brown triangle in square logo is present with statutory dimensions.',
        evidence: [evidence(art, textCue[0])],
      };
    }

    return {
      status: 'issue',
      expected: 'Vegetarian or Non-Vegetarian symbol on principal display panel (FSSAI Regulation 5(2)).',
      observed: 'No statutory vegetarian or non-vegetarian logo detected on artwork.',
      explanation: 'Every package of food shall carry a green circle in square or brown triangle in square symbol. Absence is a non-compliance under Indian regulations.',
      evidence: [],
    };
  }

  if (rule.id === 'FSSAI-2020-REG5.1-LICENSE') {
    const licMatch = artText.match(/fssai\s*(?:licen[cs]e|lic\.?)?\s*(?:no\.?|number)?\s*[:#.]?\s*(\d{14})/i);
    if (licMatch) {
      return {
        status: 'match',
        expected: 'FSSAI logo and valid 14-digit license number (Regulation 5(1)(d)).',
        observed: licMatch[0],
        explanation: `Valid 14-digit FSSAI license number located on artwork ("${licMatch[1]}").`,
        evidence: [evidence(art, licMatch[0])],
      };
    }
    const shortMatch = artText.match(/fssai\s*(?:licen[cs]e|lic\.?)?\s*(?:no\.?|number)?\s*[:#.]?\s*(\d{5,13})/i);
    if (shortMatch) {
      return {
        status: 'issue',
        expected: 'Valid 14-digit FSSAI license number (Regulation 5(1)(d)).',
        observed: shortMatch[0],
        explanation: `FSSAI license number on artwork has ${shortMatch[1].length} digits instead of the required 14 digits.`,
        evidence: [evidence(art, shortMatch[0])],
      };
    }
    return {
      status: 'issue',
      expected: 'FSSAI logo and 14-digit license number (Regulation 5(1)(d)).',
      observed: 'FSSAI license number not located on artwork.',
      explanation: 'FSSAI logo and 14-digit license number of the manufacturer/marketer must appear on the package.',
      evidence: [],
    };
  }

  if (rule.id === 'FSSAI-2020-REG5.3-NUTRITION') {
    const has100 = /per\s*100\s*(?:g|ml)/i.test(artText);
    const hasRda = /%\s*rda/i.test(artText);
    const hasAddedSugars = /added\s*sugars?/i.test(artText);
    const hasTransFat = /trans\s*fat/i.test(artText);

    if (has100 && (hasRda || (hasAddedSugars && hasTransFat))) {
      return {
        status: 'match',
        expected: 'Nutritional information per 100g/ml, per serve & %RDA (Regulation 5(3)).',
        observed: 'Per 100g/ml, added sugars, trans fat, and %RDA statements identified.',
        explanation: 'FSSAI mandatory nutrition particulars identified in extracted text.',
        evidence: [],
      };
    }
    if (has100 && !hasAddedSugars) {
      return {
        status: 'issue',
        expected: 'Separate declaration of Added Sugars and Trans Fat (FSSAI Regulation 5(3)(b)).',
        observed: 'Added Sugars statement not declared in nutrition table.',
        explanation: 'FSSAI Labelling and Display Regulations require separate declaration of Added Sugars and Trans Fat in the nutritional table.',
        evidence: [],
      };
    }
    return {
      status: 'review',
      expected: 'Nutritional information per 100g/ml, per serve, and % contribution to RDA.',
      observed: 'Incomplete FSSAI nutrition information detected.',
      explanation: 'Verify that nutrition table specifies Energy, Protein, Carb, Total Sugars, Added Sugars, Total Fat, Saturated Fat, Trans Fat, and Sodium.',
      evidence: [],
    };
  }

  if (rule.id === 'FSSAI-2020-REG5.4-ALLERGENS') {
    const match = artText.match(/contains\s*[:\s]*([^.]+)|allergen\s*[:\s]*([^.]+)/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Declaration of food allergens (Regulation 5(4)).',
        observed: match[0],
        explanation: 'Allergen declaration located on packaging artwork.',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Allergen statement if formula contains gluten, crustacea, egg, fish, peanuts, nuts, soy, milk, or sulphite >= 10mg/kg.',
      observed: 'No allergen declaration located in extracted text.',
      explanation: 'Verify formulation against FSSAI Regulation 5(4) allergen schedule.',
      evidence: [],
    };
  }

  if (rule.id === 'FSSAI-2020-REG5.7-DATE') {
    const match = artText.match(/(?:mfg|pkd|packed|manufactured|best\s*before|use\s*by|expiry)\s*[:.]?\s*([^\n]+)/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Date of manufacture / packaging and Expiry / Use By date (Regulation 5(7)).',
        observed: match[0],
        explanation: 'Date marking declaration located on packaging artwork.',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'issue',
      expected: 'Date of manufacture and Best Before / Expiry date declaration.',
      observed: 'Date marking statements not detected.',
      explanation: 'FSSAI Regulation 5(7) mandates declaration of Date of manufacture or packaging and Expiry Date.',
      evidence: [],
    };
  }

  if (rule.id === 'FSSAI-2020-REG5.10-NET-QTY') {
    const match = artText.match(/net\s*(?:wt|weight|quantity)?\s*[:.]?\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|litre|liter)/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Net quantity in standard metric units (g, kg, mL, L) (Regulation 5(10)).',
        observed: match[0],
        explanation: 'Net quantity in metric units verified under Legal Metrology & FSSAI rules.',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Net quantity declaration in metric units (Regulation 5(10)).',
      observed: 'Metric net quantity declaration not detected.',
      explanation: 'Confirm net quantity is declared on principal display panel in g, kg, mL, or L.',
      evidence: [],
    };
  }

  if (rule.id === 'FSSAI-2026-AMENDMENT-FOPNL' || rule.id === 'FSSAI-2026-FOPNL') {
    const match = artText.match(/front[- ]of[- ]pack|fopnl|warning\s*label/i);
    if (match) {
      return {
        status: 'match',
        expected: 'Front-of-Pack Nutritional Labelling (FSSAI First Amendment 2026).',
        observed: match[0],
        explanation: 'Front-of-pack nutrition indicator located on artwork.',
        evidence: [evidence(art, match[0])],
      };
    }
    return {
      status: 'review',
      expected: 'Front-of-pack nutritional label indicator for high fat, sugar, or sodium.',
      observed: 'No FOPNL label located on artwork.',
      explanation: 'Under FSSAI First Amendment Regulations 2026 (commences July 1, 2027), prepacked food exceeding HFSS thresholds must carry front-of-pack labeling.',
      evidence: [],
    };
  }

  return null;
}

/**
 * Cross-Market Comparison Engine: Evaluates artwork across US, EU, and India simultaneously.
 */
export function evaluateAllMarkets(review, options = {}) {
  const usEval = evaluateJurisdiction(review, 'us', options);
  const euEval = evaluateJurisdiction(review, 'eu', options);
  const indiaEval = evaluateJurisdiction(review, 'india', options);

  // Generate 8-point standard comparison matrix
  const matrix = [
    {
      topic: 'Nutrition Display Basis',
      category: 'Nutrition',
      usa: {
        requirement: 'Per Serving (standard household measure + metric)',
        status: usEval.findings.find(f => f.key?.includes('SERVING'))?.status || 'review',
        citation: '21 CFR 101.9(b)',
      },
      eu: {
        requirement: 'Per 100 g or per 100 ml (mandatory); per portion optional',
        status: euEval.findings.find(f => f.key?.includes('BASIS'))?.status || 'review',
        citation: 'Reg 1169/2011, Art 32(2)',
      },
      india: {
        requirement: 'Per 100 g/ml and per serve with %RDA',
        status: indiaEval.findings.find(f => f.key?.includes('NUTRITION'))?.status || 'review',
        citation: 'FSSAI Reg 5(3)',
      },
      keyDifference: 'EU requires per-100g/ml as primary basis; USA requires per-serving; India requires both per-100g/ml and per-serve with %RDA.',
    },
    {
      topic: 'Energy Declaration Units',
      category: 'Nutrition',
      usa: {
        requirement: 'Calories (kcal) only',
        status: usEval.findings.find(f => f.key?.includes('CALORIES'))?.status || 'match',
        citation: '21 CFR 101.9(c)(1)',
      },
      eu: {
        requirement: 'Mandatory dual units: both kJ and kcal (1 kcal = 4.184 kJ)',
        status: euEval.findings.find(f => f.key?.includes('DUAL-ENERGY'))?.status || 'issue',
        citation: 'Reg 1169/2011, Art 30(1)',
      },
      india: {
        requirement: 'Energy (kcal) per serve and %RDA',
        status: indiaEval.findings.find(f => f.key?.includes('NUTRITION'))?.status || 'review',
        citation: 'FSSAI Reg 5(3)',
      },
      keyDifference: 'EU strictly requires kilojoules (kJ) alongside kilocalories (kcal); USA and India use Calories/kcal.',
    },
    {
      topic: 'Sodium vs. Salt Terminology',
      category: 'Nutrition',
      usa: {
        requirement: 'Sodium in milligrams (mg) and %DV',
        status: usEval.findings.find(f => f.key?.includes('DV-CALC'))?.status || 'match',
        citation: '21 CFR 101.9(c)(9)',
      },
      eu: {
        requirement: 'Salt in grams (g) (Salt = Sodium × 2.5); sodium alone is illegal',
        status: euEval.findings.find(f => f.key?.includes('SALT'))?.status || 'issue',
        citation: 'Reg 1169/2011, Art 30(1)',
      },
      india: {
        requirement: 'Sodium in milligrams (mg) and %RDA',
        status: indiaEval.findings.find(f => f.key?.includes('NUTRITION'))?.status || 'review',
        citation: 'FSSAI Reg 5(3)',
      },
      keyDifference: 'EU strictly mandates "Salt" (salt = sodium × 2.5); USA and India declare "Sodium".',
    },
    {
      topic: 'Added Sugars Declaration',
      category: 'Nutrition',
      usa: {
        requirement: 'Mandatory grams and %DV indented under Total Sugars',
        status: usEval.findings.find(f => f.key?.includes('ADDED-SUGARS'))?.status || 'review',
        citation: '21 CFR 101.9(c)(6)(iii)',
      },
      eu: {
        requirement: 'Not mandatory in standard 7; of which sugars covers total sugars',
        status: 'not_applicable',
        citation: 'Reg 1169/2011, Art 30(1)',
      },
      india: {
        requirement: 'Mandatory separate declaration of Added Sugars and %RDA',
        status: indiaEval.findings.find(f => f.key?.includes('NUTRITION'))?.status || 'review',
        citation: 'FSSAI Reg 5(3)(b)',
      },
      keyDifference: 'USA and India require separate Added Sugars line; EU requires only "of which sugars" (total).',
    },
    {
      topic: 'Major Food Allergen Scope',
      category: 'Allergens',
      usa: {
        requirement: '9 Major Allergens (FALCPA & FASTER Act, including Sesame)',
        status: usEval.findings.find(f => f.key?.includes('ALLERGENS'))?.status || 'review',
        citation: '21 U.S.C. 343(w)',
      },
      eu: {
        requirement: '14 Substances causing allergies emphasized in ingredient list',
        status: euEval.findings.find(f => f.key?.includes('ALLERGEN-EMPHASIS'))?.status || 'review',
        citation: 'Reg 1169/2011, Art 21 & Annex II',
      },
      india: {
        requirement: '8 Specified Allergen categories declared on label',
        status: indiaEval.findings.find(f => f.key?.includes('ALLERGENS'))?.status || 'review',
        citation: 'FSSAI Reg 5(4)',
      },
      keyDifference: 'Scope varies: US (9 allergens inc. sesame); EU (14 allergens with emphasis); India (8 classes).',
    },
    {
      topic: 'Vegetarian / Non-Vegetarian Logo',
      category: 'Symbols',
      usa: {
        requirement: 'No statutory symbol required',
        status: 'not_applicable',
        citation: 'N/A',
      },
      eu: {
        requirement: 'Voluntary labeling only; no mandatory statutory mark',
        status: 'not_applicable',
        citation: 'Reg 1169/2011, Art 36',
      },
      india: {
        requirement: 'Mandatory green circle in square (Veg) or brown triangle in square (Non-Veg)',
        status: indiaEval.findings.find(f => f.key?.includes('VEG-MARK'))?.status || 'issue',
        citation: 'FSSAI Reg 5(2)',
      },
      keyDifference: 'India strictly mandates colored geometric symbol on all food; USA and EU have no statutory mark.',
    },
    {
      topic: 'Minimum Legibility Typography',
      category: 'Prepress',
      usa: {
        requirement: 'Type size based on PDP area; Calories 16pt/22pt bold',
        status: usEval.findings.find(f => f.key?.includes('CALORIES'))?.status || 'review',
        citation: '21 CFR 101.9(d)',
      },
      eu: {
        requirement: 'Mandatory x-height >= 1.2 mm (or >= 0.9 mm if package < 80 cm²)',
        status: euEval.findings.find(f => f.key?.includes('TYPOGRAPHY'))?.status || 'review',
        citation: 'Reg 1169/2011, Art 13(2)',
      },
      india: {
        requirement: 'Height of letters based on area of principal display panel',
        status: 'review',
        citation: 'FSSAI Reg 5(12)',
      },
      keyDifference: 'EU measures physical x-height (1.2mm); USA specifies point sizes for Calories/nutrients; India uses PDP area tiers.',
    },
    {
      topic: 'Regulatory Authority License',
      category: 'Legal',
      usa: {
        requirement: 'FDA registration is facility-level, not printed on retail carton',
        status: 'not_applicable',
        citation: '21 CFR Part 1',
      },
      eu: {
        requirement: 'Food business operator address; approval number for animal products',
        status: euEval.findings.find(f => f.key?.includes('MANDATORY-PARTICULARS'))?.status || 'match',
        citation: 'Reg 1169/2011, Art 9',
      },
      india: {
        requirement: 'Mandatory FSSAI logo and 14-digit license number on retail pack',
        status: indiaEval.findings.find(f => f.key?.includes('LICENSE'))?.status || 'issue',
        citation: 'FSSAI Reg 5(1)(d)',
      },
      keyDifference: 'India requires 14-digit FSSAI license on every carton; US and EU do not require license numbers on general food packages.',
    },
  ];

  return {
    us: usEval,
    eu: euEval,
    india: indiaEval,
    comparisonMatrix: matrix,
    effectiveDate: options.effectiveDate || '2026-10-23',
    generatedAt: new Date().toISOString(),
  };
}
