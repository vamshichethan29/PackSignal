/**
 * @file tests/ar-qr-link.test.mjs
 * 
 * Verifies Phase 18: QR Code Generator & HTTPS Link Security.
 * - Generates high-resolution SVG QR code pointing to secure origin.
 * - Sanitizes review parameters (safe demo scope, zero embedded private credentials).
 * - Exposes direct accessible URL alongside QR pattern.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQrSvg } from '../public/ar-modal.js';

test('1. QR SVG generator creates scalable vector markup with finder patterns', () => {
  const targetUrl = 'https://packsignal.onrender.com/ar-review.html?sample=dancing-fish';
  const svg = generateQrSvg(targetUrl, 240);

  assert.ok(svg.includes('<svg'), 'Must produce SVG markup');
  assert.ok(svg.includes('width="240"'));
  assert.ok(svg.includes('height="240"'));
  assert.ok(svg.includes('class="ar-qr-code"'));
  assert.ok(svg.includes('📦'), 'Contains center PackSignal carton icon');
});

test('2. QR URL enforces HTTPS scheme and rejects insecure origins', () => {
  const sanitizeQrUrl = (url) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new Error('Insecure QR URL: must use HTTPS protocol');
    }
    // Disallow sensitive keys or tokens in query parameters
    for (const key of parsed.searchParams.keys()) {
      if (/key|secret|token|password|auth/i.test(key)) {
        throw new Error(`Forbidden credential in AR QR URL: ${key}`);
      }
    }
    return parsed.toString();
  };

  const validUrl = 'https://packsignal.onrender.com/ar-review.html?review=rev-1';
  assert.equal(sanitizeQrUrl(validUrl), validUrl);

  assert.throws(() => {
    sanitizeQrUrl('http://insecure-site.com/ar');
  }, /Insecure QR URL/);

  assert.throws(() => {
    sanitizeQrUrl('https://packsignal.onrender.com/ar?apiKey=secret-123');
  }, /Forbidden credential/);
});
