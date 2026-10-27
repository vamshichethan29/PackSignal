/**
 * @file shopper-lenses.mjs
 * 
 * Phase 6A — Shopper Lenses Engine: Turning Rule Problems into Shopper Experiences
 * 
 * Implements:
 * 1. Shopper Personas (Nut allergy, Vegan, Watching sugar, Low vision, and India personas).
 *    Each persona features an audited one-line verdict, shopper journey, and verbatim source proof links.
 * 2. Shelf-Distance Test with readability per required packaging element.
 *    Names the first required item to become unreadable and shows its numbers.
 * 3. 3-Second Glance Heatmap with sequential gaze fixations.
 * 4. Colour-Blindness & Contrast Checks (Protanopia, Deuteranopia, Tritanopia, Monochromacy, and WCAG contrast).
 * 5. Confidence Glow highlighting verified vs non-compliant carton elements.
 * 6. Before / After Wipe comparison data.
 * 7. Explicit labeling of every estimate as an estimate.
 */

export const ESTIMATE_DISCLAIMER = '[ESTIMATE: Based on Snellen 20/20 standard visual acuity under 500 lux retail shelf illumination]';

/**
 * Shopper Personas with audited one-line verdicts and source proof links.
 */
export const SHOPPER_PERSONAS = [
  {
    id: 'persona-nut-allergy',
    name: 'Maya Lin',
    personaTitle: 'Severe Tree Nut Allergy (Anaphylaxis Risk)',
    demographic: 'Adult, 29 · Mother of allergic child · Scans every package carefully',
    icon: '🥜',
    riskLevel: 'CRITICAL_HAZARD',
    status: 'UNSAFE',
    badge: 'ALLERGEN VIOLATION',
    oneLineVerdict: 'Unsafe: Carton carries a vague "May contain tree nuts" advisory without naming specific botanical species, while recipe drift introduces unapproved walnuts.',
    shopperJourney: 'Maya picks up the Berry Crunch carton in aisle 4, flips immediately to the back informational panel, and looks for the allergen box. She reads "Contains: Almonds. May contain tree nuts." Because the specific tree nut species (walnuts, pecans, cashews) are not declared, she cannot verify whether the product was cross-contaminated with walnuts—a lethal allergen for her child. She places the carton back on the shelf in frustration.',
    affectedElement: 'FALCPA Allergen Advisory & Ingredient Statement',
    panel: 'Back panel',
    positionMm: { x: 65.0, y: 128.0 },
    ruleCitation: 'FALCPA (21 U.S.C. 343(w)) & FDA Draft Guidance on Allergen Advisory Statements',
    verbatimCartonText: 'Contains: Almonds. May contain tree nuts.',
    approvedSpecText: 'Contains: Almonds. May contain Walnuts, Pecans, and Cashews.',
    sources: [
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Back panel (Allergen Statement)',
        type: 'pdf',
        quote: 'Contains: Almonds. May contain tree nuts.'
      },
      {
        file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        location: 'Row 26, Columns A–C (Master Formulation)',
        type: 'excel',
        quote: 'Base Granola Formula DF-2026 (No Walnuts approved in master cluster mix)'
      }
    ]
  },
  {
    id: 'persona-vegan',
    name: 'Alex Rivera',
    personaTitle: 'Strict Ethical Vegan',
    demographic: 'Adult, 24 · Animal-welfare consumer · Avoids all animal & insect by-products',
    icon: '🌱',
    riskLevel: 'ETHICAL_CONFLICT',
    status: 'CONFLICT',
    badge: 'CERTIFICATION CONFLICT',
    oneLineVerdict: 'Conflict: Right display panel proudly displays the Certified Vegan shield, but the back ingredient declaration lists honey (an animal/bee-derived byproduct).',
    shopperJourney: 'Alex spots the prominent Certified Vegan logo on the right side of the carton and assumes the product is 100% plant-based. However, on flipping to the ingredients to check the sweeteners, Alex discovers "honey (1%)". Because honey is harvested from bees, it violates standard ethical vegan criteria (Vegan.org licensing DF-US-2026 rules). Alex feels misled by conflicting brand trust marks.',
    affectedElement: 'Certified Vegan Emblem vs Honey Declaration',
    panel: 'Right panel (Mark) vs Back panel (Ingredients)',
    positionMm: { x: 42.0, y: 135.0 },
    ruleCitation: 'FTC Guides for the Use of Environmental Marketing Claims (16 CFR Part 260) & Vegan Action Standard',
    verbatimCartonText: 'Certified Vegan Mark (Right Panel) / Honey (1%) (Back Panel)',
    approvedSpecText: 'Either replace clover honey with organic agave nectar, or remove Certified Vegan mark.',
    sources: [
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Right display panel',
        type: 'pdf',
        quote: 'Certified Vegan emblem'
      },
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Back panel (Ingredients)',
        type: 'pdf',
        quote: 'honey (1%)'
      },
      {
        file: 'DancingFish_Old_Design.png',
        location: 'Right Panel Trust Marks',
        type: 'image',
        quote: 'Certified Vegan Logo (Vegan.org license DF-US-2026)'
      }
    ]
  },
  {
    id: 'persona-watching-sugar',
    name: 'David Miller',
    personaTitle: 'Pre-Diabetic / Watching Added Sugars',
    demographic: 'Adult, 48 · Managing glycemic index · Actively monitors added sugar grams',
    icon: '📉',
    riskLevel: 'MISBRANDING_RISK',
    status: 'MISLEADING',
    badge: 'FDA CLAIM VIOLATION',
    oneLineVerdict: 'Misleading: Front PDP prominently claims "NO ADDED SUGAR", yet clover honey is the second primary ingredient and a regulated added sugar under FDA rules.',
    shopperJourney: 'David walks down the cereal aisle looking for a breakfast that will not spike blood glucose. The large banner "NO ADDED SUGAR" on the front panel catches his eye. However, on checking the nutrition panel and ingredients, honey is listed as a major binding syrup (9% master formula). Under 21 CFR 101.9(c)(6)(iii), honey is legally classified as added sugars. David feels the front claim is deceptive marketing.',
    affectedElement: 'Front PDP Claim vs Nutrition Facts Added Sugars',
    panel: 'Front panel (PDP)',
    positionMm: { x: 71.4, y: 35.2 },
    ruleCitation: '21 CFR 101.60(c)(2) (Nutrient Content Claims for Sugar) & 21 CFR 101.9(c)(6)(iii)',
    verbatimCartonText: 'DANCING FISH · BERRY CRUNCH GRANOLA · NO ADDED SUGAR',
    approvedSpecText: 'Remove "NO ADDED SUGAR" claim; honey contributes 7g added sugar per serving.',
    sources: [
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Front panel (PDP top banner)',
        type: 'pdf',
        quote: 'NO ADDED SUGAR'
      },
      {
        file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        location: 'Cell B26',
        type: 'excel',
        quote: 'Honey 9%'
      }
    ]
  },
  {
    id: 'persona-low-vision',
    name: 'Eleanor Vance',
    personaTitle: 'Senior Citizen / Low Vision / Presbyopia',
    demographic: 'Adult, 71 · Requires +2.5D reading glasses · Struggles under harsh retail fluorescent lights',
    icon: '👓',
    riskLevel: 'ACCESSIBILITY_BARRIER',
    status: 'STRAINING',
    badge: 'LEGIBILITY FAILURE',
    oneLineVerdict: 'Straining: Low 3.2:1 contrast and small 6 pt type on cream cardstock make the serving size and ingredient statement unreadable from beyond 30 cm.',
    shopperJourney: 'Eleanor stands in the supermarket without her reading glasses. The brand logo and berry bowl illustration are visible from a meter away, but when she attempts to verify how many servings are in the box, the 6.0 pt light-brown text on the cream background blurs completely. She must bring the package within 25 cm of her eyes to decipher the text.',
    affectedElement: 'Nutrition Table Small Print & Color Contrast',
    panel: 'Left panel & Back panel',
    positionMm: { x: 38.0, y: 35.0 },
    ruleCitation: 'FDA 21 CFR 101.2(c) (Prominence and Legibility) & ADA Packaging Accessibility Guidelines',
    verbatimCartonText: '8 servings per container · Serving size 85g (6 pt font, contrast ratio 3.2:1)',
    approvedSpecText: 'Increase contrast ratio to minimum 4.5:1 (WCAG AA); enlarge key serving declaration to min 8 pt.',
    sources: [
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Left panel (Nutrition Facts footnote)',
        type: 'pdf',
        quote: '8 servings per container, Serving size 85g'
      }
    ]
  },
  {
    id: 'persona-india-vegetarian',
    name: 'Aarav Sharma',
    personaTitle: 'Lacto-Vegetarian / Religious Dietary Adherent',
    demographic: 'Adult, 32 · Indian diaspora / Cross-border market shopper · Strictly verifies Veg Dot symbol',
    icon: '🟢',
    riskLevel: 'REGULATORY_ABSENCE',
    status: 'MISSING_MARK',
    badge: 'FSSAI MARK MISSING',
    oneLineVerdict: 'Missing Mark: US carton completely lacks the mandatory FSSAI Green Veg Dot symbol required for sale in India under Food Safety and Standards Regulations.',
    shopperJourney: 'Aarav inspects the carton in an international specialty store. In India, 100% of vegetarian packaged food must carry the green square with a filled green circle on the principal display panel. Without the FSSAI Green Dot symbol, Aarav cannot immediately verify whether animal-derived emulsifiers (e.g. tallow, gelatin) were used, and hesitates to purchase.',
    affectedElement: 'FSSAI Green Veg Dot Emblem',
    panel: 'Front panel (PDP)',
    positionMm: { x: 130.0, y: 135.0 },
    ruleCitation: 'FSSAI (Packaging and Labelling) Regulations, 2011, Regulation 2.2.2.4',
    verbatimCartonText: '[No FSSAI Vegetarian Symbol Present on US Pack]',
    approvedSpecText: 'Add 6 mm green square with filled green circle on PDP next to brand title.',
    sources: [
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Front panel (Entire PDP)',
        type: 'pdf',
        quote: 'Absence of FSSAI green dot emblem'
      }
    ]
  },
  {
    id: 'persona-india-price',
    name: 'Priya Patel',
    personaTitle: 'Price & Consumer Rights Conscious Shopper',
    demographic: 'Adult, 36 · Cross-border consumer · Expects statutory MRP and 14-digit FSSAI license',
    icon: '₹',
    riskLevel: 'STATUTORY_ABSENCE',
    status: 'MISSING_MARK',
    badge: 'LEGAL METROLOGY MISSING',
    oneLineVerdict: 'Missing Statutory Data: Lacks Maximum Retail Price (MRP incl. of all taxes) and 14-digit FSSAI manufacturing license number required for Indian retail.',
    shopperJourney: 'Priya looks for the mandatory Indian declaration panel: "MRP Rs. (incl. of all taxes)", Date of Manufacture, Expiry Date, and FSSAI License No. The US pack only carries US Net Weight in oz/g and UPC barcode, making it legally non-compliant for direct retail sale in India without an over-sticker.',
    affectedElement: 'MRP & FSSAI 14-Digit License Number',
    panel: 'Back panel / Bottom flap',
    positionMm: { x: 100.0, y: 140.0 },
    ruleCitation: 'Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e)',
    verbatimCartonText: '[No MRP or 14-Digit FSSAI License Declared]',
    approvedSpecText: 'Include statutory Indian import panel with MRP, customer care number, and importer license.',
    sources: [
      {
        file: 'DancingFish_Granola_Berry_US_Carton.pdf',
        location: 'Back panel bottom',
        type: 'pdf',
        quote: 'Absence of Indian Legal Metrology declarations'
      }
    ]
  }
];

/**
 * Standard shelf viewing distances and human visual acuity model.
 * Based on Snellen 20/20 standard: 1 arcminute resolution angle = 0.000291 radians.
 */
export const SHELF_READABILITY_ITEMS = [
  {
    id: 'item-brand-logo',
    name: 'Dancing Fish Brand Logo',
    category: 'BRAND',
    capHeightMm: 28.0,
    fontPt: 80.0,
    panel: 'Front panel (PDP)',
    mandatory: false,
    readabilityAtDistance: {
      d300cm: { readable: true, visualAcuityMinutes: 0.32, clarityScore: 98 },
      d150cm: { readable: true, visualAcuityMinutes: 0.64, clarityScore: 100 },
      d60cm:  { readable: true, visualAcuityMinutes: 1.61, clarityScore: 100 },
      d30cm:  { readable: true, visualAcuityMinutes: 3.21, clarityScore: 100 }
    },
    maxReadableDistanceMeters: 4.80,
    estimateLabel: ESTIMATE_DISCLAIMER
  },
  {
    id: 'item-statement-identity',
    name: 'Statement of Identity ("Berry Crunch Granola")',
    category: 'IDENTITY',
    capHeightMm: 8.5,
    fontPt: 24.0,
    panel: 'Front panel (PDP)',
    mandatory: true,
    citation: '21 CFR 101.3',
    readabilityAtDistance: {
      d300cm: { readable: false, visualAcuityMinutes: 1.05, clarityScore: 35 },
      d150cm: { readable: true,  visualAcuityMinutes: 0.52, clarityScore: 90 },
      d60cm:  { readable: true,  visualAcuityMinutes: 0.21, clarityScore: 100 },
      d30cm:  { readable: true,  visualAcuityMinutes: 0.10, clarityScore: 100 }
    },
    maxReadableDistanceMeters: 1.95,
    estimateLabel: ESTIMATE_DISCLAIMER
  },
  {
    id: 'item-net-quantity',
    name: 'Net Quantity of Contents ("480 g / 16.9 oz")',
    category: 'NET_QUANTITY',
    capHeightMm: 4.8,
    fontPt: 13.5,
    panel: 'Front panel (PDP, bottom 30%)',
    mandatory: true,
    citation: '21 CFR 101.7',
    readabilityAtDistance: {
      d300cm: { readable: false, visualAcuityMinutes: 1.86, clarityScore: 10 },
      d150cm: { readable: false, visualAcuityMinutes: 0.93, clarityScore: 48 },
      d60cm:  { readable: true,  visualAcuityMinutes: 0.37, clarityScore: 92 },
      d30cm:  { readable: true,  visualAcuityMinutes: 0.19, clarityScore: 100 }
    },
    maxReadableDistanceMeters: 1.10,
    estimateLabel: ESTIMATE_DISCLAIMER
  },
  {
    id: 'item-nutrition-title',
    name: 'Nutrition Facts Heading & Calories',
    category: 'NUTRITION',
    capHeightMm: 3.5,
    fontPt: 10.0,
    panel: 'Left panel',
    mandatory: true,
    citation: '21 CFR 101.9',
    readabilityAtDistance: {
      d300cm: { readable: false, visualAcuityMinutes: 2.55, clarityScore: 0 },
      d150cm: { readable: false, visualAcuityMinutes: 1.28, clarityScore: 25 },
      d60cm:  { readable: true,  visualAcuityMinutes: 0.51, clarityScore: 82 },
      d30cm:  { readable: true,  visualAcuityMinutes: 0.26, clarityScore: 100 }
    },
    maxReadableDistanceMeters: 0.80,
    estimateLabel: ESTIMATE_DISCLAIMER
  },
  {
    id: 'item-allergen-warning',
    name: 'FALCPA Allergen Declaration ("Contains: Almonds")',
    category: 'ALLERGENS',
    capHeightMm: 2.2,
    fontPt: 8.0,
    panel: 'Back panel',
    mandatory: true,
    citation: '21 U.S.C. 343(w)',
    readabilityAtDistance: {
      d300cm: { readable: false, visualAcuityMinutes: 4.05, clarityScore: 0 },
      d150cm: { readable: false, visualAcuityMinutes: 2.03, clarityScore: 0 },
      d60cm:  { readable: false, visualAcuityMinutes: 0.81, clarityScore: 42 },
      d30cm:  { readable: true,  visualAcuityMinutes: 0.41, clarityScore: 88 }
    },
    maxReadableDistanceMeters: 0.50,
    estimateLabel: ESTIMATE_DISCLAIMER
  },
  {
    id: 'item-ingredient-list',
    name: 'Ingredient Statement in Descending Order',
    category: 'INGREDIENTS',
    capHeightMm: 1.8,
    fontPt: 7.0,
    panel: 'Back panel',
    mandatory: true,
    citation: '21 CFR 101.4',
    readabilityAtDistance: {
      d300cm: { readable: false, visualAcuityMinutes: 4.95, clarityScore: 0 },
      d150cm: { readable: false, visualAcuityMinutes: 2.48, clarityScore: 0 },
      d60cm:  { readable: false, visualAcuityMinutes: 0.99, clarityScore: 30 },
      d30cm:  { readable: true,  visualAcuityMinutes: 0.50, clarityScore: 80 }
    },
    maxReadableDistanceMeters: 0.41,
    estimateLabel: ESTIMATE_DISCLAIMER
  },
  {
    id: 'item-manufacturer-address',
    name: 'Responsible Business Name and Complete Address',
    category: 'MANUFACTURER',
    capHeightMm: 1.5,
    fontPt: 6.0,
    panel: 'Back panel (Bottom)',
    mandatory: true,
    citation: '21 CFR 101.5',
    readabilityAtDistance: {
      d300cm: { readable: false, visualAcuityMinutes: 5.94, clarityScore: 0 },
      d150cm: { readable: false, visualAcuityMinutes: 2.97, clarityScore: 0 },
      d60cm:  { readable: false, visualAcuityMinutes: 1.19, clarityScore: 15 },
      d30cm:  { readable: true,  visualAcuityMinutes: 0.59, clarityScore: 72 }
    },
    maxReadableDistanceMeters: 0.35,
    estimateLabel: ESTIMATE_DISCLAIMER
  }
];

/**
 * Identifies the first required packaging element to become unreadable as distance increases.
 */
export function identifyFirstUnreadableElement(distanceMeters = 0.6) {
  // Sort mandatory items by max readable distance ascending (shortest readable distance drops out first)
  const mandatoryItems = SHELF_READABILITY_ITEMS.filter(item => item.mandatory);
  const sortedByDropout = [...mandatoryItems].sort((a, b) => a.maxReadableDistanceMeters - b.maxReadableDistanceMeters);

  // The first required item that drops out at or beyond arm's length (0.6m)
  const firstDropout = sortedByDropout[0]; // Lowest max readable distance

  // Find all items unreadable at the specified distance
  const unreadableAtDistance = mandatoryItems.filter(item => distanceMeters > item.maxReadableDistanceMeters);

  return {
    firstDropoutElement: firstDropout.name,
    firstDropoutCategory: firstDropout.category,
    firstDropoutCitation: firstDropout.citation,
    firstDropoutMaxDistanceM: firstDropout.maxReadableDistanceMeters,
    firstDropoutFontPt: firstDropout.fontPt,
    firstDropoutCapHeightMm: firstDropout.capHeightMm,
    targetDistanceM: distanceMeters,
    unreadableCountAtDistance: unreadableAtDistance.length,
    unreadableItemsAtDistance: unreadableAtDistance.map(i => i.name),
    explanation: `"${firstDropout.name}" is the FIRST mandatory element to become unreadable as a shopper steps back. Printed at ${firstDropout.fontPt} pt (${firstDropout.capHeightMm} mm cap height), it becomes illegible beyond ${firstDropout.maxReadableDistanceMeters} m under standard retail shelf lighting.`,
    isEstimate: true,
    estimateLabel: ESTIMATE_DISCLAIMER
  };
}

/**
 * 3-Second Glance Heatmap model.
 * Simulates sequential shopper attention across carton faces during the crucial first 3 seconds on the shelf.
 */
export const GLANCE_HEATMAP_DATA = {
  durationSeconds: 3.0,
  gazeSequence: [
    {
      timeWindow: '0.0s – 0.8s',
      focusTarget: 'Dancing Fish Master Logo Banner',
      panel: 'Front panel (PDP)',
      attentionSharePercent: 48,
      gazeXPercent: 50.0,
      gazeYPercent: 18.0,
      radiusPx: 75,
      intensity: 0.95,
      cognitiveImpression: 'Brand recognition: Identifies "Dancing Fish" artisan branding.'
    },
    {
      timeWindow: '0.8s – 1.8s',
      focusTarget: 'Granola Cluster & Berry Bowl Photography',
      panel: 'Front panel (PDP)',
      attentionSharePercent: 64,
      gazeXPercent: 50.0,
      gazeYPercent: 55.0,
      radiusPx: 95,
      intensity: 0.90,
      cognitiveImpression: 'Appetite appeal: Evaluates cluster crunch, berry pieces, and perceived freshness.'
    },
    {
      timeWindow: '1.8s – 2.5s',
      focusTarget: '"NO ADDED SUGAR" PDP Banner',
      panel: 'Front panel (PDP)',
      attentionSharePercent: 42,
      gazeXPercent: 50.0,
      gazeYPercent: 32.0,
      radiusPx: 60,
      intensity: 0.85,
      cognitiveImpression: 'Health halo: Absorbs "NO ADDED SUGAR" claim without checking honey ingredients on back panel.'
    },
    {
      timeWindow: '2.5s – 3.0s',
      focusTarget: 'Net Weight & Berry Crunch Identity',
      panel: 'Front panel (PDP)',
      attentionSharePercent: 30,
      gazeXPercent: 50.0,
      gazeYPercent: 88.0,
      radiusPx: 50,
      intensity: 0.70,
      cognitiveImpression: 'Value confirmation: Scans 480g weight before deciding whether to pick up.'
    }
  ],
  backPanelAttentionDuringGlance: {
    attentionSharePercent: 0,
    observation: 'Back panel receives 0% gaze during the initial 3-second shelf encounter. Shoppers commit to purchase intent based entirely on the PDP claims before ever seeing allergen or ingredient disclosures.'
  },
  isEstimate: true,
  estimateLabel: ESTIMATE_DISCLAIMER
};

/**
 * Colour-blindness simulations and WCAG contrast evaluations.
 */
export const CONTRAST_AND_ACCESSIBILITY_DATA = {
  contrastChecks: [
    {
      element: 'Front PDP Title on Cream Cardstock',
      textColor: '#1a1412', // Deep brown
      backgroundColor: '#fbf7ee', // Warm cream
      contrastRatio: 14.8,
      requiredRatioAA: 4.5,
      requiredRatioAAA: 7.0,
      wcagRating: 'AAA',
      status: 'PASS'
    },
    {
      element: 'Back Panel Ingredient Statement',
      textColor: '#292524', // Warm stone
      backgroundColor: '#ffffff', // White
      contrastRatio: 12.4,
      requiredRatioAA: 4.5,
      requiredRatioAAA: 7.0,
      wcagRating: 'AAA',
      status: 'PASS'
    },
    {
      element: '"NO ADDED SUGAR" Claim Text',
      textColor: '#dc2626', // Red
      backgroundColor: '#ffffff', // White
      contrastRatio: 4.6,
      requiredRatioAA: 4.5,
      requiredRatioAAA: 7.0,
      wcagRating: 'AA',
      status: 'PASS'
    },
    {
      element: 'Light Berry Story Narrative Accent',
      textColor: '#e11d48', // Berry pink
      backgroundColor: '#fdf2f4', // Light pink tint
      contrastRatio: 3.1,
      requiredRatioAA: 4.5,
      requiredRatioAAA: 7.0,
      wcagRating: 'FAIL',
      status: 'FAIL',
      note: 'Fails WCAG 2.1 AA minimum 4.5:1 ratio for normal body copy. Difficult for seniors to read.'
    }
  ],
  colorBlindnessModes: [
    { id: 'normal', name: 'Normal Vision', description: 'Standard trichromatic color vision (92% of population)' },
    { id: 'protanopia', name: 'Protanopia (Red-Blind)', description: 'Missing L-cones; red appears dark amber/brown (1.0% of males)' },
    { id: 'deuteranopia', name: 'Deuteranopia (Green-Blind)', description: 'Missing M-cones; red and green hue confusion (1.1% of males)' },
    { id: 'tritanopia', name: 'Tritanopia (Blue-Blind)', description: 'Missing S-cones; blue appears greenish, yellow appears violet (0.01%)' },
    { id: 'achromatopsia', name: 'Monochromacy (Total Blind)', description: 'Complete lack of color perception; grayscale contrast only' }
  ]
};

/**
 * Returns comprehensive Shopper Lenses data payload.
 */
export function getShopperLensesData(activeDistance = 0.6) {
  const dropoutAnalysis = identifyFirstUnreadableElement(activeDistance);

  return {
    status: 'SUCCESS',
    personas: SHOPPER_PERSONAS,
    shelfReadability: {
      items: SHELF_READABILITY_ITEMS,
      activeDistanceMeters: activeDistance,
      firstDropout: dropoutAnalysis,
      isEstimate: true,
      estimateDisclaimer: ESTIMATE_DISCLAIMER
    },
    glanceHeatmap: GLANCE_HEATMAP_DATA,
    accessibility: CONTRAST_AND_ACCESSIBILITY_DATA,
    beforeAfterWipe: {
      beforeState: {
        title: 'Original Uncorrected Carton (Current Print Run)',
        hazards: [
          'Deceptive "NO ADDED SUGAR" claim on PDP despite 9% honey',
          'Vague "May contain tree nuts" advisory violates FALCPA',
          'Unapproved walnuts added to ingredient list without allergen check',
          'Carbohydrate mismatch: 66g on carton vs 15g in master spec',
          'Wrong % Daily Values (Fat 9% vs 19%, Sodium 0% vs 2%)'
        ],
        badge: 'NON-COMPLIANT · 5 CRITICAL DEFECTS',
        badgeColor: '#dc2626'
      },
      afterState: {
        title: 'Senior Reviewer Corrected Pack (Remediated Spec)',
        remediations: [
          'Strikes out "NO ADDED SUGAR" claim per 21 CFR 101.60(c)(2)',
          'Specific FALCPA warning: "May contain Walnuts, Pecans, and Cashews"',
          'Reverts unapproved seeds/walnuts back to approved master granola recipe',
          'Accurate Nutrition Facts table with FDA 4-4-9 Atwater verified calories',
          'Retains 18mm Certified Vegan shield with verified non-animal syrup source'
        ],
        badge: 'AUDITED & APPROVED · ZERO DEFECTS',
        badgeColor: '#16a34a'
      }
    }
  };
}

// Re-export Shopper Personas Engine (Upgrade #42)
export * from './shopper-personas.mjs';
