import test from 'node:test';
import assert from 'node:assert/strict';
import { generateA3ReviewPoster } from '../lib/poster/a3-review-poster.mjs';

test('Campus A3 Poster — ISO MediaBox & Vector Markup Integrity', async () => {
  const mockReview = {
    id: 'test-a3-review',
    name: 'Dancing Fish · Berry Crunch',
    market: 'United States',
    createdAt: new Date().toISOString(),
    findings: [
      { id: 'f-1', title: 'Net Quantity Mismatch', panel: 'PDP', status: 'OPEN' },
      { id: 'f-2', title: 'Serving Basis Ambiguity', panel: 'Info Panel', status: 'RESOLVED' },
    ],
  };

  const pdfBuffer = await generateA3ReviewPoster(mockReview);
  assert.ok(Buffer.isBuffer(pdfBuffer), 'Must return PDF buffer');
  assert.ok(pdfBuffer.length > 1000, 'PDF buffer must contain vector content');

  // Check PDF header
  const pdfString = pdfBuffer.slice(0, 1024).toString('utf8');
  assert.match(pdfString, /%PDF-1\.[4-7]/, 'Must be valid PDF version');

  // Verify A3 MediaBox dimensions: 420 x 297 mm in points is approx 1190.55 x 841.89 pt (landscape)
  // or 841.89 x 1190.55 pt
  const fullPdfStr = pdfBuffer.toString('binary');
  assert.match(fullPdfStr, /MediaBox\s*\[\s*0\s+0\s+(1190|1191|841|842)/, 'Must declare A3 MediaBox dimensions');
  assert.match(fullPdfStr, /\/Count 1/, 'Must be exactly one page');
});
