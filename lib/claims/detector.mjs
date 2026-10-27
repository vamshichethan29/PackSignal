/**
 * PackSignal Claims Intelligence — Claim Detector
 * (lib/claims/detector.mjs)
 *
 * Implements Step 18 of Phase 6:
 * Detects packaging claims from artwork text with exact quotations,
 * page/box location, negation suppression, and qualified vs unqualified phrasing.
 */

import { CLAIM_TYPES } from './registry.mjs';

export const CLAIM_PATTERNS = [
  {
    type: CLAIM_TYPES.RECYCLABILITY,
    label: 'Recyclability claim',
    pattern: /\b(?:100\s*%\s*)?recyclable\b/ig
  },
  {
    type: CLAIM_TYPES.RECYCLED_CONTENT,
    label: 'Recycled-content claim',
    pattern: /\b(?:made with|contains)\s+\d{1,3}\s*%\s+recycled\s+(?:content|material|plastic|paper|board)\b/ig
  },
  {
    type: CLAIM_TYPES.COMPOSTABILITY,
    label: 'Compostability claim',
    pattern: /\b(?:home\s+|industrially\s+)?compostable\b/ig
  },
  {
    type: CLAIM_TYPES.CARBON_IMPACT,
    label: 'Carbon impact claim',
    pattern: /\bcarbon[- ]?(?:neutral|negative|positive)\b/ig
  },
  {
    type: CLAIM_TYPES.SUSTAINABILITY,
    label: 'Eco-friendly claim',
    pattern: /\b(?:eco[ -]?friendly|environmentally friendly|sustainable packaging|zero[- ]waste)\b/ig
  },
  {
    type: CLAIM_TYPES.VEGAN,
    label: 'Vegan certification claim',
    pattern: /\b(?:certified\s+)?vegan\b/ig
  },
  {
    type: CLAIM_TYPES.ORGANIC,
    label: 'Organic claim',
    pattern: /\b(?:100\s*%\s*)?(?:certified\s+)?organic\b/ig
  },
  {
    type: CLAIM_TYPES.PRODUCT_ATTRIBUTE,
    label: 'Naturalness claim',
    pattern: /\b(?:100\s*%\s*(?:all[- ]?)?natural|all[- ]natural|gmo\s*free|non[- ]gmo)\b/ig
  },
  {
    type: CLAIM_TYPES.NUTRIENT_CONTENT,
    label: 'Nutrient content claim',
    pattern: /\b(?:no added sugar|zero sugar|low fat|high protein)\b/ig
  }
];

/**
 * Checks whether a matched phrase is part of a negative instruction (e.g. "not recyclable").
 */
function isNegated(fullText, matchIndex) {
  const preceding = fullText.slice(Math.max(0, matchIndex - 30), matchIndex).toLowerCase();
  return /\b(?:not|never|non|un)\s*$/.test(preceding) || /\b(?:do not|must not|cannot)\s*$/.test(preceding);
}

/**
 * Detects claims across artwork document pages.
 */
export function detectArtworkClaims(artworkDoc = {}) {
  const detected = [];
  const seenQuotes = new Set();
  const pages = artworkDoc.pages || [];

  for (const page of pages) {
    const pageText = String(page.text || '');

    for (const rule of CLAIM_PATTERNS) {
      rule.pattern.lastIndex = 0;
      for (const match of pageText.matchAll(rule.pattern)) {
        const rawQuote = match[0].trim();
        const matchIndex = match.index || 0;

        if (!rawQuote || isNegated(pageText, matchIndex)) continue;

        const lowerKey = rawQuote.toLowerCase();
        if (seenQuotes.has(lowerKey)) continue;
        seenQuotes.add(lowerKey);

        detected.push({
          claimType: rule.type,
          label: rule.label,
          rawQuote,
          page: page.number || 1,
          location: `Page ${page.number || 1}`,
          box: null, // Box can be populated from matching text spans if available
          isQualified: /\b(?:where facilities exist|check locally|under industrial conditions)\b/i.test(pageText)
        });
      }
    }
  }

  // Fallback to full document text if pages didn't yield matches
  if (detected.length === 0 && artworkDoc.text) {
    const fullText = String(artworkDoc.text);
    for (const rule of CLAIM_PATTERNS) {
      rule.pattern.lastIndex = 0;
      for (const match of fullText.matchAll(rule.pattern)) {
        const rawQuote = match[0].trim();
        const matchIndex = match.index || 0;
        if (!rawQuote || isNegated(fullText, matchIndex)) continue;

        const lowerKey = rawQuote.toLowerCase();
        if (seenQuotes.has(lowerKey)) continue;
        seenQuotes.add(lowerKey);

        detected.push({
          claimType: rule.type,
          label: rule.label,
          rawQuote,
          page: 1,
          location: 'Artwork text',
          box: null,
          isQualified: /\b(?:where facilities exist|check locally|under industrial conditions)\b/i.test(fullText)
        });
      }
    }
  }

  return detected;
}
