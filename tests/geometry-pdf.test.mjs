import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePackagingGeometry } from '../lib/geometry/index.mjs';
import { PANEL_VERIFICATION_STATES } from '../lib/geometry/model.mjs';

test('1. PDF vector dieline without trusted structural layers marks panels as candidates or unverified', () => {
  const untrustedPdfDoc = {
    id: 'pdf-decorative',
    role: 'artwork',
    pages: [{ number: 1, width: 800, height: 600, unit: 'points' }],
    vectorGeometry: { format: 'PDF', units: 'points' },
    vectorLines: [
      { points: [[100, 100], [400, 100]], layer: 'Artwork Layer 1' },
      { points: [[400, 100], [400, 300]], layer: 'Typography' },
      { points: [[400, 300], [100, 300]], layer: 'Border Pattern' },
      { points: [[100, 300], [100, 100]], layer: 'Background' }
    ]
  };

  const analysis = analyzePackagingGeometry({
    artworkDocument: untrustedPdfDoc,
    dielineDocument: null
  });

  // Since decorative layers are not trusted structural cut/crease layers, no confirmed production panels are fabricated
  assert.equal(analysis.panels.length, 0);
  assert.ok(analysis.limitations.some(lim => lim.includes('trusted structural') || lim.includes('dieline')));
});

test('2. PDF with explicit structural layers (Cut, Crease) detects candidate boundaries', () => {
  const structuredPdfDoc = {
    id: 'pdf-structured',
    role: 'artwork',
    sha256: 'sha-pdf-struct',
    pages: [{ number: 1, width: 600, height: 400, unit: 'millimeters' }],
    vectorGeometry: { format: 'PDF', units: 'millimeters' },
    vectorRegions: [
      {
        page: 1,
        box: [0.1, 0.1, 0.5, 0.9],
        points: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.9], [0.1, 0.9]],
        layer: 'Cut',
        sourceLabel: 'Front'
      }
    ],
    vectorLines: [
      { points: [[0.5, 0.1], [0.5, 0.9]], layer: 'Crease' }
    ]
  };

  const analysis = analyzePackagingGeometry({
    artworkDocument: structuredPdfDoc,
    dielineDocument: structuredPdfDoc // Same-file PDF dieline
  });

  assert.equal(analysis.panels.length, 1);
  assert.equal(analysis.panels[0].sourceType, 'PDF_VECTOR');
  assert.equal(analysis.panels[0].verificationState, PANEL_VERIFICATION_STATES.EXPLICITLY_LABELED);
});

test('3. Esko DancingFish PDF structural layer presence inspection', () => {
  // Simulating the structural layers extracted from samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf
  const eskoSampleDoc = {
    id: 'esko-dancingfish',
    name: 'DancingFish_Granola_Berry_US_Carton.pdf',
    role: 'artwork',
    sha256: 'sha-dancingfish-berry',
    pages: [{ number: 1, width: 1292.18, height: 1081.39, unit: 'points' }],
    vectorGeometry: {
      format: 'PDF',
      units: 'points',
      layers: ['Cut', 'Crease', 'Glue', 'Artwork Panels', 'Inkfree artwork panel', 'FOLDING CARTON_DYNAMIC.ARD']
    },
    vectorRegions: [
      {
        page: 1,
        box: [0.26, 0.28, 0.52, 0.72],
        points: [[0.26, 0.28], [0.52, 0.28], [0.52, 0.72], [0.26, 0.72]],
        layer: 'Artwork Panels',
        sourceLabel: 'Artwork panel'
      }
    ],
    vectorLines: [
      { points: [[0.26, 0.28], [0.26, 0.72]], layer: 'Crease' },
      { points: [[0.52, 0.28], [0.52, 0.72]], layer: 'Crease' }
    ]
  };

  const analysis = analyzePackagingGeometry({
    artworkDocument: eskoSampleDoc,
    dielineDocument: eskoSampleDoc
  });

  assert.ok(analysis.panels.length >= 1);
  // Does not certify production readiness
  assert.ok(analysis.limitations.some(lim => lim.includes('production') || lim.includes('prepress') || lim.includes('certified')));
});
