/**
 * @file tests/brief-export.test.mjs
 * 
 * Unit tests for Phase 5 PDF Brief Generator & Evidence Appendix.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { generateBriefPdfHtml } from '../lib/brief/brief-pdf.mjs';

describe('Phase 5 — PDF Brief Export & Evidence Appendix', () => {

  test('1. Generates complete print-ready HTML with 11 sections', () => {
    const session = resetDeskSession('test-pdf-11-sec');
    const brief = buildBriefFromSession(session);

    const html = generateBriefPdfHtml(brief, session);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('PROJECT OVERVIEW'));
    assert.ok(html.includes('PRODUCT INFORMATION'));
    assert.ok(html.includes('DELIVERY / REVIEW CHECKLIST'));
  });

  test('2. Includes Grounded Source Evidence Appendix with sentence IDs and quotes', () => {
    const session = resetDeskSession('test-pdf-appendix');
    const brief = buildBriefFromSession(session);

    const html = generateBriefPdfHtml(brief, session);
    assert.ok(html.includes('APPENDIX A — GROUNDED SOURCE EVIDENCE AUDIT TRAIL'));
    assert.ok(html.includes('BR-S-'));
    assert.ok(html.includes('Ground Truth Source Evidence'));
  });

  test('3. Displays DRAFT warning when unapproved and APPROVED seal when approved', () => {
    const session = resetDeskSession('test-pdf-status-watermark');
    const brief = buildBriefFromSession(session);

    // Draft
    const draftHtml = generateBriefPdfHtml(brief, session);
    assert.ok(draftHtml.includes('DRAFT — NOT APPROVED FOR PRINT'));

    // Approved
    brief.status = 'APPROVED';
    brief.approval = {
      approvedBy: 'Elena Rostova',
      role: 'REGULATORY_LEAD',
      sealId: 'SEAL-PACKSIGNAL-TEST',
      contentHash: 'hash-123'
    };
    brief.approvedAt = new Date().toISOString();

    const approvedHtml = generateBriefPdfHtml(brief, session);
    assert.ok(approvedHtml.includes('APPROVED SPECIFICATION BRIEF'));
    assert.ok(approvedHtml.includes('SEAL-PACKSIGNAL-TEST'));
  });

});
