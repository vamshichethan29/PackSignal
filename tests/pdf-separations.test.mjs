import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSeparations } from '../lib/print/separation-analysis.mjs';

test('PDF Separations: 4-color rich black on fine type (< 10 pt) triggers prepress defect', () => {
  const result = analyzeSeparations({
    colorPlates: ['Cyan', 'Magenta', 'Yellow', 'Black'],
    textObjects: [
      {
        text: 'Contains: Tree Nuts, Milk',
        sizePt: 6.5,
        color: { c: 50, m: 40, y: 40, k: 90 }, // 4-color rich black on 6.5 pt type
      },
    ],
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].verdict, 'RICH_BLACK_SMALL_TEXT_DEFECT');
  assert.equal(result.findings[0].status, 'issue');
  assert.ok(result.findings[0].explanation.includes('colored halos and illegibility'));
});

test('PDF Separations: 100% Black (single-plate K) on fine type is compliant without halos', () => {
  const result = analyzeSeparations({
    colorPlates: ['Cyan', 'Magenta', 'Yellow', 'Black'],
    textObjects: [
      {
        text: 'Contains: Tree Nuts, Milk',
        sizePt: 6.5,
        color: { c: 0, m: 0, y: 0, k: 100 }, // 100% K single plate
      },
    ],
  });

  assert.equal(result.findings.length, 0); // No rich black defects
});

test('PDF Separations: Barcode lines screened across multiple plates triggers defect', () => {
  const result = analyzeSeparations({
    colorPlates: ['Cyan', 'Magenta', 'Yellow', 'Black'],
    barcodeObjects: [
      {
        barcode: '036000291452',
        color: { c: 60, m: 50, y: 40, k: 90 }, // Barcode screened across CMYK
      },
    ],
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].verdict, 'BARCODE_PRINT_CHANNEL_DEFECT');
  assert.equal(result.findings[0].severity, 'critical');
});

test('PDF Separations: Barcode lines printed on single 100% K plate passes', () => {
  const result = analyzeSeparations({
    colorPlates: ['Cyan', 'Magenta', 'Yellow', 'Black'],
    barcodeObjects: [
      {
        barcode: '036000291452',
        color: { c: 0, m: 0, y: 0, k: 100 }, // 100% K solid
      },
    ],
  });

  assert.equal(result.findings.length, 0);
});

test('PDF Separations: Categorizes technical layers, finish coatings, and white underprints', () => {
  const result = analyzeSeparations({
    spotColors: [
      { name: 'CutContour' },
      { name: 'CreaseLine' },
      { name: 'Spot Gloss Varnish' },
      { name: 'Cold Foil Gold' },
      { name: 'Opaque White Underprint' },
      { name: 'PANTONE 286 C' },
    ],
  });

  assert.equal(result.findings.length, 0);
});
