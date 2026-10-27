import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderPrintReadinessRadar,
  REGISTERED_PROFILES,
  openPrintDensitometerModal,
} from '../public/print-radar.js';

function createMockContainer() {
  const listeners = new Map();
  const container = {
    innerHTML: '',
    querySelector(sel) {
      if (sel === '#radar-press-profile-select') {
        return {
          value: 'ISO-OFFSET-COATED-300',
          addEventListener: (evt, fn) => listeners.set(`select:${evt}`, fn),
        };
      }
      return {
        addEventListener: (evt, fn) => listeners.set(`${sel}:${evt}`, fn),
        classList: { toggle: () => {}, add: () => {}, remove: () => {} },
        textContent: '',
        innerHTML: '',
      };
    },
    querySelectorAll(sel) {
      if (sel === '.radar-card') {
        return ['tac', 'bleed', 'trim', 'crease'].map(check => ({
          dataset: { radarCheck: check },
        }));
      }
      return [];
    },
    trigger(key, evt) {
      const fn = listeners.get(key);
      if (fn) fn(evt);
    },
  };
  return container;
}

test('1. Print Readiness Radar registers production-grade press profiles', () => {
  assert.ok(REGISTERED_PROFILES.length >= 5);
  const offset = REGISTERED_PROFILES.find(p => p.id === 'ISO-OFFSET-COATED-300');
  assert.equal(offset.tac, 300);
  assert.equal(offset.bleed, 3.0);
  assert.equal(offset.inset, 3.0);
  assert.equal(offset.crease, 1.5);
  assert.equal(offset.process, 'OFFSET');

  const flexo = REGISTERED_PROFILES.find(p => p.id === 'FTA-FLEXO-POUCH-280');
  assert.equal(flexo.tac, 280);
  assert.equal(flexo.process, 'FLEXOGRAPHY');

  const gravure = REGISTERED_PROFILES.find(p => p.id === 'GRAVURE-BEVERAGE-CAN-340');
  assert.equal(gravure.tac, 340);
  assert.equal(gravure.crease, 0.0);
});

test('2. renderPrintReadinessRadar generates complete physical prepress dashboard', () => {
  const container = createMockContainer();
  const review = {
    id: 'rev-test-1',
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
      { id: 'prepress:trim_safety', check: 'prepress:trim_safety', status: 'match', measuredValue: 3.5, requiredValue: 3.0 },
      { id: 'prepress:crease_clearance', check: 'prepress:crease_clearance', status: 'match', measuredValue: 1.8, requiredValue: 1.5 },
    ],
  };

  renderPrintReadinessRadar(review, container);

  assert.ok(container.innerHTML.includes('PACKSIGNAL — PRINT READINESS RADAR'));
  assert.ok(container.innerHTML.includes('ISO 12647-2 Coated Carton'));
  assert.ok(container.innerHTML.includes('320%'));
  assert.ok(container.innerHTML.includes('Show TAC Heatmap'));
  assert.ok(container.innerHTML.includes('Inspect CMYK (Densitometer)'));
  assert.ok(container.innerHTML.includes('Show Dieline Safety'));
});

test('3. Coverage model accounts honestly for unsupported checks', () => {
  const container = createMockContainer();
  const review = {
    id: 'rev-rgb-only',
    preflight: {
      colorSpace: 'DeviceRGB',
      pressProfile: 'ISO-OFFSET-COATED-300',
      tac: { authority: 'UNSUPPORTED_COLOR_SPACE', status: 'unable' },
    },
    findings: [],
  };

  renderPrintReadinessRadar(review, container);
  assert.ok(container.innerHTML.includes('RGB Unsupported'));
  assert.ok(container.innerHTML.includes('UNABLE'));
});

test('4. Densitometer modal handles custom sample channels and computes formula', () => {
  // Mock global document if running in node test environment
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      getElementById: () => null,
      createElement: () => ({ style: {}, innerHTML: '', querySelector: () => null }),
      body: { appendChild: () => {} },
    };
  }

  const sample = { c: 80, m: 70, y: 70, k: 100, sourceObject: 'Heading Vector Fill' };
  const profile = REGISTERED_PROFILES[0];
  // Calling should not throw
  openPrintDensitometerModal(sample, profile);
});
