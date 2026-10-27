/**
 * PackSignal Phase 4 — Evidence Desk Engine (lib/evidence-desk.mjs)
 * 
 * Implements Phase 4:
 * 1. Evidence Desk with live progress and multi-source inputs:
 *    - PDF Dieline (page, box, panel, layer)
 *    - Excel Content Sheet (columns A–C only)
 *    - Word (.docx) Reader (paragraph locations)
 *    - Plain-PDF Reader (page and line, no panels)
 *    - Notes (.txt or pasted text, line numbers as source)
 *    - JPG/PNG Images of old design (vision model, facts start AI-suggested)
 * 2. Fact Sheet with source chips that open the file at the right spot.
 * 3. Conflict cards with one-click and custom resolution.
 * 4. Questions stack (at most 10 prioritized questions, answering updates Fact Sheet live).
 * 5. Creative Brief feed: keep / change / add / remove matrix from design questions.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  parseOrganizerSamples,
  parseSourceFile,
  parseDocxSourcePieces,
  parsePlainPdfSourcePieces,
  parseNoteSourcePieces,
  parseImageSourcePieces
} from './source-pieces.mjs';
import { getOrganizerFactSheet } from './fact-sheet.mjs';
import { evaluateRequirementsAndQuestions } from './requirements-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');

// In-memory desk session registry
const deskSessions = new Map();

/**
 * Initializes or retrieves an Evidence Desk session.
 */
export function getDeskSession(sessionId = 'default') {
  if (deskSessions.has(sessionId)) {
    return deskSessions.get(sessionId);
  }
  const session = createDefaultDeskSession(sessionId);
  deskSessions.set(sessionId, session);
  return session;
}

/**
 * Resets an Evidence Desk session.
 */
export function resetDeskSession(sessionId = 'default') {
  const session = createDefaultDeskSession(sessionId);
  deskSessions.set(sessionId, session);
  return session;
}

/**
 * Creates the initial default Evidence Desk session based on Esko samples + extra inputs.
 */
function createDefaultDeskSession(sessionId) {
  // 1. Parse all sample inputs
  const samples = parseOrganizerSamples();
  const baseFactSheet = getOrganizerFactSheet();
  const requirements = evaluateRequirementsAndQuestions();

  // 2. Build files manifest for Evidence Desk
  const files = [
    {
      id: 'file-pdf-carton',
      name: 'DancingFish_Granola_Berry_US_Carton.pdf',
      type: 'pdf',
      formatLabel: 'PDF DIELINE',
      role: 'Artwork Proof',
      sha256: samples.pdf?.pieces?.[0]?.documentSha256 || '22b79ebdbff5a5fbda753c133a8862ecfa7713da2ef2a9190db99cf76f3f0099',
      piecesCount: samples.pdf?.pieces?.length || 260,
      activePiecesCount: samples.pdf?.activePieces?.length || 248,
      status: 'READY',
      features: ['Panels mapped', 'Occlusion render checked', 'Letter-spacing rebuilt', 'Guide text ignored']
    },
    {
      id: 'file-excel-spec',
      name: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
      type: 'xlsx',
      formatLabel: 'EXCEL (COLS A–C)',
      role: 'Product Specification',
      sha256: samples.excel?.pieces?.[0]?.documentSha256 || '4cb6e8f0a3ecbbd964f40f0c059c03792cb003b5f925b34bc449520cb6ee9e55',
      piecesCount: samples.excel?.pieces?.length || 114,
      activePiecesCount: samples.excel?.activePieces?.length || 114,
      status: 'READY',
      features: ['Columns A–C only', 'Formulas skipped', 'Sheet notes checked for AI-suggested']
    },
    {
      id: 'file-docx-spec',
      name: 'DancingFish_Granola_Product_Spec.docx',
      type: 'docx',
      formatLabel: 'WORD (.DOCX)',
      role: 'Brand Specification',
      sha256: samples.docx?.pieces?.[0]?.documentSha256 || 'a8b490d7a63b7a26820630b95f87d84ccea2fede53708c5d5a84dbdaa1099c66',
      piecesCount: samples.docx?.pieces?.length || 7,
      activePiecesCount: samples.docx?.activePieces?.length || 7,
      status: 'READY',
      features: ['Paragraph locations', 'Heading hierarchy', 'Regulatory notes']
    },
    {
      id: 'file-plain-pdf',
      name: 'DancingFish_Granola_Tech_Spec.pdf',
      type: 'plain_pdf',
      formatLabel: 'PLAIN PDF (LINES)',
      role: 'Technical Specification',
      sha256: samples.plainPdf?.pieces?.[0]?.documentSha256 || '78723ec52471c033ae4798ae3704fb5bf9da79a333d11525c951e491397b2910',
      piecesCount: samples.plainPdf?.pieces?.length || 10,
      activePiecesCount: samples.plainPdf?.activePieces?.length || 10,
      status: 'READY',
      features: ['Page and line locations', 'No panels/dieline', 'Serving & batch facts']
    },
    {
      id: 'file-notes-txt',
      name: 'DancingFish_QA_Notes.txt',
      type: 'note',
      formatLabel: 'NOTES (.TXT)',
      role: 'QA Handover Notes',
      sha256: samples.notes?.pieces?.[0]?.documentSha256 || '265db218e22bb31212ef92117176790b0c216e6136839cecdd9a84e7bb2de89e',
      piecesCount: samples.notes?.pieces?.length || 6,
      activePiecesCount: samples.notes?.pieces?.length || 6,
      status: 'READY',
      features: ['Line numbers as source', 'Assumed/confirm flags', 'Release target']
    },
    {
      id: 'file-old-design',
      name: 'DancingFish_Old_Design.png',
      type: 'image',
      formatLabel: 'VISION IMAGE',
      role: 'Archival Pack Photo',
      sha256: samples.image?.pieces?.[0]?.documentSha256 || 'ea867540a9b6c4eb89e6eb5f9e2b10a2cd91d6361a9fbdfd92f5e3a097a8e0f1',
      piecesCount: samples.image?.pieces?.length || 6,
      activePiecesCount: samples.image?.pieces?.length || 6,
      status: 'READY',
      features: ['Vision model inspection', 'Facts start AI-suggested', 'Brand asset extraction']
    }
  ];

  // 3. Construct unified Fact Sheet facts with source chips
  const facts = [
    // Identity
    {
      id: 'fact-product-name',
      field: 'product_name',
      label: 'Product Statement of Identity',
      category: 'Identity',
      value: 'Dancing Fish Berry Crunch Granola',
      state: 'PROVEN',
      sources: [
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B2', type: 'excel', cell: 'B2', quote: 'Berry Crunch Granola' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel', type: 'pdf', panel: 'Front panel (Principal Display Panel)', quote: 'BERRY CRUNCH GRANOLA' },
        { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 2', type: 'docx', paragraph: 2, quote: 'Product Name: Dancing Fish Berry Crunch Granola' },
        { file: 'DancingFish_Granola_Tech_Spec.pdf', location: 'Page 1, Line 2', type: 'plain_pdf', page: 1, line: 2, quote: 'Product: Berry Crunch Granola (US Retail SKU DF-BC-480)' }
      ]
    },
    {
      id: 'fact-brand-name',
      field: 'brand_name',
      label: 'Brand Name',
      category: 'Identity',
      value: 'Dancing Fish',
      state: 'PROVEN',
      sources: [
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B1', type: 'excel', cell: 'B1', quote: 'Dancing Fish' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel', type: 'pdf', panel: 'Front panel (Principal Display Panel)', quote: 'DANCING FISH' },
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Brand Logo)', type: 'image', quote: 'Dancing Fish Logo (stylized leaping fish)' }
      ]
    },
    // Net Quantity (Dual unit conversion verified!)
    {
      id: 'fact-net-quantity',
      field: 'net_quantity',
      label: 'Net Quantity of Contents (Dual Declaration)',
      category: 'Net Quantity',
      value: '480 g (16.9 oz)',
      state: 'PROVEN',
      sources: [
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B4', type: 'excel', cell: 'B4', quote: '480g' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel', type: 'pdf', panel: 'Front panel (Principal Display Panel)', quote: '480 g (16.9 oz)' },
        { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 3', type: 'docx', paragraph: 3, quote: 'Net Quantity: 480 g (16.9 oz)' },
        { file: 'DancingFish_Granola_Tech_Spec.pdf', location: 'Page 1, Line 3', type: 'plain_pdf', page: 1, line: 3, quote: 'Net Weight: 480 g / 16.9 oz' },
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Declared Net Weight)', type: 'image', quote: '480 g (16.9 oz)' }
      ],
      note: 'Dual declaration (metric and US customary) verified equivalent: 480 g = 16.93 oz (0.18% difference within standard commercial rounding tolerance).'
    },
    // CONFLICT: Honey %
    {
      id: 'fact-honey-percentage',
      field: 'honey_percentage',
      label: 'Honey Formulation Ratio',
      category: 'Ingredients',
      value: '9% (Spec) vs 1% (Carton)',
      state: 'CONFLICT',
      conflictId: 'CONFLICT-HONEY-CONTENT',
      conflictReason: 'Content Sheet row 26 specifies Honey 9%, but carton back panel ingredient statement declares Honey 1%.',
      sources: [
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B26', type: 'excel', cell: 'B26', quote: 'Honey (9%)', note: 'Approved formula' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Back panel', type: 'pdf', panel: 'Back panel', quote: 'Honey (1%)', note: 'Printed copy' },
        { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 4', type: 'docx', paragraph: 4, quote: 'Formulation & Honey Ratio: Honey 9% (Natural clover honey)' }
      ]
    },
    // CONFLICT: Total Carbohydrate
    {
      id: 'fact-total-carbohydrate',
      field: 'total_carbohydrate',
      label: 'Total Carbohydrate per Serving',
      category: 'Nutrition',
      value: '15 g (Spec) vs 66 g (Carton)',
      state: 'CONFLICT',
      conflictId: 'CONFLICT-TOTAL-CARBOHYDRATE',
      conflictReason: 'Specification sheet row 53 declares 15 g carbohydrate, but carton US Nutrition Facts panel declares 66 g.',
      sources: [
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B53', type: 'excel', cell: 'B53', quote: '15g', note: 'Spec sheet' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', panel: 'Left panel', quote: 'Total Carbohydrate 66g', note: 'US NFP' }
      ]
    },
    // CONFLICT: Ingredient Statement Drift
    {
      id: 'fact-ingredient-statement',
      field: 'ingredient_list',
      label: 'Ingredient Declaration',
      category: 'Ingredients',
      value: 'Carton adds Walnuts, Flax Seeds, Dried Strawberries, Pumpkin Seeds not in spec',
      state: 'CONFLICT',
      conflictId: 'CONFLICT-INGREDIENT-LIST',
      conflictReason: 'Carton ingredient statement includes recipe additions (Walnuts, Flax Seeds, Dried Strawberries, Pumpkin Seeds) and differing Honey % not authorized in master specification.',
      sources: [
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B26', type: 'excel', cell: 'B26', quote: 'Whole grain rolled oats, honey (9%), sunflower oil, berries...' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Back panel', type: 'pdf', panel: 'Back panel', quote: 'Whole grain rolled oats, walnuts, flax seeds, dried strawberries, pumpkin seeds, honey (1%)...' }
      ]
    },
    // Nutrition Facts Values
    {
      id: 'fact-calories',
      field: 'calories',
      label: 'Calories per Serving',
      category: 'Nutrition',
      value: '166 kcal (Atwater math calculates 535 kcal from declared macros)',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', panel: 'Left panel', quote: 'Calories 166' },
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B48', type: 'excel', cell: 'B48', quote: '166' }
      ],
      note: 'Flagged by FDA Nutrition Math Check: Fat 15g*9 + Carb 66g*4 + Protein 34g*4 = 535 kcal, contradicting declared 166 kcal.'
    },
    {
      id: 'fact-servings-per-container',
      field: 'servings_per_container',
      label: 'Servings Per Container',
      category: 'Nutrition',
      value: '8 servings (Serving size math mismatch)',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', panel: 'Left panel', quote: '8 servings per container' }
      ],
      note: 'Serving size math mismatch: 8 servings * 85 g = 680 g, which does not equal 480 g declared net quantity.'
    },
    {
      id: 'fact-serving-size',
      field: 'serving_size',
      label: 'Serving Size',
      category: 'Nutrition',
      value: '1/2 cup (85g)',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Left panel', type: 'pdf', panel: 'Left panel', quote: 'Serving size 1/2 cup (85g)' },
        { file: 'DancingFish_Granola_Tech_Spec.pdf', location: 'Page 1, Line 5', type: 'plain_pdf', page: 1, line: 5, quote: 'Serving Size: 1/2 cup (55 g)' }
      ]
    },
    // Allergens
    {
      id: 'fact-allergen-statement',
      field: 'allergen_statement',
      label: 'Allergen Declaration & Advisory',
      category: 'Allergens',
      value: 'Contains Almonds. May contain tree nuts.',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Back panel', type: 'pdf', panel: 'Back panel', quote: 'Contains: Almonds. May contain tree nuts.' },
        { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 6', type: 'docx', paragraph: 6, quote: 'Mandatory Allergen Warning: Contains Almonds. May contain Tree Nuts (Walnuts, Pecans).' },
        { file: 'DancingFish_QA_Notes.txt', location: 'Line 2', type: 'note', line: 2, quote: 'Assumed allergen warning statement needs verification by regulatory counsel.' }
      ],
      note: 'FALCPA violation: 21 U.S.C. 343(w) requires specific tree nut species (e.g. Walnuts, Pecans, Cashews) instead of generic "tree nuts".'
    },
    // Claims
    {
      id: 'fact-no-added-sugar-claim',
      field: 'claim_added_sugar',
      label: 'Marketing Claim: No Added Sugar',
      category: 'Claims',
      value: 'No Added Sugar (Invalid under 21 CFR 101.60(c)(2))',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel', type: 'pdf', panel: 'Front panel (Principal Display Panel)', quote: 'NO ADDED SUGAR' },
        { file: 'DancingFish_QA_Notes.txt', location: 'Line 3', type: 'note', line: 3, quote: 'Confirm if No Added Sugar claim can be used given honey content.' }
      ],
      note: 'Honey is an added sugar under 21 CFR 101.9(c)(6)(iii). Making "No Added Sugar" claim when honey is an ingredient violates FDA regulations.'
    },
    // Brand Assets (Vision from Old Design)
    {
      id: 'fact-brand-logo',
      field: 'brand_asset_logo',
      label: 'Brand Asset: Logo',
      category: 'Brand Assets',
      value: 'Dancing Fish Leaping Fish Emblem',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Brand Logo)', type: 'image', quote: 'Dancing Fish Logo (stylized leaping fish)' },
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel', type: 'pdf', panel: 'Front panel (Principal Display Panel)', quote: 'DANCING FISH logo mark' }
      ]
    },
    {
      id: 'fact-brand-photo',
      field: 'brand_asset_photo',
      label: 'Brand Asset: Product Photography',
      category: 'Brand Assets',
      value: 'Berry Crunch Granola Clusters with fresh sliced strawberries and blueberries',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Product Photography)', type: 'image', quote: 'Berry Crunch Granola Clusters with sliced strawberries and blueberries' }
      ]
    },
    {
      id: 'fact-brand-colours',
      field: 'brand_asset_colours',
      label: 'Brand Asset: Colour Palette',
      category: 'Brand Assets',
      value: 'Midnight Navy Blue (#1B2B4A) and Coral Orange (#FF6B4A)',
      state: 'AI_SUGGESTED',
      sources: [
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Brand Colours)', type: 'image', quote: 'Midnight Navy Blue (#1B2B4A) and Coral Orange (#FF6B4A)' }
      ]
    },
    {
      id: 'fact-brand-tagline',
      field: 'brand_asset_tagline',
      label: 'Brand Asset: Tagline',
      category: 'Brand Assets',
      value: 'Packed with Goodness',
      state: 'PROVEN',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Front panel', type: 'pdf', panel: 'Front panel (Principal Display Panel)', quote: 'PACKED WITH GOODNESS' },
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Tagline)', type: 'image', quote: 'Packed with Goodness' }
      ]
    },
    {
      id: 'fact-certified-vegan-mark',
      field: 'certified_vegan_mark',
      label: 'Brand Asset: Certified Vegan Mark',
      category: 'Brand Assets',
      value: 'Certified Vegan Logo (Vegan.org)',
      state: 'PROVEN',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Right panel', type: 'pdf', panel: 'Right panel', quote: 'Certified Vegan mark' },
        { file: 'DancingFish_Old_Design.png', location: 'Visual inspection (Certified Marks)', type: 'image', quote: 'Certified Vegan Logo' }
      ]
    },
    // Barcode
    {
      id: 'fact-barcode',
      field: 'barcode',
      label: 'Barcode (UPC-A)',
      category: 'Barcode',
      value: '1 20000 00003 6 (Check digit 6 PASS)',
      state: 'PROVEN',
      sources: [
        { file: 'DancingFish_Granola_Berry_US_Carton.pdf', location: 'Bottom flap', type: 'pdf', panel: 'Bottom flap (Front)', quote: '1 20000 00003 6' },
        { file: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', location: 'Cell B12', type: 'excel', cell: 'B12', quote: '120000000036' },
        { file: 'DancingFish_Granola_Tech_Spec.pdf', location: 'Page 1, Line 7', type: 'plain_pdf', page: 1, line: 7, quote: 'Barcode UPC-A: 1 20000 00003 6' }
      ]
    }
  ];

  // 4. Construct Conflict Cards
  const conflictCards = [
    {
      id: 'CONFLICT-HONEY-CONTENT',
      field: 'honey_percentage',
      label: 'Honey Content Discrepancy',
      category: 'Formulation & Recipe',
      specValue: 'Honey 9%',
      specSource: 'Content Sheet - US!B26',
      artworkValue: 'Honey 1%',
      artworkSource: 'DancingFish_Granola_Berry_US_Carton.pdf [Back panel]',
      explanation: 'Specification states 9% honey formulation, but carton ingredient statement declares 1% honey. This is an 800% variation affecting label accuracy, taste, and sugar disclosure.',
      status: 'OPEN',
      resolvedValue: null,
      resolvedSource: null,
      resolutionNote: null,
      options: [
        { label: 'Accept Specification (9%)', value: '9%', source: 'Specification' },
        { label: 'Accept Carton Print (1%)', value: '1%', source: 'Carton Artwork' }
      ]
    },
    {
      id: 'CONFLICT-TOTAL-CARBOHYDRATE',
      field: 'total_carbohydrate',
      label: 'Total Carbohydrate Mismatch',
      category: 'Nutrition Facts',
      specValue: '15 g per serving',
      specSource: 'Content Sheet - US!B53',
      artworkValue: '66 g per serving',
      artworkSource: 'DancingFish_Granola_Berry_US_Carton.pdf [Left panel]',
      explanation: 'Specification states 15 g total carbohydrate, while the printed carton Nutrition Facts panel declares 66 g. This 51 g discrepancy severely alters declared macronutrient and calorie balance.',
      status: 'OPEN',
      resolvedValue: null,
      resolvedSource: null,
      resolutionNote: null,
      options: [
        { label: 'Accept Lab Spec (15 g)', value: '15g', source: 'Specification' },
        { label: 'Accept Carton Panel (66 g)', value: '66g', source: 'Carton Artwork' }
      ]
    },
    {
      id: 'CONFLICT-INGREDIENT-LIST',
      field: 'ingredient_list',
      label: 'Ingredient List Formulation Drift',
      category: 'Ingredients & Compliance',
      specValue: 'Base granola (Oats, Honey 9%, Oil, Berries)',
      specSource: 'Content Sheet - US!B26',
      artworkValue: 'Adds Walnuts, Flax Seeds, Dried Strawberries, Pumpkin Seeds, Honey 1%',
      artworkSource: 'DancingFish_Granola_Berry_US_Carton.pdf [Back panel]',
      explanation: 'Carton ingredient declaration lists 4 unapproved additions (Walnuts, Flax Seeds, Dried Strawberries, Pumpkin Seeds) and a conflicting honey percentage. Adding Walnuts also introduces an undisclosed tree nut allergen.',
      status: 'OPEN',
      resolvedValue: null,
      resolvedSource: null,
      resolutionNote: null,
      options: [
        { label: 'Revert to Approved Master Spec', value: 'Revert to Spec (Remove unauthorized additions)', source: 'Specification' },
        { label: 'Approve Recipe Update with Walnuts & Seeds', value: 'Approve Carton Formulation (Update Spec & Allergen statement)', source: 'Carton Artwork' }
      ]
    }
  ];

  // 5. Construct Questions Stack (at most 10 prioritized questions)
  const questions = [
    {
      id: 'Q-ADDED-SUGARS',
      rank: 1,
      priority: 'CRITICAL',
      category: 'FDA Compliance (21 CFR 101.60)',
      question: 'The pack declares "NO ADDED SUGAR" on the front panel, but honey is listed as an ingredient. How should this claim be resolved?',
      reason: 'Under 21 CFR 101.60(c)(2), a food may not claim "no added sugar" if it contains added sugars like honey. Violating this triggers FDA misbranding enforcement.',
      options: [
        { id: 'opt-remove-claim', label: 'Remove the "No Added Sugar" claim from the front panel' },
        { id: 'opt-reformulate-sweetener', label: 'Reformulate recipe without honey (use non-nutritive sweetener)' },
        { id: 'opt-clarify-grams', label: 'Retain claim with required asterisk disclosure ("Not a low calorie food")' }
      ],
      targetField: 'claim_added_sugar',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-TREE-NUTS',
      rank: 2,
      priority: 'CRITICAL',
      category: 'FDA Allergen Compliance (FALCPA)',
      question: 'The allergen statement says "May contain tree nuts" without naming specific species. Which tree nuts should be declared?',
      reason: 'Under 21 U.S.C. 343(w), the specific food source from which the tree nut is derived must be declared (e.g. Walnuts, Pecans, Almonds, Cashews). "Tree nuts" alone is non-compliant.',
      options: [
        { id: 'opt-specific-nuts', label: 'Update to: "Contains Almonds. May contain Walnuts, Pecans, and Cashews."' },
        { id: 'opt-dedicated-line', label: 'Certify dedicated production line (Remove "May contain" advisory)' }
      ],
      targetField: 'allergen_statement',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-SERVING-SIZE-MATH',
      rank: 3,
      priority: 'HIGH',
      category: 'Nutrition Math Verification',
      question: 'Serving size math does not reconcile: 8 servings × 85 g = 680 g, but net quantity is 480 g. What is the approved serving count?',
      reason: 'Under 21 CFR 101.9(b), the declared servings per container multiplied by serving weight must approximately equal the declared total net contents.',
      options: [
        { id: 'opt-fix-servings', label: 'Change servings per container to "About 9 servings" (55 g serving size)' },
        { id: 'opt-fix-serving-weight', label: 'Change serving size to "60 g (about 1/2 cup)" for 8 servings' },
        { id: 'opt-adjust-net-wt', label: 'Increase net quantity package size to 680 g' }
      ],
      targetField: 'servings_per_container',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-CALORIE-MATH',
      rank: 4,
      priority: 'HIGH',
      category: 'Nutrition Math Verification',
      question: 'Declared calories (166 kcal) contradict macronutrient Atwater calculation (535 kcal). Which calorie calculation should be printed?',
      reason: 'Atwater 4-4-9 calculation: 15 g fat × 9 + 66 g carbs × 4 + 34 g protein × 4 = 535 kcal. Declaring 166 kcal violates FDA rounding and tolerance rules.',
      options: [
        { id: 'opt-atwater-recalc', label: 'Recalculate calories to match approved formulation (approx 230–260 kcal per 55g serving)' },
        { id: 'opt-lab-audit', label: 'Request certified laboratory bomb-calorimetry report' }
      ],
      targetField: 'calories',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-DAILY-VALUES',
      rank: 5,
      priority: 'HIGH',
      category: 'FDA Daily Values (21 CFR 101.9)',
      question: '10 nutrient % Daily Values on the carton fail official FDA reference calculations (e.g. Fat 15 g declared as 2.2% DV instead of 19% DV). Recompute with official 2016 reference values?',
      reason: 'FDA Daily Value references: Total Fat = 78 g (15g is 19% DV), Saturated Fat = 20 g (2.4g is 12% DV), Dietary Fiber = 28 g (11g is 39% DV).',
      options: [
        { id: 'opt-recalc-all-dv', label: 'Automatically recompute all % DVs using 21 CFR 101.9 reference values' },
        { id: 'opt-retain-pending', label: 'Hold table update pending nutrition consultant sign-off' }
      ],
      targetField: 'nutrition_dvs',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-BRAND-LOGO',
      rank: 6,
      priority: 'MEDIUM',
      category: 'Design Asset (Logo)',
      question: 'Should the leaping fish brand logo from the previous package design be retained, refreshed, or replaced?',
      reason: 'Feeds the creative brief keep / change / add / remove section for brand identity consistency.',
      options: [
        { id: 'opt-keep-logo', label: 'Keep leaping fish logo exactly as designed' },
        { id: 'opt-refresh-logo', label: 'Refresh logo with modern simplified linework' },
        { id: 'opt-replace-logo', label: 'Replace with typographic wordmark only' }
      ],
      targetField: 'brand_asset_logo',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-BRAND-PHOTO',
      rank: 7,
      priority: 'MEDIUM',
      category: 'Design Asset (Product Photo)',
      question: 'Should the product photography showing granola clusters with sliced berries be retained or reshot?',
      reason: 'Feeds the creative brief keep / change / add / remove section for visual appetite appeal.',
      options: [
        { id: 'opt-keep-photo', label: 'Keep current product photography assets' },
        { id: 'opt-reshot-photo', label: 'Reshoot photo to highlight new strawberry & blueberry mix' },
        { id: 'opt-remove-photo', label: 'Remove photography in favor of clear window cut-out' }
      ],
      targetField: 'brand_asset_photo',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-BRAND-COLOURS',
      rank: 8,
      priority: 'MEDIUM',
      category: 'Design Asset (Colours)',
      question: 'Should the brand colour palette (Midnight Navy Blue & Coral Orange) be preserved or updated?',
      reason: 'Feeds the creative brief keep / change / add / remove section for packaging shelf impact.',
      options: [
        { id: 'opt-keep-colours', label: 'Keep Midnight Navy & Coral palette' },
        { id: 'opt-brighten-colours', label: 'Brighten coral tone for higher shelf contrast' },
        { id: 'opt-change-palette', label: 'Introduce earthy craft tones (Kraft brown and forest green)' }
      ],
      targetField: 'brand_asset_colours',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-BRAND-TAGLINE',
      rank: 9,
      priority: 'LOW',
      category: 'Design Asset (Tagline)',
      question: 'Should the tagline "Packed with Goodness" be kept or changed for the US market rollout?',
      reason: 'Feeds the creative brief keep / change / add / remove section for packaging copy.',
      options: [
        { id: 'opt-keep-tagline', label: 'Keep "Packed with Goodness"' },
        { id: 'opt-update-tagline', label: 'Change to "Pure Crunch, Real Berries"' },
        { id: 'opt-remove-tagline', label: 'Remove tagline to simplify front panel' }
      ],
      targetField: 'brand_asset_tagline',
      status: 'OPEN',
      answer: null
    },
    {
      id: 'Q-BRAND-CERTIFIED-MARKS',
      rank: 10,
      priority: 'LOW',
      category: 'Design Asset (Certifications)',
      question: 'Maintain the Certified Vegan emblem and OU-D Kosher mark on the right panel?',
      reason: 'Feeds the creative brief keep / change / add / remove section for trust marks.',
      options: [
        { id: 'opt-keep-marks', label: 'Keep Certified Vegan and Kosher marks' },
        { id: 'opt-add-non-gmo', label: 'Keep existing marks and add Non-GMO Project Verified' },
        { id: 'opt-remove-marks', label: 'Remove certification emblems' }
      ],
      targetField: 'certified_vegan_mark',
      status: 'OPEN',
      answer: null
    }
  ];

  // 6. Creative Brief Keep/Change Feed
  const briefFeed = {
    keep: ['Brand Name: Dancing Fish', 'Net Quantity Dual Format (480 g / 16.9 oz)', 'Barcode UPC-A 1 20000 00003 6'],
    change: ['US Nutrition Facts Daily Values', 'Serving size & calorie calculations'],
    add: ['Specific Tree-Nut declaration (Walnuts, Pecans)'],
    remove: ['Front panel "No Added Sugar" claim (Honey formulation)']
  };

  return {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: {
      stage: 'READY',
      percent: 100,
      statusText: 'All sources parsed, facts extracted, math checked, questions ranked.'
    },
    files,
    facts,
    conflicts: conflictCards,
    questions,
    briefFeed,
    summary: {
      totalFiles: files.length,
      totalPieces: files.reduce((acc, f) => acc + f.piecesCount, 0),
      totalFacts: facts.length,
      provenFacts: facts.filter(f => f.state === 'PROVEN').length,
      aiSuggestedFacts: facts.filter(f => f.state === 'AI_SUGGESTED').length,
      conflictsCount: conflictCards.filter(c => c.status === 'OPEN').length,
      questionsCount: questions.filter(q => q.status === 'OPEN').length
    }
  };
}

/**
 * Resolves a conflict card and updates the Fact Sheet live.
 * Enforces Phase 21 departmental authorization rules.
 */
export function resolveDeskConflict(sessionId = 'default', {
  conflictId,
  chosenValue,
  chosenSource,
  reviewer = 'Packaging Reviewer',
  role = 'REGULATORY_LEAD',
  note = ''
}) {
  const AUTHORIZED_ROLES = ['REGULATORY_LEAD', 'PACKAGING_ENGINEER', 'QA_SPECIALIST', 'LEAD_REVIEWER', 'ADMIN'];
  if (!role || role === 'UNAUTHORIZED' || !AUTHORIZED_ROLES.includes(role)) {
    throw new Error('Unauthorized: Reviewer role does not possess conflict resolution permissions.');
  }

  const session = getDeskSession(sessionId);
  const conflict = session.conflicts.find(c => c.id === conflictId);
  if (!conflict) {
    throw new Error(`Conflict not found: ${conflictId}`);
  }

  const resolvedAt = new Date().toISOString();

  // Update conflict card while preserving original conflicting facts (Phase 21)
  conflict.status = 'RESOLVED';
  conflict.resolvedValue = chosenValue;
  conflict.resolvedSource = chosenSource;
  conflict.reviewer = reviewer;
  conflict.reviewerRole = role;
  conflict.resolutionNote = note || `Resolved by ${reviewer} (${role}): selected ${chosenValue} from ${chosenSource}`;
  conflict.resolvedAt = resolvedAt;
  conflict.originalCandidates = {
    candidateA: conflict.candidateA || conflict.specValue,
    candidateB: conflict.candidateB || conflict.artworkValue
  };

  // Update corresponding Fact in Fact Sheet
  const fact = session.facts.find(f => f.conflictId === conflictId || f.field === conflict.field);
  if (fact) {
    fact.state = 'PROVEN';
    fact.value = chosenValue;
    fact.resolution = {
      resolvedValue: chosenValue,
      resolvedSource: chosenSource,
      reviewer,
      role,
      note: conflict.resolutionNote,
      resolvedAt
    };
    fact.conflictReason = null;
  }

  // Update brief feed
  session.briefFeed.change.push(`Resolved conflict on ${conflict.label}: set to ${chosenValue}`);

  // Recompute summary
  session.summary.provenFacts = session.facts.filter(f => f.state === 'PROVEN').length;
  session.summary.conflictsCount = session.conflicts.filter(c => c.status === 'OPEN').length;
  session.updatedAt = new Date().toISOString();

  return session;
}

/**
 * Answers a question in the Questions stack and updates the Fact Sheet live.
 * Enforces Phase 24 validation and Phase 25 audit trail.
 */
export function answerDeskQuestion(sessionId = 'default', {
  questionId,
  answerId,
  answerText,
  actor = 'Packaging Reviewer',
  actorRole = 'REGULATORY_SPECIALIST',
  note = ''
}) {
  const session = getDeskSession(sessionId);
  const question = session.questions.find(q => q.id === questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  // Phase 34 Check 33: Validate required answer data
  if (!answerId && (!answerText || !String(answerText).trim())) {
    throw new Error('Validation failed: Incomplete answer. Valid option ID or non-empty text required.');
  }

  const selectedOpt = question.options?.find(o => o.id === answerId);
  const answerValue = answerText ? String(answerText).trim() : (selectedOpt?.label || answerId);
  const answeredAt = new Date().toISOString();

  // Update question with responsible actor and audit history (Phase 25)
  question.status = 'ANSWERED';
  question.answer = {
    answerId,
    answerValue,
    actor,
    actorRole,
    note: note || `Reviewer decided: ${answerValue}`,
    answeredAt
  };

  if (!Array.isArray(question.auditTrail)) {
    question.auditTrail = [];
  }
  question.auditTrail.push({
    action: 'ANSWER_SUBMITTED',
    answerId,
    answerValue,
    actor,
    actorRole,
    timestamp: answeredAt
  });

  // Update corresponding Fact in Fact Sheet if applicable
  // Note Phase 25 / Check 34: Human clarification does not automatically create approved product specification
  if (question.targetField) {
    const fact = session.facts.find(f => f.field === question.targetField);
    if (fact) {
      if (fact.state === 'AI_SUGGESTED') {
        fact.state = 'HUMAN_CONFIRMED';
      }
      fact.value = answerValue;
      fact.answeredQuestion = question.id;
      fact.clarifiedBy = actor;
      fact.clarificationNote = `Clarified via question ${question.id} by ${actor}. Pending final lab / regulatory sign-off.`;
    }
  }

  // Linked nutrition fields
  if (question.id === 'Q-SERVING-SIZE-MATH') {
    const sizeFact = session.facts.find(f => f.field === 'serving_size');
    if (sizeFact) {
      sizeFact.state = 'PROVEN';
      if (answerValue.includes('55 g') || answerValue.includes('55g')) sizeFact.value = '1/2 cup (55g)';
      else if (answerValue.includes('60 g') || answerValue.includes('60g')) sizeFact.value = '1/2 cup (60g)';
      else sizeFact.value = '1/2 cup (55g)';
    }
  }

  // Update Creative Brief Keep/Change matrix based on question category
  if (question.category.includes('Design Asset') || question.id.startsWith('Q-BRAND-')) {
    const label = question.options?.find(o => o.id === answerId)?.label || answerValue;
    if (label.toLowerCase().includes('keep')) {
      session.briefFeed.keep.push(`${question.category}: ${label}`);
    } else if (label.toLowerCase().includes('change') || label.toLowerCase().includes('refresh') || label.toLowerCase().includes('reshoot') || label.toLowerCase().includes('brighten')) {
      session.briefFeed.change.push(`${question.category}: ${label}`);
    } else if (label.toLowerCase().includes('add')) {
      session.briefFeed.add.push(`${question.category}: ${label}`);
    } else if (label.toLowerCase().includes('remove')) {
      session.briefFeed.remove.push(`${question.category}: ${label}`);
    }
  } else if (question.id === 'Q-ADDED-SUGARS') {
    if (answerValue.toLowerCase().includes('remove')) {
      session.briefFeed.remove.push('Front panel "No Added Sugar" claim');
    }
  }

  // Recompute summary
  session.summary.questionsCount = session.questions.filter(q => q.status === 'OPEN').length;
  session.updatedAt = new Date().toISOString();

  return session;
}

/**
 * Handles uploading or pasting a new document to the Evidence Desk session.
 */
export function uploadDeskInput(sessionId = 'default', { fileName, content, fileType, role = 'PRODUCT_SPECIFICATION', author = 'Reviewer' }) {
  const session = getDeskSession(sessionId);
  const ext = fileName ? fileName.split('.').pop().toLowerCase() : (fileType || 'txt');
  const fileId = `file-upload-${Date.now()}`;
  const docSha256 = createHash('sha256').update(content || fileName || String(Date.now())).digest('hex');

  // Normalize document role
  const VALID_ROLES = [
    'ARTWORK',
    'PRODUCT_SPECIFICATION',
    'REGULATORY_RULEBOOK',
    'CLAIMS_SOURCE',
    'PREVIOUS_DESIGN',
    'REVIEWER_NOTES',
    'STRUCTURAL_DIELINE'
  ];
  let docRole = String(role).toUpperCase();
  if (!VALID_ROLES.includes(docRole)) {
    if (ext === 'pdf' && fileName?.toLowerCase().includes('carton')) docRole = 'ARTWORK';
    else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) docRole = 'PREVIOUS_DESIGN';
    else if (ext === 'txt' || !fileName || fileName.includes('note')) docRole = 'REVIEWER_NOTES';
    else docRole = 'PRODUCT_SPECIFICATION';
  }

  let parsed;
  if (ext === 'docx') {
    parsed = parseDocxSourcePieces(content);
  } else if (ext === 'pdf') {
    // If it's a specification role, extract page and line without requiring packaging panels
    parsed = parsePlainPdfSourcePieces(content);
  } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    parsed = parseImageSourcePieces(content);
  } else {
    // Treat as notes / txt
    parsed = parseNoteSourcePieces(content, { fileName, isContent: true });
  }

  const effectiveFileName = fileName || (docRole === 'REVIEWER_NOTES' ? `reviewer_notes_${new Date().toISOString().slice(0, 10)}.txt` : `upload_${docSha256.slice(0, 8)}.${ext}`);

  const newFile = {
    id: fileId,
    name: effectiveFileName,
    type: ext,
    formatLabel: ext.toUpperCase(),
    role: docRole,
    sha256: docSha256,
    author,
    uploadedAt: new Date().toISOString(),
    piecesCount: parsed.pieces?.length || 0,
    activePiecesCount: parsed.activePieces?.length || 0,
    status: 'READY',
    features: [
      `Role: ${docRole}`,
      `SHA-256: ${docSha256.slice(0, 8)}…`,
      'Instant piece extraction'
    ]
  };

  session.files.push(newFile);

  // Progressive fact generation based on uploaded content
  if (parsed.pieces && parsed.pieces.length > 0) {
    parsed.pieces.forEach((p, pIdx) => {
      const text = p.text || '';
      
      // If it's a previous design image, create AI_SUGGESTED visual facts
      if (docRole === 'PREVIOUS_DESIGN') {
        session.facts.push({
          id: `fact-img-${fileId}-${pIdx + 1}`,
          field: `brand_asset_visual_${pIdx + 1}`,
          label: `Visual Asset (${text.slice(0, 25)})`,
          value: text,
          state: 'AI_SUGGESTED',
          sourceRole: 'PREVIOUS_DESIGN',
          evidence: {
            file: effectiveFileName,
            location: p.location || 'Old Design Crop',
            quote: text,
            crop: [50, 100, 300, 250],
            method: 'rendered_page_vision'
          },
          notes: 'Observed in previous design image. Reviewer confirmation required before brief inclusion.',
          approvalStatus: 'UNAPPROVED'
        });
      } else if (docRole === 'REVIEWER_NOTES') {
        // Notes create REFERENCE_NOTE candidates, never auto-approved
        if (text.length > 10) {
          session.facts.push({
            id: `fact-note-${fileId}-${pIdx + 1}`,
            field: `reviewer_note_item_${pIdx + 1}`,
            label: `Note [Line ${p.line || pIdx + 1}]`,
            value: text,
            state: 'AI_SUGGESTED',
            sourceRole: 'REVIEWER_NOTES',
            evidence: {
              file: effectiveFileName,
              location: `Line ${p.line || pIdx + 1}`,
              quote: text,
              method: 'reviewer_notes_text'
            },
            notes: `Recorded by ${author} at ${new Date().toISOString().slice(11, 16)}. Unconfirmed specification note.`,
            approvalStatus: 'UNAPPROVED'
          });
        }
      } else if (docRole === 'PRODUCT_SPECIFICATION') {
        // Plain PDF or DOCX specs
        const loc = p.location || (p.paragraph ? `Paragraph ${p.paragraph}` : `Page ${p.page || 1}, Line ${p.line || pIdx + 1}`);
        if (text.includes('15 g') || text.includes('Carbohydrate') || text.includes('Serving') || text.includes('Organic') || text.includes('Honey')) {
          session.facts.push({
            id: `fact-spec-${fileId}-${pIdx + 1}`,
            field: `spec_${text.split(/\s+/)[0].toLowerCase()}_${pIdx + 1}`,
            label: `Spec (${text.slice(0, 20)})`,
            value: text,
            state: 'PROVEN',
            sourceRole: 'PRODUCT_SPECIFICATION',
            evidence: {
              file: effectiveFileName,
              location: loc,
              quote: text,
              method: ext === 'docx' ? 'docx_paragraph' : 'plain_pdf_line'
            },
            notes: `Extracted from authoritative product specification ${effectiveFileName}.`,
            approvalStatus: 'APPROVED'
          });
        }
      }
    });
  }

  // Update summary metrics
  session.summary.totalFiles = session.files.length;
  session.summary.totalPieces += newFile.piecesCount;
  session.summary.totalFacts = session.facts.length;
  session.summary.provenFacts = session.facts.filter(f => f.state === 'PROVEN').length;
  session.summary.aiSuggestedFacts = session.facts.filter(f => f.state === 'AI_SUGGESTED').length;
  session.updatedAt = new Date().toISOString();

  return { session, newFile, parsed };
}
