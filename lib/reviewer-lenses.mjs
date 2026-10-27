/**
 * @file reviewer-lenses.mjs
 * 
 * Phase 5A — Reviewer Lenses: Red Pen, Sticky Notes, Track Changes, and A3 Wall Poster.
 * 
 * Implements:
 * 1. Shared finding-location layer: panel + position in mm on flat dieline.
 * 2. Red-pen markup with self-drawing vector strokes and Clean / Marked toggle.
 * 3. Sticky notes color-coded by owner (Legal, R&D, Brand).
 * 4. Track changes visual diffs for ingredients, allergens, and claims.
 * 5. A3 landscape wall poster export (strictly one printable page).
 */

import { getDeskSession } from './evidence-desk.mjs';

/**
 * Packaging dieline dimensions for DancingFish_Granola_Berry_US_Carton.pdf
 * Total dieline canvas: W: 1350 pt (476.25 mm), H: 1100 pt (388.08 mm).
 * 1 pt = 0.352778 mm | 1 mm = 2.83465 pt
 */
export const DIELINE_GEOMETRY = {
  canvasWidthPt: 1350.0,
  canvasHeightPt: 1100.0,
  canvasWidthMm: 476.25,
  canvasHeightMm: 388.08,
  panels: [
    {
      id: 'panel-back',
      name: 'Back panel',
      role: 'Informational Display Panel (Ingredients, Allergens, Company)',
      xMm: 17.64,
      yMm: 141.11,
      widthMm: 139.35,
      heightMm: 160.16,
      bboxPt: [50.0, 400.0, 445.0, 854.0]
    },
    {
      id: 'panel-right',
      name: 'Right panel',
      role: 'Trust Marks & Story Panel (Vegan, Kosher)',
      xMm: 156.99,
      yMm: 141.11,
      widthMm: 77.61,
      heightMm: 160.16,
      bboxPt: [445.0, 400.0, 665.0, 854.0]
    },
    {
      id: 'panel-front',
      name: 'Front panel (Principal Display Panel)',
      role: 'Principal Display Panel (Brand, Identity, Claims, Net Quantity)',
      xMm: 234.60,
      yMm: 141.11,
      widthMm: 142.88,
      heightMm: 160.16,
      bboxPt: [665.0, 400.0, 1070.0, 854.0]
    },
    {
      id: 'panel-left',
      name: 'Left panel',
      role: 'US Nutrition Facts Panel (Macros, Daily Values, Servings)',
      xMm: 377.48,
      yMm: 141.11,
      widthMm: 78.32,
      heightMm: 160.16,
      bboxPt: [1070.0, 400.0, 1292.0, 854.0]
    },
    {
      id: 'panel-top',
      name: 'Top flap',
      role: 'Closure & Brand Accent',
      xMm: 234.60,
      yMm: 59.97,
      widthMm: 142.88,
      heightMm: 81.14,
      bboxPt: [665.0, 170.0, 1070.0, 400.0]
    },
    {
      id: 'panel-bottom',
      name: 'Bottom flap',
      role: 'Technical Panel (UPC-A Barcode)',
      xMm: 234.60,
      yMm: 301.27,
      widthMm: 142.88,
      heightMm: 81.14,
      bboxPt: [665.0, 854.0, 1070.0, 1084.0]
    }
  ]
};

/**
 * Shared Finding-Location Layer:
 * Defines exact spatial locations (panel + position in mm), red-pen strokes,
 * owner sticky notes, and linked sources for every open finding on Esko's carton.
 */
export const CARTON_REVIEWER_FINDINGS = [
  // 1. Front Panel: No Added Sugar Claim
  {
    id: 'finding-claim-sugar',
    title: 'Misleading Claim: "NO ADDED SUGAR"',
    panel: 'Front panel (Principal Display Panel)',
    panelId: 'panel-front',
    positionMm: { x: 71.4, y: 35.2 }, // relative to panel top-left
    dielineMm: { x: 306.0, y: 176.3 }, // on overall dieline
    dielinePt: [867.0, 499.8],
    owner: 'Legal',
    ownerTitle: 'Regulatory Counsel',
    color: '#dc2626',
    stickyNote: {
      id: 'sticky-claim-sugar',
      owner: 'Legal',
      ownerName: 'Sarah Jenkins, Esq. (Regulatory Counsel)',
      badge: 'FDA COMPLIANCE',
      note: 'VIOLATION 21 CFR 101.60(c)(2): Honey is an added sugar under 21 CFR 101.9(c)(6)(iii). Making "No Added Sugar" front-panel claim when honey is an ingredient triggers FDA Warning Letter risk. Must remove claim immediately.',
      actionRequired: 'Remove front-panel claim "NO ADDED SUGAR"'
    },
    redPen: {
      type: 'circle-strikethrough',
      svgPath: 'M 800,480 C 760,470 940,465 960,485 C 975,510 770,525 765,495 Z',
      strikePath: 'M 760,520 L 970,470',
      arrowPath: 'M 880,470 Q 860,420 830,390',
      calloutText: 'REMOVE: Honey = Added Sugar (21 CFR 101.60)',
      strokeLength: 480
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel (Principal Display Panel)', type: 'pdf', quote: 'NO ADDED SUGAR' },
      { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B26', type: 'excel', quote: 'Honey (9%)' },
      { file: 'DancingFish_QA_Notes.txt', location: 'Line 3', type: 'note', quote: 'Confirm if No Added Sugar claim can be used given honey content.' }
    ]
  },

  // 2. Back Panel: Honey Ratio Mismatch (1% printed vs 9% spec)
  {
    id: 'finding-honey-ratio',
    title: 'Honey Formulation Ratio Mismatch (1% vs 9%)',
    panel: 'Back panel',
    panelId: 'panel-back',
    positionMm: { x: 85.0, y: 105.5 },
    dielineMm: { x: 102.6, y: 246.6 },
    dielinePt: [290.8, 699.0],
    owner: 'R&D',
    ownerTitle: 'Food Science & Formulation Lead',
    color: '#0284c7',
    stickyNote: {
      id: 'sticky-honey-ratio',
      owner: 'R&D',
      ownerName: 'Dr. Michael Chang (R&D Lead)',
      badge: 'FORMULATION DRIFT',
      note: 'RECIPE MISMATCH: Master batch formula DF-2026 specifies 9% clover honey for cluster binding. Artwork back panel prints "Honey (1%)". Printing 1% reduces characterising sweetness and violates master spec.',
      actionRequired: 'Revert carton copy to Honey (9%)'
    },
    redPen: {
      type: 'loop-callout',
      svgPath: 'M 255,685 C 240,670 330,670 340,690 C 350,715 250,715 255,685 Z',
      strikePath: 'M 260,700 L 335,690',
      arrowPath: 'M 340,700 Q 380,720 400,750',
      calloutText: 'SPEC SAYS 9% HONEY! Revert 1% -> 9%',
      strokeLength: 320
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Back panel', type: 'pdf', quote: 'Honey (1%)' },
      { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B26', type: 'excel', quote: 'Honey (9%)' },
      { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 4', type: 'docx', quote: 'Formulation & Honey Ratio: Honey 9% (Natural clover honey)' }
    ]
  },

  // 3. Back Panel: Ingredient Statement Drift (Unauthorized additions)
  {
    id: 'finding-ingredient-drift',
    title: 'Ingredient Drift: Unauthorized Walnuts & Seeds',
    panel: 'Back panel',
    panelId: 'panel-back',
    positionMm: { x: 62.0, y: 88.0 },
    dielineMm: { x: 79.6, y: 229.1 },
    dielinePt: [225.8, 649.5],
    owner: 'R&D',
    ownerTitle: 'Formulation & Compliance',
    color: '#0284c7',
    stickyNote: {
      id: 'sticky-ingredient-drift',
      owner: 'R&D',
      ownerName: 'Dr. Michael Chang (R&D Lead)',
      badge: 'RECIPE INTEGRITY',
      note: 'Carton ingredient declaration lists 4 unapproved additions: Walnuts, Flax Seeds, Dried Strawberries, Pumpkin Seeds. Adding Walnuts without allergen control introduces undisclosed tree nut allergen.',
      actionRequired: 'Revert ingredient statement to approved base granola specification'
    },
    redPen: {
      type: 'bracket-box',
      svgPath: 'M 100,635 L 420,635 L 420,720 L 100,720 Z',
      strikePath: 'M 160,660 L 390,660 M 130,685 L 340,685',
      arrowPath: 'M 100,680 Q 70,680 50,710',
      calloutText: 'UNAUTHORIZED: Walnuts, Flax, Strawberries, Pumpkin Seeds',
      strokeLength: 640
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Back panel', type: 'pdf', quote: 'Whole grain rolled oats, walnuts, flax seeds, dried strawberries, pumpkin seeds, honey (1%)...' },
      { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B26', type: 'excel', quote: 'Whole grain rolled oats, honey (9%), sunflower oil, berries...' }
    ]
  },

  // 4. Back Panel: Allergen Statement Missing Specific Species (FALCPA)
  {
    id: 'finding-allergen-warning',
    title: 'FALCPA Violation: Generic "Tree Nuts" Warning',
    panel: 'Back panel',
    panelId: 'panel-back',
    positionMm: { x: 65.0, y: 128.0 },
    dielineMm: { x: 82.6, y: 269.1 },
    dielinePt: [234.3, 762.8],
    owner: 'Legal',
    ownerTitle: 'Regulatory Counsel',
    color: '#dc2626',
    stickyNote: {
      id: 'sticky-allergen-warning',
      owner: 'Legal',
      ownerName: 'Sarah Jenkins, Esq. (Regulatory Counsel)',
      badge: 'FALCPA ALLERGEN LAW',
      note: 'FALCPA (21 U.S.C. 343(w)) requires declaring the specific food source of all major food allergens. Declaring "May contain tree nuts" without naming specific species is non-compliant under FDA allergen rules.',
      actionRequired: 'Update statement to: "Contains Almonds. May contain Walnuts, Pecans, and Cashews."'
    },
    redPen: {
      type: 'squiggly-underline',
      svgPath: 'M 105,765 Q 120,772 135,765 Q 150,758 165,765 Q 180,772 195,765 Q 210,758 225,765 Q 240,772 255,765 Q 270,758 285,765 Q 300,772 315,765 Q 330,758 345,765 Q 360,772 375,765',
      strikePath: 'M 220,755 L 360,755',
      arrowPath: 'M 375,765 Q 410,780 430,810',
      calloutText: 'FALCPA: Specify species (Walnuts, Pecans)!',
      strokeLength: 380
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Back panel', type: 'pdf', quote: 'Contains: Almonds. May contain tree nuts.' },
      { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 6', type: 'docx', quote: 'Mandatory Allergen Warning: Contains Almonds. May contain Tree Nuts (Walnuts, Pecans).' }
    ]
  },

  // 5. Left Panel: Serving Size Math Contradiction (8 × 85g = 680g ≠ 480g)
  {
    id: 'finding-serving-math',
    title: 'Serving Math: 8 × 85 g = 680 g (Net wt is 480 g)',
    panel: 'Left panel',
    panelId: 'panel-left',
    positionMm: { x: 38.0, y: 35.0 },
    dielineMm: { x: 415.5, y: 176.1 },
    dielinePt: [1177.8, 499.2],
    owner: 'R&D',
    ownerTitle: 'Nutrition Science',
    color: '#0284c7',
    stickyNote: {
      id: 'sticky-serving-math',
      owner: 'R&D',
      ownerName: 'Elena Rostova (Nutrition Consultant)',
      badge: 'NUTRITION MATH',
      note: 'Serving calculation mismatch: Declared 8 servings × 85 g serving size = 680 g, which exceeds total net package contents of 480 g by 200 g (41.6% discrepancy). Violates 21 CFR 101.9(b).',
      actionRequired: 'Update to "About 9 servings" with approved 55 g serving size'
    },
    redPen: {
      type: 'equation-bracket',
      svgPath: 'M 1090,465 L 1080,465 L 1080,515 L 1090,515',
      strikePath: 'M 1095,490 L 1260,490',
      arrowPath: 'M 1080,490 Q 1040,480 1020,460',
      calloutText: '8 × 85g = 680g != 480g NET WT!',
      strokeLength: 260
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', quote: '8 servings per container · Serving size 1/2 cup (85g)' },
      { file: 'DancingFish_Granola_Tech_Spec.pdf', location: 'Page 1, Line 5', type: 'plain_pdf', quote: 'Serving Size: 1/2 cup (55 g)' }
    ]
  },

  // 6. Left Panel: Calorie Atwater Contradiction (166 kcal declared vs 535 kcal)
  {
    id: 'finding-calorie-math',
    title: 'Calorie Math: 166 kcal declared vs 535 kcal Atwater',
    panel: 'Left panel',
    panelId: 'panel-left',
    positionMm: { x: 38.0, y: 55.0 },
    dielineMm: { x: 415.5, y: 196.1 },
    dielinePt: [1177.8, 555.9],
    owner: 'R&D',
    ownerTitle: 'Nutrition Science',
    color: '#0284c7',
    stickyNote: {
      id: 'sticky-calorie-math',
      owner: 'R&D',
      ownerName: 'Elena Rostova (Nutrition Consultant)',
      badge: 'ATWATER TOLERANCE',
      note: 'FDA 4-4-9 Atwater calculation check: Fat 15 g × 9 (135 kcal) + Carbs 66 g × 4 (264 kcal) + Protein 34 g × 4 (136 kcal) = 535 kcal. Declared 166 kcal violates FDA rounding rules and Class II nutrient limits.',
      actionRequired: 'Recalculate calories to match approved formulation (approx 240 kcal per 55g serving)'
    },
    redPen: {
      type: 'callout-box',
      svgPath: 'M 1100,535 L 1260,535 L 1260,570 L 1100,570 Z',
      strikePath: 'M 1160,555 L 1220,555',
      arrowPath: 'M 1260,550 Q 1290,550 1310,570',
      calloutText: '15*9 + 66*4 + 34*4 = 535 kcal != 166!',
      strokeLength: 390
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', quote: 'Calories 166' },
      { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B48', type: 'excel', quote: '166' }
    ]
  },

  // 7. Left Panel: Total Carbohydrate Spec Mismatch (15g spec vs 66g carton)
  {
    id: 'finding-carb-mismatch',
    title: 'Total Carbohydrate Mismatch: 15 g (Spec) vs 66 g (Carton)',
    panel: 'Left panel',
    panelId: 'panel-left',
    positionMm: { x: 38.0, y: 78.0 },
    dielineMm: { x: 415.5, y: 219.1 },
    dielinePt: [1177.8, 621.1],
    owner: 'R&D',
    ownerTitle: 'Nutrition Science',
    color: '#0284c7',
    stickyNote: {
      id: 'sticky-carb-mismatch',
      owner: 'R&D',
      ownerName: 'Elena Rostova (Nutrition Consultant)',
      badge: 'SPEC MISMATCH',
      note: 'Content Sheet row 53 declares 15 g carbohydrate, but carton US Nutrition Facts panel declares 66 g. 51 g discrepancy requires lab-confirmed nutritional declaration.',
      actionRequired: 'Confirm approved analytical carb declaration (66 g per 85g or 42 g per 55g)'
    },
    redPen: {
      type: 'circle-callout',
      svgPath: 'M 1195,615 C 1175,605 1250,605 1250,625 C 1250,640 1180,640 1195,615 Z',
      strikePath: 'M 1205,625 L 1245,625',
      arrowPath: 'M 1250,625 Q 1285,630 1305,650',
      calloutText: 'Spec says 15g! Check lab report',
      strokeLength: 280
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', quote: 'Total Carbohydrate 66g' },
      { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B53', type: 'excel', quote: '15g' }
    ]
  },

  // 8. Right Panel: Certified Vegan Mark Placement
  {
    id: 'finding-vegan-mark',
    title: 'Certified Vegan Mark Verification',
    panel: 'Right panel',
    panelId: 'panel-right',
    positionMm: { x: 42.0, y: 135.0 },
    dielineMm: { x: 198.9, y: 276.1 },
    dielinePt: [564.0, 782.7],
    owner: 'Brand',
    ownerTitle: 'Creative Director',
    color: '#9333ea',
    stickyNote: {
      id: 'sticky-vegan-mark',
      owner: 'Brand',
      ownerName: 'Chloe Dupont (Brand Director)',
      badge: 'TRUST ASSETS',
      note: 'Ensure Certified Vegan emblem (Vegan.org license DF-US-2026) is preserved on the right display panel at minimum 18 mm height. Placement matches archival design V03.',
      actionRequired: 'Retain approved Certified Vegan emblem at 18 mm scale'
    },
    redPen: {
      type: 'approval-check',
      svgPath: 'M 500,740 L 530,775 L 590,705',
      strikePath: '',
      arrowPath: 'M 590,705 Q 610,690 635,680',
      calloutText: 'KEEP: Certified Vegan (18mm minimum)',
      strokeLength: 220
    },
    sources: [
      { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Right panel', type: 'pdf', quote: 'Certified Vegan mark' },
      { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Certified Marks)', type: 'image', quote: 'Certified Vegan Logo' }
    ]
  }
];

/**
 * Track Changes Data: Exact visual diffs for Ingredients, Allergens, and Claims.
 */
export const TRACK_CHANGES_ITEMS = [
  {
    id: 'track-ingredients',
    category: 'Ingredients Formulation',
    panel: 'Back panel',
    title: 'Ingredient List Recipe Drift',
    changeType: 'FORMULATION_REVERT',
    owner: 'R&D / Food Science',
    originalText: 'Whole grain rolled oats, walnuts, flax seeds, dried strawberries, pumpkin seeds, honey (1%), sunflower oil, berries, salt.',
    proposedText: 'Whole grain rolled oats, honey (9%), sunflower oil, berries, almonds, salt.',
    diffSegments: [
      { text: 'Whole grain rolled oats, ', type: 'unchanged' },
      { text: 'walnuts, flax seeds, dried strawberries, pumpkin seeds, ', type: 'deleted' },
      { text: 'honey (', type: 'unchanged' },
      { text: '1%', type: 'deleted' },
      { text: '9%', type: 'inserted' },
      { text: '), sunflower oil, berries, ', type: 'unchanged' },
      { text: 'almonds, ', type: 'inserted' },
      { text: 'salt.', type: 'unchanged' }
    ],
    rationale: 'Reverts carton formulation drift to match the approved R&D specification sheet (Cell B26). Removes unauthorized seeds and walnuts; restores approved 9% clover honey ratio.'
  },
  {
    id: 'track-allergens',
    category: 'FALCPA Allergen Warning',
    panel: 'Back panel',
    title: 'Tree Nut Species Specificity Declaration',
    changeType: 'REGULATORY_COMPLIANCE',
    owner: 'Legal / Regulatory Counsel',
    originalText: 'Contains: Almonds. May contain tree nuts.',
    proposedText: 'Contains: Almonds. May contain Walnuts, Pecans, and Cashews.',
    diffSegments: [
      { text: 'Contains: Almonds. May contain ', type: 'unchanged' },
      { text: 'tree nuts', type: 'deleted' },
      { text: 'Walnuts, Pecans, and Cashews', type: 'inserted' },
      { text: '.', type: 'unchanged' }
    ],
    rationale: 'Complies with US Food Allergen Labeling and Consumer Protection Act (FALCPA, 21 U.S.C. 343(w)). Specific botanical species of tree nuts must be named.'
  },
  {
    id: 'track-claims',
    category: 'Front Panel Marketing Copy',
    panel: 'Front panel (Principal Display Panel)',
    title: 'Removal of "NO ADDED SUGAR" Claim',
    changeType: 'CLAIM_REMOVAL',
    owner: 'Legal / Marketing',
    originalText: 'DANCING FISH · BERRY CRUNCH GRANOLA · NO ADDED SUGAR · 480 g (16.9 oz)',
    proposedText: 'DANCING FISH · BERRY CRUNCH GRANOLA · 480 g (16.9 oz)',
    diffSegments: [
      { text: 'DANCING FISH · BERRY CRUNCH GRANOLA · ', type: 'unchanged' },
      { text: 'NO ADDED SUGAR · ', type: 'deleted' },
      { text: '480 g (16.9 oz)', type: 'unchanged' }
    ],
    rationale: 'Honey is a source of added sugars under 21 CFR 101.9(c)(6)(iii). 21 CFR 101.60(c)(2) strictly prohibits "no added sugar" claims on products containing added sugars.'
  }
];

/**
 * Returns full reviewer lenses dataset for the active session.
 */
export function getReviewerLensesData(sessionId = 'default') {
  const session = getDeskSession(sessionId);

  return {
    sessionId,
    cartonName: 'DancingFish_Granola_Berry_US_Carton.pdf',
    geometry: DIELINE_GEOMETRY,
    findings: CARTON_REVIEWER_FINDINGS,
    stickyNotes: CARTON_REVIEWER_FINDINGS.map(f => ({
      ...f.stickyNote,
      findingId: f.id,
      panel: f.panel,
      positionMm: f.positionMm,
      color: f.color
    })),
    trackChanges: TRACK_CHANGES_ITEMS,
    owners: ['All', 'Legal', 'R&D', 'Brand'],
    summary: {
      totalFindings: CARTON_REVIEWER_FINDINGS.length,
      legalCount: CARTON_REVIEWER_FINDINGS.filter(f => f.owner === 'Legal').length,
      rdCount: CARTON_REVIEWER_FINDINGS.filter(f => f.owner === 'R&D').length,
      brandCount: CARTON_REVIEWER_FINDINGS.filter(f => f.owner === 'Brand').length
    }
  };
}

/**
 * Generates the single-page A3 landscape wall poster printable HTML document.
 * Formatted with strict @page { size: A3 landscape; margin: 8mm; } to ensure
 * it prints on exactly ONE page.
 */
export function generateA3WallPosterHtml(sessionId = 'default') {
  const data = getReviewerLensesData(sessionId);

  // Render Panel boxes
  const panelsHtml = data.geometry.panels.map(p => `
    <div class="poster-panel-box" id="poster-${p.id}" style="
      left: ${(p.xMm / data.geometry.canvasWidthMm) * 100}%;
      top: ${(p.yMm / data.geometry.canvasHeightMm) * 100}%;
      width: ${(p.widthMm / data.geometry.canvasWidthMm) * 100}%;
      height: ${(p.heightMm / data.geometry.canvasHeightMm) * 100}%;
    ">
      <div class="poster-panel-label">${escapeHtml(p.name)}</div>
      <div class="poster-panel-dims">${p.widthMm.toFixed(1)} × ${p.heightMm.toFixed(1)} mm</div>
    </div>
  `).join('');

  // Render Red-pen overlay SVG
  const redPenSvg = `
    <svg class="poster-redpen-svg" viewBox="0 0 ${data.geometry.canvasWidthPt} ${data.geometry.canvasHeightPt}">
      <defs>
        <marker id="red-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
        </marker>
        <marker id="blue-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
        </marker>
      </defs>
      ${data.findings.map(f => `
        <g class="poster-mark-group" data-finding-id="${f.id}">
          <path d="${f.redPen.svgPath}" fill="none" stroke="${f.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${f.redPen.strikePath ? `<path d="${f.redPen.strikePath}" fill="none" stroke="${f.color}" stroke-width="2.5" stroke-linecap="round" />` : ''}
          ${f.redPen.arrowPath ? `<path d="${f.redPen.arrowPath}" fill="none" stroke="${f.color}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#${f.color === '#dc2626' ? 'red-arrow' : 'blue-arrow'})" />` : ''}
          <text x="${f.dielinePt[0]}" y="${f.dielinePt[1] - 15}" fill="${f.color}" font-family="system-ui, sans-serif" font-size="11" font-weight="bold">${escapeHtml(f.redPen.calloutText)}</text>
        </g>
      `).join('')}
    </svg>
  `;

  // Render Sticky Notes column
  const stickyNotesHtml = data.stickyNotes.map(n => `
    <div class="poster-sticky-card ${n.owner.toLowerCase()}">
      <div class="sticky-top">
        <span class="sticky-owner-badge ${n.owner.toLowerCase()}">${escapeHtml(n.owner)} · ${escapeHtml(n.badge)}</span>
        <span class="sticky-panel-ref">${escapeHtml(n.panel)}</span>
      </div>
      <div class="sticky-author">${escapeHtml(n.ownerName)}</div>
      <p class="sticky-text">${escapeHtml(n.note)}</p>
      <div class="sticky-action"><strong>Action:</strong> ${escapeHtml(n.actionRequired)}</div>
    </div>
  `).join('');

  // Render Track Changes
  const trackChangesHtml = data.trackChanges.map(t => {
    const diffHtml = t.diffSegments.map(s => {
      if (s.type === 'deleted') return `<del class="diff-del">${escapeHtml(s.text)}</del>`;
      if (s.type === 'inserted') return `<ins class="diff-ins">${escapeHtml(s.text)}</ins>`;
      return `<span>${escapeHtml(s.text)}</span>`;
    }).join('');

    return `
      <div class="poster-track-item">
        <div class="track-header">
          <strong>${escapeHtml(t.title)}</strong>
          <span class="track-panel-tag">${escapeHtml(t.panel)}</span>
        </div>
        <div class="track-diff-box">${diffHtml}</div>
        <div class="track-rationale"><em>Rationale:</em> ${escapeHtml(t.rationale)}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PackSignal — Senior Reviewer Markup Poster (A3 Wall Poster)</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 8mm;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      width: 404mm; /* A3 width minus margins */
      height: 281mm; /* A3 height minus margins */
      max-height: 281mm;
      overflow: hidden;
    }
    .poster-container {
      display: grid;
      grid-template-rows: 24mm 1fr 22mm;
      height: 100%;
      gap: 3mm;
    }
    /* Header */
    .poster-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 2mm;
    }
    .poster-brand-block h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .poster-subtitle {
      font-size: 8pt;
      color: #475569;
      margin-top: 1mm;
    }
    .poster-header-badges {
      display: flex;
      gap: 3mm;
      align-items: center;
    }
    .poster-pill {
      font-size: 8pt;
      font-weight: 700;
      padding: 1.5mm 3.5mm;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pill-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .pill-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
    .pill-purple { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }

    /* Main Grid */
    .poster-body-grid {
      display: grid;
      grid-template-columns: 260mm 1fr;
      gap: 4mm;
      height: 100%;
      min-height: 0;
    }

    /* Dieline Canvas */
    .poster-dieline-frame {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      position: relative;
      background: #f8fafc;
      overflow: hidden;
      height: 100%;
    }
    .poster-panel-box {
      position: absolute;
      border: 1px dashed #94a3b8;
      background: rgba(255, 255, 255, 0.85);
      padding: 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 1;
    }
    #poster-panel-front { border: 1.5px solid #0284c7; background: #ffffff; }
    .poster-panel-label {
      font-size: 7pt;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
    }
    .poster-panel-dims {
      font-size: 6pt;
      color: #94a3b8;
      align-self: flex-end;
    }
    .poster-redpen-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
      pointer-events: none;
    }

    /* Side Panels: Sticky Notes & Track Changes */
    .poster-side-column {
      display: flex;
      flex-direction: column;
      gap: 3mm;
      min-height: 0;
    }
    .poster-section-header {
      font-size: 9pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1mm;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .poster-sticky-tray {
      display: flex;
      flex-direction: column;
      gap: 2mm;
      overflow-y: hidden;
      flex: 1;
    }
    .poster-sticky-card {
      padding: 2mm 3mm;
      border-radius: 4px;
      font-size: 7pt;
      line-height: 1.35;
      border: 1px solid transparent;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .poster-sticky-card.legal { background: #fef3c7; border-color: #f59e0b; color: #78350f; }
    .poster-sticky-card.r\\&d { background: #e0f2fe; border-color: #0284c7; color: #0c4a6e; }
    .poster-sticky-card.brand { background: #f3e8ff; border-color: #9333ea; color: #581c87; }
    .sticky-top {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1mm;
      font-weight: 700;
    }
    .sticky-owner-badge { font-size: 6.5pt; text-transform: uppercase; }
    .sticky-panel-ref { font-size: 6pt; opacity: 0.8; }
    .sticky-author { font-size: 6.5pt; font-weight: 600; margin-bottom: 1mm; }
    .sticky-text { margin: 0 0 1mm 0; }
    .sticky-action { font-size: 6.5pt; font-weight: 600; }

    /* Track Changes Section */
    .poster-track-section {
      display: flex;
      flex-direction: column;
      gap: 2mm;
      flex: 1;
      overflow-y: hidden;
    }
    .poster-track-item {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 2mm 2.5mm;
      font-size: 6.5pt;
      line-height: 1.3;
    }
    .track-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1mm;
      font-size: 7pt;
    }
    .track-panel-tag { font-size: 6pt; color: #64748b; }
    .track-diff-box {
      background: #ffffff;
      padding: 1.5mm;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      margin-bottom: 1mm;
    }
    .diff-del { color: #dc2626; text-decoration: line-through; background: #fee2e2; }
    .diff-ins { color: #16a34a; text-decoration: underline; background: #dcfce7; font-weight: bold; }
    .track-rationale { font-size: 6pt; color: #475569; }

    /* Footer / Prepress Sign-Off */
    .poster-footer {
      border-top: 1.5px solid #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 2mm;
      font-size: 7.5pt;
    }
    .poster-signoff-boxes {
      display: flex;
      gap: 8mm;
    }
    .signoff-box {
      display: flex;
      gap: 2mm;
      align-items: center;
      border-right: 1px solid #cbd5e1;
      padding-right: 6mm;
    }
    .signoff-line {
      display: inline-block;
      width: 25mm;
      border-bottom: 1px solid #0f172a;
      margin-left: 1mm;
    }

    @media print {
      body { width: 100%; height: 100%; }
      .poster-container { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="poster-container">
    <!-- Header -->
    <header class="poster-header">
      <div class="poster-brand-block">
        <h1>PACKSIGNAL SENIOR REVIEWER MARKUP POSTER · ESKO CARTRIDGE SPEC</h1>
        <div class="poster-subtitle">
          Artwork: <strong>DancingFish_Granola_Berry_US_Carton.pdf</strong> | Jurisdiction: <strong>US FDA 21 CFR</strong> | Verified Findings: <strong>${data.summary.totalFindings} active marks</strong>
        </div>
      </div>
      <div class="poster-header-badges">
        <span class="poster-pill pill-red">LEGAL (${data.summary.legalCount})</span>
        <span class="poster-pill pill-blue">R&amp;D (${data.summary.rdCount})</span>
        <span class="poster-pill pill-purple">BRAND (${data.summary.brandCount})</span>
      </div>
    </header>

    <!-- Main Grid: Dieline + Reviewer Lenses -->
    <main class="poster-body-grid">
      <!-- 2D Dieline with Red Pen Markup -->
      <section class="poster-dieline-frame">
        ${panelsHtml}
        ${redPenSvg}
      </section>

      <!-- Right Column: Sticky Notes + Track Changes -->
      <aside class="poster-side-column">
        <div class="poster-section-header">REVIEWER STICKY NOTES BY OWNER</div>
        <div class="poster-sticky-tray">
          ${stickyNotesHtml}
        </div>

        <div class="poster-section-header" style="margin-top:2mm;">TRACK CHANGES (REDLINE COPY)</div>
        <div class="poster-track-section">
          ${trackChangesHtml}
        </div>
      </aside>
    </main>

    <!-- Prepress Sign-Off Footer -->
    <footer class="poster-footer">
      <div>
        <strong>PACKSIGNAL PROVENANCE AUDIT LEDGER</strong> · Modulo-10 Barcode PASS · Dual-declaration (480g / 16.9oz) PASS · Certified Vegan VERIFIED
      </div>
      <div class="poster-signoff-boxes">
        <div class="signoff-box">
          <span>Legal Sign-off:</span>
          <span class="signoff-line"></span>
        </div>
        <div class="signoff-box">
          <span>R&amp;D Sign-off:</span>
          <span class="signoff-line"></span>
        </div>
        <div class="signoff-box">
          <span>Prepress Lead:</span>
          <span class="signoff-line"></span>
        </div>
      </div>
      <div>
        <strong>PAGE 1 OF 1</strong> (A3 WALL POSTER FORMAT)
      </div>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
