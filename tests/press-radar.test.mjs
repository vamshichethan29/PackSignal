import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderPressQualityRadar,
  REGISTERED_PROFILES,
} from '../public/press-quality-radar.js';

function createMockContainer() {
  const elements = new Map();
  const listeners = new Map();

  const container = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '#radar-press-profile-select') {
        return {
          value: 'ISO-OFFSET-COATED-300',
          addEventListener: (evt, fn) => listeners.set(`select:${evt}`, fn),
        };
      }
      if (selector === '#radar-detail-drawer') {
        return { classList: { add: () => {}, remove: () => {} } };
      }
      if (selector === '#radar-detail-content') {
        return { innerHTML: '', querySelector: () => null };
      }
      return {
        addEventListener: (evt, fn) => listeners.set(`${selector}:${evt}`, fn),
        textContent: 'Mock Element',
        innerHTML: '',
        classList: { toggle: () => {}, add: () => {}, remove: () => {} },
      };
    },
    querySelectorAll(selector) {
      if (selector === '.radar-tile') {
        return ['tac', 'bleed', 'trim', 'crease'].map(check => ({
          dataset: { radarCheck: check },
          classList: { toggle: () => {}, add: () => {}, remove: () => {} },
          addEventListener: (evt, fn) => listeners.set(`tile:${check}:${evt}`, fn),
          querySelector: (sub) => ({ textContent: check.toUpperCase(), innerHTML: check }),
        }));
      }
      return [];
    },
    trigger(key, eventObj = {}) {
      const fn = listeners.get(key);
      if (fn) fn(eventObj);
    },
  };
  return container;
}

test('1. Press Readiness Inspector registers approved print conditions', () => {
  assert.ok(REGISTERED_PROFILES.length >= 4);
  const offset = REGISTERED_PROFILES.find(p => p.id === 'ISO-OFFSET-COATED-300');
  assert.equal(offset.tac, 300);
  assert.equal(offset.bleed, 3.0);
  assert.equal(offset.inset, 3.0);
  assert.equal(offset.crease, 1.5);
  assert.equal(offset.approved, true);

  const flexo = REGISTERED_PROFILES.find(p => p.id === 'FTA-FLEXO-POUCH-280');
  assert.equal(flexo.tac, 280);
});

test('2. renderPressQualityRadar renders tiles with honest evaluated values', () => {
  const container = createMockContainer();
  const review = {
    id: 'test-review-123',
    preflight: {
      pressProfile: 'ISO-OFFSET-COATED-300',
      tac: { peakTac: 320, status: 'issue' },
      bleed: { measuredMm: 2.0, status: 'issue' },
      trimSafety: { measuredMm: 3.5, status: 'match' },
      creaseClearance: { measuredMm: 1.8, status: 'match' },
    },
    findings: [
      { id: 'prepress:tac_excess', check: 'prepress:tac_excess', status: 'issue', measuredValue: 320, requiredValue: 300 },
      { id: 'prepress:bleed_extension', check: 'prepress:bleed_extension', status: 'issue', measuredValue: 2.0, requiredValue: 3.0 },
    ],
  };

  renderPressQualityRadar(review, container);

  assert.ok(container.innerHTML.includes('PRESS READINESS INSPECTOR'));
  assert.ok(container.innerHTML.includes('TAC INK COVERAGE'));
  assert.ok(container.innerHTML.includes('320%'));
  assert.ok(container.innerHTML.includes('BLEED EXTENSION'));
  assert.ok(container.innerHTML.includes('2 mm') || container.innerHTML.includes('2.0 mm'));
  assert.ok(container.innerHTML.includes('[Show TAC Heatmap]'));
  assert.ok(container.innerHTML.includes('[Show Bleed &amp; Safety Zones]'));
});

test('3. Cylindrical beverage can profile renders N/A for crease clearance', () => {
  const container = createMockContainer();
  const review = {
    id: 'can-review-456',
    preflight: {
      pressProfile: 'GRAVURE-BEVERAGE-CAN-340',
      tac: { peakTac: 310, status: 'match' },
    },
  };

  renderPressQualityRadar(review, container);
  assert.ok(container.innerHTML.includes('N/A'));
  assert.ok(container.innerHTML.includes('Cylindrical container'));
});

test('4. Renders CMYK Separations and Barcode Identifier tiles', () => {
  const container = createMockContainer();
  const review = {
    id: 'test-review-sep',
    preflight: {
      colorSpace: 'DeviceCMYK',
    },
    findings: [
      { id: 'rule-gtin', type: 'BARCODE_GTIN_MATCH', status: 'match', observed: '036000291452' },
    ],
  };

  renderPressQualityRadar(review, container);
  assert.ok(container.innerHTML.includes('CMYK SEPARATIONS'));
  assert.ok(container.innerHTML.includes('BARCODE IDENTIFIER'));
  assert.ok(container.innerHTML.includes('GTIN MATCH'));
});

test('5. Barcode print quality tile reports UNAVAILABLE when calibrated verifier is missing', () => {
  const container = createMockContainer();
  const review = {
    id: 'test-review-unverified-barcode',
    preflight: {},
  };

  renderPressQualityRadar(review, container);
  assert.ok(container.innerHTML.includes('BARCODE PRINT QUALITY'));
  assert.ok(container.innerHTML.includes('UNAVAILABLE'));
  assert.ok(container.innerHTML.includes('ISO barcode print-quality grade unavailable'));
});

test('6. Barcode print quality tile renders verified ISO grade when evidence is supplied', () => {
  const container = createMockContainer();
  const review = {
    id: 'test-review-verified-barcode',
    preflight: {
      barcodePrintQuality: {
        standard: 'ISO/IEC 15416',
        grade: 3.8,
        letterGrade: 'A',
        device: 'Axicon 6515',
      },
    },
  };

  renderPressQualityRadar(review, container);
  assert.ok(container.innerHTML.includes('Grade 3.8 / A'));
  assert.ok(container.innerHTML.includes('Axicon 6515'));
});

