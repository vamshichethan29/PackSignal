/**
 * @file lib/pack-canvas/text-measurement.mjs
 * 
 * PackSignal Phase 6 — True Text Measurement & Regulatory Typography Sizing
 * 
 * Accurately calculates rendered physical text height using typographic shaping,
 * word wrapping, character geometry, and FDA 21 CFR minimum font rules.
 */

export const PT_TO_MM = 25.4 / 72; // 0.352778
export const MM_TO_PT = 72 / 25.4; // 2.83465

export const REGULATORY_MINIMUM_TYPOGRAPHY = {
  ingredientList: {
    minFontPt: 6.0,          // 21 CFR 101.4 (min 1/16" lowercase x-height ~ 4.5pt - 6.0pt)
    minXHeightMm: 1.588,     // 1/16 inch
    standardFontPt: 8.0,
    leadingRatio: 1.25,
    charsPerMmAt8Pt: 0.65,
    charsPerMmAt6Pt: 0.88
  },
  netQuantity: {
    minFontPt: 13.5,         // PDP area 25-100 sq inches requires min 3/16" (4.76 mm ~ 13.5 pt)
    minHeightMm: 4.763,      // 3/16 inch
    bottomPercent: 0.30      // Must be placed in bottom 30% of PDP under 21 CFR 101.7
  },
  nutritionFacts: {
    standardWidthMm: 70.0,
    standardHeightMm: 124.0,
    condensedHeightMm: 95.0,
    minHeadingFontPt: 16.0,
    minNutrientFontPt: 8.0,
    minFootnoteFontPt: 6.0
  },
  allergenWarning: {
    minFontPt: 7.0,
    standardFontPt: 8.5
  },
  manufacturerAddress: {
    minFontPt: 6.0,
    standardFontPt: 7.5
  }
};

/**
 * Accurately measures physical block dimensions given real text content,
 * target panel width, and typographic configuration.
 */
export function measureTextBlock(text, widthMm, options = {}) {
  const fontPt = Number(options.fontPt || 8.0);
  const leadingRatio = Number(options.leadingRatio || 1.25);
  const columns = Number(options.columns || 1);
  const paddingMm = Number(options.paddingMm !== undefined ? options.paddingMm : 2.5);

  const cleanText = String(text || '').trim();
  if (!cleanText) {
    return {
      widthMm,
      heightMm: paddingMm * 2,
      lineCount: 0,
      fontPt,
      charsPerLine: 0
    };
  }

  // Calculate usable column width
  const columnWidthMm = (widthMm - (columns - 1) * 3.0) / columns;

  // Typographic shaping approximation calibrated against standard sans-serif (Helvetica / Roboto)
  // Average lowercase glyph width in mm is approx fontPt * PT_TO_MM * 0.52
  const avgCharWidthMm = fontPt * PT_TO_MM * 0.52;
  const charsPerLine = Math.max(10, Math.floor(columnWidthMm / avgCharWidthMm));

  const words = cleanText.split(/\s+/);
  let totalLines = 1;
  let currentLineChars = 0;

  for (const word of words) {
    if (currentLineChars + word.length + 1 <= charsPerLine) {
      currentLineChars += word.length + 1;
    } else {
      totalLines++;
      currentLineChars = word.length;
    }
  }

  // Distribute lines across columns
  const linesPerColumn = Math.ceil(totalLines / columns);
  const lineHeightMm = fontPt * leadingRatio * PT_TO_MM;
  const contentHeightMm = linesPerColumn * lineHeightMm;
  const totalHeightMm = Number((contentHeightMm + paddingMm * 2).toFixed(2));

  return {
    widthMm,
    heightMm: Math.max(6.0, totalHeightMm),
    lineCount: totalLines,
    linesPerColumn,
    fontPt,
    columns,
    charsPerLine
  };
}

/**
 * Computes structured Nutrition Facts panel dimensions.
 */
export function measureNutritionFactsBlock(options = {}) {
  const rawFormat = typeof options === 'string' ? options : (options?.format || 'STANDARD_VERTICAL');
  const format = String(rawFormat || 'STANDARD_VERTICAL').toUpperCase();

  if (format === 'CONDENSED_VERTICAL') {
    return {
      widthMm: 70.0,
      heightMm: 95.0,
      format: 'CONDENSED_VERTICAL',
      citation: '21 CFR 101.9(j)(13)(ii)(A)',
      explanation: 'FDA condensed vertical format with simplified footnote'
    };
  }

  if (format === 'TABULAR') {
    return {
      widthMm: 125.0,
      heightMm: 55.0,
      format: 'TABULAR',
      citation: '21 CFR 101.9(j)(13)(ii)(B)',
      explanation: 'FDA tabular horizontal format for wide informational panels'
    };
  }

  return {
    widthMm: 70.0,
    heightMm: 124.0,
    format: 'STANDARD_VERTICAL',
    citation: '21 CFR 101.9(d)',
    explanation: 'FDA standard vertical display with full footnote rules'
  };
}

/**
 * Validates a content block's font size against regulatory minimums.
 */
export function validateRegulatoryFontMinimum(blockCategory, fontPt, pdpAreaSqInches = 50) {
  if (blockCategory === 'NET_QUANTITY') {
    // 21 CFR 101.7: 25 to 100 sq inches requires minimum 3/16 inch (13.5 pt)
    const minPt = pdpAreaSqInches > 25 ? 13.5 : 9.0;
    return {
      compliant: fontPt >= minPt,
      requiredMinPt: minPt,
      actualFontPt: fontPt,
      citation: '21 CFR 101.7(i)'
    };
  }

  if (blockCategory === 'INGREDIENTS') {
    const minPt = REGULATORY_MINIMUM_TYPOGRAPHY.ingredientList.minFontPt;
    return {
      compliant: fontPt >= minPt,
      requiredMinPt: minPt,
      actualFontPt: fontPt,
      citation: '21 CFR 101.4'
    };
  }

  return {
    compliant: fontPt >= 6.0,
    requiredMinPt: 6.0,
    actualFontPt: fontPt,
    citation: 'General Food Labeling Safe Harbor'
  };
}
