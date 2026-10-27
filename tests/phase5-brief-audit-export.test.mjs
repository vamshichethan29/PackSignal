/**
 * @file tests/phase5-brief-audit-export.test.mjs
 * 
 * Comprehensive tests for Phase 5 — Creative Brief, Compliance Audit,
 * Approval Gate, PDF/Checklist Export, and "Ask about this" Side Panel.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeskSession,
  resetDeskSession,
  resolveDeskConflict,
  answerDeskQuestion
} from '../lib/evidence-desk.mjs';
import {
  generateBriefDraft,
  auditBrief,
  updateBriefSentence,
  syncBriefWithProvenFacts,
  approveBrief,
  generateBriefChecklist,
  generateBriefPdfHtml,
  askAboutThis,
  confirmFactFromAnswer,
  getOrCreateBrief
} from '../lib/creative-brief.mjs';

describe('Phase 5 — Creative Brief, Audit, Approval and Export', () => {

  test('AI Draft generator constructs packaging brief with sentence-level fact IDs', () => {
    const session = resetDeskSession('test-phase5-draft');
    const brief = generateBriefDraft(session);

    assert.ok(brief.briefId, 'Brief must have an ID');
    assert.strictEqual(brief.status, 'DRAFT', 'Initial status is DRAFT');
    assert.strictEqual(brief.sections.length, 8, 'Brief must have 8 standard packaging sections');

    // Every section must contain sentences
    for (const sec of brief.sections) {
      assert.ok(sec.title, 'Section must have title');
      assert.ok(Array.isArray(sec.sentences) && sec.sentences.length > 0, `Section ${sec.id} must have sentences`);
      
      // Every sentence carries factIds
      for (const sent of sec.sentences) {
        assert.ok(sent.id, 'Sentence must have unique id');
        assert.ok(typeof sent.text === 'string' && sent.text.length > 0, 'Sentence text must be non-empty');
        assert.ok(Array.isArray(sent.factIds), 'Sentence must carry an array of factIds');
        assert.ok(Array.isArray(sent.extractedNumbers), 'Extracted numbers must be an array');
        assert.ok(Array.isArray(sent.extractedClaims), 'Extracted claims must be an array');
      }
    }

    // Check specific identity sentence linking
    const identitySec = brief.sections.find(s => s.id === 'section-identity');
    assert.ok(identitySec.sentences[0].factIds.includes('fact-product-name'), 'Identity sentence must link to fact-product-name');
  });

  test('Compliance Audit engine rejects unproven numbers and claims in initial draft', () => {
    const session = resetDeskSession('test-phase5-audit');
    const brief = generateBriefDraft(session);

    const audit = auditBrief(brief, session);
    assert.ok(audit, 'Audit result must be returned');
    assert.strictEqual(audit.isApprovable, false, 'Initial brief with open conflicts cannot be approved');
    assert.ok(audit.unprovenSentences > 0, 'Must have unproven sentences due to conflicts and AI-suggested facts');
    assert.ok(audit.issues.length > 0, 'Audit must record issues');

    // Honey conflict must be caught
    const honeyIssue = audit.issues.find(i => i.type === 'UNPROVEN_NUMBER_CONFLICT');
    assert.ok(honeyIssue, 'Must flag sentence linked to Honey conflict');
    assert.match(honeyIssue.message, /CONFLICT/i);

    // AI-suggested calories / servings / allergens must be caught
    const unprovenClaimOrNumber = audit.issues.find(i => i.type === 'UNPROVEN_NUMBER_OR_CLAIM');
    assert.ok(unprovenClaimOrNumber, 'Must flag unproven AI_SUGGESTED elements');
  });

  test('Sentence editing allows refining text and linking fact IDs', () => {
    const session = resetDeskSession('test-phase5-edit');
    const brief = generateBriefDraft(session);

    const initialSent = brief.sections[0].sentences[0];
    const updateResult = updateBriefSentence(brief, session, {
      sectionId: 'section-identity',
      sentenceId: initialSent.id,
      text: 'The master product identity is designated as Dancing Fish Berry Crunch Granola (US SKU).',
      factIds: ['fact-product-name']
    });

    assert.strictEqual(updateResult.sentence.text, 'The master product identity is designated as Dancing Fish Berry Crunch Granola (US SKU).');
    assert.deepStrictEqual(updateResult.sentence.factIds, ['fact-product-name']);
    assert.ok(brief.audit, 'Audit must re-run automatically after sentence update');
  });

  test('Resolving conflicts and answering questions drives unproven sentences to ZERO', () => {
    const session = resetDeskSession('test-phase5-zero-defect');
    const brief = generateBriefDraft(session);

    // 1. Resolve all 3 conflicts
    resolveDeskConflict('test-phase5-zero-defect', {
      conflictId: 'CONFLICT-HONEY-CONTENT',
      chosenValue: '9%',
      chosenSource: 'Specification Sheet (Cell B26)',
      note: 'Master formula specifies 9% clover honey'
    });

    resolveDeskConflict('test-phase5-zero-defect', {
      conflictId: 'CONFLICT-TOTAL-CARBOHYDRATE',
      chosenValue: '66 g',
      chosenSource: 'US NFP Panel (Carton Artwork)',
      note: 'Verified 66 g total carbs per serving'
    });

    resolveDeskConflict('test-phase5-zero-defect', {
      conflictId: 'CONFLICT-INGREDIENT-LIST',
      chosenValue: 'Whole grain rolled oats, honey (9%), sunflower oil, berries, almonds',
      chosenSource: 'Approved Specification',
      note: 'Reverted formulation to approved spec'
    });

    // 2. Answer all relevant questions to transition facts to PROVEN
    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-ADDED-SUGARS',
      answerId: 'opt-remove-claim',
      answerValue: 'Remove the "No Added Sugar" claim from the front panel'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-TREE-NUTS',
      answerId: 'opt-specific-nuts',
      answerValue: 'Contains Almonds. May contain Walnuts and Pecans.'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-SERVING-SIZE-MATH',
      answerId: 'opt-fix-servings',
      answerValue: 'About 9 servings (55 g serving size)'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-CALORIE-MATH',
      answerId: 'opt-atwater-recalc',
      answerValue: '240 kcal per serving'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-DAILY-VALUES',
      answerId: 'opt-recalc-all-dv',
      answerValue: 'FDA 2016 Daily Values recalculated'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-BRAND-LOGO',
      answerId: 'opt-keep-logo',
      answerValue: 'Keep leaping fish logo exactly as designed'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-BRAND-PHOTO',
      answerId: 'opt-keep-photo',
      answerValue: 'Keep current product photography assets'
    });

    answerDeskQuestion('test-phase5-zero-defect', {
      questionId: 'Q-BRAND-COLOURS',
      answerId: 'opt-keep-colours',
      answerValue: 'Keep Midnight Navy & Coral palette'
    });

    // Sync brief with the newly proven facts
    syncBriefWithProvenFacts(brief, session);

    // Audit must pass 100% with ZERO unproven sentences
    const audit = auditBrief(brief, session);
    assert.strictEqual(audit.unprovenSentences, 0, `Expected 0 unproven sentences, but got ${audit.unprovenSentences}. Issues: ${JSON.stringify(audit.issues)}`);
    assert.strictEqual(audit.complianceScore, 100, 'Compliance score must be 100%');
    assert.strictEqual(audit.isApprovable, true, 'Brief must be marked approvable');
  });

  test('Approval Gate rejects unproven brief and approves zero-defect brief with cryptographic seal', () => {
    const session = resetDeskSession('test-phase5-approval');
    const brief = generateBriefDraft(session);

    // Initial brief has unproven sentences -> must throw error on approval
    assert.throws(() => {
      approveBrief(brief, session);
    }, /Cannot approve brief/i);

    // Resolve facts to drive unproven sentences to 0
    for (const f of session.facts) {
      f.state = 'PROVEN';
      f.conflictId = null;
    }
    syncBriefWithProvenFacts(brief, session);

    // Approve should succeed
    const approved = approveBrief(brief, session, {
      name: 'Dr. Jane Smith',
      role: 'Head of Regulatory Affairs',
      org: 'PackSignal Compliance'
    });

    assert.strictEqual(approved.status, 'APPROVED');
    assert.ok(approved.approval, 'Approval metadata must be attached');
    assert.strictEqual(approved.approval.approvedBy, 'Dr. Jane Smith');
    assert.ok(approved.approval.auditChecksum, 'Must produce SHA-256 audit checksum');
    assert.match(approved.approval.provenanceSeal, /^SEAL-PACKSIGNAL-/);
  });

  test('Preflight Checklist export generates complete production inspection items', () => {
    const session = resetDeskSession('test-phase5-checklist');
    const brief = generateBriefDraft(session);
    for (const f of session.facts) {
      f.state = 'PROVEN';
      f.conflictId = null;
    }
    syncBriefWithProvenFacts(brief, session);

    const checklist = generateBriefChecklist(brief, session);
    assert.ok(checklist.items.length > 0, 'Checklist must contain verification items');
    assert.strictEqual(checklist.failedChecks, 0, 'Zero failed checks for proven brief');
    assert.strictEqual(checklist.passedChecks, checklist.totalChecks);

    const sampleItem = checklist.items[0];
    assert.ok(sampleItem.id);
    assert.ok(sampleItem.section);
    assert.ok(sampleItem.statement);
    assert.strictEqual(sampleItem.status, 'PASS');
    assert.ok(sampleItem.facts[0].primarySource, 'Must include provenance source link');
  });

  test('PDF Export produces valid print-ready HTML with provenance badges and approval seal', () => {
    const session = resetDeskSession('test-phase5-pdf');
    const brief = generateBriefDraft(session);
    for (const f of session.facts) {
      f.state = 'PROVEN';
      f.conflictId = null;
    }
    syncBriefWithProvenFacts(brief, session);
    approveBrief(brief, session);

    const html = generateBriefPdfHtml(brief, session);
    assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce HTML5 document');
    assert.ok(html.includes('APPROVED PACKAGING SPECIFICATION BRIEF'), 'Must display approval heading');
    assert.ok(html.includes('SEAL-PACKSIGNAL-'), 'Must embed provenance seal');
    assert.ok(html.includes('pdf-fact-tag proven'), 'Must render proven fact tags');
  });

  test('"Ask about this" answers queries from facts and allows confirming answers into PROVEN facts', () => {
    const session = resetDeskSession('test-phase5-ask');
    const { brief } = getOrCreateBrief('test-phase5-ask');

    // Query 1: Ask about Honey
    const qHoney = askAboutThis('What is the honey percentage and added sugar claim status?', session);
    assert.ok(qHoney.answer.includes('honey'), 'Answer must mention honey');
    assert.ok(qHoney.sources.length > 0, 'Must cite sources');

    // Query 2: Ask about Storage conditions (which proposes a new fact)
    const qStorage = askAboutThis('What are the storage conditions and shelf life?', session);
    assert.ok(qStorage.answer.includes('below 22°C'), 'Answer must quote storage temperature');
    assert.ok(qStorage.canConfirmAsFact, 'Must offer confirm as fact capability');
    assert.strictEqual(qStorage.proposedFact.field, 'storage_conditions');

    // Confirm the fact into the Fact Sheet
    const confirmResult = confirmFactFromAnswer(session, brief, qStorage.proposedFact);
    assert.strictEqual(confirmResult.confirmedFact.state, 'PROVEN');
    
    // Fact must now exist in session as PROVEN
    const savedFact = session.facts.find(f => f.field === 'storage_conditions');
    assert.ok(savedFact, 'Saved fact must exist in Fact Sheet');
    assert.strictEqual(savedFact.state, 'PROVEN');
  });

  test('Full Milestone: upload to approved brief with zero unproven sentences', () => {
    // 1. Session start with multi-source samples loaded
    const session = resetDeskSession('test-phase5-e2e-milestone');
    assert.strictEqual(session.files.length, 6, 'All 6 format sources loaded');
    
    // 2. Initial brief has unproven statements
    const { brief } = getOrCreateBrief('test-phase5-e2e-milestone');
    assert.strictEqual(brief.audit.isApprovable, false);

    // 3. User resolves conflicts in the Evidence Desk
    resolveDeskConflict('test-phase5-e2e-milestone', {
      conflictId: 'CONFLICT-HONEY-CONTENT',
      chosenValue: '9%',
      chosenSource: 'Product Spec & Content Sheet'
    });
    resolveDeskConflict('test-phase5-e2e-milestone', {
      conflictId: 'CONFLICT-TOTAL-CARBOHYDRATE',
      chosenValue: '66 g',
      chosenSource: 'Carton NFP'
    });
    resolveDeskConflict('test-phase5-e2e-milestone', {
      conflictId: 'CONFLICT-INGREDIENT-LIST',
      chosenValue: 'Whole grain rolled oats, honey (9%), sunflower oil, berries, almonds',
      chosenSource: 'Specification'
    });

    // 4. User answers the ranked questions
    for (const q of session.questions) {
      const opt = q.options[0];
      answerDeskQuestion('test-phase5-e2e-milestone', {
        questionId: q.id,
        answerId: opt.id,
        answerValue: opt.label
      });
    }

    // 5. User asks about storage conditions and confirms it
    const askRes = askAboutThis('storage conditions', session);
    confirmFactFromAnswer(session, brief, askRes.proposedFact);

    // 6. User re-audits the brief
    syncBriefWithProvenFacts(brief, session);
    const audit = auditBrief(brief, session);

    // 7. Verify zero unproven sentences and approval
    assert.strictEqual(audit.unprovenSentences, 0, 'Zero unproven sentences achieved');
    assert.strictEqual(audit.isApprovable, true, 'Brief is 100% approvable');

    const approvedBrief = approveBrief(brief, session, {
      name: 'Vamshi Chethan',
      role: 'Packaging System Lead'
    });

    assert.strictEqual(approvedBrief.status, 'APPROVED');
    assert.ok(approvedBrief.approval.auditChecksum);
    assert.ok(approvedBrief.approval.provenanceSeal);
  });

});
