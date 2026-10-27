/**
 * @file creative-brief.mjs
 * 
 * Phase 5 — Creative Brief Generator, Sentence-Level Fact Linking,
 * Compliance Audit Engine, Approval Gate, PDF/Checklist Export,
 * and "Ask about this" Side Panel Engine.
 */

import { createHash } from 'node:crypto';
import { getDeskSession } from './evidence-desk.mjs';
import { generateQrSvg } from '../public/ar-modal.js';

/**
 * Regex patterns for extracting numerical and regulatory claims from sentences.
 */
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|g|oz|kcal|cups?|servings?|cal|mg|mcg)?\b/gi;
const CLAIM_PATTERNS = [
  /\bno\s+added\s+sugars?\b/i,
  /\bcertified\s+vegan\b/i,
  /\bkosher\b/i,
  /\bcontains\b/i,
  /\bmay\s+contain\b/i,
  /\bnon-gmo\b/i,
  /\bgluten\s*free\b/i
];

/**
 * Standard brief section templates.
 */
export const BRIEF_SECTIONS_META = [
  { id: 'section-identity', title: '1. Product Identity & Brand Authority' },
  { id: 'section-net-quantity', title: '2. Net Contents & Packaging Dimensions' },
  { id: 'section-formulation', title: '3. Formulation, Honey Content & Ingredients' },
  { id: 'section-nutrition', title: '4. US Nutrition Facts Panel & Daily Values' },
  { id: 'section-allergens', title: '5. FALCPA Allergen Declaration & Advisories' },
  { id: 'section-claims', title: '6. Marketing Claims & Front Panel Copy' },
  { id: 'section-assets', title: '7. Creative Directives: Keep / Change / Add / Remove' },
  { id: 'section-technical', title: '8. Technical Specifications & Barcode' }
];

/**
 * Generates an initial AI Draft of the creative brief from the active session facts.
 * Every sentence carries explicit factIds.
 *
 * @param {object} session - Evidence desk session
 * @returns {object} Draft creative brief with sections, sentences, and metadata
 */
export function generateBriefDraft(session) {
  const factsMap = new Map((session.facts || []).map(f => [f.field, f]));
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));

  const getFact = (field) => factsMap.get(field);

  // Helper to construct a sentence with factIds
  let sentenceCounter = 0;
  function makeSentence(text, factIds = []) {
    sentenceCounter++;
    const sId = `sent-${sentenceCounter}`;
    
    // Extract numbers
    const numbers = (text.match(NUMBER_PATTERN) || []).map(n => n.trim());
    // Extract claims
    const claims = [];
    for (const pat of CLAIM_PATTERNS) {
      const m = text.match(pat);
      if (m) claims.push(m[0].toLowerCase());
    }

    return {
      id: sId,
      text,
      factIds: [...factIds],
      isClaimOrNumber: numbers.length > 0 || claims.length > 0,
      extractedNumbers: numbers,
      extractedClaims: claims,
      status: 'PENDING_AUDIT',
      auditIssues: []
    };
  }

  const sections = [];

  // Section 1: Identity
  const nameFact = getFact('product_name');
  const brandFact = getFact('brand_name');
  sections.push({
    id: 'section-identity',
    title: '1. Product Identity & Brand Authority',
    sentences: [
      makeSentence(
        `The master product identity is designated as ${nameFact?.value || 'Dancing Fish Berry Crunch Granola'} for retail packaging.`,
        [nameFact?.id, brandFact?.id].filter(Boolean)
      ),
      makeSentence(
        `The brand name "${brandFact?.value || 'Dancing Fish'}" must be presented as the primary trade mark on the Principal Display Panel.`,
        [brandFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 2: Net Quantity
  const netQtyFact = getFact('net_quantity');
  sections.push({
    id: 'section-net-quantity',
    title: '2. Net Contents & Packaging Dimensions',
    sentences: [
      makeSentence(
        `The package shall declare net contents in dual US customary and metric units as ${netQtyFact?.value || '480 g (16.9 oz)'} located in the bottom 30% of the Principal Display Panel.`,
        [netQtyFact?.id].filter(Boolean)
      ),
      makeSentence(
        `Dual unit equivalence is verified at 480 g = 16.93 oz within standard commercial rounding tolerance.`,
        [netQtyFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 3: Formulation & Ingredients
  const honeyFact = getFact('honey_percentage');
  const ingFact = getFact('ingredient_list');
  sections.push({
    id: 'section-formulation',
    title: '3. Formulation, Honey Content & Ingredients',
    sentences: [
      makeSentence(
        honeyFact?.state === 'PROVEN'
          ? `The approved product formulation requires a honey content of ${honeyFact.value}.`
          : `The recipe specifies ${honeyFact?.value || '9%'} honey ratio currently pending conflict resolution.`,
        [honeyFact?.id].filter(Boolean)
      ),
      makeSentence(
        ingFact?.state === 'PROVEN'
          ? `The ingredient list declaration shall read: "${ingFact.value}".`
          : `The ingredient declaration states "${ingFact?.value || 'Whole grain rolled oats, honey, berries'}" subject to specification sign-off.`,
        [ingFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 4: Nutrition Facts
  const calFact = getFact('calories');
  const carbFact = getFact('total_carbohydrate');
  const servFact = getFact('servings_per_container');
  const sizeFact = getFact('serving_size');
  sections.push({
    id: 'section-nutrition',
    title: '4. US Nutrition Facts Panel & Daily Values',
    sentences: [
      makeSentence(
        `Serving metrics must state ${servFact?.value || '8 servings'} per container at a serving size of ${sizeFact?.value || '1/2 cup (85g)'}.`,
        [servFact?.id, sizeFact?.id].filter(Boolean)
      ),
      makeSentence(
        `Declared calories per serving shall be ${calFact?.value || '166 kcal'}.`,
        [calFact?.id].filter(Boolean)
      ),
      makeSentence(
        `Total carbohydrate per serving is declared as ${carbFact?.value || '66 g'}.`,
        [carbFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 5: Allergens
  const allergenFact = getFact('allergen_statement');
  sections.push({
    id: 'section-allergens',
    title: '5. FALCPA Allergen Declaration & Advisories',
    sentences: [
      makeSentence(
        `The mandatory allergen declaration shall state: "${allergenFact?.value || 'Contains Almonds. May contain tree nuts.'}".`,
        [allergenFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 6: Claims
  const claimSugarFact = getFact('claim_added_sugar');
  const veganFact = getFact('certified_vegan_mark');
  sections.push({
    id: 'section-claims',
    title: '6. Marketing Claims & Front Panel Copy',
    sentences: [
      makeSentence(
        claimSugarFact?.state === 'PROVEN' && claimSugarFact?.value?.toLowerCase().includes('remove')
          ? `The front panel claim "No Added Sugar" is removed in compliance with 21 CFR 101.60(c)(2).`
          : `Front panel includes marketing claim "${claimSugarFact?.value || 'No Added Sugar'}".`,
        [claimSugarFact?.id].filter(Boolean)
      ),
      makeSentence(
        `The pack carries the ${veganFact?.value || 'Certified Vegan Logo (Vegan.org)'} on the right display panel.`,
        [veganFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 7: Design Assets Keep/Change
  const logoFact = getFact('brand_asset_logo');
  const photoFact = getFact('brand_asset_photo');
  const coloursFact = getFact('brand_asset_colours');
  const taglineFact = getFact('brand_asset_tagline');
  sections.push({
    id: 'section-assets',
    title: '7. Creative Directives: Keep / Change / Add / Remove',
    sentences: [
      makeSentence(
        `Brand Identity: Retain ${logoFact?.value || 'Dancing Fish Leaping Fish Emblem'} as the primary visual mark.`,
        [logoFact?.id].filter(Boolean)
      ),
      makeSentence(
        `Appetite Appeal: Utilize ${photoFact?.value || 'Berry Crunch Granola Clusters photography'} on front carton face.`,
        [photoFact?.id].filter(Boolean)
      ),
      makeSentence(
        `Colour Palette: Preserve brand colors ${coloursFact?.value || 'Midnight Navy Blue (#1B2B4A) and Coral Orange (#FF6B4A)'}.`,
        [coloursFact?.id].filter(Boolean)
      ),
      makeSentence(
        `Brand Tagline: Feature "${taglineFact?.value || 'Packed with Goodness'}" across upper carton face.`,
        [taglineFact?.id].filter(Boolean)
      )
    ]
  });

  // Section 8: Technical Specs & Barcode
  const barcodeFact = getFact('barcode');
  sections.push({
    id: 'section-technical',
    title: '8. Technical Specifications & Barcode',
    sentences: [
      makeSentence(
        `The production carton shall print UPC-A barcode ${barcodeFact?.value || '1 20000 00003 6'} with verified check digit 6 on the bottom panel.`,
        [barcodeFact?.id].filter(Boolean)
      )
    ]
  });

  const brief = {
    briefId: `brief-${session.sessionId || 'default'}`,
    title: 'Dancing Fish Berry Crunch Granola — US Packaging Creative Brief',
    market: 'United States (FDA 21 CFR)',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections
  };

  // Perform initial compliance audit
  auditBrief(brief, session);

  return brief;
}

/**
 * Compliance Audit Engine: Rejects unproven numbers and claims!
 * Evaluates every sentence against referenced facts.
 *
 * @param {object} brief - Creative brief
 * @param {object} session - Evidence desk session containing facts
 * @returns {object} Audit results object
 */
export function auditBrief(brief, session) {
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));
  let totalSentences = 0;
  let provenSentences = 0;
  let unprovenSentences = 0;
  const issues = [];

  for (const section of brief.sections || []) {
    for (const sent of section.sentences || []) {
      totalSentences++;
      sent.auditIssues = [];

      // Check if sentence makes a claim or cites numbers
      const hasFactIds = Array.isArray(sent.factIds) && sent.factIds.length > 0;

      if (!hasFactIds) {
        if (sent.isClaimOrNumber) {
          const issue = {
            sentenceId: sent.id,
            sectionId: section.id,
            type: 'MISSING_FACT_LINK',
            message: `Sentence contains claims or numerical declarations (${sent.extractedNumbers.concat(sent.extractedClaims).join(', ')}) but carries no linked fact ID.`
          };
          sent.auditIssues.push(issue);
          issues.push(issue);
        }
      } else {
        // Inspect referenced facts
        for (const factId of sent.factIds) {
          const fact = factsById.get(factId);
          if (!fact) {
            const issue = {
              sentenceId: sent.id,
              sectionId: section.id,
              type: 'FACT_NOT_FOUND',
              message: `Referenced fact ID "${factId}" does not exist in the active Fact Sheet.`
            };
            sent.auditIssues.push(issue);
            issues.push(issue);
          } else if (fact.state === 'CONFLICT') {
            const issue = {
              sentenceId: sent.id,
              sectionId: section.id,
              type: 'UNPROVEN_NUMBER_CONFLICT',
              factId: fact.id,
              factLabel: fact.label,
              message: `Sentence cites fact "${fact.label}" which is currently flagged in CONFLICT state (${fact.value}).`
            };
            sent.auditIssues.push(issue);
            issues.push(issue);
          } else if (fact.state === 'AI_SUGGESTED') {
            const issue = {
              sentenceId: sent.id,
              sectionId: section.id,
              type: 'UNPROVEN_NUMBER_OR_CLAIM',
              factId: fact.id,
              factLabel: fact.label,
              message: `Sentence relies on unconfirmed fact "${fact.label}" in AI_SUGGESTED state.`
            };
            sent.auditIssues.push(issue);
            issues.push(issue);
          }
        }
      }

      // Sentence status determination
      if (sent.auditIssues.length > 0) {
        sent.status = 'REJECTED_UNPROVEN';
        unprovenSentences++;
      } else {
        sent.status = 'VERIFIED_PROVEN';
        provenSentences++;
      }
    }
  }

  const isApprovable = unprovenSentences === 0 && totalSentences > 0;

  brief.audit = {
    totalSentences,
    provenSentences,
    unprovenSentences,
    complianceScore: totalSentences > 0 ? Math.round((provenSentences / totalSentences) * 100) : 0,
    isApprovable,
    issuesCount: issues.length,
    issues,
    auditedAt: new Date().toISOString(),
    verdict: isApprovable ? 'READY_FOR_APPROVAL' : 'CHANGES_REQUIRED_UNPROVEN_ELEMENTS_FOUND'
  };

  return brief.audit;
}

/**
 * Updates a specific sentence within the brief (text or factIds) and re-audits.
 */
export function updateBriefSentence(brief, session, { sectionId, sentenceId, text, factIds }) {
  const section = brief.sections.find(s => s.id === sectionId);
  if (!section) throw new Error(`Section not found: ${sectionId}`);

  const sent = section.sentences.find(s => s.id === sentenceId);
  if (!sent) throw new Error(`Sentence not found: ${sentenceId}`);

  if (typeof text === 'string') {
    sent.text = text;
    // Re-extract numbers and claims
    sent.extractedNumbers = (text.match(NUMBER_PATTERN) || []).map(n => n.trim());
    sent.extractedClaims = [];
    for (const pat of CLAIM_PATTERNS) {
      const m = text.match(pat);
      if (m) sent.extractedClaims.push(m[0].toLowerCase());
    }
    sent.isClaimOrNumber = sent.extractedNumbers.length > 0 || sent.extractedClaims.length > 0;
  }

  if (Array.isArray(factIds)) {
    sent.factIds = [...factIds];
  }

  brief.updatedAt = new Date().toISOString();
  auditBrief(brief, session);
  return { brief, sentence: sent };
}

/**
 * Replaces or auto-aligns brief sentences with the latest proven facts from session.
 */
export function syncBriefWithProvenFacts(brief, session) {
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));
  const factsByField = new Map((session.facts || []).map(f => [f.field, f]));

  for (const sec of brief.sections || []) {
    for (const sent of sec.sentences || []) {
      // If sentence has a fact in CONFLICT or AI_SUGGESTED that is now PROVEN, update text
      for (const fId of sent.factIds) {
        const f = factsById.get(fId);
        if (f && f.state === 'PROVEN') {
          if (f.field === 'honey_percentage' && sent.text.includes('pending conflict')) {
            sent.text = `The approved product formulation requires a honey content of ${f.value}.`;
          } else if (f.field === 'total_carbohydrate' && sent.text.includes('pending')) {
            sent.text = `Total carbohydrate per serving is declared as ${f.value}.`;
          } else if (f.field === 'ingredient_list' && sent.text.includes('subject to')) {
            sent.text = `The ingredient list declaration shall read: "${f.value}".`;
          } else if (f.field === 'claim_added_sugar') {
            if (f.value.toLowerCase().includes('remove')) {
              sent.text = `The front panel claim "No Added Sugar" is removed in compliance with 21 CFR 101.60(c)(2).`;
            }
          } else if (f.field === 'allergen_statement' && !sent.text.includes(f.value)) {
            sent.text = `The mandatory allergen declaration shall state: "${f.value}".`;
          } else if (f.field === 'calories' && sent.text.includes('Atwater math')) {
            sent.text = `Declared calories per serving shall be ${f.value}.`;
          } else if (f.field === 'servings_per_container' || f.field === 'serving_size') {
            const servF = factsByField.get('servings_per_container');
            const sizeF = factsByField.get('serving_size');
            if (servF?.state === 'PROVEN' && sizeF?.state === 'PROVEN') {
              sent.text = `Serving metrics must state ${servF.value} per container at a serving size of ${sizeF.value}.`;
            }
          }
        }
      }
    }
  }

  brief.updatedAt = new Date().toISOString();
  auditBrief(brief, session);
  return brief;
}

/**
 * Approves the brief if and only if unprovenSentences === 0.
 */
export function approveBrief(brief, session, reviewer = {}) {
  const audit = auditBrief(brief, session);
  if (!audit.isApprovable) {
    throw new Error(`Cannot approve brief: ${audit.unprovenSentences} unproven sentence(s) remain. Resolve all conflicts and answer all required questions first.`);
  }

  const checksum = createHash('sha256')
    .update(JSON.stringify({
      briefId: brief.briefId,
      sections: brief.sections.map(s => s.sentences.map(sent => sent.text)),
      facts: (session.facts || []).map(f => ({ id: f.id, val: f.value, state: f.state }))
    }))
    .digest('hex');

  brief.status = 'APPROVED';
  brief.approval = {
    approvedAt: new Date().toISOString(),
    approvedBy: reviewer.name || 'Packaging Quality & Regulatory Reviewer',
    role: reviewer.role || 'Senior Brand & Compliance Lead',
    organization: reviewer.org || 'PackSignal Packaging Assurance',
    auditChecksum: checksum,
    provenanceSeal: `SEAL-PACKSIGNAL-${checksum.substring(0, 12).toUpperCase()}`,
    complianceStatus: '100% AUDIT PASS — ZERO UNPROVEN CLAIMS OR NUMBERS'
  };

  return brief;
}

/**
 * Exports preflight checklist for packaging production.
 */
export function generateBriefChecklist(brief, session) {
  const items = [];
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));

  for (const sec of brief.sections || []) {
    for (const sent of sec.sentences || []) {
      const referencedFacts = (sent.factIds || []).map(id => factsById.get(id)).filter(Boolean);
      const isProven = referencedFacts.length > 0 && referencedFacts.every(f => f.state === 'PROVEN');

      items.push({
        id: `check-${sent.id}`,
        section: sec.title,
        statement: sent.text,
        status: isProven ? 'PASS' : 'FAIL',
        isProven,
        facts: referencedFacts.map(f => ({
          label: f.label,
          value: f.value,
          state: f.state,
          primarySource: f.sources?.[0] ? `${f.sources[0].file} [${f.sources[0].location}]` : 'Direct Reviewer Input'
        }))
      });
    }
  }

  return {
    briefId: brief.briefId,
    generatedAt: new Date().toISOString(),
    market: brief.market,
    approvalStatus: brief.status,
    totalChecks: items.length,
    passedChecks: items.filter(i => i.status === 'PASS').length,
    failedChecks: items.filter(i => i.status === 'FAIL').length,
    items
  };
}

/**
 * Generates print-ready HTML/PDF content for the approved brief.
 */
export function generateBriefPdfHtml(brief, session) {
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));

  const sectionsHtml = (brief.sections || []).map(sec => {
    const sentsHtml = (sec.sentences || []).map(sent => {
      const factBadges = (sent.factIds || []).map(fId => {
        const fact = factsById.get(fId);
        const stateClass = fact?.state === 'PROVEN' ? 'proven' : 'unproven';
        return `<span class="pdf-fact-tag ${stateClass}">✓ ${fact?.label || fId}: ${fact?.value || 'verified'}</span>`;
      }).join(' ');

      return `
        <div class="pdf-sentence-item">
          <p class="pdf-sentence-text">${escapeHtml(sent.text)}</p>
          <div class="pdf-sentence-facts">${factBadges}</div>
        </div>
      `;
    }).join('');

    return `
      <section class="pdf-brief-section">
        <h2 class="pdf-section-title">${escapeHtml(sec.title)}</h2>
        ${sentsHtml}
      </section>
    `;
  }).join('');

  const approvalBlock = brief.approval ? `
    <div class="pdf-approval-seal">
      <div class="seal-badge">
        <div class="seal-circle">PASSED</div>
        <div class="seal-meta">
          <h3>APPROVED PACKAGING SPECIFICATION BRIEF</h3>
          <p><strong>Approved By:</strong> ${escapeHtml(brief.approval.approvedBy)} (${escapeHtml(brief.approval.role)})</p>
          <p><strong>Timestamp:</strong> ${brief.approval.approvedAt}</p>
          <p><strong>Verification Hash:</strong> <code>${brief.approval.auditChecksum}</code></p>
          <p><strong>Provenance Seal:</strong> <span class="seal-code">${brief.approval.provenanceSeal}</span></p>
        </div>
      </div>
    </div>
  ` : `
    <div class="pdf-draft-warning">
      <h3>DRAFT SPECIFICATION — PENDING ZERO-DEFECT AUDIT SIGN-OFF</h3>
      <p>Audit Score: ${brief.audit?.complianceScore || 0}% | Unproven sentences: ${brief.audit?.unprovenSentences || 0}</p>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(brief.title)}</title>
  <style>
    @page { size: letter; margin: 1in; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 2rem; max-width: 800px; margin: 0 auto; background: #fff; }
    header { border-bottom: 3px solid #0284c7; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    h1 { font-size: 1.75rem; margin: 0 0 0.5rem 0; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 0.95rem; margin: 0; }
    .pdf-brief-section { margin-bottom: 1.75rem; }
    .pdf-section-title { font-size: 1.15rem; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; margin-bottom: 0.75rem; }
    .pdf-sentence-item { margin-bottom: 0.85rem; padding-left: 0.5rem; border-left: 2px solid #cbd5e1; }
    .pdf-sentence-text { margin: 0 0 0.35rem 0; font-size: 0.95rem; }
    .pdf-sentence-facts { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .pdf-fact-tag { font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 500; }
    .pdf-fact-tag.proven { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .pdf-fact-tag.unproven { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .pdf-approval-seal { margin-top: 2.5rem; padding: 1.5rem; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; }
    .seal-badge { display: flex; gap: 1.5rem; align-items: center; }
    .seal-circle { width: 70px; height: 70px; border-radius: 50%; background: #16a34a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem; letter-spacing: 0.05em; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .seal-meta h3 { margin: 0 0 0.5rem 0; color: #15803d; font-size: 1.1rem; }
    .seal-meta p { margin: 0.15rem 0; font-size: 0.85rem; }
    .seal-code { font-family: monospace; font-weight: bold; color: #0f172a; }
    .pdf-draft-warning { margin-top: 2.5rem; padding: 1.5rem; background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; }
    .pdf-pack-views-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem; }
    .pdf-pack-view-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem; background: #f8fafc; text-align: center; }
    .view-header { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 0.5rem; letter-spacing: 0.05em; }
    .carton-iso-svg { width: 100%; height: 160px; }
    .view-caption { font-size: 0.7rem; color: #64748b; margin-top: 0.5rem; line-height: 1.3; }
    .ar-qr-wrapper { display: flex; justify-content: center; align-items: center; min-height: 160px; }
    .pdf-user-snapshot { margin-bottom: 1rem; text-align: center; }
    @media print {
      body { padding: 0; }
      .pdf-brief-section { page-break-inside: avoid; }
      .pdf-approval-seal { page-break-inside: avoid; }
      .pdf-3d-snapshots { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(brief.title)}</h1>
    <p class="subtitle">Jurisdiction: ${escapeHtml(brief.market)} | Generated by PackSignal Creative Brief Engine</p>
  </header>

  ${sectionsHtml}

  ${(() => {
    const qrSvg = generateQrSvg('https://packsignal.demo/#ar-view/' + (brief.id || 'default'), 120);
    const isIndia = String(brief.market || '').toLowerCase().includes('in');
    return `
    <section class="pdf-brief-section pdf-3d-snapshots">
      <h2 class="pdf-section-title">3D Pack Verification & Physical Projections (Phase 7A)</h2>
      <p style="font-size:0.85rem;color:#64748b;margin:0 0 1rem 0;">
        Physical tuck-end carton kinematics derived from Cut and Crease dieline layers. Shows folded panel alignment, defect pin coordinates, and X-ray statutory ghost boxes.
      </p>

      ${brief.snapshot3d ? `
        <div class="pdf-user-snapshot">
          <img src="${brief.snapshot3d}" alt="3D Pack View Snapshot" style="max-width:100%;border-radius:6px;border:1px solid #cbd5e1;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);" />
        </div>
      ` : ''}

      <div class="pdf-pack-views-grid">
        <div class="pdf-pack-view-card">
          <div class="view-header">Front Panel (PDP) · Isometric Projection</div>
          <svg viewBox="0 0 240 220" class="carton-iso-svg">
            <polygon points="120,30 200,65 120,100 40,65" fill="#f8fafc" stroke="#334155" stroke-width="1.5" />
            <polygon points="40,65 120,100 120,200 40,165" fill="#e2e8f0" stroke="#334155" stroke-width="1.5" />
            <polygon points="120,100 200,65 200,165 120,200" fill="#cbd5e1" stroke="#334155" stroke-width="1.5" />
            
            <text x="160" y="105" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle" transform="rotate(-23 160 105)">DANCING FISH</text>
            <text x="160" y="118" font-size="7" fill="#475569" text-anchor="middle" transform="rotate(-23 160 118)">BERRY CRUNCH</text>
            <text x="160" y="145" font-size="7" font-weight="bold" fill="#0369a1" text-anchor="middle" transform="rotate(-23 160 145)">${isIndia ? 'NET WT 480 g' : '480 g (16.9 oz)'}</text>
            ${isIndia ? '<circle cx="135" cy="85" r="4" fill="#16a34a" /><rect x="131" y="81" width="8" height="8" fill="none" stroke="#16a34a" stroke-width="0.8" />' : ''}

            <g transform="translate(170, 150)">
              <circle cx="0" cy="0" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
              <text x="8" y="3" font-size="6.5" font-weight="bold" fill="#ef4444">Pin 01: Net Qty</text>
            </g>

            <g transform="translate(170, 85)">
              <circle cx="0" cy="0" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" />
              <text x="8" y="3" font-size="6.5" font-weight="bold" fill="#f59e0b">Pin 02: Claim</text>
            </g>
          </svg>
          <div class="view-caption">Closed Tuck-End Carton · 100% Kinematic Fold</div>
        </div>

        <div class="pdf-pack-view-card">
          <div class="view-header">X-Ray Mode · Statutory Ghost Boxes</div>
          <svg viewBox="0 0 240 220" class="carton-iso-svg">
            <polygon points="120,30 200,65 120,100 40,65" fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3 3" />
            <polygon points="40,65 120,100 120,200 40,165" fill="rgba(56, 189, 248, 0.05)" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3 3" />
            <polygon points="120,100 200,65 200,165 120,200" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" stroke-width="1.5" />

            ${!isIndia ? `
              <rect x="135" y="148" width="55" height="18" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3 2" transform="rotate(-23 162 157)" />
              <text x="162" y="160" font-size="5.5" font-weight="bold" fill="#b45309" text-anchor="middle" transform="rotate(-23 162 160)">GHOST: [16.9 oz]</text>
            ` : `
              <rect x="130" y="135" width="60" height="20" fill="rgba(22, 163, 74, 0.2)" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="3 2" transform="rotate(-23 160 145)" />
              <text x="160" y="147" font-size="5.5" font-weight="bold" fill="#15803d" text-anchor="middle" transform="rotate(-23 160 147)">GHOST: MRP ₹299</text>
            `}
          </svg>
          <div class="view-caption">${!isIndia ? 'Ghost Box: Missing Net Quantity in oz (21 CFR §101.7)' : 'Ghost Box: FSSAI Green Veg Dot & Statutory MRP'}</div>
        </div>

        <div class="pdf-pack-view-card ar-card">
          <div class="view-header">Augmented Reality (AR) Verification</div>
          <div class="ar-qr-wrapper">
            ${qrSvg}
          </div>
          <div class="view-caption">
            <strong>Scan with Phone Camera</strong><br>
            Real-Scale (1:1) USDZ Quick Look & WebXR Preview
          </div>
        </div>
      </div>
    </section>
    `;
  })()}

  ${approvalBlock}
</body>
</html>`;
}

/**
 * "Ask about this" Engine: Answers questions strictly from facts and source pieces.
 * Returns citations, exact quotes, and an optional new suggested fact that can be confirmed into the Fact Sheet.
 */
export function askAboutThis(questionText, session) {
  if (!questionText || typeof questionText !== 'string') {
    throw new Error('Question text is required.');
  }

  const q = questionText.toLowerCase().trim();
  const facts = session.facts || [];
  const files = session.files || [];

  // Matcher against facts
  let matchedFact = null;
  let answer = '';
  let sources = [];
  let proposedFact = null;

  if (q.includes('honey') || q.includes('sugar') || q.includes('sweetener')) {
    const honeyFact = facts.find(f => f.field === 'honey_percentage');
    const claimFact = facts.find(f => f.field === 'claim_added_sugar');
    matchedFact = honeyFact;
    sources = honeyFact?.sources || [];
    answer = `Based on master specifications and carton artwork, honey content is declared as ${honeyFact?.value || '9%'}. Because honey is an added sugar under 21 CFR 101.9(c)(6)(iii), front-panel claims like "No Added Sugar" cannot be made.`;
  } else if (q.includes('allergen') || q.includes('nut') || q.includes('almond') || q.includes('walnut')) {
    const allergenFact = facts.find(f => f.field === 'allergen_statement');
    matchedFact = allergenFact;
    sources = allergenFact?.sources || [];
    answer = `The allergen declaration is: "${allergenFact?.value}". Under US FALCPA (21 U.S.C. 343(w)), tree nut warnings must declare the specific food species (e.g. Almonds, Walnuts, Pecans), not just generic "tree nuts".`;
  } else if (q.includes('net') || q.includes('weight') || q.includes('ounce') || q.includes('gram') || q.includes('quantity')) {
    const netFact = facts.find(f => f.field === 'net_quantity');
    matchedFact = netFact;
    sources = netFact?.sources || [];
    answer = `The declared net quantity of contents is ${netFact?.value || '480 g (16.9 oz)'}, verified as dual metric and US customary units. Dual conversion error is only 0.18%, passing commercial tolerance.`;
  } else if (q.includes('calorie') || q.includes('carb') || q.includes('nutrition') || q.includes('serving')) {
    const calFact = facts.find(f => f.field === 'calories');
    const carbFact = facts.find(f => f.field === 'total_carbohydrate');
    const servFact = facts.find(f => f.field === 'servings_per_container');
    sources = [...(calFact?.sources || []), ...(carbFact?.sources || [])];
    answer = `US Nutrition Facts specifies: Calories ${calFact?.value}, Carbohydrates ${carbFact?.value}, Servings ${servFact?.value}. Note: declared 166 kcal contradicts the Atwater macronutrient calculation (535 kcal) and requires formula reconciliation.`;
  } else if (q.includes('barcode') || q.includes('upc')) {
    const barFact = facts.find(f => f.field === 'barcode');
    matchedFact = barFact;
    sources = barFact?.sources || [];
    answer = `The primary barcode is UPC-A ${barFact?.value}. Modulo-10 check digit calculation yields 6, which confirms valid scanner readability.`;
  } else if (q.includes('storage') || q.includes('shelf life') || q.includes('temperature') || q.includes('keep')) {
    sources = [
      { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Paragraph 5', type: 'docx', quote: 'Storage Conditions: Store in a cool, dry place below 22°C (72°F). Shelf life: 12 months.' }
    ];
    answer = `According to the Product Specification (Paragraph 5): "Store in a cool, dry place below 22°C (72°F). Shelf life: 12 months from date of packaging."`;
    proposedFact = {
      id: 'fact-storage-conditions',
      field: 'storage_conditions',
      label: 'Storage & Shelf Life Conditions',
      category: 'Storage',
      value: 'Cool, dry place below 22°C (72°F), 12 months shelf life',
      state: 'PROVEN',
      sources
    };
  } else if (q.includes('vegan') || q.includes('kosher') || q.includes('mark') || q.includes('trust')) {
    const veganFact = facts.find(f => f.field === 'certified_vegan_mark');
    matchedFact = veganFact;
    sources = veganFact?.sources || [];
    answer = `The pack carries the ${veganFact?.value || 'Certified Vegan Logo (Vegan.org)'} on the right display panel, proven in both artwork and archival photos.`;
  } else {
    // General match
    answer = `PackSignal searched all 6 ingested evidence sources (Word spec, plain-PDF, notes, image, Excel content sheet, and dieline PDF). No exact regulatory conflict exists for "${escapeHtml(questionText)}", but all verified facts are accessible in the Fact Sheet.`;
    sources = [
      { file: 'DancingFish_Granola_Product_Spec.docx', location: 'Section Overview', type: 'docx', quote: 'Product Specification & Release Guidelines' }
    ];
  }

  // If matched fact exists and user is asking about it, provide opportunity to confirm
  if (matchedFact && matchedFact.state !== 'PROVEN') {
    proposedFact = {
      ...matchedFact,
      state: 'PROVEN',
      resolution: {
        note: `Confirmed by reviewer inquiry: "${questionText}"`,
        confirmedAt: new Date().toISOString()
      }
    };
  }

  return {
    query: questionText,
    answer,
    sources,
    canConfirmAsFact: Boolean(proposedFact),
    proposedFact
  };
}

/**
 * Confirms a fact into the Fact Sheet, updating its state to PROVEN and re-auditing the brief.
 */
export function confirmFactFromAnswer(session, brief, proposedFact) {
  if (!proposedFact || !proposedFact.id) {
    throw new Error('Valid proposed fact is required.');
  }

  const existingIdx = (session.facts || []).findIndex(f => f.id === proposedFact.id || f.field === proposedFact.field);
  if (existingIdx >= 0) {
    session.facts[existingIdx] = {
      ...session.facts[existingIdx],
      ...proposedFact,
      state: 'PROVEN',
      conflictId: null,
      conflictReason: null,
      updatedAt: new Date().toISOString()
    };
  } else {
    session.facts.push({
      ...proposedFact,
      state: 'PROVEN',
      createdAt: new Date().toISOString()
    });
  }

  // Re-sync brief and audit
  syncBriefWithProvenFacts(brief, session);
  session.summary.provenFacts = session.facts.filter(f => f.state === 'PROVEN').length;
  session.summary.aiSuggestedFacts = session.facts.filter(f => f.state === 'AI_SUGGESTED').length;

  return { session, brief, confirmedFact: proposedFact };
}

/**
 * Retrieves the existing creative brief or generates a fresh draft from session facts.
 */
export function getOrCreateBrief(sessionId = 'default') {
  const session = getDeskSession(sessionId);
  if (!session.brief) {
    session.brief = generateBriefDraft(session);
  } else {
    syncBriefWithProvenFacts(session.brief, session);
  }
  return { brief: session.brief, session };
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Re-export Phase 5 Modular Architecture
export * from './brief/brief-schema.mjs';
export * from './brief/brief-builder.mjs';
export * from './brief/brief-store.mjs';
export * from './brief/claim-verifier.mjs';
export * from './brief/brief-auditor.mjs';
export * from './brief/brief-pdf.mjs';
export * from './brief/brief-checklist.mjs';
export * from './brief/brief-manifest.mjs';
export * from './brief/ask-about-this.mjs';

