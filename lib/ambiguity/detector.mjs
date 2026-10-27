/**
 * PackSignal Ambiguity Resolution Engine — Deterministic Ambiguity Detector
 * (lib/ambiguity/detector.mjs)
 */

import { buildQuestion } from './question-builder.mjs';
import { deduplicateQuestions, hashId } from './deduplication.mjs';
import { QUESTION_TYPES, QUESTION_STATUS } from './question-types.mjs';

function normal(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Scans review documents, facts, conflicts, and rules to deterministically generate
 * prioritized ambiguity resolution questions.
 * @param {object} review
 * @returns {object[]} List of ambiguity questions
 */
export function detectAmbiguities(review) {
  const docs = review.documents || [];
  const sources = docs.filter(d => ['spec', 'brief', 'claims', 'formulation'].includes(d.role));
  const facts = review.facts || review.structuredFacts || [];
  const conflicts = review.conflicts || review.factConflicts || [];
  const existingResolutions = review.ambiguityResolutions || {};
  const storedQuestions = review.ambiguityQuestions || [];
  const options = review.options || {};
  const sku = review.data?.product?.sku || docs[0]?.data?.product?.sku || 'default';

  const questions = [];

  // 1. NUTRITION BASIS AMBIGUITY (Flagship Check)
  for (const doc of sources) {
    if (!doc.cells?.length) continue;
    const heading = doc.cells.find(c => normal(c.value) === 'nutrientcomposition' || /nutrition(?:\s+facts)?/i.test(c.value));
    if (!heading) continue;

    // Look for column variant headers (e.g. "Per Serving", "Per 100 g", "100g", "Serving")
    const variants = doc.cells.filter(c => c.sheet === heading.sheet && c.row === heading.row && c.col > heading.col && c.value);
    if (variants.length >= 2) {
      const prevStoredQ = storedQuestions.find(sq => sq.type === QUESTION_TYPES.NUTRITION_BASIS && sq.field === 'nutrition.basis');
      const existingRes = existingResolutions['nutrition.basis'] || prevStoredQ?.resolution || (options.nutritionBasisConfirmed && options.nutritionVariant ? {
        candidateId: variants.find(v => v.value === options.nutritionVariant) ? `cand-col-${String.fromCharCode(64 + variants.find(v => v.value === options.nutritionVariant).col).toLowerCase()}` : 'cand-col-b',
        value: options.nutritionVariant,
        resolvedAt: new Date().toISOString(),
      } : null);

      const sourceDepHash = hashId(`${doc.id}:${doc.sha256}:${variants.map(v => v.value).join('|')}`);
      const candidates = variants.map((v, idx) => {
        const colLetter = String.fromCharCode(64 + v.col);
        const sampleValueCell = doc.cells.find(c => c.sheet === v.sheet && c.row === heading.row + 1 && c.col === v.col);
        const sampleRowLabel = doc.cells.find(c => c.sheet === v.sheet && c.row === heading.row + 1 && c.col === heading.col)?.value || 'Energy';
        return {
          candidateId: `cand-col-${colLetter.toLowerCase()}`,
          label: `Column ${colLetter} — ${v.value}`,
          value: v.value,
          documentId: doc.id,
          documentName: doc.name,
          documentSha256: doc.sha256,
          sheet: v.sheet,
          location: `${v.sheet}!${colLetter}${v.row + 1}`,
          cell: `${colLetter}${v.row + 1}`,
          column: colLetter,
          approvalStatus: /draft/i.test(doc.data?.status || '') ? 'DRAFT' : 'UNCONFIRMED_BASIS',
          quote: sampleValueCell ? `${sampleRowLabel}: ${sampleValueCell.value} (${v.value})` : `Column header: ${v.value}`,
          sku,
          isAuthoritative: options.nutritionVariant === v.value && Boolean(options.nutritionBasisConfirmed),
        };
      });

      questions.push(buildQuestion({
        reviewId: review.id,
        sku,
        type: QUESTION_TYPES.NUTRITION_BASIS,
        field: 'nutrition.basis',
        title: 'Specify Approved Nutrition Basis & Column',
        question: `The source spreadsheet "${doc.name}" contains multiple nutrition bases (${variants.map(v => v.value).join(' vs ')}). Which is approved for this SKU?`,
        reason: 'Nutrition % Daily Value, calorie plausibility, and nutrient comparisons require a verified serving basis.',
        sourceCandidates: candidates,
        affectedFactFields: ['nutrition.basis', 'nutrition.calories', 'nutrition.totalfat', 'nutrition.sodium', 'nutrition.carbohydrate', 'nutrition.protein'],
        affectedRuleIds: ['21 CFR 101.9', 'US-004', 'US-005', 'US-006'],
        affectedCheckIds: ['nutrition_source_comparison', 'us_daily_value_arithmetic', 'calorie_sanity'],
        affectedFindingKeys: ['rule:nutrition.energy', 'rule:nutrition.totalfat', 'rule:nutrition.sodium', 'us-preflight-us-005', 'us-preflight-us-006'],
        sourceDependencyHash: sourceDepHash,
        existingResolution: existingRes,
        status: existingRes ? QUESTION_STATUS.RESOLVED : (prevStoredQ?.status || QUESTION_STATUS.OPEN),
        history: prevStoredQ?.history || [],
        isMandatory: true,
      }));
    }
  }

  // 2. FACT CONFLICTS
  for (const conflict of conflicts) {
    const field = conflict.field || conflict.label;
    const competing = conflict.competingValues || conflict.facts || [];
    if (competing.length < 2) continue;

    const sourceDepHash = hashId(`${field}:${competing.map(c => `${c.documentId}:${c.value}`).join(';')}`);
    const candidates = competing.map((c, idx) => {
      const doc = docs.find(d => d.id === c.documentId) || { name: c.documentName || 'Source Specification', sha256: '' };
      return {
        candidateId: `cand-fact-${hashId(`${c.documentId}:${field}:${c.value}`)}`,
        label: `"${c.value}" — ${doc.name}`,
        value: c.value,
        documentId: c.documentId || doc.id,
        documentName: doc.name,
        documentSha256: doc.sha256,
        sheet: c.sheet || null,
        location: c.sourceLocation || c.location || (c.cell ? `${c.sheet}!${c.cell}` : 'Specification document'),
        cell: c.cell || null,
        approvalStatus: c.approvalState || (/draft/i.test(doc.data?.status || '') ? 'DRAFT' : 'UNCONFIRMED'),
        quote: c.sourceQuote || c.value,
        sku,
        isAuthoritative: options.factChoices?.[field] === (c.factId || c.value),
      };
    });

    const checkMapping = {
      net_quantity: ['net_quantity_check'],
      ingredients: ['ingredients_allergens_check'],
      allergen_statement: ['ingredients_allergens_check'],
      storage_statement: ['storage_comparison'],
      business_details: ['business_address_check'],
      variant: ['sku_variant_check', 'cross_sku_review'],
    };

    const findingKeyMapping = {
      net_quantity: ['rule:net_quantity', 'us-preflight-us-001'],
      ingredients: ['rule:ingredients', 'us-preflight-us-003'],
      allergen_statement: ['rule:allergen_statement', 'us-preflight-us-003'],
      business_details: ['rule:business_details', 'us-preflight-us-002'],
    };

    questions.push(buildQuestion({
      reviewId: review.id,
      sku,
      type: QUESTION_TYPES.FACT_CONFLICT,
      field,
      title: `Resolve Conflicting Specification for ${conflict.label || field}`,
      question: `Multiple source documents provide contradictory values for ${conflict.label || field}. Which specification is authoritative?`,
      reason: `Resolves discrepancy between ${competing.map(c => `"${c.value}" in ${c.documentName || 'source'}`).join(' and ')}.`,
      sourceCandidates: candidates,
      affectedFactFields: [field],
      affectedRuleIds: [`rule:${field}`],
      affectedCheckIds: checkMapping[field] || [`${field}_comparison`],
      affectedFindingKeys: findingKeyMapping[field] || [`rule:${field}`],
      sourceDependencyHash: sourceDepHash,
      existingResolution: existingResolutions[field] || null,
      isMandatory: field === 'net_quantity' || field === 'ingredients' || field === 'allergen_statement',
    }));
  }

  // 3. SOURCE AUTHORITY
  const draftDocs = sources.filter(d => /draft|review|unconfirmed/i.test(d.data?.status || d.text || ''));
  if (draftDocs.length > 0 && !options.sourceConfirmed) {
    const doc = draftDocs[0];
    const sourceDepHash = hashId(`auth:${doc.id}:${doc.sha256}`);
    questions.push(buildQuestion({
      reviewId: review.id,
      sku,
      type: QUESTION_TYPES.SOURCE_AUTHORITY,
      field: 'source.authority',
      title: 'Confirm Master Specification Approval Authority',
      question: `Document "${doc.name}" is marked "${doc.data?.status || 'Draft'}". Is this document approved for release packaging inspection?`,
      reason: 'Draft specifications prevent issuing definitive release or defect verdicts.',
      sourceCandidates: [
        {
          candidateId: 'cand-auth-approved',
          label: 'Authorize as Controlling Specification',
          value: 'APPROVED_AUTHORITY',
          documentId: doc.id,
          documentName: doc.name,
          documentSha256: doc.sha256,
          approvalStatus: 'AUTHORIZATION_PENDING',
          quote: `Document status: ${doc.data?.status || 'Draft'}`,
          sku,
          isAuthoritative: false,
        },
        {
          candidateId: 'cand-auth-advisory',
          label: 'Retain as Advisory / Draft Only',
          value: 'ADVISORY_DRAFT',
          documentId: doc.id,
          documentName: doc.name,
          documentSha256: doc.sha256,
          approvalStatus: 'DRAFT',
          quote: 'Reviewer leaves document as advisory inspection aid.',
          sku,
          isAuthoritative: false,
        }
      ],
      affectedFactFields: ['source.authority'],
      affectedRuleIds: ['DF-01'],
      affectedCheckIds: ['source_authority_check'],
      affectedFindingKeys: ['source-status'],
      sourceDependencyHash: sourceDepHash,
      existingResolution: existingResolutions['source.authority'] || null,
      isMandatory: true,
    }));
  }

  // 4. CLAIM SUBSTANTIATION
  const findings = review.findings || [];
  const claimFindings = findings.filter(f => f.key === 'rule:claims' && (f.status === 'review' || f.status === 'unable'));
  for (const cf of claimFindings) {
    const sourceDepHash = hashId(`claim:${cf.id}:${cf.observed}`);
    questions.push(buildQuestion({
      reviewId: review.id,
      sku,
      type: QUESTION_TYPES.CLAIM_SUBSTANTIATION,
      field: 'claims.substantiation',
      title: 'Provide Claim Approval & Substantiation Evidence',
      question: `Artwork declares claim "${cf.observed}". Does verified legal substantiation or register approval exist for this SKU?`,
      reason: 'Environmental and nutrient claims require verified third-party certification or company claims register entry.',
      sourceCandidates: [
        {
          candidateId: 'cand-claim-substantiated',
          label: 'Substantiated by Verified Company Register',
          value: 'VERIFIED_SUBSTANTIATED',
          documentId: 'claims-reg',
          documentName: 'Approved Claims Register',
          approvalStatus: 'VERIFIED',
          quote: cf.observed,
          sku,
          isAuthoritative: false,
        },
        {
          candidateId: 'cand-claim-unsubstantiated',
          label: 'No Supporting Evidence / Require Copy Removal',
          value: 'UNSUBSTANTIATED',
          documentId: 'claims-reg',
          documentName: 'Approved Claims Register',
          approvalStatus: 'UNAPPROVED',
          quote: cf.observed,
          sku,
          isAuthoritative: false,
        }
      ],
      affectedFactFields: ['claims'],
      affectedRuleIds: ['21 CFR 101.13', '16 CFR 260'],
      affectedCheckIds: ['claims_verification'],
      affectedFindingKeys: ['rule:claims', 'us-preflight-us-007'],
      sourceDependencyHash: sourceDepHash,
      existingResolution: existingResolutions['claims.substantiation'] || null,
      isMandatory: false,
    }));
  }

  // Preserve any previously stored questions that were not regenerated (e.g. resolved or reopened)
  for (const sq of storedQuestions) {
    if (!questions.some(q => q.questionId === sq.questionId)) {
      questions.push(sq);
    }
  }

  return deduplicateQuestions(questions);
}
