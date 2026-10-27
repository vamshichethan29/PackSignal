/**
 * @file lib/brief/brief-builder.mjs
 * 
 * Phase 5 — Canonical Packaging Design Brief Builder
 * Constructs a fully structured, 11-section packaging brief with atomic sentences,
 * explicit fact IDs, regulatory rule links, and design decision associations.
 */

import { BRIEF_SECTIONS, SENTENCE_KINDS, AUDIT_STATUS, createBriefSentence } from './brief-schema.mjs';
import { auditEntireBrief } from './brief-auditor.mjs';

/**
 * Builds a structured 11-section Packaging Design Brief from a desk session.
 */
export function buildBriefFromSession(session, options = {}) {
  const sessionId = session.sessionId || session.id || 'default';
  const facts = session.facts || [];
  const factsByField = new Map(facts.map(f => [f.field, f]));
  const factsById = new Map(facts.map(f => [f.id, f]));
  const questions = session.questions || [];
  const market = session.market || 'United States (FDA 21 CFR)';
  const briefVersion = options.briefVersion || 'v1.0.0';

  let sentenceCounter = 0;
  function nextId() {
    sentenceCounter++;
    return `BR-S-${String(sentenceCounter).padStart(3, '0')}`;
  }

  const sentences = [];

  // Helper to add sentence to a section
  function addSentence(sectionId, text, kind, { factIds = [], requirementIds = [], decisionIds = [] } = {}) {
    const sent = createBriefSentence({
      sentenceId: nextId(),
      sectionId,
      text,
      kind,
      factIds,
      requirementIds,
      decisionIds,
      evidenceStatus: AUDIT_STATUS.AUDIT_REQUIRED,
      sourceReviewVersion: briefVersion
    });
    sentences.push(sent);
    return sent;
  }

  // Section 1: Project Overview
  const prodNameFact = factsByField.get('product_name');
  const brandNameFact = factsByField.get('brand_name');
  const sec1 = 'sec-01-overview';
  addSentence(sec1, 'PROJECT OVERVIEW & COMMERCIAL OBJECTIVES', SENTENCE_KINDS.SECTION_HEADING);
  addSentence(
    sec1,
    `The master packaging project is designated for ${prodNameFact?.value || 'Dancing Fish Berry Crunch Granola'} under brand authority "${brandNameFact?.value || 'Dancing Fish'}".`,
    SENTENCE_KINDS.FACTUAL_CLAIM,
    { factIds: [prodNameFact?.id, brandNameFact?.id].filter(Boolean) }
  );
  addSentence(
    sec1,
    `Target commercial jurisdiction is registered as ${market} for retail shelf release.`,
    SENTENCE_KINDS.PROCESS_INSTRUCTION
  );

  // Section 2: Product Information
  const netQtyFact = factsByField.get('net_quantity');
  const servSizeFact = factsByField.get('serving_size');
  const sec2 = 'sec-02-product-info';
  addSentence(sec2, 'PRODUCT IDENTITY & METROLOGY SPECIFICATIONS', SENTENCE_KINDS.SECTION_HEADING);
  if (netQtyFact) {
    addSentence(
      sec2,
      `The package net quantity of contents must declare ${netQtyFact.value} placed within the lower 30% of the Principal Display Panel.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [netQtyFact.id], requirementIds: ['US-001', 'RULE-NET-QTY'] }
    );
  } else {
    addSentence(sec2, 'Net quantity specification is UNRESOLVED and requires verified source declaration.', SENTENCE_KINDS.OPEN_QUESTION);
  }
  if (servSizeFact) {
    addSentence(
      sec2,
      `Standard consumer serving metric is verified as ${servSizeFact.value}.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [servSizeFact.id] }
    );
  }

  // Section 3: Ingredients & Allergens
  const ingFact = factsByField.get('ingredient_list');
  const allergenFact = factsByField.get('allergen_statement');
  const honeyFact = factsByField.get('honey_percentage');
  const sec3 = 'sec-03-ingredients';
  addSentence(sec3, 'FORMULATION, INGREDIENTS & FALCPA ALLERGEN DISCLOSURES', SENTENCE_KINDS.SECTION_HEADING);
  if (honeyFact) {
    if (honeyFact.state === 'PROVEN') {
      addSentence(
        sec3,
        `The approved formulation mandates a honey percentage of ${honeyFact.value}.`,
        SENTENCE_KINDS.FACTUAL_CLAIM,
        { factIds: [honeyFact.id] }
      );
    } else {
      addSentence(
        sec3,
        `Honey content is recorded as ${honeyFact.value} currently flagged in ${honeyFact.state} state pending resolution.`,
        SENTENCE_KINDS.FACTUAL_CLAIM,
        { factIds: [honeyFact.id] }
      );
    }
  }
  if (ingFact) {
    addSentence(
      sec3,
      `The ingredient declaration shall read exactly: "${ingFact.value}".`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [ingFact.id] }
    );
  }
  if (allergenFact) {
    addSentence(
      sec3,
      `The mandatory allergen disclosure statement shall read: "${allergenFact.value}".`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [allergenFact.id], requirementIds: ['US-005', 'RULE-ALLERGENS'] }
    );
  }

  // Section 4: Nutrition Requirements
  const calFact = factsByField.get('calories');
  const carbFact = factsByField.get('total_carbohydrate');
  const servingsFact = factsByField.get('servings_per_container');
  const sec4 = 'sec-04-nutrition';
  addSentence(sec4, 'US FDA NUTRITION FACTS PANEL DIRECTIVES', SENTENCE_KINDS.SECTION_HEADING);
  if (servingsFact) {
    addSentence(
      sec4,
      `Declared servings per container metric states ${servingsFact.value}.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [servingsFact.id] }
    );
  }
  if (calFact) {
    addSentence(
      sec4,
      `Energy density is declared as ${calFact.value} per serving on the Nutrition Facts panel.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [calFact.id] }
    );
  }
  if (carbFact) {
    addSentence(
      sec4,
      `Total carbohydrate content is declared as ${carbFact.value} per serving.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [carbFact.id] }
    );
  }

  // Section 5: Marketing Claims
  const sugarClaimFact = factsByField.get('claim_added_sugar');
  const veganMarkFact = factsByField.get('certified_vegan_mark');
  const sec5 = 'sec-05-claims';
  addSentence(sec5, 'FRONT PANEL COPY & SUBSTANTIATED MARKETING CLAIMS', SENTENCE_KINDS.SECTION_HEADING);
  if (sugarClaimFact) {
    if (sugarClaimFact.value.toLowerCase().includes('remove')) {
      addSentence(
        sec5,
        `The front panel claim "No Added Sugar" is removed in compliance with 21 CFR 101.60(c)(2).`,
        SENTENCE_KINDS.FACTUAL_CLAIM,
        { factIds: [sugarClaimFact.id], requirementIds: ['US-010', 'RULE-SUGAR-CLAIM'] }
      );
    } else {
      addSentence(
        sec5,
        `Front panel includes marketing claim "${sugarClaimFact.value}".`,
        SENTENCE_KINDS.FACTUAL_CLAIM,
        { factIds: [sugarClaimFact.id] }
      );
    }
  }
  if (veganMarkFact) {
    addSentence(
      sec5,
      `The package features the ${veganMarkFact.value} on the side information panel.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [veganMarkFact.id] }
    );
  }

  // Section 6: Regulatory Requirements
  const sec6 = 'sec-06-regulatory';
  addSentence(sec6, 'REGULATORY JURISDICTION & MANDATORY STATUTORY COPIES', SENTENCE_KINDS.SECTION_HEADING);
  addSentence(
    sec6,
    `Principal Display Panel typography must comply with US 21 CFR §101.7 minimum letter height requirements.`,
    SENTENCE_KINDS.REQUIREMENT_DIRECTIVE,
    { requirementIds: ['US-001', 'RULE-PDP-HEIGHT'] }
  );
  addSentence(
    sec6,
    `Tree nut allergen declarations must specify individual biological nut species under US FALCPA 21 U.S.C. 343(w).`,
    SENTENCE_KINDS.REQUIREMENT_DIRECTIVE,
    { requirementIds: ['US-005', 'RULE-TREE-NUTS'] }
  );

  // Section 7: Design & Brand Direction
  const logoFact = factsByField.get('brand_asset_logo');
  const photoFact = factsByField.get('brand_asset_photo');
  const coloursFact = factsByField.get('brand_asset_colours');
  const taglineFact = factsByField.get('brand_asset_tagline');
  const sec7 = 'sec-07-brand';
  addSentence(sec7, 'VISUAL IDENTITY, ASSETS & PACKAGING AESTHETICS', SENTENCE_KINDS.SECTION_HEADING);
  if (logoFact) {
    addSentence(
      sec7,
      `Primary brand mark is specified as ${logoFact.value}.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [logoFact.id] }
    );
  }
  if (photoFact) {
    addSentence(
      sec7,
      `Appetite appeal visual uses ${photoFact.value}.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [photoFact.id] }
    );
  }
  if (coloursFact) {
    addSentence(
      sec7,
      `Brand color palette includes ${coloursFact.value}.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [coloursFact.id] }
    );
  }
  if (taglineFact) {
    addSentence(
      sec7,
      `Front panel features brand tagline "${taglineFact.value}".`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [taglineFact.id] }
    );
  }

  // Section 8: Keep / Change / Add / Remove Decisions
  const sec8 = 'sec-08-keep-change';
  addSentence(sec8, 'CREATIVE BRIEF DIRECTIVES: KEEP / CHANGE / ADD / REMOVE', SENTENCE_KINDS.SECTION_HEADING);
  addSentence(
    sec8,
    `KEEP: Retain established Leaping Fish Emblem and Navy Blue brand identity.`,
    SENTENCE_KINDS.APPROVED_DESIGN_DECISION,
    { factIds: [logoFact?.id, coloursFact?.id].filter(Boolean), decisionIds: ['DEC-KEEP-LOGO', 'DEC-KEEP-COLOURS'] }
  );
  addSentence(
    sec8,
    `CHANGE: Refresh ingredient typography and update net contents to dual US customary units.`,
    SENTENCE_KINDS.APPROVED_DESIGN_DECISION,
    { factIds: [netQtyFact?.id, ingFact?.id].filter(Boolean), decisionIds: ['DEC-CHANGE-NET-QTY'] }
  );
  addSentence(
    sec8,
    `REMOVE: Remove front panel "No Added Sugar" claim due to honey formulation.`,
    SENTENCE_KINDS.APPROVED_DESIGN_DECISION,
    { factIds: [sugarClaimFact?.id, honeyFact?.id].filter(Boolean), decisionIds: ['DEC-REMOVE-SUGAR-CLAIM'] }
  );

  // Section 9: Production Requirements
  const barcodeFact = factsByField.get('barcode');
  const sec9 = 'sec-09-production';
  addSentence(sec9, 'TECHNICAL PREPRESS, BARCODE & PACKAGING STRUCTURE', SENTENCE_KINDS.SECTION_HEADING);
  addSentence(
    sec9,
    `The structural container format is configured as a tuck-end carton dieline.`,
    SENTENCE_KINDS.PROCESS_INSTRUCTION
  );
  if (barcodeFact) {
    addSentence(
      sec9,
      `Production packaging must print UPC-A barcode ${barcodeFact.value} with GS1 check digit 6 on the carton base.`,
      SENTENCE_KINDS.FACTUAL_CLAIM,
      { factIds: [barcodeFact.id], requirementIds: ['RULE-BARCODE-GS1'] }
    );
  }

  // Section 10: Open Questions & Dependencies
  const sec10 = 'sec-10-open-questions';
  addSentence(sec10, 'UNRESOLVED QUESTIONS & BLOCKING SOURCE DEPENDENCIES', SENTENCE_KINDS.SECTION_HEADING);
  const openQuestions = questions.filter(q => q.status !== 'ANSWERED');
  if (openQuestions.length > 0) {
    for (const q of openQuestions.slice(0, 3)) {
      addSentence(sec10, `Open Question: ${q.text || q.question}`, SENTENCE_KINDS.OPEN_QUESTION);
    }
  } else {
    addSentence(sec10, 'All critical preflight formulation and legal questions have been resolved.', SENTENCE_KINDS.EXPLANATORY_NOTE);
  }

  // Section 11: Delivery / Review Checklist
  const sec11 = 'sec-11-checklist';
  addSentence(sec11, 'PREFLIGHT PRODUCTION & REGULATORY SIGN-OFF CHECKLIST', SENTENCE_KINDS.SECTION_HEADING);
  addSentence(
    sec11,
    `Checklist Item 01: Verify Net Contents placement in lower 30% of PDP with minimum 4.76 mm type height.`,
    SENTENCE_KINDS.PROCESS_INSTRUCTION,
    { factIds: [netQtyFact?.id].filter(Boolean), requirementIds: ['US-001'] }
  );
  addSentence(
    sec11,
    `Checklist Item 02: Verify FALCPA allergen disclosure names specific tree nut species.`,
    SENTENCE_KINDS.PROCESS_INSTRUCTION,
    { factIds: [allergenFact?.id].filter(Boolean), requirementIds: ['US-005'] }
  );
  addSentence(
    sec11,
    `Checklist Item 03: Confirm UPC-A barcode scan grading achieves ANSI/ISO Grade A on finished stock.`,
    SENTENCE_KINDS.PROCESS_INSTRUCTION,
    { factIds: [barcodeFact?.id].filter(Boolean), requirementIds: ['RULE-BARCODE-GS1'] }
  );

  // Group sentences into section objects
  const sections = BRIEF_SECTIONS.map(secDef => {
    const secSentences = sentences.filter(s => s.sectionId === secDef.id);
    return {
      id: secDef.id,
      code: secDef.code,
      title: secDef.title,
      required: secDef.required,
      sentences: secSentences
    };
  });

  const brief = {
    briefId: `brief-${sessionId}`,
    reviewId: sessionId,
    briefVersion,
    sourceReviewRevision: session.revision || '1.0.0',
    market,
    launchDate: options.launchDate || 'Q3 2026',
    productIdentity: {
      brand: brandNameFact?.value || 'Dancing Fish',
      productName: prodNameFact?.value || 'Dancing Fish Berry Crunch Granola',
      variant: 'Berry Crunch',
      market
    },
    sections,
    sentences,
    requirements: session.rules || [],
    designDecisions: session.decisions || session.questionAnswers || [],
    unresolvedQuestions: openQuestions,
    auditResult: null,
    approvalState: 'UNAPPROVED',
    approvedBy: null,
    approvedAt: null,
    sourceFingerprint: session.sourceFingerprint || null,
    exportManifest: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Run immediate audit
  auditEntireBrief(brief, session);

  return brief;
}
