/**
 * PackSignal — Intelligent Finding Department Classifier
 * lib/finding-department-classifier.mjs
 *
 * Automatically classifies packaging artwork findings into responsible enterprise
 * departments (Legal & Regulatory, R&D & Formulation, Brand & Marketing, Prepress & Print)
 * using deterministic structured metadata (check type, rule category, product field,
 * prepress signals, and statutory authorities).
 */

import { DEPARTMENTS, normalizeDepartmentId, isValidDepartment } from './finding-departments.mjs';

/**
 * Classifies a single finding into its primary and collaborating departments.
 *
 * @param {Object} finding - Canonical finding record
 * @param {Object} [reviewContext] - Optional review context (options, market, documents)
 * @param {Object} [overrides] - Reviewer manual overrides dictionary: { [findingId]: overrideObj }
 * @returns {Object} Department routing classification metadata
 */
export function classifyFinding(finding = {}, reviewContext = {}, overrides = {}) {
  const findingId = finding.id || finding.findingId || '';

  // 1. Check for authorized reviewer override
  const override = overrides[findingId] || finding.departmentOverride || (finding.reviewerDepartmentOverride ? { primaryDepartment: finding.primaryDepartment, collaboratingDepartments: finding.collaboratingDepartments } : null);
  if (override && override.primaryDepartment && isValidDepartment(override.primaryDepartment)) {
    const primary = normalizeDepartmentId(override.primaryDepartment);
    const rawCollabs = Array.isArray(override.collaboratingDepartments)
      ? override.collaboratingDepartments
      : (Array.isArray(finding.collaboratingDepartments) ? finding.collaboratingDepartments : []);

    const collaborating = [...new Set(
      rawCollabs
        .map(normalizeDepartmentId)
        .filter(id => id !== primary && id !== 'unassigned')
    )];

    return {
      primaryDepartment: primary,
      collaboratingDepartments: collaborating,
      classificationMethod: 'REVIEWER_OVERRIDE',
      classificationRuleId: override.reasonRuleId || 'manual_override',
      classificationVersion: '1.0',
      classificationReason: override.reason || 'Manually routed by authorized reviewer',
      classificationState: 'OVERRIDDEN',
      overrideBy: override.changedBy || override.by || 'reviewer',
      overrideAt: override.changedAt || override.at || null
    };
  }

  // 2. Extract structured classification signals
  const field = String(finding.rule?.field || finding.field || '').toLowerCase();
  const category = String(finding.category || finding.rule?.category || '').toLowerCase();
  const method = String(finding.method || '').toLowerCase();
  const key = String(finding.key || '').toLowerCase();
  const ruleId = String(finding.rule?.id || finding.rule?.citation || '').toLowerCase();
  const title = String(finding.title || '').toLowerCase();
  const comparison = String(finding.rule?.comparison || '').toLowerCase();
  const authority = String(finding.rule?.authority || '').toLowerCase();
  const ruleType = String(finding.type || finding.ruleType || finding.rule?.type || finding.rule?.checkType || '').toLowerCase();
  const verdict = String(finding.verdict || finding.checkVerdict || '').toLowerCase();

  let primary = 'unassigned';
  let collaborating = [];
  let reason = '';
  let matchedRule = 'default_unassigned';

  // --- WAVE D PACKAGING FAMILIES ROUTING ---
  if (ruleType === 'barcode_gtin_match' || verdict.includes('gtin') || key.includes('gtin')) {
    primary = 'prepress';
    collaborating.push('rd');
    matchedRule = 'barcode_gtin_rule';
    reason = 'Barcode symbology and GTIN specification matching between artwork symbol and product master.';
  } else if (ruleType === 'statutory_symbol_presence' || verdict.includes('symbol_presence') || verdict.includes('mandatory_symbol')) {
    primary = 'legal';
    collaborating.push('brand');
    matchedRule = 'statutory_symbol_rule';
    reason = 'Statutory or mandatory symbol presence requirement (e.g. FSSAI veg/non-veg mark).';
  } else if (ruleType === 'multilingual_pair_requirement' || verdict.includes('bilingual') || verdict.includes('multilingual')) {
    primary = 'legal';
    collaborating.push('brand');
    matchedRule = 'multilingual_pair_rule';
    reason = 'Parallel multilingual statement requirement under applicable market regulation.';
  } else if (ruleType === 'manufacturer_address_declaration' || verdict.includes('address') || verdict.includes('manufacturer_declaration')) {
    primary = 'legal';
    collaborating.push('brand');
    matchedRule = 'manufacturer_address_rule';
    reason = 'Statutory business declaration and manufacturer identification under 21 CFR 101.5.';
  } else if (ruleType === 'storage_instruction_mandate' || verdict.includes('storage')) {
    primary = 'rd';
    collaborating.push('legal');
    matchedRule = 'storage_instruction_rule';
    reason = 'Thermal storage regime and handling instructions for product shelf-life safety.';
  } else if (ruleType === 'nutrient_content_claim_limit' || verdict.includes('nutrient_claim')) {
    primary = 'legal';
    collaborating.push('rd');
    matchedRule = 'nutrient_claim_rule';
    reason = 'Quantitative nutrient content claim evaluation under 21 CFR 101.61.';
  }

  // --- RULE A: PREPRESS & PRINT ---
  // PDF structure, font metrics, text occlusion, barcode print quality, quiet zones, bleed/trim
  if (
    category === 'preflight' ||
    category === 'prepress' ||
    category === 'typography' ||
    method === 'typography_inspection' ||
    method === 'barcode_quality' ||
    method === 'panel_geometry' ||
    method === 'visibility_review' ||
    method === 'native_pdf_paint_order' ||
    method === 'pdf_native_cmyk_object_stream' ||
    key.startsWith('prepress:') ||
    findingId.startsWith('prepress:') ||
    String(finding.check || '').startsWith('prepress:') ||
    key.startsWith('preflight:') ||
    key.startsWith('pdf-preflight:') ||
    findingId.startsWith('pdf-preflight:') ||
    key.startsWith('visibility:') ||
    key.startsWith('panel-zone:') ||
    /total area coverage|tac|ink density|color separation|ink bleed|trim box|cut line|trim safety|crease clearance|fold geometry|barcode quiet zone|quiet zone touch|barcode print quality|print legibility|point size|font size|minimum height|non-printing stream|hidden native text|hidden text|vector occlusion/i.test(title)
  ) {
    primary = 'prepress';
    matchedRule = 'prepress_quality_rule';
    reason = 'Prepress technical attribute: typography measurement, TAC ink density, bleed, crease clearance, or print structure.';

    // If it's a minimum font size for a statutory requirement (e.g. 21 CFR 101.105(h) net quantity or allergen declaration),
    // Legal & Regulatory is a collaborating team
    if (/21\s*cfr|statutory|allergen|net\s*quantity|mandatory|warning|disclosure/i.test(title + ' ' + ruleId + ' ' + authority)) {
      collaborating.push('legal');
    }
  }

  // --- RULE B: R&D & FORMULATION ---
  // Ingredients, recipe percentages, nutritional facts, macronutrient math, serving size/basis
  else if (
    field === 'ingredients' ||
    field.startsWith('nutrition') ||
    category === 'nutrition' ||
    category === 'formulation' ||
    key.startsWith('nutrition:') ||
    key.startsWith('nutrition-sanity:') ||
    key.startsWith('pack-quantity:') ||
    findingId.startsWith('nutrition-sanity:') ||
    findingId.startsWith('nutrition:') ||
    findingId.startsWith('pack-quantity:') ||
    /ingredient|formulation|recipe|honey\s*percentage|percentage mismatch|calorie math|macronutrient|serving size|serving basis|pack quantity|servings vs net|daily value arithmetic|4-4-9 calorie|atwater|calorie/i.test(title + ' ' + key + ' ' + findingId)
  ) {
    primary = 'rd';
    matchedRule = 'rd_formulation_rule';
    reason = 'Formulation and product recipe: ingredient declaration, component percentage, or nutrition fact math.';

    // If an ingredient percentage mismatch also touches regulated QUID or allergen cross-contamination,
    // or calorie compliance under 21 CFR 101.9, Legal & Regulatory collaborates
    if (/quid|allergen|statutory|declaration|standard of identity|21\s*cfr|atwater|calorie|pack\s*quantity|net\s*weight|servings\s*vs\s*net/i.test(title + ' ' + ruleId + ' ' + key + ' ' + findingId)) {
      collaborating.push('legal');
    }
  }

  // --- RULE C: LEGAL & REGULATORY ---
  // Allergen disclosures, mandatory health warnings, statutory net quantity declarations, country of origin, regulatory claims
  else if (
    field === 'allergen_statement' ||
    field === 'net_quantity' ||
    category === 'regulatory' ||
    category === 'statutory' ||
    key.startsWith('market:') ||
    key.startsWith('statutory:') ||
    /allergen|falcpa|faster act|may contain|tree nut|net quantity|net contents|101\.105|statutory declaration|fssai|veg mark|mrp|green dot|packag.*waste|mandatory statement|health warning|country of origin|certification seal|regulatory claim/i.test(title + ' ' + key + ' ' + ruleId + ' ' + authority)
  ) {
    primary = 'legal';
    matchedRule = 'legal_regulatory_rule';
    reason = 'Statutory compliance: mandatory allergen statement, net contents declaration, or regulated disclosure.';

    // If it is net quantity, Prepress is a collaborator because print font size is regulated
    if (field === 'net_quantity' || /net quantity|net contents/i.test(title)) {
      collaborating.push('prepress');
    }

    // If it's a promotional claim with regulatory bounds (e.g. "No Added Sugar" or "Organic"), Brand collaborates
    if (/claim|no added sugar|organic|vegan|clean label/i.test(title + ' ' + key)) {
      collaborating.push('brand');
      collaborating.push('rd');
    }
  }

  // --- RULE D: BRAND & MARKETING ---
  // Product identity, variant name, romance copy, slogans, promotional marketing claims, brand assets
  else if (
    field === 'brand' ||
    field === 'product_name' ||
    field === 'variant' ||
    field === 'claims' ||
    category === 'brand' ||
    category === 'marketing' ||
    comparison === 'register_lookup' ||
    key.startsWith('cross-sku:') ||
    key.startsWith('claim-review') ||
    /brand|product name|variant|marketing copy|romance copy|slogan|certified organic|no added sugar|vegan claim|gluten free claim|taste guarantee|front label headline|brand asset/i.test(title + ' ' + key)
  ) {
    primary = 'brand';
    matchedRule = 'brand_marketing_rule';
    reason = 'Brand presentation: product identity, marketing claim, or approved brand copy.';

    // Claims like "No Added Sugar" or "Certified Vegan" also need Legal & Regulatory review
    if (/claim|no added sugar|organic|vegan|gluten free|natural/i.test(title + ' ' + key)) {
      collaborating.push('legal');
      collaborating.push('rd');
    }

    // Cross-SKU sibling variant mentions also involve R&D to verify if ingredient cross-promotion was intentional
    if (key.startsWith('cross-sku:') || /cross-sku/i.test(title)) {
      collaborating.push('rd');
    }
  }

  // --- RULE E: BARCODE ROUTING ---
  // Barcode data mismatch vs print scan quality
  else if (field === 'barcode' || /barcode/i.test(title + ' ' + key)) {
    if (/quiet zone|contrast|printability|resolution|line width|vector/i.test(title + ' ' + key)) {
      primary = 'prepress';
      reason = 'Barcode printability and physical quiet zone specifications.';
    } else {
      // Barcode number check against master data sheet is Prepress/Operations primary with R&D collaborator
      primary = 'prepress';
      collaborating.push('rd');
      reason = 'UPC/EAN barcode identity and symbol verification.';
    }
    matchedRule = 'barcode_verification_rule';
  }

  // --- RULE F: CAPTURE FACE / IMAGE READING GAPS ---
  else if (method === 'capture_face_review' || method === 'image_observation' || method === 'review_input_gap') {
    primary = 'prepress';
    matchedRule = 'artwork_intake_rule';
    reason = 'Artwork photo intake: missing source document or unclassified visible copy.';
  }

  // Fallback to Unassigned if not deterministically matched
  if (primary === 'unassigned') {
    primary = 'unassigned';
    reason = 'No deterministic rule matched the finding metadata; awaiting reviewer routing.';
    matchedRule = 'unassigned_fallback';
  }

  // Deduplicate collaborating departments and remove primary/unassigned
  const uniqueCollabs = [...new Set(
    collaborating
      .map(normalizeDepartmentId)
      .filter(id => id !== primary && id !== 'unassigned')
  )];

  return {
    primaryDepartment: primary,
    collaboratingDepartments: uniqueCollabs,
    classificationMethod: 'DETERMINISTIC_RULE',
    classificationRuleId: matchedRule,
    classificationVersion: '1.0',
    classificationReason: reason,
    classificationState: 'AUTO_ROUTED'
  };
}

/**
 * Enriches all findings in a review object with canonical department metadata.
 * Modifies the findings in place and returns the summary counts by department.
 *
 * @param {Object} review - The full review object
 * @returns {Object} Department summary counts: { legal, rd, brand, prepress, unassigned, total }
 */
export function enrichReviewFindingsWithDepartments(review) {
  if (!review || !Array.isArray(review.findings)) {
    return { legal: 0, rd: 0, brand: 0, prepress: 0, unassigned: 0, total: 0 };
  }

  const overrides = review.departmentOverrides || {};
  const counts = {
    legal: 0,
    rd: 0,
    brand: 0,
    prepress: 0,
    unassigned: 0,
    total: review.findings.length
  };

  const statusByDepartment = {
    legal: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    rd: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    brand: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    prepress: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    unassigned: { issue: 0, review: 0, match: 0, unable: 0, total: 0 }
  };

  for (const finding of review.findings) {
    const classification = classifyFinding(finding, review, overrides);

    finding.primaryDepartment = classification.primaryDepartment;
    finding.collaboratingDepartments = classification.collaboratingDepartments;
    finding.classificationMethod = classification.classificationMethod;
    finding.classificationRuleId = classification.classificationRuleId;
    finding.classificationReason = classification.classificationReason;
    finding.classificationState = classification.classificationState;

    const dept = classification.primaryDepartment;
    if (counts[dept] !== undefined) {
      counts[dept]++;
    } else {
      counts.unassigned++;
    }

    const st = finding.status || 'review';
    if (statusByDepartment[dept]) {
      statusByDepartment[dept][st] = (statusByDepartment[dept][st] || 0) + 1;
      statusByDepartment[dept].total++;
    }
  }

  review.departmentSummary = {
    counts,
    statusByDepartment,
    updatedAt: new Date().toISOString()
  };

  return review.departmentSummary;
}
