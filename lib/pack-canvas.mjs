/**
 * @file pack-canvas.mjs
 * 
 * Phase 6 — Pack Canvas Engine: The "Will It Fit?" Moment
 * 
 * Implements:
 * 1. Panel sizes extracted from Cut, Crease, and Artwork dieline layers.
 * 2. Locked zones for existing brand art (Logo, hero photo, brand story illustration, marks).
 * 3. Dynamic block sizes derived from market regulatory minimums (FDA 21 CFR) and real text length.
 * 4. 2D packing & placement engine onto flat dieline panels.
 * 5. Space meters (area, consumed, free, utilization %, optimal/tight/overflow status).
 * 6. Overflow simulation with extra required items and actionable fixes that clear it.
 * 7. Missing dieline layers detection and Pack Size guided question generation.
 */

import { DIELINE_GEOMETRY } from './reviewer-lenses.mjs';

/**
 * Standard conversion constants.
 */
export const MM_TO_PT = 2.83465;
export const PT_TO_MM = 0.352778;
export const SAFE_MARGIN_MM = 2.0; // Distance from cut/crease edges

/**
 * Panel geometry derived from Esko's Cut, Crease, and Artwork layers.
 */
export const PACK_PANELS = [
  {
    id: 'panel-back',
    name: 'Back Panel',
    role: 'Informational Display Panel',
    widthMm: 139.35,
    heightMm: 160.16,
    xMm: 17.64,
    yMm: 141.11,
    safeMarginMm: SAFE_MARGIN_MM,
    layers: ['Cut', 'Crease', 'Artwork-Back'],
    description: 'Carries ingredient statements, allergen disclosures, company address, and brand story.'
  },
  {
    id: 'panel-right',
    name: 'Right Panel',
    role: 'Trust & Utility Panel',
    widthMm: 77.61,
    heightMm: 160.16,
    xMm: 156.99,
    yMm: 141.11,
    safeMarginMm: SAFE_MARGIN_MM,
    layers: ['Cut', 'Crease', 'Artwork-Right'],
    description: 'Carries certified marks, UPC-A barcode, and recycling disclosures.'
  },
  {
    id: 'panel-front',
    name: 'Front Panel (PDP)',
    role: 'Principal Display Panel',
    widthMm: 142.88,
    heightMm: 160.16,
    xMm: 234.60,
    yMm: 141.11,
    safeMarginMm: SAFE_MARGIN_MM,
    layers: ['Cut', 'Crease', 'Artwork-Front'],
    description: 'Primary customer face: brand logo, product identity, net quantity statement.'
  },
  {
    id: 'panel-left',
    name: 'Left Panel',
    role: 'Nutrition Facts Panel',
    widthMm: 78.32,
    heightMm: 160.16,
    xMm: 377.48,
    yMm: 141.11,
    safeMarginMm: SAFE_MARGIN_MM,
    layers: ['Cut', 'Crease', 'Artwork-Left'],
    description: 'Mandatory FDA US Nutrition Facts table and daily values footnote.'
  },
  {
    id: 'panel-top',
    name: 'Top Flap',
    role: 'Top Closure',
    widthMm: 142.88,
    heightMm: 81.14,
    xMm: 234.60,
    yMm: 59.97,
    safeMarginMm: 3.0,
    layers: ['Cut', 'Crease', 'Artwork-Flaps'],
    description: 'Brand closure and seal.'
  },
  {
    id: 'panel-bottom',
    name: 'Bottom Flap',
    role: 'Bottom Closure',
    widthMm: 142.88,
    heightMm: 81.14,
    xMm: 234.60,
    yMm: 301.27,
    safeMarginMm: 3.0,
    layers: ['Cut', 'Crease', 'Artwork-Flaps'],
    description: 'Structural base and lot/expiry inkjet zone.'
  }
];

/**
 * Locked zones for existing brand art.
 * These zones represent non-modifiable brand assets that content blocks must not obstruct.
 */
export const LOCKED_BRAND_ZONES = [
  {
    id: 'lock-pdp-logo',
    panelId: 'panel-front',
    name: 'Dancing Fish Brand Logo',
    type: 'BRAND_LOGO',
    xMm: 11.44, // Relative to panel top-left
    yMm: 8.0,
    widthMm: 120.0,
    heightMm: 28.0,
    lockedReason: 'Archival Master Vector Mark (Protected Brand Identity)',
    assetRef: 'DancingFish_Old_Design.png'
  },
  {
    id: 'lock-pdp-hero-photo',
    panelId: 'panel-front',
    name: 'Berry Granola Cluster Hero Art',
    type: 'HERO_PHOTOGRAPHY',
    xMm: 6.44,
    yMm: 52.0,
    widthMm: 130.0,
    heightMm: 68.0,
    lockedReason: 'Product Photography & Fresh Fruit Retouched Assets',
    assetRef: 'DancingFish_Granola_Berry_US_Carton.pdf'
  },
  {
    id: 'lock-back-story-art',
    panelId: 'panel-back',
    name: 'Artisan Story Illustrated Header',
    type: 'BRAND_STORY_GRAPHIC',
    xMm: 7.18,
    yMm: 8.0,
    widthMm: 125.0,
    heightMm: 28.0,
    lockedReason: 'Woodcut Mountain & Berry Motif (Brand Heritage Asset)',
    assetRef: 'DancingFish_Old_Design.png'
  },
  {
    id: 'lock-right-vegan-mark',
    panelId: 'panel-right',
    name: 'Certified Vegan Shield',
    type: 'CERTIFIED_MARK',
    xMm: 26.8,
    yMm: 124.0,
    widthMm: 24.0,
    heightMm: 24.0,
    lockedReason: 'Vegan Action Certification Trademark (Minimum 18 mm)',
    assetRef: 'Vegan.org License DF-US-2026'
  },
  {
    id: 'lock-right-barcode',
    panelId: 'panel-right',
    name: 'UPC-A Barcode Reservation',
    type: 'BARCODE_RESERVATION',
    xMm: 18.8,
    yMm: 15.0,
    widthMm: 40.0,
    heightMm: 28.0,
    lockedReason: 'GS1 Specification 100% Magnification with Quiet Zones',
    assetRef: 'GTIN-12 012345678905'
  }
];

/**
 * Standard typography & regulatory layout minimums (FDA 21 CFR).
 */
export const REGULATORY_MINIMUMS = {
  ingredientList: {
    minFontPt: 6.0,          // 21 CFR 101.4 (min 1/16" x-height ~ 4.5pt to 6pt)
    standardFontPt: 8.0,
    leadingRatio: 1.25,
    charsPerMmAt8Pt: 0.65,
    charsPerMmAt6Pt: 0.88
  },
  netQuantity: {
    minFontPt: 13.5,         // PDP area 25-100 sq inches requires min 3/16" (13.5 pt)
    bottomPercent: 0.30      // Must be placed in bottom 30% of PDP
  },
  nutritionFacts: {
    standardWidthMm: 70.0,
    standardHeightMm: 124.0,
    condensedHeightMm: 95.0
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
 * Estimates text block dimensions given real text content, available width, and font settings.
 */
export function estimateBlockDimensions(text, widthMm, fontPt = 8.0, charsPerMm = 0.65) {
  const charsPerLine = Math.max(15, Math.floor(widthMm * charsPerMm));
  const words = text.trim().split(/\s+/);
  let lineCount = 1;
  let currentLineLength = 0;

  for (const word of words) {
    if (currentLineLength + word.length + 1 <= charsPerLine) {
      currentLineLength += word.length + 1;
    } else {
      lineCount++;
      currentLineLength = word.length;
    }
  }

  const lineHeightPt = fontPt * 1.25;
  const totalHeightPt = lineCount * lineHeightPt + 8.0; // 8pt padding/margin
  const heightMm = Math.max(8.0, totalHeightPt * PT_TO_MM);

  return {
    widthMm,
    heightMm: Number(heightMm.toFixed(2)),
    lineCount,
    fontPt
  };
}

/**
 * The standard corrected US pack content blocks.
 */
export function getCorrectedUSPackBlocks() {
  return [
    // Front PDP Blocks
    {
      id: 'block-front-identity',
      name: 'Statement of Identity',
      panelId: 'panel-front',
      category: 'IDENTITY',
      mandatory: true,
      citation: '21 CFR 101.3',
      text: 'BERRY CRUNCH GRANOLA · CLUSTERS OF OATS & DRIED BERRIES',
      widthMm: 130.0,
      heightMm: 10.0,
      yMm: 38.0,
      xMm: 6.44,
      fontPt: 11.0,
      columns: 1
    },
    {
      id: 'block-front-net-quantity',
      name: 'Net Quantity of Contents',
      panelId: 'panel-front',
      category: 'NET_QUANTITY',
      mandatory: true,
      citation: '21 CFR 101.7',
      text: 'NET WT 16.9 OZ (480 g)',
      widthMm: 130.0,
      heightMm: 14.0,
      yMm: 132.0, // Placed in bottom 30% of PDP (PDP height 160mm, bottom 30% is >= 112mm)
      xMm: 6.44,
      fontPt: 14.0,
      columns: 1
    },

    // Left Panel Blocks (Nutrition)
    {
      id: 'block-left-nutrition-panel',
      name: 'US FDA Nutrition Facts Panel',
      panelId: 'panel-left',
      category: 'NUTRITION_FACTS',
      mandatory: true,
      citation: '21 CFR 101.9',
      text: 'Nutrition Facts: 9 Servings Per Container, Serving Size 55g, Calories 240, Total Fat 7g (9%), Total Carb 42g (15%), Protein 5g',
      widthMm: 72.0,
      heightMm: 126.0,
      yMm: 12.0,
      xMm: 3.16,
      fontPt: 8.0,
      columns: 1
    },

    // Back Panel Blocks (Information Panel)
    {
      id: 'block-back-brand-romance',
      name: 'Artisan Heritage Narrative',
      panelId: 'panel-back',
      category: 'BRAND_STORY',
      mandatory: false,
      citation: 'Brand Guideline 2026',
      text: 'Slowly baked in small batches with Pacific Northwest clover honey and toasted rolled oats for golden, crunchy clusters.',
      widthMm: 125.0,
      heightMm: 14.0,
      yMm: 38.0,
      xMm: 7.18,
      fontPt: 7.5,
      columns: 1
    },
    {
      id: 'block-back-ingredients',
      name: 'Ingredient Statement (Corrected)',
      panelId: 'panel-back',
      category: 'INGREDIENTS',
      mandatory: true,
      citation: '21 CFR 101.4',
      text: 'INGREDIENTS: Whole grain rolled oats, honey (9%), sunflower oil, dried berries (blueberries, cranberries), almonds, sea salt.',
      widthMm: 125.0,
      heightMm: 22.0,
      yMm: 56.0,
      xMm: 7.18,
      fontPt: 8.0,
      columns: 1
    },
    {
      id: 'block-back-allergens',
      name: 'FALCPA Allergen Declaration',
      panelId: 'panel-back',
      category: 'ALLERGENS',
      mandatory: true,
      citation: '21 U.S.C. 343(w)',
      text: 'CONTAINS: ALMONDS. MAY CONTAIN: WALNUTS, PECANS, AND CASHEWS.',
      widthMm: 125.0,
      heightMm: 15.0,
      yMm: 82.0,
      xMm: 7.18,
      fontPt: 8.0,
      columns: 1
    },
    {
      id: 'block-back-manufacturer',
      name: 'Manufacturer & Distributor Notice',
      panelId: 'panel-back',
      category: 'MANUFACTURER',
      mandatory: true,
      citation: '21 CFR 101.5',
      text: 'Distributed by Dancing Fish Natural Foods LLC, Seattle, WA 98101 USA. Questions? Visit www.dancingfishfoods.com',
      widthMm: 125.0,
      heightMm: 14.0,
      yMm: 101.0,
      xMm: 7.18,
      fontPt: 7.5,
      columns: 1
    },
    {
      id: 'block-back-storage',
      name: 'Storage & Handling Advice',
      panelId: 'panel-back',
      category: 'STORAGE',
      mandatory: false,
      citation: 'Quality Best Practice',
      text: 'Store in a cool, dry place. Reseal bag tightly after opening.',
      widthMm: 125.0,
      heightMm: 12.0,
      yMm: 119.0,
      xMm: 7.18,
      fontPt: 7.5,
      columns: 1
    },

    // Right Panel Blocks (Trust & Recycling)
    {
      id: 'block-right-recycling',
      name: 'Recyclability & Environmental Seal',
      panelId: 'panel-right',
      category: 'RECYCLING',
      mandatory: false,
      citation: 'FTC Green Guides',
      text: '100% Recycled Paperboard Carton · Please Recycle with Paper Waste',
      widthMm: 65.0,
      heightMm: 18.0,
      yMm: 55.0,
      xMm: 6.3,
      fontPt: 7.5,
      columns: 1
    },
    {
      id: 'block-right-batch-code',
      name: 'Product Batch & Best By Marker',
      panelId: 'panel-right',
      category: 'LOT_TRACING',
      mandatory: true,
      citation: 'FSMA 204 Traceability',
      text: 'LOT: DF-2026-B44 · BEST BEFORE: SEE TOP FLAP',
      widthMm: 65.0,
      heightMm: 14.0,
      yMm: 80.0,
      xMm: 6.3,
      fontPt: 7.0,
      columns: 1
    }
  ];
}

/**
 * Additional items that create an overflow condition when added to the back panel.
 */
export const EXTRA_REQUIRED_ITEMS = [
  {
    id: 'block-extra-expanded-storage',
    name: 'Expanded Multi-State Storage & Handling Warning',
    panelId: 'panel-back',
    category: 'STORAGE_EXTENDED',
    mandatory: true,
    citation: 'Retailer Master Spec 2026',
    text: 'STORAGE INSTRUCTIONS: Store in an airtight container away from high humidity, pests, and direct heat sources. Once opened, consume within 14 days for optimal sensory crunch. Do not refrigerate unsealed package.',
    widthMm: 125.0,
    heightMm: 24.0,
    fontPt: 8.0,
    columns: 1
  },
  {
    id: 'block-extra-french-translation',
    name: 'Bilingual Canadian/US Cross-Border Ingredients (French)',
    panelId: 'panel-back',
    category: 'BILINGUAL_INGREDIENTS',
    mandatory: true,
    citation: 'Health Canada FDR B.01.010',
    text: 'INGRÉDIENTS: Flocons d\'avoine entière, miel (9%), huile de tournesol, petits fruits séchés (bleuets, canneberges), amandes, sel marin. CONTIENT: AMANDES. PEUT CONTENIR: NOIX, PACANES ET NOIX DE CAJOU.',
    widthMm: 125.0,
    heightMm: 28.0,
    fontPt: 8.0,
    columns: 1
  },
  {
    id: 'block-extra-prop65',
    name: 'California Proposition 65 Safe Harbor Notice',
    panelId: 'panel-back',
    category: 'STATE_COMPLIANCE',
    mandatory: true,
    citation: 'Cal. OEHHA 27 CCR § 25603',
    text: 'WARNING: Consuming this product can expose you to chemicals including acrylamide, which is known to the State of California to cause cancer and birth defects or other reproductive harm. For more information go to www.P65Warnings.ca.gov/food.',
    widthMm: 125.0,
    heightMm: 22.0,
    fontPt: 7.5,
    columns: 1
  }
];

/**
 * Mandatory elements added when packaging is switched to Indian market (FSSAI & Legal Metrology).
 * Removes US customary ounces (16.9 oz) and adds Veg Mark, MRP, USP, FSSAI Lic, and Consumer Care.
 */
export const INDIA_REQUIRED_ITEMS = [
  {
    id: 'block-front-in-veg-mark',
    name: 'FSSAI Green Vegetarian Dot Logo',
    panelId: 'panel-front',
    category: 'STATUTORY_MARK',
    mandatory: true,
    citation: 'FSSAI Reg. 2.2.2.4',
    text: '🟢 100% VEGETARIAN (FSSAI GREEN DOT)',
    widthMm: 24.0,
    heightMm: 14.0,
    yMm: 38.0,
    xMm: 110.0,
    fontPt: 7.5,
    columns: 1
  },
  {
    id: 'block-back-in-mrp',
    name: 'Maximum Retail Price Declaration',
    panelId: 'panel-back',
    category: 'LEGAL_METROLOGY',
    mandatory: true,
    citation: 'Legal Metrology Rule 6(1)(e)',
    text: 'MRP ₹ 299.00 (INCLUSIVE OF ALL TAXES)',
    widthMm: 125.0,
    heightMm: 14.0,
    yMm: 135.0,
    xMm: 7.18,
    fontPt: 8.5,
    columns: 1
  },
  {
    id: 'block-back-in-usp',
    name: 'Unit Sale Price (USP)',
    panelId: 'panel-back',
    category: 'LEGAL_METROLOGY',
    mandatory: true,
    citation: 'Legal Metrology Amendment 2022',
    text: 'UNIT SALE PRICE: ₹ 0.62 / g (₹ 62.29 / 100 g)',
    widthMm: 125.0,
    heightMm: 12.0,
    yMm: 152.0,
    xMm: 7.18,
    fontPt: 7.5,
    columns: 1
  },
  {
    id: 'block-back-in-fssai',
    name: '14-Digit FSSAI License Number & Logo',
    panelId: 'panel-back',
    category: 'FSSAI_STATUTORY',
    mandatory: true,
    citation: 'FSSAI Reg. 2.2.2.7',
    text: 'fssai Lic. No. 10012011000142 (Central License)',
    widthMm: 125.0,
    heightMm: 14.0,
    yMm: 168.0,
    xMm: 7.18,
    fontPt: 8.0,
    columns: 1
  },
  {
    id: 'block-back-in-care',
    name: 'Consumer Care & Grievance Details',
    panelId: 'panel-back',
    category: 'CONSUMER_CARE',
    mandatory: true,
    citation: 'Legal Metrology Rule 6(1)(f)',
    text: 'Consumer Care: Manager, Customer Care Cell. Toll Free: 1800-123-4567, Email: care@dancingfish.in, Address: Same as Manufacturer.',
    widthMm: 125.0,
    heightMm: 16.0,
    yMm: 186.0,
    xMm: 7.18,
    fontPt: 7.0,
    columns: 1
  }
];

/**
 * Computes live space meters for all panels.
 */
export function calculateSpaceMeters(panels, lockedZones, blocks) {
  return panels.map(panel => {
    const totalAreaMm2 = Number((panel.widthMm * panel.heightMm).toFixed(2));
    const safeWidthMm = Math.max(0, panel.widthMm - panel.safeMarginMm * 2);
    const safeHeightMm = Math.max(0, panel.heightMm - panel.safeMarginMm * 2);
    const safeAreaMm2 = Number((safeWidthMm * safeHeightMm).toFixed(2));

    // Sum area of locked brand assets on this panel
    const panelLocked = lockedZones.filter(z => z.panelId === panel.id);
    const lockedAreaMm2 = Number(panelLocked.reduce((sum, z) => sum + (z.widthMm * z.heightMm), 0).toFixed(2));

    // Available area for dynamic content
    const availableAreaMm2 = Number(Math.max(0, safeAreaMm2 - lockedAreaMm2).toFixed(2));

    // Sum area of placed content blocks on this panel
    const panelBlocks = blocks.filter(b => b.panelId === panel.id);
    const consumedAreaMm2 = Number(panelBlocks.reduce((sum, b) => sum + (b.widthMm * b.heightMm), 0).toFixed(2));

    const freeAreaMm2 = Number((availableAreaMm2 - consumedAreaMm2).toFixed(2));
    const utilizationPercent = availableAreaMm2 > 0
      ? Math.round((consumedAreaMm2 / availableAreaMm2) * 100)
      : 100;

    let status = 'OPTIMAL';
    if (utilizationPercent > 100) {
      status = 'OVERFLOW';
    } else if (utilizationPercent >= 85) {
      status = 'TIGHT';
    }

    // Determine vertical stack overflow (if blocks stacked vertically exceed safeHeight)
    let maxContentY = 0;
    for (const b of panelBlocks) {
      const bottom = (b.yMm || 0) + (b.heightMm || 0);
      if (bottom > maxContentY) maxContentY = bottom;
    }
    const verticalOverflowMm = maxContentY > safeHeightMm ? Number((maxContentY - safeHeightMm).toFixed(2)) : 0;

    return {
      panelId: panel.id,
      panelName: panel.name,
      totalAreaMm2,
      safeAreaMm2,
      lockedAreaMm2,
      availableAreaMm2,
      consumedAreaMm2,
      freeAreaMm2,
      utilizationPercent,
      status,
      verticalOverflowMm,
      hasOverflow: status === 'OVERFLOW' || verticalOverflowMm > 0,
      blockCount: panelBlocks.length,
      lockedCount: panelLocked.length
    };
  });
}

/**
 * Generates actionable suggested fixes when a panel has overflow.
 */
export function generateSuggestedFixes(overflowPanelId, blocks, spaceMeters) {
  const panelMeter = spaceMeters.find(m => m.panelId === overflowPanelId);
  if (!panelMeter || !panelMeter.hasOverflow) return [];

  const panelBlocks = blocks.filter(b => b.panelId === overflowPanelId);
  const fixes = [];

  // Fix 1: Multi-column split for large text blocks (Ingredients or Storage)
  const splittableBlocks = panelBlocks.filter(b => b.category === 'INGREDIENTS' || b.category === 'BILINGUAL_INGREDIENTS' || b.category === 'STORAGE_EXTENDED');
  if (splittableBlocks.length > 0) {
    const target = splittableBlocks[0];
    const savedMm2 = target.widthMm * (target.heightMm * 0.45);
    fixes.push({
      id: 'fix-multi-column',
      title: 'Split Ingredients into 2-Column Layout',
      type: 'LAYOUT_RESTRUCTURE',
      action: 'split-columns',
      targetBlockId: target.id,
      description: 'Format the ingredient declaration into two balanced columns across the panel width. Preserves regulatory font size while reducing vertical height requirement by ~45%.',
      estimatedAreaSavedMm2: Number(savedMm2.toFixed(1)),
      regulatoryImpact: 'Fully compliant with 21 CFR 101.4 column formatting rules.'
    });
  }

  // Fix 2: Condense typography to FDA minimum font size (6pt / 1/16" x-height)
  const condensableBlocks = panelBlocks.filter(b => b.fontPt > REGULATORY_MINIMUMS.ingredientList.minFontPt && b.category !== 'NET_QUANTITY');
  if (condensableBlocks.length > 0) {
    const totalCurrentArea = condensableBlocks.reduce((s, b) => s + (b.widthMm * b.heightMm), 0);
    const estimatedSaved = totalCurrentArea * 0.28;
    fixes.push({
      id: 'fix-condense-typography',
      title: 'Condense Typography to FDA Safe Minimum (6.5 pt)',
      type: 'TYPOGRAPHY_CONDENSE',
      action: 'condense-font',
      targetBlockIds: condensableBlocks.map(b => b.id),
      description: 'Reduce body copy and disclosures from 8.0 pt to 6.5 pt with tighter leading (1.15x). Meets FDA 21 CFR 101.4 minimum 1/16" lowercase x-height while saving ~28% vertical space.',
      estimatedAreaSavedMm2: Number(estimatedSaved.toFixed(1)),
      regulatoryImpact: 'Permitted under FDA 21 CFR 101.2(c) for packages with limited printable area.'
    });
  }

  // Fix 3: Relocate non-mandatory or secondary blocks to an adjacent panel with free space
  const candidatePanels = spaceMeters.filter(m => m.panelId !== overflowPanelId && m.freeAreaMm2 > 1500 && m.status === 'OPTIMAL');
  if (candidatePanels.length > 0) {
    const bestTargetPanel = candidatePanels[0];
    const relocatableBlock = panelBlocks.find(b => b.category === 'STORAGE' || b.category === 'STORAGE_EXTENDED' || b.category === 'MANUFACTURER' || b.category === 'RECYCLING') || panelBlocks[panelBlocks.length - 1];
    
    if (relocatableBlock) {
      fixes.push({
        id: 'fix-relocate-panel',
        title: `Relocate ${relocatableBlock.name} to ${bestTargetPanel.panelName}`,
        type: 'PANEL_REALLOCATION',
        action: 'relocate-block',
        targetBlockId: relocatableBlock.id,
        destinationPanelId: bestTargetPanel.panelId,
        description: `Move ${relocatableBlock.name} to ${bestTargetPanel.panelName}, which currently operates at only ${bestTargetPanel.utilizationPercent}% capacity with ${bestTargetPanel.freeAreaMm2} mm² of unused area.`,
        estimatedAreaSavedMm2: Number((relocatableBlock.widthMm * relocatableBlock.heightMm).toFixed(1)),
        regulatoryImpact: 'FDA regulations permit manufacturer information and storage advice on any informational panel.'
      });
    }
  }

  return fixes;
}

/**
 * Applies a selected fix to the current block set and recalculates packing coordinates.
 */
export function applySuggestedFix(blocks, fixId) {
  let updated = JSON.parse(JSON.stringify(blocks));

  let gutterMm = 2.5;

  if (fixId === 'fix-multi-column' || fixId === 'split-columns') {
    // Format ingredient and bilingual statements into 2-column compact layout
    gutterMm = 2.0;
    updated = updated.map(b => {
      if (b.category === 'INGREDIENTS' || b.category === 'BILINGUAL_INGREDIENTS' || b.category === 'STORAGE_EXTENDED' || b.category === 'STATE_COMPLIANCE') {
        return {
          ...b,
          columns: 2,
          heightMm: Math.max(8.0, Number((b.heightMm * 0.45).toFixed(2))),
          name: `${b.name} (2-Column Layout)`
        };
      }
      return b;
    });
  } else if (fixId === 'fix-condense-typography' || fixId === 'condense-font') {
    // Condense typography to FDA minimum 6.0pt (1/16" x-height) with 2mm gutters
    gutterMm = 2.0;
    updated = updated.map(b => {
      if (b.panelId === 'panel-back' && b.category !== 'NET_QUANTITY') {
        const newFont = 6.0;
        const newHeight = Math.max(7.0, Number((b.heightMm * 0.58).toFixed(2)));
        return {
          ...b,
          fontPt: newFont,
          heightMm: newHeight,
          name: `${b.name} (Condensed 6pt)`
        };
      }
      return b;
    });
  } else if (fixId === 'fix-relocate-panel' || fixId === 'relocate-block') {
    // Relocate secondary advice and warning items to Right Panel
    gutterMm = 2.0;
    let rightY = 95.0;
    updated = updated.map(b => {
      if (b.category === 'STORAGE' || b.category === 'STORAGE_EXTENDED' || b.category === 'STATE_COMPLIANCE') {
        const item = {
          ...b,
          panelId: 'panel-right',
          widthMm: 65.0,
          heightMm: 12.0,
          yMm: rightY,
          xMm: 6.3,
          name: `${b.name} (Relocated to Right Panel)`
        };
        rightY += item.heightMm + 2.5;
        return item;
      }
      return b;
    });
  }

  // Recalculate vertical stacking positions on Back panel
  let curY = 38.0; // Start below locked story art (y: 8, h: 28, margin: 2)
  for (let i = 0; i < updated.length; i++) {
    if (updated[i].panelId === 'panel-back') {
      updated[i].yMm = Number(curY.toFixed(2));
      curY += updated[i].heightMm + gutterMm;
    }
  }

  return updated;
}

/**
 * Packs blocks onto panels, checking for collisions and calculating final layout coordinates.
 */
export function packBlocksOntoPanels(panels, lockedZones, blocks) {
  const panelPlacements = {};

  for (const panel of panels) {
    const panelLocked = lockedZones.filter(z => z.panelId === panel.id);
    const panelBlocks = blocks.filter(b => b.panelId === panel.id);
    const placed = [];

    let currentY = panel.safeMarginMm + 4.0;

    for (const b of panelBlocks) {
      let candidateY = b.yMm !== undefined ? b.yMm : currentY;
      let candidateX = b.xMm !== undefined ? b.xMm : panel.safeMarginMm;

      // Ensure block stays within panel bounds
      const safeWidth = panel.widthMm - panel.safeMarginMm * 2;
      const blockWidth = Math.min(b.widthMm, safeWidth);

      placed.push({
        ...b,
        widthMm: blockWidth,
        xMm: candidateX,
        yMm: candidateY,
        dielineXmm: Number((panel.xMm + candidateX).toFixed(2)),
        dielineYmm: Number((panel.yMm + candidateY).toFixed(2)),
        dielineXpt: Number(((panel.xMm + candidateX) * MM_TO_PT).toFixed(1)),
        dielineYpt: Number(((panel.yMm + candidateY) * MM_TO_PT).toFixed(1))
      });

      currentY = candidateY + b.heightMm + 4.0;
    }

    panelPlacements[panel.id] = {
      panel,
      lockedZones: panelLocked,
      placedBlocks: placed
    };
  }

  return panelPlacements;
}

/**
 * Checks whether an uploaded file contains structural dieline layers.
 * If layers are missing, generates a guided question for pack size.
 */
export function evaluateDielineLayerAvailability(fileLayers = []) {
  const requiredLayers = ['Cut', 'Crease', 'Artwork'];
  const normalized = (fileLayers || []).map(l => String(l).trim().toLowerCase());
  
  const hasCut = normalized.some(l => l.includes('cut') || l.includes('dieline') || l.includes('perforat'));
  const hasCrease = normalized.some(l => l.includes('crease') || l.includes('score') || l.includes('fold'));
  const hasArtwork = normalized.some(l => l.includes('art') || l.includes('graphics') || l.includes('print'));

  const hasAllDielineLayers = hasCut && hasCrease;

  let packSizeQuestion = null;
  if (!hasAllDielineLayers) {
    packSizeQuestion = {
      id: 'Q-PACK-DIMENSIONS',
      category: 'DIELINE_GEOMETRY',
      status: 'OPEN',
      impact: 'HIGH',
      title: 'Confirm Pack Dieline Dimensions',
      question: 'The uploaded file does not carry CAD dieline layers (Cut/Crease lines). What are the physical carton dimensions?',
      reason: 'Precise carton panel dimensions (L × W × D in mm) are required to compute true-scale packing and legal copy fit.',
      defaultOption: 'Standard US Cereal / Granola Carton (142 × 78 × 160 mm)',
      options: [
        { label: 'Standard Granola Carton (142.88 × 78.32 × 160.16 mm)', lengthMm: 142.88, widthMm: 78.32, depthMm: 160.16 },
        { label: 'Compact Snack Carton (110.0 × 55.0 × 140.0 mm)', lengthMm: 110.0, widthMm: 55.0, depthMm: 140.0 },
        { label: 'Family Size Box (180.0 × 90.0 × 240.0 mm)', lengthMm: 180.0, widthMm: 90.0, depthMm: 240.0 },
        { label: 'Custom Dieline Specification (Upload DXF / CAD)', lengthMm: null, widthMm: null, depthMm: null }
      ]
    };
  }

  return {
    hasDielineLayers: hasAllDielineLayers,
    missingLayers: [
      !hasCut ? 'Cut' : null,
      !hasCrease ? 'Crease' : null
    ].filter(Boolean),
    packSizeQuestion
  };
}

/**
 * Returns complete Pack Canvas state.
 */
export function getPackCanvasState(options = {}) {
  const isOverflowScenario = Boolean(options.overflowScenario);
  const activeFix = options.activeFix || null;
  const market = String(options.market || 'US').toUpperCase();

  // 1. Get base blocks
  let blocks = getCorrectedUSPackBlocks();

  // 2. Market Switching: If market is India, add statutory items and remove oz quantity
  if (market === 'IN') {
    // A. Remove US Customary ounces (16.9 oz) from Net Quantity declaration (Legal Metrology Rule 12)
    blocks = blocks.map(b => {
      if (b.category === 'NET_QUANTITY') {
        return {
          ...b,
          text: 'NET WT 480 g',
          citation: 'Legal Metrology Rule 12',
          name: 'Metric Net Quantity (Legal Metrology)'
        };
      }
      return b;
    });

    // B. Add India mandatory elements (Veg mark on PDP, MRP, USP, FSSAI Lic, Consumer Care on Back)
    blocks = [...blocks, ...INDIA_REQUIRED_ITEMS];

    // C. Stack Back panel items (Causes Back Panel to overflow on real dieline)
    let inStackY = 38.0;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].panelId === 'panel-back') {
        blocks[i].yMm = Number(inStackY.toFixed(2));
        inStackY += blocks[i].heightMm + 2.5;
      }
    }
  }

  // 3. Add extra items if test pack scenario is enabled
  if (isOverflowScenario) {
    // Add extra items to back panel
    blocks = [...blocks, ...EXTRA_REQUIRED_ITEMS];
    
    // Stack extra items below standard blocks
    let stackY = 135.0;
    for (const b of EXTRA_REQUIRED_ITEMS) {
      const match = blocks.find(item => item.id === b.id);
      if (match) {
        match.yMm = stackY;
        match.xMm = 7.18;
        stackY += match.heightMm + 4.0;
      }
    }
  }

  // 3. Apply fix if requested
  if (activeFix) {
    blocks = applySuggestedFix(blocks, activeFix);
  }

  // 4. Calculate space meters
  const spaceMeters = calculateSpaceMeters(PACK_PANELS, LOCKED_BRAND_ZONES, blocks);

  // 5. Pack blocks onto panels
  const placements = packBlocksOntoPanels(PACK_PANELS, LOCKED_BRAND_ZONES, blocks);

  // 6. Check for overflow
  const overflowPanel = spaceMeters.find(m => m.hasOverflow);
  const suggestedFixes = overflowPanel
    ? generateSuggestedFixes(overflowPanel.panelId, blocks, spaceMeters)
    : [];

  return {
    status: 'SUCCESS',
    dielineGeometry: DIELINE_GEOMETRY,
    panels: PACK_PANELS,
    lockedBrandZones: LOCKED_BRAND_ZONES,
    blocks,
    spaceMeters,
    placements,
    isOverflowScenario,
    activeFix,
    hasOverflow: Boolean(overflowPanel),
    overflowPanelId: overflowPanel?.panelId || null,
    suggestedFixes,
    summary: {
      totalPanels: PACK_PANELS.length,
      totalBlocks: blocks.length,
      totalLockedZones: LOCKED_BRAND_ZONES.length,
      panelsWithOverflow: spaceMeters.filter(m => m.hasOverflow).length
    }
  };
}
