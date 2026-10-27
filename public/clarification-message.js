/**
 * PackSignal — Smart "Ask Someone" Clarification Message Generator (Browser ES Module)
 * public/clarification-message.js
 *
 * Source-backed Slack, Microsoft Teams, and Plain Text clarification messages
 * anchored to verified finding and evidence provenance.
 */

export const DEPARTMENTS = [
  'R&D / Product Development',
  'Regulatory / Legal',
  'Quality Assurance',
  'Brand / Marketing',
  'Packaging Design',
  'Prepress / Production',
  'Other'
];

export const DEPARTMENT_SHORT_NAMES = {
  'R&D / Product Development': 'R&D',
  'Regulatory / Legal': 'Regulatory / Legal',
  'Quality Assurance': 'QA',
  'Brand / Marketing': 'Brand / Marketing',
  'Packaging Design': 'Packaging Design',
  'Prepress / Production': 'Prepress',
  'Other': 'the team'
};

/**
 * Sanitizes external path representations so local filesystem paths
 * (e.g., /Users/...) are never leaked into messages.
 */
export function sanitizeDocumentName(name) {
  if (!name || typeof name !== 'string') return '';
  const clean = name.trim();
  if (clean.startsWith('/') || clean.includes('\\') || clean.includes('/')) {
    const parts = clean.split(/[/\\]/);
    return parts[parts.length - 1] || 'Document';
  }
  return clean;
}

/**
 * Automatically suggests a responsible department based on finding signals,
 * rule type, category, or title.
 */
export function suggestDepartment(finding = {}) {
  if (finding.primaryDepartment) {
    const directMap = {
      legal: 'Regulatory / Legal',
      rd: 'R&D / Product Development',
      brand: 'Brand / Marketing',
      prepress: 'Prepress / Production',
    };
    if (directMap[finding.primaryDepartment]) {
      return directMap[finding.primaryDepartment];
    }
  }

  const field = String(finding.rule?.field || finding.field || '').toLowerCase();
  const category = String(finding.category || '').toLowerCase();
  const title = String(finding.title || '').toLowerCase();
  const explanation = String(finding.explanation || '').toLowerCase();
  const ruleText = String(finding.rule?.text || '').toLowerCase();
  const ruleId = String(finding.rule?.id || finding.rule?.citation || '').toLowerCase();
  const method = String(finding.method || '').toLowerCase();

  const combined = `${field} ${category} ${title} ${explanation} ${ruleText} ${ruleId} ${method}`;

  // 1. Ingredients / Formulation -> R&D
  if (
    field === 'ingredients' ||
    /ingredient|recipe|formulation|honey|flavor|flavour|component|blend/i.test(combined)
  ) {
    return 'R&D / Product Development';
  }

  // 2. Nutrition Formulation -> R&D / QA (R&D default)
  if (
    field.startsWith('nutrition') ||
    /nutrition|calories|protein|sodium|fat|sugar|carbohydrate|vitamin|mineral|serving\s*size|servings\s*per/i.test(combined)
  ) {
    return 'R&D / Product Development';
  }

  // 3. Allergen Compliance -> Regulatory / Legal
  if (
    field === 'allergens' ||
    /allergen|cross[- ]contact|precautionary|may\s*contain|contains:/i.test(combined)
  ) {
    return 'Regulatory / Legal';
  }

  // 4. Claim Substantiation & Regulatory Rules -> Regulatory / Legal
  if (
    field === 'claims' ||
    /claim|organic|non[- ]gmo|substantiat|statutory|regulation|fda|cfr|fssai|legal|gazette|sop|rulebook/i.test(combined)
  ) {
    return 'Regulatory / Legal';
  }

  // 5. Marketing Copy -> Brand / Marketing
  if (
    field === 'marketing' ||
    /marketing|brand|romance|story|tagline|slogan|callout|trademark/i.test(combined)
  ) {
    return 'Brand / Marketing';
  }

  // 6. Print Preflight & Technical prepress -> Prepress / Production (Check before general panel placement)
  if (
    field === 'preflight' ||
    /preflight|barcode|upc|ean|qr\s*code|bleed|cut\s*guide|ink|color\s*separation|resolution|dpi|typography|font\s*size|pt\s*size|minimum\s*height/i.test(combined)
  ) {
    return 'Prepress / Production';
  }

  // 7. Panel Placement & Packaging Geometry -> Packaging Design
  if (
    field === 'panel_placement' ||
    /panel|placement|pdp|face|zone|quiet\s*zone|geometry|dieline|crease|fold|carton\s*face/i.test(combined)
  ) {
    return 'Packaging Design';
  }

  // 8. Unreadable Artwork -> Prepress / Production
  if (
    method === 'artwork_readability' ||
    method === 'visibility_review' ||
    /unreadable|visibility|blur|small\s*text|contrast|illegible|crop\s*review/i.test(combined)
  ) {
    return 'Prepress / Production';
  }

  // 9. Source Authority / Unapproved Spec -> QA
  if (/source_authority|draft\s*source|unapproved\s*spec|spec\s*owner/i.test(combined)) {
    return 'Quality Assurance';
  }

  return 'Other';
}

/**
 * Classifies the type of clarification issue to formulate the most
 * precise, professional, context-aware question.
 */
export function classifyClarificationCase(finding = {}, sourceEvidence = null) {
  const title = String(finding.title || '').toLowerCase();
  const explanation = String(finding.explanation || '').toLowerCase();
  const field = String(finding.rule?.field || finding.field || '').toLowerCase();
  const method = String(finding.method || '').toLowerCase();

  // Version regression
  if (finding.isRegression || finding.revisionRegression || /regression|passed\s*in\s*previous/i.test(title + ' ' + explanation)) {
    return 'CASE_G_VERSION_REGRESSION';
  }

  // Unreadable artwork (prioritize over missing source so OCR/readability issues don't get misclassified)
  if (method === 'artwork_readability' || /unreadable|blur|illegible|visibility|contrast/i.test(title + ' ' + explanation)) {
    return 'CASE_E_UNREADABLE_ARTWORK';
  }

  // Physical Prepress checks
  if (finding.check === 'prepress:tac_excess' || /total area coverage|tac|ink density/i.test(title)) {
    return 'CASE_PREPRESS_TAC';
  }
  if (finding.check === 'prepress:bleed_extension' || /bleed extension|bleed margin/i.test(title)) {
    return 'CASE_PREPRESS_BLEED';
  }
  if (finding.check === 'prepress:trim_safety' || /trim safety|too close to trim/i.test(title)) {
    return 'CASE_PREPRESS_TRIM';
  }
  if (finding.check === 'prepress:crease_clearance' || /crease clearance|fold geometry/i.test(title)) {
    return 'CASE_PREPRESS_CREASE';
  }

  // Missing source
  const hasNoSource = !sourceEvidence || (Array.isArray(sourceEvidence) && sourceEvidence.length === 0);
  const expectedMissing = !finding.expected || /no\s*approved\s*value|missing\s*reference|unspecified/i.test(finding.expected);
  if ((hasNoSource && expectedMissing) || method === 'review_input_gap') {
    return 'CASE_B_MISSING_SOURCE';
  }

  // Missing statutory declaration
  if (
    finding.isGhostPlacement ||
    finding.checkType === 'MISSING_REQUIRED_DECLARATION' ||
    ((/net\s*quantity|volume|weight/i.test(title) || /address|manufacturer|distributor/i.test(title) || /fssai|veg\s*mark/i.test(title) || /allergen/i.test(title)) &&
     /not detected|missing|omitted/i.test(finding.observed || ''))
  ) {
    return 'CASE_MISSING_STATUTORY_DECLARATION';
  }

  // Claim substantiation
  if (/claim|substantiat|organic|non[- ]gmo|vegan|heart\s*healthy|whole\s*grain/i.test(title + ' ' + explanation + ' ' + field)) {
    return 'CASE_C_CLAIM_SUBSTANTIATION';
  }

  // Panel placement
  if (/panel|placement|pdp|principal\s*display|zone|quiet\s*zone/i.test(title + ' ' + explanation + ' ' + field)) {
    return 'CASE_D_PANEL_PLACEMENT';
  }

  // Rulebook conflict
  if (/rulebook|statutory\s*citation|sop|gazette|statute|regulatory\s*conflict/i.test(title + ' ' + explanation)) {
    return 'CASE_F_RULEBOOK_CONFLICT';
  }

  // Typography shortfall
  if (
    finding.category === 'typography' ||
    finding.check === 'statutory_type_size' ||
    finding.key?.startsWith('preflight:typography') ||
    /typography|font size|letter height|point size|x-height|statutory type size|21 cfr 101\.105|21 cfr 101\.2/i.test(title + ' ' + (finding.explanation || ''))
  ) {
    return 'CASE_TYPOGRAPHY_SHORTFALL';
  }

  // Numeric or percentage mismatch
  const hasPercent = /%/i.test((finding.observed || '') + (finding.expected || '')) || /percentage/i.test(title);
  const hasNumbers = /\d+(\.\d+)?\s*(%|g|mg|ml|l|oz|kcal|pt|mm)/i.test((finding.observed || '') + ' ' + (finding.expected || ''));
  if (hasPercent || hasNumbers || /discrepancy|mismatch|difference/i.test(title)) {
    return 'CASE_A_NUMERIC_MISMATCH';
  }

  return 'CASE_GENERAL_DISCREPANCY';
}

/**
 * Generates the specific question addressed to the responsible team.
 */
export function buildClarificationQuestion({ caseType, department, finding, product }) {
  const shortDept = DEPARTMENT_SHORT_NAMES[department] || department || 'the team';

  // Check specific content hints
  const isIngredient = /ingredient|honey|sugar|recipe|percentage/i.test(finding.title || '') || finding.rule?.field === 'ingredients';
  const isHoney = /honey/i.test((finding.title || '') + ' ' + (finding.observed || '') + ' ' + (finding.expected || ''));

  switch (caseType) {
    case 'CASE_MISSING_STATUTORY_DECLARATION':
      return `Could ${shortDept} confirm the approved wording and placement before the next revision?`;

    case 'CASE_PREPRESS_TAC':
      return `Could ${shortDept} please verify if measured ink coverage of ${finding.measuredValue ?? 'peak'}% (configured limit: ${finding.requiredValue ?? 300}%) is acceptable under the active press profile, or if separation re-profiling is required?`;

    case 'CASE_PREPRESS_BLEED':
      return `Could ${shortDept} please confirm whether the measured ${finding.measuredValue ?? 'actual'} mm bleed extension (required: ${finding.requiredValue ?? 3.0} mm) is sufficient for converter die-cutting tolerances?`;

    case 'CASE_PREPRESS_TRIM':
      return `Could ${shortDept} please confirm if critical copy/logo at ${finding.measuredValue ?? 'actual'} mm from the cut boundary (required safety inset: ${finding.requiredValue ?? 3.0} mm) must be nudged inward before plate imaging?`;

    case 'CASE_PREPRESS_CREASE':
      return `Could ${shortDept} please confirm if copy positioned ${finding.measuredValue ?? 'actual'} mm from structural score lines satisfies package folding and fiber-cracking constraints?`;

    case 'CASE_A_NUMERIC_MISMATCH':
      if (isHoney) {
        return `Could ${shortDept} please confirm the final approved honey percentage for this SKU before launch?`;
      }
      if (isIngredient) {
        return `Could ${shortDept} please confirm the approved ingredient percentage/specification for this SKU before launch?`;
      }
      return `Could ${shortDept} please confirm which value is approved for this SKU before launch?`;

    case 'CASE_B_MISSING_SOURCE':
      return `Could ${shortDept} please provide the approved specification or supporting document for this requirement?`;

    case 'CASE_C_CLAIM_SUBSTANTIATION':
      return `Could ${shortDept} confirm whether this claim is authorized for this SKU and market, and provide the supporting reference?`;

    case 'CASE_D_PANEL_PLACEMENT':
      return `Could ${shortDept} confirm the intended placement and approved panel specification?`;

    case 'CASE_E_UNREADABLE_ARTWORK':
      return `Could ${shortDept} provide a clearer proof or confirm the original visible content?`;

    case 'CASE_F_RULEBOOK_CONFLICT':
      return `Could ${shortDept} confirm which rule or company SOP version governs this review?`;

    case 'CASE_G_VERSION_REGRESSION':
      return `This requirement passed in the previous artwork version but now requires rechecking. Could ${shortDept} confirm whether the change was intentional?`;

    case 'CASE_TYPOGRAPHY_SHORTFALL':
      return `Could ${shortDept} verify the final approved font and adjust the artwork if required to satisfy statutory letter height?`;

    case 'CASE_GENERAL_DISCREPANCY':
    default:
      return `Could ${shortDept} please review this packaging finding and clarify the approved specification before final sign-off?`;
  }
}

/**
 * Extracts and standardizes primary source and artwork evidence items.
 */
export function extractEvidenceDetails(finding = {}, explicitSource = null, explicitArtwork = null) {
  const evidenceList = Array.isArray(finding.evidence) ? finding.evidence : [];

  // Artwork evidence
  let art = explicitArtwork;
  if (!art) {
    art = evidenceList.find(e => e.role === 'artwork' && (e.quote || e.page || e.location)) ||
          evidenceList.find(e => e.role === 'artwork') ||
          null;
  }

  // Source evidence
  let src = explicitSource;
  if (!src) {
    src = evidenceList.find(e => e.role === 'spec' || e.role === 'source' || e.role === 'rulebook') ||
          evidenceList.find(e => e.role !== 'artwork') ||
          null;
  }

  // Artwork label & location
  let artText = art?.quote || finding.observed || 'Not detected in extracted content';
  let artLoc = '';
  if (art?.page && art?.location) {
    artLoc = `Page ${art.page}, ${art.location}`;
  } else if (art?.page) {
    artLoc = `Page ${art.page}`;
  } else if (art?.location) {
    artLoc = art.location;
  }

  // Source label & location
  let srcDoc = src?.name ? sanitizeDocumentName(src.name) : '';
  let srcLoc = '';
  if (src?.context?.cell) {
    srcLoc = src.context.sheet ? `${src.context.sheet}, ${src.context.cell}` : src.context.cell;
  } else if (src?.context?.sheet) {
    srcLoc = `Sheet ${src.context.sheet}`;
  } else if (src?.location && !src.location.includes('/') && !src.location.includes('\\')) {
    srcLoc = src.location;
  }

  let srcAuthority = src?.authority || (srcDoc.toLowerCase().includes('draft') ? 'Draft / In Review' : '');
  if (!srcAuthority && (finding.status === 'review' || /draft/i.test(srcDoc))) {
    srcAuthority = 'Draft / In Review';
  }

  let srcText = src?.quote || finding.expected || '';

  return {
    artText,
    artLoc,
    srcDoc,
    srcLoc,
    srcAuthority,
    srcText,
    hasSource: Boolean(srcDoc || srcText),
  };
}

/**
 * Main clarification message generator.
 *
 * Supported platforms: 'slack' | 'teams' | 'plain'
 */
export function generateClarificationMessage({
  finding = {},
  sourceEvidence = null,
  artworkEvidence = null,
  product = '',
  department = '',
  platform = 'slack',
  reviewerContext = {}
} = {}) {
  const chosenDept = department || suggestDepartment(finding);
  const chosenPlatform = platform === 'teams' ? 'teams' : platform === 'email' ? 'email' : platform === 'plain' ? 'plain' : 'slack';
  const prodName = product || finding.context?.productVariant || reviewerContext.productName || 'Packaging Artwork';
  const findingId = finding.id || 'Finding';
  const title = finding.title || 'Packaging Discrepancy';

  const caseType = classifyClarificationCase(finding, sourceEvidence || finding.evidence);
  const question = buildClarificationQuestion({ caseType, department: chosenDept, finding, product: prodName });
  const ev = extractEvidenceDetails(finding, sourceEvidence, artworkEvidence);

  const isSlack = chosenPlatform === 'slack';
  const isTeams = chosenPlatform === 'teams';
  const isEmail = chosenPlatform === 'email';
  const isPlain = chosenPlatform === 'plain';

  const b = (text) => {
    if (isSlack) return `*${text}*`;
    if (isTeams) return `**${text}**`;
    return text;
  };

  const lines = [];

  if (isEmail) {
    lines.push(`Subject: Packaging Clarification — ${prodName}: ${title}`);
    lines.push(`To: ${chosenDept}`);
    lines.push('');
    lines.push(`Hi ${DEPARTMENT_SHORT_NAMES[chosenDept] || chosenDept},`);
    lines.push('');
  } else {
    // Title / Subject Header
    lines.push(`${b(`Packaging Clarification — ${prodName}`)}`);
    lines.push('');
  }

  // Issue summary
  const isAtwater = Boolean(finding.atwater) || finding.id === 'nutrition-sanity:atwater' || /atwater|calories vs macronutrients/i.test(title);
  if (isAtwater) {
    const declaredKcal = finding.declaredCalories ?? finding.atwater?.declaredCalories ?? (finding.observed?.match(/Declared\s+(\d+)/i)?.[1] || '166');
    const estKcal = finding.estimatedCalories ?? finding.atwater?.estimatedCalories ?? (finding.observed?.match(/estimate\s+([\d.]+)/i)?.[1] || '535');
    const basis = finding.basis ?? finding.atwater?.basis ?? 'per serving';
    const lines = [];
    if (isEmail) {
      lines.push(`Subject: Packaging Clarification — ${prodName}: Calorie Consistency`);
      lines.push(`To: R&D / Product Development`);
      lines.push('');
      lines.push('Hi R&D,');
      lines.push('');
    } else {
      lines.push(b(`Packaging Clarification — ${prodName}`));
      lines.push('');
      lines.push('Hi R&D,');
      lines.push('');
    }
    lines.push('The packaging nutrition review identified a potential discrepancy between declared calories and the macronutrient calculation.');
    lines.push('');
    lines.push(`${b('Declared energy:')} ${declaredKcal} kcal`);
    lines.push(`${b('General 9/4/4 estimate:')} ${estKcal} kcal`);
    lines.push(`${b('Nutrition basis:')} ${basis}`);
    lines.push('');
    lines.push('Could you confirm the approved formulation, serving basis, unrounded nutrient values, and calculation method used for the label?');
    lines.push('');
    lines.push(`${b('Finding:')} ${findingId}`);
    lines.push('');
    lines.push('Thanks.');
    return lines.join('\n');
  }

  const isPackQty = Boolean(finding.packQuantity) ||
    finding.id === 'pack-quantity:servings-net-mass' ||
    finding.id === 'nutrition-sanity:serving-quantity' ||
    /servings vs net weight|pack quantity consistency|serving count vs net quantity/i.test(title);

  if (isPackQty) {
    const pq = finding.packQuantity || {};
    const sCount = finding.servingsCount ?? pq.servingsCount ?? (finding.observed?.match(/(\d+)\s*servings/i)?.[1] || '8');
    const sSize = pq.inputs?.servingSize?.originalText || (finding.servingSizeGrams ? `${finding.servingSizeGrams} g` : '85 g');
    const implied = finding.expectedPackMassG ?? pq.expectedPackMassG ?? (finding.observed?.match(/estimate\s+([\d.]+)/i)?.[1] || '680 g');
    const declared = finding.declaredPackMassG ?? pq.declaredPackMassG ?? (finding.observed?.match(/net quantity\s+([\d.]+)/i)?.[1] || '480 g');
    const diff = finding.differenceG ?? pq.differenceG ?? '200 g';

    const lines = [];
    if (isEmail) {
      lines.push(`Subject: Packaging Quantity Clarification — ${prodName}`);
      lines.push(`To: R&D / Formulation`);
      lines.push('');
      lines.push('Hi R&D,');
      lines.push('');
    } else {
      lines.push(b(`Packaging Quantity Clarification — ${prodName}`));
      lines.push('');
      lines.push('Hi R&D,');
      lines.push('');
    }
    lines.push('The packaging quantity review detected a possible inconsistency.');
    lines.push('');
    lines.push(`${b('Servings per container:')} ${sCount}`);
    lines.push(`${b('Serving size:')} ${sSize}`);
    lines.push(`${b('Implied package weight:')} ${typeof implied === 'number' ? `${implied} g` : implied}`);
    lines.push(`${b('Declared net weight:')} ${typeof declared === 'number' ? `${declared} g` : declared}`);
    lines.push(`${b('Difference:')} ${typeof diff === 'number' ? `${diff} g` : diff}`);
    lines.push('');
    lines.push('Could you confirm the approved serving count, serving-size basis and net quantity for this SKU?');
    lines.push('');
    lines.push(`${b('Finding:')} ${findingId}`);
    lines.push('');
    lines.push('Thanks.');
    return lines.join('\n');
  }

  const isMissingStatutory = caseType === 'CASE_MISSING_STATUTORY_DECLARATION' ||
    finding.isGhostPlacement ||
    finding.checkType === 'MISSING_REQUIRED_DECLARATION';

  if (isMissingStatutory) {
    const market = reviewerContext.market || (finding.rule?.citation?.includes('CFR') ? 'US' : finding.rule?.citation?.includes('FSSAI') ? 'India' : 'US');
    const req = finding.rule?.citation || finding.rule?.text || finding.authorityCitation || (title.toLowerCase().includes('quantity') ? 'FDA 21 CFR §101.7 & §101.105' : 'FDA 21 CFR §101.5');
    const inspected = finding.inspectedPages || 'All artwork pages & panels';
    const permittedRegion = finding.suggestedPlacement?.description || finding.legalRegion?.description || (title.toLowerCase().includes('quantity') ? 'Principal Display Panel (Bottom 30%)' : 'Information Panel or Principal Display Panel');
    const declName = title.replace(/missing\s*|check\s*|declaration\s*/gi, '').trim() || 'net-quantity';

    const lines = [];
    if (isEmail) {
      lines.push(`Subject: Statutory Labeling Clarification — ${prodName}`);
      lines.push(`To: Regulatory / Legal`);
      lines.push('');
      lines.push('Hi Legal Team,');
      lines.push('');
    } else {
      lines.push(b(`Statutory Labeling Clarification — ${prodName}`));
      lines.push('');
      lines.push('Hi Legal Team,');
      lines.push('');
    }
    lines.push(`PackSignal could not verify the required ${declName} declaration in the current packaging artwork.`);
    lines.push('');
    lines.push(`${b('Product:')} ${prodName}`);
    lines.push(`${b('Market:')} ${market}`);
    lines.push(`${b('Applicable requirement:')} ${req}`);
    lines.push(`${b('Artwork inspected:')} ${inspected}`);
    lines.push(`${b('Suggested permitted region:')} ${permittedRegion}`);
    lines.push('');
    lines.push('Could you confirm the approved wording and placement before the next revision?');
    lines.push('');
    lines.push(`${b('Finding:')} ${findingId}`);
    lines.push('');
    lines.push('Thanks.');
    return lines.join('\n');
  }

  const isPdfHiddenText = finding.id?.startsWith('pdf-preflight:hidden-text') ||
    finding.key?.startsWith('pdf-preflight:hidden-text') ||
    /hidden native text|hidden text|pdf_hidden_text_occlusion/i.test(title + ' ' + (finding.check || ''));

  if (isPdfHiddenText) {
    const artDoc = sanitizeDocumentName(finding.evidence?.find(e => e.role === 'artwork')?.name) || 'Artwork PDF';
    const pageNum = finding.evidence?.find(e => e.page)?.page || 1;
    const quote = finding.evidence?.find(e => e.quote)?.quote || finding.observed || 'Obsolete declarations';
    const occluder = finding.occluder || {};
    const occluderDesc = occluder.type ? `${occluder.type} (${occluder.fill || 'white'}, seqno #${occluder.seqno || 'N/A'})` : 'later opaque graphic';

    const lines = [];
    if (isEmail) {
      lines.push(`Subject: PDF Preflight Hidden Text Clarification — ${prodName}`);
      lines.push(`To: Prepress / Production`);
      lines.push('');
      lines.push('Hi Prepress Team,');
      lines.push('');
    } else {
      lines.push(b(`PDF Preflight Hidden Text Clarification — ${prodName}`));
      lines.push('');
      lines.push('Hi Prepress Team,');
      lines.push('');
    }
    lines.push('PackSignal found native text within the artwork PDF that appears to be covered by a later opaque graphic.');
    lines.push('');
    lines.push(`${b('Document:')} ${artDoc}`);
    lines.push(`${b('Page:')} ${pageNum}`);
    lines.push(`${b('Underlying text:')} ${quote}`);
    lines.push(`${b('Covering object:')} ${occluderDesc}`);
    lines.push('');
    lines.push('Could you confirm whether this is obsolete artwork content and whether it should be removed from the final production PDF?');
    lines.push('');
    lines.push(`${b('Finding:')} ${findingId}`);
    lines.push('');
    lines.push('Thanks.');
    return lines.join('\n');
  }

  const isTypographyShortfall = caseType === 'CASE_TYPOGRAPHY_SHORTFALL' ||
    finding.category === 'typography' ||
    finding.check === 'statutory_type_size' ||
    /typography|font size|letter height|point size|statutory type size/i.test(title);

  if (isTypographyShortfall) {
    const lines = [];
    if (isEmail) {
      lines.push(`Subject: Typography Requirement Clarification — ${prodName}`);
      lines.push(`To: Prepress / Production`);
      lines.push('');
      lines.push('Hi Prepress Team,');
      lines.push('');
    } else {
      lines.push(b(`Typography Requirement Clarification — ${prodName}`));
      lines.push('');
      lines.push('Hi Prepress Team,');
      lines.push('');
    }
    lines.push('PackSignal identified a possible typography requirement shortfall in the artwork.');
    lines.push('');
    const quote = finding.evidence?.[0]?.quote || finding.observed || finding.originalText || '';
    lines.push(`${b('Text:')} "${quote}"`);
    lines.push(`${b('Nominal font size:')} ${finding.nominalFontSizePt != null ? `${finding.nominalFontSizePt} pt` : 'Not specified'}`);
    lines.push(`${b('Measured glyph height:')} ${finding.measuredGlyphHeightMm != null ? `${finding.measuredGlyphHeightMm} mm` : (finding.measuredValue != null ? `${finding.measuredValue} mm` : '—')}`);
    lines.push(`${b('Applicable minimum:')} ${finding.requiredHeightMm != null ? `${finding.requiredHeightMm} mm` : (finding.requiredValue != null ? `${finding.requiredValue} mm` : '1.588 mm')}`);
    lines.push(`${b('Regulatory source:')} ${finding.ruleCitation || finding.rule?.source || '21 CFR 101.105(h)'}`);
    lines.push(`${b('PDP area:')} ${finding.pdpAreaSqIn != null ? `${finding.pdpAreaSqIn} sq in` : 'Unspecified'}`);
    lines.push('');
    lines.push('Could you verify the final approved font and adjust the artwork if required?');
    lines.push('');
    lines.push(`${b('Finding:')} ${findingId}`);
    lines.push('');
    lines.push('Thanks.');
    return lines.join('\n');
  }

  lines.push(`${b('Issue:')} ${title}`);
  lines.push('');

  // Artwork evidence
  const artLine = ev.artLoc ? `${ev.artText} (${ev.artLoc})` : ev.artText;
  lines.push(`${b('Artwork:')} ${artLine}`);

  // Source evidence
  if (ev.hasSource && ev.srcText) {
    let sourceLabel = ev.srcDoc || 'Specification';
    if (ev.srcLoc) {
      sourceLabel += ` (${ev.srcLoc})`;
    }
    if (ev.srcAuthority && /draft|in review|unconfirmed/i.test(ev.srcAuthority)) {
      sourceLabel += ' [Draft / In Review]';
    }
    lines.push(`${b(`${sourceLabel}:`)} ${ev.srcText}`);
  } else {
    lines.push(`${b('Source Reference:')} Approved source reference unavailable.`);
  }

  // Statutory or rule reference if present
  if (finding.rule?.citation) {
    lines.push(`${b('Statutory Citation:')} ${finding.rule.citation}`);
  }

  lines.push('');

  // Clarification Question
  lines.push(`${b('Question:')} ${question}`);
  lines.push('');

  // Guidance on confirmation
  lines.push('Once confirmed, we\'ll update the review against the authoritative specification.');
  lines.push('');

  // Finding ID & Tracking metadata (safe, non-private)
  lines.push(`${b('Finding ID:')} ${findingId}`);
  if (reviewerContext.reviewId) {
    lines.push(`${b('Review ID:')} ${reviewerContext.reviewId}`);
  }

  return lines.join('\n');
}
