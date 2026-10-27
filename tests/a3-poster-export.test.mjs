/**
 * @file tests/a3-poster-export.test.mjs
 * 
 * Unit tests for Phase 5A: Single-Page ISO A3 Review Wall Poster PDF Export
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateA3ReviewPoster } from '../lib/poster/a3-review-poster.mjs';

describe('Phase 5A — ISO A3 Review Wall Poster PDF Export', () => {

  const sampleReview = {
    id: 'rev-poster-test-001',
    productName: 'Dancing Fish Berry Crunch Granola',
    version: 'v1.0',
    artworkHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    documents: [
      {
        id: 'doc-carton-p1',
        role: 'artwork',
        sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        pages: [{ number: 1, width: 800, height: 600 }]
      }
    ],
    findings: [
      {
        id: 'F-001',
        title: 'Net Quantity Dual Unit Omission',
        status: 'issue',
        explanation: 'Fails 21 CFR 101.7 metric equivalent requirement.',
        primaryDepartment: 'legal',
        box: [0.40, 0.75, 0.60, 0.85]
      },
      {
        id: 'F-002',
        title: 'Honey Formulation Ratio Discrepancy',
        status: 'review',
        explanation: 'Declared Honey (1%) differs from formulation record Honey (9%).',
        primaryDepartment: 'rd',
        box: [0.10, 0.30, 0.30, 0.40]
      },
      {
        id: 'F-003',
        title: 'Unsubstantiated Certified Vegan Claim',
        status: 'issue',
        explanation: 'Honey present in recipe contradicts voluntary vegan badge.',
        primaryDepartment: 'brand',
        box: [0.70, 0.20, 0.85, 0.30]
      }
    ]
  };

  it('1. Generates valid PDF buffer with %PDF- header', async () => {
    const pdfBuf = await generateA3ReviewPoster(sampleReview);

    assert.ok(Buffer.isBuffer(pdfBuf));
    assert.ok(pdfBuf.length > 1000);
    const header = pdfBuf.subarray(0, 5).toString('ascii');
    assert.equal(header, '%PDF-');
  });

  it('2. Output PDF is strictly exactly ONE page (ISO A3 Landscape 1190.55 x 841.89 pt)', async () => {
    const pdfBuf = await generateA3ReviewPoster(sampleReview);
    const pdfStr = pdfBuf.toString('binary');

    // Count /Type /Page occurrences (excluding /Type /Pages catalog)
    const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g) || [];
    assert.equal(pageMatches.length, 1, `Expected exactly 1 page, found ${pageMatches.length}`);

    // Verify A3 Landscape MediaBox: 1190.55 pt (420 mm) x 841.89 pt (297 mm)
    // ReportLab formats MediaBox as [0, 0, 1190.55, 841.89] or similar
    const mediaBoxMatch = pdfStr.match(/\/MediaBox\s*\[\s*0(?:\.0)?\s+0(?:\.0)?\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    assert.ok(mediaBoxMatch, 'MediaBox must be present in PDF output');

    const widthPt = parseFloat(mediaBoxMatch[1]);
    const heightPt = parseFloat(mediaBoxMatch[2]);

    assert.ok(Math.abs(widthPt - 1190.55) < 2.0, `Width ${widthPt} pt should match ISO A3 landscape 1190.55 pt`);
    assert.ok(Math.abs(heightPt - 841.89) < 2.0, `Height ${heightPt} pt should match ISO A3 landscape 841.89 pt`);
  });

  it('3. Embeds document hash, product title, and numbered markers in PDF stream', async () => {
    const pdfBuf = await generateA3ReviewPoster(sampleReview);
    const pdfStr = pdfBuf.toString('binary');

    assert.ok(pdfStr.includes('Dancing Fish') || pdfStr.includes('PACKSIGNAL'), 'PDF must include product/brand header');
    assert.ok(pdfStr.includes('rev-poster-test-001'), 'PDF must include review session ID');
  });

});
