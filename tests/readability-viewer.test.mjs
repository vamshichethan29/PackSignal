import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcVisualAngleArcMin,
  getReadabilityRisk,
  renderShelfReadabilityPanel,
  renderShelfReadabilityOverlayLayer,
  DISTANCE_BOUNDS,
  PRESETS
} from '../public/shelf-readability.js';

const MOCK_REVIEW = {
  id: 'rev-test-01',
  name: 'Dancing Fish Berry Crunch',
  pdpAreaSqIn: 32.0,
  vectorTypography: {
    textRuns: [
      {
        textRunId: 'tr-01',
        originalText: 'Net Wt 16 oz (454 g)',
        category: 'net_quantity',
        measuredGlyphHeightMm: 3.20,
        nominalFontSizePt: 10.0,
        boundingBox: [0.1, 0.8, 0.4, 0.9],
        page: 1
      },
      {
        textRunId: 'tr-02',
        originalText: 'Berry Crunch Granola',
        category: 'identity',
        measuredGlyphHeightMm: 8.5,
        nominalFontSizePt: 24.0,
        boundingBox: [0.1, 0.2, 0.7, 0.3],
        page: 1
      }
    ]
  }
};

test('1. calcVisualAngleArcMin computes consistent geometrical arcminutes', () => {
  const at100cm = calcVisualAngleArcMin(3.0, 100);
  const at200cm = calcVisualAngleArcMin(3.0, 200);

  assert.ok(at100cm > 0);
  assert.ok(at200cm > 0);
  assert.ok(at100cm > at200cm);
  assert.ok(Math.abs((at100cm / at200cm) - 2.0) < 0.05);
});

test('2. getReadabilityRisk handles standard, age 40+, and low vision thresholds', () => {
  // 4 arcmin: below 5 arcmin resolution threshold -> HIGH_READABILITY_RISK
  assert.equal(getReadabilityRisk(4.0, 'STANDARD_20_20'), 'HIGH_READABILITY_RISK');

  // 7 arcmin: above 5 arcmin, below 10 arcmin -> ELEVATED_READABILITY_RISK
  assert.equal(getReadabilityRisk(7.0, 'STANDARD_20_20'), 'ELEVATED_READABILITY_RISK');

  // 12 arcmin: above 10 arcmin comfort -> LOW_VISUAL_SIZE_RISK
  assert.equal(getReadabilityRisk(12.0, 'STANDARD_20_20'), 'LOW_VISUAL_SIZE_RISK');

  // For Low Vision (20/70), 12 arcmin is still HIGH_READABILITY_RISK (< 17.5 arcmin)
  assert.equal(getReadabilityRisk(12.0, 'MILD_LOW_VISION'), 'HIGH_READABILITY_RISK');
});

test('3. renderShelfReadabilityPanel outputs valid HTML with distance slider and preset controls', () => {
  const html = renderShelfReadabilityPanel(MOCK_REVIEW, { distanceCm: 120 });

  assert.ok(html.includes('SHELF-DISTANCE READABILITY SIMULATOR'));
  assert.ok(html.includes('data-shelf-slider'));
  assert.ok(html.includes('min="30"'));
  assert.ok(html.includes('max="200"'));
  assert.ok(html.includes('120 cm'));
  assert.ok(html.includes('data-shelf-preset="30"'));
  assert.ok(html.includes('data-shelf-preset="200"'));
  assert.ok(html.includes('Net Wt 16 oz'));
  assert.ok(html.includes('Readability Simulation (Not an FDA Violation Heatmap)'));
});

test('4. renderShelfReadabilityOverlayLayer generates coordinate-positioned risk overlay boxes', () => {
  const overlayHtml = renderShelfReadabilityOverlayLayer(MOCK_REVIEW, 1, { distanceCm: 100 });

  assert.ok(overlayHtml.includes('shelf-readability-overlay-layer'));
  assert.ok(overlayHtml.includes('shelf-overlay-box'));
  assert.ok(overlayHtml.includes('data-region-id="tr-01"'));
  assert.ok(overlayHtml.includes('data-region-id="tr-02"'));
  assert.ok(overlayHtml.includes('left:10%'));
  assert.ok(overlayHtml.includes('top:80%'));
});

test('5. Persona filtering tags relevant declarations in the rendered table', () => {
  const nutHtml = renderShelfReadabilityPanel(MOCK_REVIEW, { shopperPersona: 'nut-allergy' });
  const veganHtml = renderShelfReadabilityPanel(MOCK_REVIEW, { shopperPersona: 'vegan' });

  assert.ok(nutHtml.includes('data-shelf-slider'));
  assert.ok(veganHtml.includes('data-shelf-slider'));
});
