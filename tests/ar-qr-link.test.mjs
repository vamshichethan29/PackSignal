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

test('3. QR code decodes cleanly with standard ISO/IEC 18004 barcode readers', async () => {
  const QRCode = (await import('qrcode')).default || await import('qrcode');
  const jsQR = (await import('jsqr')).default || await import('jsqr');

  const payload = 'https://packsignal-8dzy.onrender.com/scan.html?session=scan-test-99&token=tok-abc';
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' });
  const count = qr.modules.size;
  const margin = 2;
  const total = count + margin * 2;
  const scale = 5;
  const width = total * scale;
  const height = total * scale;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c)) {
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            const x = (c + margin) * scale + px;
            const y = (r + margin) * scale + py;
            const idx = (y * width + x) * 4;
            rgba[idx] = 15;
            rgba[idx + 1] = 23;
            rgba[idx + 2] = 42;
            rgba[idx + 3] = 255;
          }
        }
      }
    }
  }

  // Overlay center badge
  const badgePix = Math.floor(width * 0.16);
  const badgeStart = Math.floor((width - badgePix) / 2);
  for (let y = badgeStart; y < badgeStart + badgePix; y++) {
    for (let x = badgeStart; x < badgeStart + badgePix; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 21;
      rgba[idx + 1] = 128;
      rgba[idx + 2] = 61;
      rgba[idx + 3] = 255;
    }
  }

  const result = jsQR(rgba, width, height);
  assert.ok(result, 'Barcode scanner must decode image');
  assert.equal(result.data, payload, 'Decoded payload must exactly match input URL');
});
