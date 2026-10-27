import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTypography, getNetQuantityMinimumHeight } from '../lib/font-preflight.mjs';
import { calculatePdpArea, PACKAGE_TYPES, PDP_SOURCE_AUTHORITY } from '../lib/print/pdp-area.mjs';
import { generateClarificationMessage } from '../lib/clarification-message.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

test('1. Typography finding preserves source evidence, text run ID, and calculation proof', () => {
  const pdp = calculatePdpArea({
    packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
    dimensions: { heightInches: 5.0, widthInches: 4.0 },
    sourceAuthority: PDP_SOURCE_AUTHORITY.APPROVED_DIELINE,
  });

  const textRun = {
    textRunId: 'text-run-net-wt-p1',
    documentId: 'doc-artwork-v1',
    documentHash: 'a1b2c3d4e5f6',
    page: 1,
    originalText: 'NET WT 12 OZ (340g)',
    fontResourceId: '/F1',
    fontName: 'Helvetica-Bold',
    fontSubtype: 'TrueType',
    nominalFontSizePt: 8.0,
    measuredLowercaseOHeightMm: 1.85,
    measuredGlyphHeightMm: 1.85,
    measurementMethod: 'NATIVE_GLYPH_OUTLINE_TRANSFORM',
    measurementAuthority: 'MEASURED_FROM_SOURCE',
    boundingBox: [100, 200, 250, 220],
  };

  const finding = evaluateTypography({
    textRun,
    ruleId: '21_CFR_101_105_H',
    pdpEvaluation: pdp,
  });

  assert.equal(finding.findingId, 'typo-text-run-net-wt-p1-21_cfr_101_105_h');
  assert.equal(finding.textRunId, 'text-run-net-wt-p1');
  assert.equal(finding.fontName, 'Helvetica-Bold');
  assert.equal(finding.nominalFontSizePt, 8.0);
  assert.equal(finding.measuredGlyphHeightMm, 1.85);
  // PDP = 20 sq in -> bracket is 5 < PDP <= 25 sq in -> 1/8 inch = 3.175 mm
  assert.equal(finding.requiredHeightMm, 3.175);
  assert.equal(finding.status, 'issue');
  assert.ok(finding.calculationProof.includes('PDP Dimensions: 4 in × 5 in'));
  assert.ok(finding.calculationProof.includes('PDP Area: 20 sq in'));
  assert.ok(finding.calculationProof.includes('Required Minimum: 1/8 inch (3.175 mm)'));
  assert.ok(finding.calculationProof.includes('Measured Glyph Height: 1.850 mm (Nominal: 8 pt)'));
  assert.ok(finding.calculationProof.includes('Difference: -1.325 mm'));
});

test('2. Ask Someone Prepress message includes real typography metrics', () => {
  const finding = {
    id: 'typo-net-qty-1',
    findingId: 'typo-net-qty-1',
    sourceText: 'NET WT 16 OZ (454g)',
    fontName: 'DIN-Regular',
    nominalFontSizePt: 7.5,
    measuredGlyphHeightMm: 1.62,
    requiredHeightMm: 3.175,
    ruleCitation: '21 CFR 101.105(h)',
    pdpAreaSqIn: 18.5,
  };

  const message = generateClarificationMessage({
    finding,
    targetRole: 'PREPRESS',
  });

  assert.ok(message.includes('NET WT 16 OZ (454g)'));
  assert.ok(message.includes('7.5 pt'));
  assert.ok(message.includes('1.62 mm'));
  assert.ok(message.includes('3.175 mm'));
  assert.ok(message.includes('21 CFR 101.105(h)'));
  assert.ok(message.includes('18.5 sq in'));
  assert.ok(message.includes('Could you verify the final approved font'));
});

test('3. Signed report includes native typography verification section and proofs', async () => {
  const auditData = {
    brandName: 'TestBrand',
    productName: 'Organic Crackers',
    gtin: '01234567890123',
    market: 'US',
    artworkVersion: '1.0',
    overallVerdict: 'FAIL',
    findings: [
      {
        id: 'finding-1',
        category: 'typography',
        title: 'Net Quantity Letter Height Shortfall',
        status: 'issue',
        severity: 'HIGH',
        department: 'Prepress & Print',
        explanation: 'Measured letter height of 1.85 mm is below required 3.175 mm.',
        quote: 'NET WT 12 OZ (340g)',
        fontName: 'Helvetica-Bold',
        fontSubtype: 'TrueType',
        nominalFontSizePt: 8.0,
        measuredGlyphHeightMm: 1.85,
        requiredHeightMm: 3.175,
        measurementMethod: 'NATIVE_GLYPH_OUTLINE_TRANSFORM',
        calculationProof: 'PDP Area: 20 sq in. Required Minimum: 1/8 inch (3.175 mm). Measured: 1.85 mm.',
      },
    ],
    pdpEvaluation: {
      pdpAreaSqIn: 20.0,
      calculationMethod: 'RECTANGULAR_DIMENSIONS',
      sourceAuthority: 'APPROVED_DIELINE',
    },
    signer: 'PackSignal Preflight Auditor v2.4',
    signatureTimestamp: new Date().toISOString(),
  };

  const html = await createHtmlReport(auditData, '.');

  assert.ok(html.includes('NATIVE PDF TYPOGRAPHY VERIFICATION'));
  assert.ok(html.includes('NET WT 12 OZ (340g)'));
  assert.ok(html.includes('Helvetica-Bold'));
  assert.ok(html.includes('8 pt'));
  assert.ok(html.includes('1.85 mm'));
  assert.ok(html.includes('3.175 mm'));
  assert.ok(html.includes('NATIVE_GLYPH_OUTLINE_TRANSFORM'));
  assert.ok(html.includes('PDP Area: 20 sq in'));
});
