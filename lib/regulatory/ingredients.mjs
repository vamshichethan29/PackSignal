/**
 * PackSignal Deterministic Ingredient Declaration Engine (lib/regulatory/ingredients.mjs)
 * Implements 21 CFR 101.4 (Food; designation of ingredients) checks:
 * - Common or usual name concordance
 * - Descending order of predominance by weight
 * - Subingredient tree parsing
 * - Chemical preservative function declaration (21 CFR 101.22)
 * - Omitted and unapproved ingredient detection
 */

import { normal } from '../engine.mjs';

/**
 * Splits ingredient text by commas, respecting parentheses and nested subingredients.
 */
export function parseIngredientList(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.replace(/^ingredients\s*[:.-]?\s*/i, '').trim();
  const items = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

    if ((ch === ',' || ch === ';') && depth === 0) {
      if (current.trim()) items.push(parseSingleIngredient(current.trim()));
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(parseSingleIngredient(current.trim()));
  return items;
}

function parseSingleIngredient(str) {
  const match = str.match(/^([^(]+)(?:\(([^)]+)\))?/);
  const name = (match ? match[1] : str).trim();
  const subStr = match && match[2] ? match[2].trim() : null;
  const subingredients = subStr ? subStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Extract declared percentage if present (e.g. "Honey (9%)" or "Oats 50%")
  const pctMatch = str.match(/(\d+(?:\.\d+)?)\s*%/);
  const percentage = pctMatch ? Number(pctMatch[1]) : null;

  // Extract preservative function statement (e.g. "Preserved with Citric Acid" or "(to protect flavor)")
  const hasPreservativeFunction = /\b(to preserve|preservative|protect flavor|maintain freshness|anti[- ]caking)\b/i.test(str);

  return {
    raw: str,
    name,
    normName: normal(name),
    percentage,
    subingredients,
    hasPreservativeFunction,
  };
}

/**
 * Evaluates ingredient declaration against approved source formulation.
 */
export function evaluateIngredientDeclaration(sourceIngredientsStr, artworkIngredientsStr, formulationHasWeights = false) {
  if (!sourceIngredientsStr || !artworkIngredientsStr) {
    return {
      status: 'unable',
      verdict: 'INSUFFICIENT_INPUT',
      explanation: 'Both source formulation and artwork ingredient text are required.',
      omissions: [],
      additions: [],
      orderIssues: [],
    };
  }

  const sourceItems = parseIngredientList(sourceIngredientsStr);
  const artItems = parseIngredientList(artworkIngredientsStr);

  const sourceMap = new Map(sourceItems.map((item, idx) => [item.normName, { item, order: idx }]));
  const artMap = new Map(artItems.map((item, idx) => [item.normName, { item, order: idx }]));

  // 1. Detect omitted ingredients from source
  const omissions = [];
  for (const [norm, { item }] of sourceMap) {
    if (!artMap.has(norm)) {
      // Check partial token inclusion
      const tokenMatch = [...artMap.keys()].some(artNorm => artNorm.includes(norm) || norm.includes(artNorm));
      if (!tokenMatch) {
        omissions.push(item.raw);
      }
    }
  }

  // 2. Detect unapproved additions on artwork
  const additions = [];
  for (const [norm, { item }] of artMap) {
    if (!sourceMap.has(norm)) {
      const tokenMatch = [...sourceMap.keys()].some(srcNorm => srcNorm.includes(norm) || norm.includes(srcNorm));
      if (!tokenMatch) {
        additions.push(item.raw);
      }
    }
  }

  // 3. Evaluate descending order by weight (21 CFR 101.4(a)(1))
  const orderIssues = [];
  if (formulationHasWeights) {
    // Check if relative order in artwork matches source order
    let lastSourceIndex = -1;
    for (const artItem of artItems) {
      const srcEntry = sourceMap.get(artItem.normName);
      if (srcEntry) {
        if (srcEntry.order < lastSourceIndex) {
          orderIssues.push({
            ingredient: artItem.raw,
            artworkPosition: artItems.indexOf(artItem) + 1,
            expectedOrder: srcEntry.order + 1,
            reason: `Declared out of descending order: "${artItem.raw}" appears earlier on artwork than supported by formulation weights.`,
          });
        } else {
          lastSourceIndex = srcEntry.order;
        }
      }
    }
  }

  // 4. Percentage discrepancies
  const percentageMismatches = [];
  for (const src of sourceItems) {
    if (src.percentage != null) {
      const artMatch = artItems.find(a => a.normName === src.normName);
      if (artMatch && artMatch.percentage != null && artMatch.percentage !== src.percentage) {
        percentageMismatches.push({
          ingredient: src.name,
          sourcePercentage: src.percentage,
          artworkPercentage: artMatch.percentage,
        });
      }
    }
  }

  const hasIssues = omissions.length > 0 || additions.length > 0 || percentageMismatches.length > 0 || orderIssues.length > 0;

  return {
    status: hasIssues ? 'issue' : 'match',
    verdict: hasIssues ? 'INGREDIENT_DISCREPANCY' : 'INGREDIENT_CONCORDANCE',
    omissions,
    additions,
    orderIssues,
    percentageMismatches,
    sourceItemCount: sourceItems.length,
    artItemCount: artItems.length,
    citation: '21 CFR 101.4(a)(1)',
    explanation: hasIssues
      ? `Ingredient declaration discrepancy: ${[
          omissions.length ? `${omissions.length} approved ingredient(s) omitted (${omissions.join(', ')})` : null,
          additions.length ? `${additions.length} unapproved ingredient(s) printed (${additions.join(', ')})` : null,
          percentageMismatches.length ? `${percentageMismatches.map(p => `${p.ingredient}: ${p.artworkPercentage}% on pack vs ${p.sourcePercentage}% in spec`).join('; ')}` : null,
          orderIssues.length ? 'Descending order conflict' : null,
        ].filter(Boolean).join('. ')}.`
      : `Artwork ingredient declaration matches approved source formulation (${artItems.length} ingredients verified).`,
  };
}

export function compareIngredientDeclarations(artworkIngredientsStr, sourceIngredientsStr, options = {}) {
  const formulationHasWeights = options.hasFormulationWeights ?? false;
  const res = evaluateIngredientDeclaration(sourceIngredientsStr, artworkIngredientsStr, formulationHasWeights);
  return {
    status: res.status,
    omittedIngredients: res.omissions,
    unapprovedAdditions: res.additions,
    orderCheck: !formulationHasWeights ? 'REVIEW_REQUIRED' : (res.orderIssues.length > 0 ? 'FAIL' : 'PASS'),
    notes: !formulationHasWeights ? 'Weight order unverified without formulation percentage data' : '',
    explanation: res.explanation,
  };
}

export const parseParentheticalIngredients = parseIngredientList;

export function checkPreservativeFunction(ingredientStr) {
  return /\b(to preserve|preservative|protect flavor|maintain freshness|anti[- ]caking)\b/i.test(ingredientStr);
}

