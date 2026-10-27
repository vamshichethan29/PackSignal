/**
 * PackSignal — Competitor Snap Analysis Engine (lib/campus/competitor-snap.mjs)
 * Phase 10 Campus Extra: Snap any competitor pack to extract claims into the brief,
 * providing real-time competitive differentiation analysis on the prepress table.
 */

export const KNOWN_COMPETITOR_PATTERNS = [
  { claim: 'No Added Sugar', category: 'Nutrition Claim', pattern: /\b(?:no\s+added\s+sugar|zero\s+added\s+sugar|0g\s+added\s+sugar)\b/i },
  { claim: 'High Protein', category: 'Nutritional Claim', pattern: /\b(?:high\s+protein|source\s+of\s+protein|\d+g\s+(?:plant\s+)?protein|plant[- ]based\s+protein)\b/i },
  { claim: '100% Whole Grain', category: 'Formulation Claim', pattern: /\b(?:100%\s+whole\s+grain|whole\s+grain\s+first\s+ingredient)\b/i },
  { claim: 'Gluten Free', category: 'Allergen / Dietary Claim', pattern: /\b(?:gluten[- ]free|certified\s+gluten[- ]free)\b/i },
  { claim: 'Vegan Certified', category: 'Dietary Mark', pattern: /\b(?:vegan|100%\s+vegan|plant[- ]based)\b/i },
  { claim: 'Non-GMO Verified', category: 'Sourcing Certification', pattern: /\b(?:non[- ]gmo|non[- ]gmo\s+project\s+verified)\b/i },
  { claim: 'Keto Friendly', category: 'Dietary Claim', pattern: /\b(?:keto|keto[- ]friendly|low[- ]carb)\b/i },
  { claim: 'Heart Healthy', category: 'Health Claim', pattern: /\b(?:heart\s+healthy|may\s+reduce\s+the\s+risk\s+of\s+heart\s+disease)\b/i },
];

/**
 * Extracts marketing and regulatory claims from raw competitor packaging text.
 * @param {string} rawText - Text extracted from competitor package photo/OCR
 * @param {string} competitorBrand - Competitor brand name (e.g. 'Nature Valley', 'Tata Tea')
 */
export function extractCompetitorClaims(rawText = '', competitorBrand = 'Competitor SKU') {
  const detectedClaims = [];
  const text = String(rawText || '');

  for (const item of KNOWN_COMPETITOR_PATTERNS) {
    const match = text.match(item.pattern);
    if (match) {
      detectedClaims.push({
        claim: item.claim,
        category: item.category,
        detectedPhrase: match[0],
        confidence: 0.95,
      });
    }
  }

  // Also extract any nutrient declarations if present
  const proteinMatch = text.match(/protein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const sugarMatch = text.match(/(?:added\s+)?sugars?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const caloriesMatch = text.match(/(?:calories|energy)\s*[:\-]?\s*(\d+)/i);

  return {
    competitorBrand,
    totalClaimsDetected: detectedClaims.length,
    claims: detectedClaims,
    nutritionHighlights: {
      proteinGrams: proteinMatch ? parseFloat(proteinMatch[1]) : null,
      sugarGrams: sugarMatch ? parseFloat(sugarMatch[1]) : null,
      calories: caloriesMatch ? parseInt(caloriesMatch[1], 10) : null,
    },
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Benchmarks extracted competitor claims against our approved brand specification.
 * Identifies competitive advantages and regulatory vulnerabilities.
 */
export function benchmarkCompetitorAgainstBrief(competitorAnalysis, ourApprovedSpec) {
  const briefClaims = new Set(
    (ourApprovedSpec?.claims || ['100% Whole Grain', 'High Fiber', 'Vegan Certified']).map(c => c.toLowerCase())
  );

  const comparisonMatrix = [];

  for (const compClaim of competitorAnalysis.claims || []) {
    const isShared = briefClaims.has(compClaim.claim.toLowerCase());
    comparisonMatrix.push({
      claim: compClaim.claim,
      category: compClaim.category,
      competitorPresence: 'Present on shelf',
      ourSpecification: isShared ? 'Approved in Brief' : 'Absent from our pack',
      strategicRecommendation: isShared
        ? 'Parity claim — ensure prominent physical dieline placement.'
        : `Competitive differentiator: Competitor highlights "${compClaim.claim}". Consider substantiating in next revision.`,
    });
  }

  return {
    competitor: competitorAnalysis.competitorBrand,
    comparisonMatrix,
    benchmarkedCount: comparisonMatrix.length,
  };
}
