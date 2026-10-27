/**
 * lib/nutrition/parser.mjs
 * 
 * Deterministic parser for Nutrition Facts panels on packaging artwork
 * and source specifications. Extracts declared nutrients, units, %DVs,
 * serving sizes, servings per container, and panel layouts with line-level evidence.
 */

import { normalizeNutrientId, getNutrientDefinition, NUTRIENTS } from './nutrient-registry.mjs';

/**
 * Regex patterns for nutrition panel detection and line parsing
 */
const PANEL_HEADER_REGEX = /\b(?:nutrition\s+facts|nutrition\s+information|supplement\s+facts)\b/i;
const SERVING_SIZE_REGEX = /\bserving\s+size\s*[:\s]?\s*([^\n\r]+)/i;
const SERVINGS_PER_CONTAINER_REGEX = /(?:about\s+)?(\d+(?:\.\d+)?)\s+servings?\s+per\s+container|servings?\s+per\s+container\s*[:\s]?\s*(?:about\s+)?(\d+(?:\.\d+)?)/i;
const CALORIES_REGEX = /\bcalories\s*[:\s]?\s*(\d+)\b/i;

/**
 * Nutrient extraction pattern for standard lines:
 * e.g., "Total Fat 8g 10%", "Total Carbohydrate 30g 11% DV", "Sodium 230mg 10%"
 * or dual column: "Total Fat 8g 10% 16g 20%"
 */
const NUTRIENT_VALUE_UNIT_REGEX = /(\d+(?:\.\d+)?)\s*(mcg|mg|g|kcal|kj|%)\b/gi;
const PERCENT_DV_REGEX = /(\d+(?:\.\d+)?)\s*%(?:\s*(?:dv|daily\s+value)\b)?/gi;

/**
 * Parse an artwork document's lines or text into detected Nutrition Panels.
 * 
 * @param {Object} artwork - Artwork document with text or lines
 * @returns {Array<Object>} List of detected nutrition panels
 */
export function parseArtworkNutritionPanels(artwork) {
  if (!artwork) return [];

  const rawLines = artwork.lines?.length
    ? artwork.lines
    : (artwork.text || '').split(/\r?\n/).map((text, idx) => ({
        text,
        line: idx + 1,
        page: 1,
        box: null
      }));

  const lines = rawLines
    .map(item => ({ ...item, text: String(item.text || '').trim() }))
    .filter(item => item.text.length > 0);

  const panels = [];
  let currentPanel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect new panel header
    if (PANEL_HEADER_REGEX.test(line.text)) {
      if (currentPanel && currentPanel.rawLines.length > 0) {
        finalizePanel(currentPanel);
        panels.push(currentPanel);
      }
      currentPanel = {
        panelId: `panel-${panels.length + 1}`,
        page: line.page || 1,
        title: line.text,
        headerLine: line,
        box: line.box || null,
        panelType: 'STANDARD_US_NFT',
        servingBasis: 'PER_SERVING',
        columns: [{ id: 'col-1', label: 'Per Serving', basis: 'PER_SERVING' }],
        servingSizeText: null,
        servingSizeGrams: null,
        servingSizeUnit: null,
        servingsPerContainer: null,
        servingsPerContainerText: null,
        calories: null,
        rawLines: [line],
        nutrientRecords: []
      };
      continue;
    }

    if (currentPanel) {
      // Check if this line belongs to the current nutrition panel or marks end of panel
      // A panel ends if we hit another header or if we see unrelated text after nutrients
      if (isEndOfPanel(line.text, currentPanel.rawLines.length)) {
        finalizePanel(currentPanel);
        panels.push(currentPanel);
        currentPanel = null;
        continue;
      }

      currentPanel.rawLines.push(line);
      if (line.box && !currentPanel.box) {
        currentPanel.box = line.box;
      }
    }
  }

  if (currentPanel && currentPanel.rawLines.length > 0) {
    finalizePanel(currentPanel);
    panels.push(currentPanel);
  }

  // If no explicit panel header was found, but nutrient lines exist across the document,
  // create a default synthetic panel to inspect them without failing completely.
  if (panels.length === 0 && lines.some(l => isNutrientLine(l.text))) {
    const synthetic = {
      panelId: 'panel-1',
      page: 1,
      title: 'Nutrition Facts (Detected)',
      headerLine: null,
      box: null,
      panelType: 'STANDARD_US_NFT',
      servingBasis: 'PER_SERVING',
      columns: [{ id: 'col-1', label: 'Per Serving', basis: 'PER_SERVING' }],
      servingSizeText: null,
      servingSizeGrams: null,
      servingSizeUnit: null,
      servingsPerContainer: null,
      servingsPerContainerText: null,
      calories: null,
      rawLines: lines,
      nutrientRecords: []
    };
    finalizePanel(synthetic);
    if (synthetic.nutrientRecords.length > 0 || synthetic.calories !== null) {
      panels.push(synthetic);
    }
  }


  return panels;
}

/**
 * Checks if line text indicates end of Nutrition Facts panel
 */
function isEndOfPanel(text, lineCount) {
  if (lineCount < 3) return false;
  // Ingredients list or allergen statement typically starts after nutrition panel
  if (/^(?:ingredients|contains|manufactured by|distributed by|best before|keep refrigerated)\b/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Checks if a string contains common nutrient names
 */
function isNutrientLine(text) {
  return /^(?:calories|total fat|saturated fat|trans fat|cholesterol|sodium|total carb|dietary fib|total sugars|includes|protein|vitamin d|calcium|iron|potassium)\b/i.test(text);
}

/**
 * Finalizes panel extraction from its raw lines
 */
function finalizePanel(panel) {
  let inDualColumn = false;

  for (let i = 0; i < panel.rawLines.length; i++) {
    const line = panel.rawLines[i];
    const text = line.text;

    // Detect dual column header
    // e.g. "Per serving | Per container" or "1/2 cup | 1 pouch"
    if (/\bper\s+serving\b/i.test(text) && /\bper\s+(?:container|package|100\s*g)\b/i.test(text)) {
      inDualColumn = true;
      panel.panelType = 'DUAL_COLUMN_NFT';
      panel.columns = [
        { id: 'col-1', label: 'Per Serving', basis: 'PER_SERVING' },
        { id: 'col-2', label: 'Per Container', basis: 'PER_CONTAINER' }
      ];
      continue;
    }

    // Serving size
    const ssMatch = text.match(SERVING_SIZE_REGEX);
    if (ssMatch && !panel.servingSizeText) {
      panel.servingSizeText = ssMatch[1].trim();
      const metricMatch = panel.servingSizeText.match(/(\d+(?:\.\d+)?)\s*(g|ml|mg|oz)\b/i);
      if (metricMatch) {
        panel.servingSizeGrams = Number(metricMatch[1]);
        panel.servingSizeUnit = metricMatch[2].toLowerCase();
      }
      continue;
    }

    // Servings per container
    const spcMatch = text.match(SERVINGS_PER_CONTAINER_REGEX);
    if (spcMatch && !panel.servingsPerContainer) {
      const spcVal = spcMatch[1] || spcMatch[2];
      panel.servingsPerContainer = Number(spcVal);
      panel.servingsPerContainerText = text;
      continue;
    }

    // Calories
    const calMatch = text.match(CALORIES_REGEX);
    if (calMatch && panel.calories === null) {
      // In dual column, could have two numbers: e.g. "Calories 140 280"
      const allNums = Array.from(text.matchAll(/\b(\d+)\b/g)).map(m => Number(m[1]));
      // Exclude the word "calories" position if matched
      const validNums = allNums.filter(n => n >= 0 && n < 10000);
      if (validNums.length > 0) {
        panel.calories = validNums[0];
        if (validNums.length > 1 && panel.columns.length > 1) {
          panel.caloriesSecondary = validNums[1];
        }
      }
      continue;
    }

    // Parse Nutrient lines
    const parsedNutrients = parseNutrientLine(line, panel.columns);
    if (parsedNutrients.length > 0) {
      panel.nutrientRecords.push(...parsedNutrients);
    }
  }
}

/**
 * Parses a single line for nutrient name, amount, unit, and printed %DV
 */
export function parseNutrientLine(line, columns = [{ id: 'col-1', basis: 'PER_SERVING' }]) {
  const text = line.text;
  const records = [];

  // Match nutrient canonical identity
  const nutrientId = normalizeNutrientId(text);
  if (!nutrientId) return records;

  const def = getNutrientDefinition(nutrientId);

  // Extract all amounts + units in this line
  // e.g. "8g" -> 8, g
  const amounts = [];
  const amountMatches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(mcg|mg|g|kcal|kj|%)\b/gi));
  for (const m of amountMatches) {
    if (m[2].toLowerCase() === '%') continue; // % is DV, not mass/energy unit
    amounts.push({
      value: Number(m[1]),
      unit: m[2]
    });
  }

  // Extract all % DV mentions
  // e.g. "10%" -> 10
  const dvs = [];
  const dvMatches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*%(?:\s*(?:dv|daily\s+value)\b)?/gi));
  for (const m of dvMatches) {
    dvs.push(Number(m[1]));
  }


  // If there's 1 column or only 1 amount found:
  if (amounts.length > 0) {
    const rec1 = {
      nutrientId,
      canonicalName: def?.canonicalName || nutrientId,
      printedAmount: amounts[0].value,
      printedUnit: amounts[0].unit,
      printedDvPercent: dvs.length > 0 ? dvs[0] : null,
      columnId: columns[0]?.id || 'col-1',
      basis: columns[0]?.basis || 'PER_SERVING',
      artworkPage: line.page || 1,
      artworkLine: line.line || null,
      artworkBox: line.box || null,
      artworkQuote: line.text,
      extractionMethod: 'artwork_text_parser'
    };
    records.push(rec1);

    // If dual column with secondary amount:
    if (columns.length > 1 && amounts.length > 1) {
      const rec2 = {
        nutrientId,
        canonicalName: def?.canonicalName || nutrientId,
        printedAmount: amounts[1].value,
        printedUnit: amounts[1].unit,
        printedDvPercent: dvs.length > 1 ? dvs[1] : null,
        columnId: columns[1].id,
        basis: columns[1].basis,
        artworkPage: line.page || 1,
        artworkLine: line.line || null,
        artworkBox: line.box || null,
        artworkQuote: line.text,
        extractionMethod: 'artwork_text_parser'
      };
      records.push(rec2);
    }
  } else if (dvs.length > 0) {
    // Only %DV found, amount missing
    records.push({
      nutrientId,
      canonicalName: def?.canonicalName || nutrientId,
      printedAmount: null,
      printedUnit: def?.standardUnit || null,
      printedDvPercent: dvs[0],
      columnId: columns[0]?.id || 'col-1',
      basis: columns[0]?.basis || 'PER_SERVING',
      artworkPage: line.page || 1,
      artworkLine: line.line || null,
      artworkBox: line.box || null,
      artworkQuote: line.text,
      extractionMethod: 'artwork_text_parser'
    });
  }

  return records;
}

/**
 * Normalizes a list of review facts into typed nutrient records with source cell metadata.
 * 
 * @param {Array<Object>} facts - List of source facts from review
 * @returns {Array<Object>} Normalized source nutrient records
 */
export function normalizeSourceNutrients(facts) {
  if (!Array.isArray(facts)) return [];

  const records = [];

  for (const fact of facts) {
    if (!fact || !fact.field) continue;
    let nutrientId = null;

    if (fact.field.startsWith('nutrition.')) {
      nutrientId = normalizeNutrientId(fact.field.replace(/^nutrition\./, ''));
    } else {
      nutrientId = normalizeNutrientId(fact.field);
    }

    if (!nutrientId) continue;
    const def = getNutrientDefinition(nutrientId);

    // Parse numeric value and unit
    const strVal = String(fact.value ?? '').trim();
    const valMatch = strVal.match(/(-?\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?/);
    if (!valMatch) continue;

    const numericValue = Number(valMatch[1]);
    const parsedUnit = valMatch[2] || def?.standardUnit || '';

    const ev = fact.evidence || {};
    const context = ev.context || fact.sourceContext || {};

    records.push({
      nutrientId,
      canonicalName: def?.canonicalName || nutrientId,
      value: numericValue,
      unit: parsedUnit,
      basis: fact.basis || 'PER_SERVING',
      sourceDocumentId: ev.documentId || fact.documentId || 'source-doc',
      sourceDocumentHash: ev.documentHash || fact.documentHash || null,
      sourceSheet: ev.sheet || context.sheet || null,
      sourceCell: ev.cell || context.cell || null,
      sourceQuote: fact.value,
      sourceApprovalState: fact.sourceApprovalState || 'UNKNOWN',
      ambiguous: Boolean(fact.ambiguous),
      variants: fact.variants || [],
      extractionMethod: 'source_fact_normalizer'
    });
  }

  return records;
}
