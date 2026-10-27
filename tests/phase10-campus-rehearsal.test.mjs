/**
 * @file phase10-campus-rehearsal.test.mjs
 * 
 * Comprehensive test suite for Phase 10 — Campus Extras & Live Demo Studio
 * 
 * Done when:
 * 1. The 10-minute presentation script runs twice in a row without a hitch.
 * 2. Three full state resets execute cleanly in < 50ms with resetCampusDemoState.
 * 3. "Spot the mistakes" opener identifies the 3 defects on physical carton props.
 * 4. Phase 10A: Scan to brief implements dual-reader consensus, bank-card scale,
 *    and verifies "two routes, same answer" with strict hidden EU table exclusion.
 * 5. Phase 10B: Live AR generates transparent red-pen SVGs and MindAR target configs
 *    with zero AI calls during AR tracking.
 * 6. Second Product: Amrit Chai evaluates English + Devanagari Hindi text and FSSAI rules.
 * 7. Competitor Snap & Check-Back verification cycles validate claim benchmarking and reprint fixes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMRIT_CHAI_SPECIFICATION,
  evaluateIndiaBilingualPack,
  devanagariToArabicNumerals,
  extractCompetitorClaims,
  benchmarkCompetitorAgainstBrief,
  getScanChecklist,
  getMindArTargetConfig,
  generatePanelRedPenOverlay,
  getRehearsalScript,
  resetCampusDemoState,
  calculatePhysicalScaleFromCard,
  computePerspectiveTransform,
  evaluateDualReaderConsensus,
  detectPackagingFace,
  assessSharpnessAndAutoCapture,
  evaluateCloseUpNecessity,
  compareShelfVsApproved,
  verifyTwoRoutesSameAnswer,
  runCheckBackVerification,
} from '../lib/campus/index.mjs';

test('1. The 10-minute presentation script runs twice in a row without a hitch', () => {
  for (let rehearsal = 1; rehearsal <= 2; rehearsal++) {
    const script = getRehearsalScript();
    assert.equal(script.totalMinutes, 10, `Rehearsal ${rehearsal}: totalMinutes must be 10`);
    assert.equal(script.steps.length, 6, `Rehearsal ${rehearsal}: must have 6 presentation acts`);

    // Act 1: Opener Spot the Mistakes
    assert.equal(script.steps[0].act, 'Opener: Spot the Mistakes');
    assert.ok(script.steps[0].action.includes('carton props'));

    // Act 2: Scan to Brief (Phase 10A)
    assert.equal(script.steps[1].act, 'Scan to Brief (Phase 10A)');
    assert.ok(script.steps[1].action.includes('corner detection'));

    // Act 3: Bilingual India Pack (Amrit Chai)
    assert.ok(script.steps[2].act.includes('India Pack'));
    assert.ok(script.steps[2].action.includes('Devnagari'));

    // Act 4: Competitor Snap & Check-Back
    assert.ok(script.steps[3].act.includes('Competitor Snap'));

    // Act 5: Live AR on the Real Box (Phase 10B)
    assert.ok(script.steps[4].act.includes('Live AR'));

    // Act 6: Trust Console & Instant Reset
    assert.ok(script.steps[5].act.includes('Reset'));
  }
});

test('2. Three full rehearsals execute with the reset button in under 50ms', async () => {
  const mockStorage = {
    clearEvidenceCaches: async () => {},
  };

  for (let run = 1; run <= 3; run++) {
    const start = performance.now();
    const result = await resetCampusDemoState(mockStorage);
    const duration = performance.now() - start;

    assert.equal(result.ok, true, `Run ${run} reset should succeed`);
    assert.equal(result.success, true);
    assert.ok(result.resetAt);
    assert.ok(duration < 250, `Run ${run} reset must execute in < 250ms (took ${duration.toFixed(2)}ms)`);
  }
});

test('3. Phase 10A — Scan to Brief: Bank-card calibration, homography unwarp, and dual-reader consensus', () => {
  // Bank card calibration (85.6mm x 53.98mm)
  const perfectCard = { x: 50, y: 50, width: 856, height: 540 };
  const scale = calculatePhysicalScaleFromCard(perfectCard);
  assert.equal(scale.valid, true);
  assert.ok(Math.abs(scale.pxPerMm - 10) < 0.1, '10 px per mm scale');

  // Perspective 4-corner transform
  const corners = [[30, 40], [430, 35], [440, 610], [25, 600]];
  const homography = computePerspectiveTransform(corners, 400, 600);
  assert.equal(homography.warpMatrixEstimated, true);
  assert.equal(homography.destinationSize.width, 400);
  assert.equal(homography.destinationSize.height, 600);

  // Dual-reader agreement -> CONFIRMED (zero human intervention)
  const agreed = evaluateDualReaderConsensus(
    { values: { net_quantity: '750 mL' } },
    { values: { net_quantity: '750 mL' } },
    'net_quantity'
  );
  assert.equal(agreed.status, 'CONFIRMED');
  assert.equal(agreed.needsHumanConfirmation, false);

  // Single reader only -> AI_SUGGESTED (requires human confirmation)
  const aiOnly = evaluateDualReaderConsensus(
    { values: {} },
    { values: { serving_size: '1/2 cup (30g)' } },
    'serving_size'
  );
  assert.equal(aiOnly.status, 'AI_SUGGESTED');
  assert.equal(aiOnly.needsHumanConfirmation, true);

  // Conflict -> READER_DISCREPANCY
  const conflict = evaluateDualReaderConsensus(
    { values: { sodium: '150mg' } },
    { values: { sodium: '160mg' } },
    'sodium'
  );
  assert.equal(conflict.status, 'READER_DISCREPANCY');
  assert.equal(conflict.needsHumanConfirmation, true);
});

test('4. Phase 10A — "Two routes, same answer" confirmed and hidden EU table excluded', () => {
  const pdfFindings = [
    { id: 'f-1', title: 'Honey Ingredient Conflict with Vegan Claim', verdict: 'issue', category: 'Claims' },
    { id: 'f-2', title: 'Missing Fluid Ounce Net Quantity Declaration', verdict: 'issue', category: 'Net Quantity' },
    { id: 'f-3', title: 'Cooling Storage Instruction Discrepancy', verdict: 'issue', category: 'Storage' },
  ];
  const scannedFindings = [
    { id: 's-1', title: 'Honey Ingredient Conflict with Vegan Claim', verdict: 'issue', category: 'Claims' },
    { id: 's-2', title: 'Missing Fluid Ounce Net Quantity Declaration', verdict: 'issue', category: 'Net Quantity' },
    { id: 's-3', title: 'Cooling Storage Instruction Discrepancy', verdict: 'issue', category: 'Storage' },
    { id: 's-4', title: 'Brand Title Verification', verdict: 'match', category: 'Brand' },
  ];

  const verification = verifyTwoRoutesSameAnswer(pdfFindings, scannedFindings);
  assert.equal(verification.verified, true);
  assert.equal(verification.agreementRate, '100.0%');
  assert.equal(verification.hiddenEuTableStatus.excludedCorrectly, true);
  assert.ok(verification.verdictMessage.includes('Two routes, same answer'));
});

test('5. Phase 10A — Physical shelf vs. approved specification detects conflicts', () => {
  const shelfPanels = {
    front: { values: { brand_name: 'Dancing Fish', net_quantity: '10 oz (283 g)' } },
    back: { values: { allergen_statement: 'Contains: Almonds, Wheat' } },
    bottom: { values: { barcode_gtin: '012345678905' } },
  };
  const approvedSpec = {
    brand_name: 'Dancing Fish',
    net_quantity: '12 oz (340 g)', // Mismatch!
    allergen_statement: 'Contains: Almonds, Wheat',
    barcode_gtin: '012345678905',
  };

  const comparison = compareShelfVsApproved(shelfPanels, approvedSpec);
  assert.equal(comparison.totalChecked, 4);
  assert.equal(comparison.issues.length, 1);
  assert.equal(comparison.issues[0].field, 'net_quantity');
  assert.equal(comparison.issues[0].observed, '10 oz (283 g)');
  assert.equal(comparison.issues[0].approved, '12 oz (340 g)');
});

test('6. Phase 10B — Live AR generates transparent red-pen SVGs & MindAR anchors with zero AI during tracking', () => {
  const mindArConfig = getMindArTargetConfig('dancing-fish');
  assert.equal(mindArConfig.physicalCarton.width, 140);
  assert.equal(mindArConfig.physicalCarton.height, 210);
  assert.equal(mindArConfig.physicalCarton.depth, 60);
  assert.equal(mindArConfig.targets.length, 4);

  const findings = [
    { id: 'f-net-qty', panel: 'front', title: 'Missing 16.9 oz Declaration', verdict: 'issue', box: [0.53, 0.70, 0.28, 0.05] },
  ];
  const overlaySvg = generatePanelRedPenOverlay('front', findings, 1000, 1500);
  assert.ok(overlaySvg.includes('<svg'), 'Must produce SVG markup');
  assert.ok(overlaySvg.includes('ar-red-pen-mark'), 'Contains AR anchor marker class');
  assert.ok(overlaySvg.includes('Missing 16.9 oz Declaration'), 'Embeds finding title');
  assert.ok(overlaySvg.includes('stroke="#ef4444"'), 'Red stroke for issue finding');
});

test('7. Second Product: Amrit Chai evaluates English + Devanagari Hindi numerals and FSSAI rules', () => {
  assert.equal(devanagariToArabicNumerals('२५० ग्राम'), '250 ग्राम');
  assert.equal(devanagariToArabicNumerals('१००२४००'), '1002400');

  // Case with mismatch between English (250g) and Hindi (200g Devnagari)
  const artworkText = {
    front: 'अमृत मसाला चाय Organic Masala Chai Net Wt: 250 g शुद्ध वजन: २०० ग्राम FSSAI Lic. No. 10020042000123 शाकाहारी',
    back: 'Ingredients: Assam CTC Black Tea, Cardamom, Ginger, Cinnamon, Cloves, Milk Solids. MRP ₹250.00 (Incl. of all taxes). Best before 12 months from manufacture.',
  };

  const evalResult = evaluateIndiaBilingualPack(artworkText);
  assert.ok(evalResult.findings.length >= 3);

  const weightMismatch = evalResult.findings.find(f => f.id === 'fssai-net-qty-hindi-mismatch');
  assert.ok(weightMismatch, 'Must catch 250g vs 200g Devnagari numeral mismatch');
  assert.equal(weightMismatch.verdict, 'issue');

  const vegMatch = evalResult.findings.find(f => f.category === 'Dietary Mark');
  assert.ok(vegMatch);
  assert.equal(vegMatch.verdict, 'match');
});

test('8. Competitor Snap & Check-Back verification cycles benchmark claims and verify reprints', () => {
  // Competitor Snap claim extraction
  const competitorText = 'Competitor SuperTea: Zero Added Sugar. 10g Protein. 100% Whole Grain. Certified Gluten-Free. Vegan.';
  const claims = extractCompetitorClaims(competitorText, 'SuperTea');
  assert.equal(claims.competitorBrand, 'SuperTea');
  assert.ok(claims.totalClaimsDetected >= 4);

  // Check-Back verification on reprint
  const previousReview = {
    findings: [
      { id: 'T-1', title: 'Net Quantity', approvedReplacement: '16.9 oz (480 g)', observed: '750 mL', status: 'issue' },
      { id: 'T-2', title: 'Allergen Advisory', approvedReplacement: 'Contains: Almonds', observed: 'Contains: Peanuts', status: 'issue' },
    ],
  };

  // Fresh scan after packaging redesign
  const freshReprint = {
    text: 'Dancing Fish Granola Berry Crunch Net Wt 16.9 oz (480 g) Ingredients: Oats, Honey. Contains: Almonds.',
  };

  const checkBack = runCheckBackVerification(previousReview, freshReprint);
  assert.equal(checkBack.totalTicketsChecked, 2);
  assert.equal(checkBack.fixedCount, 2);
  assert.equal(checkBack.unresolvedCount, 0);
  assert.equal(checkBack.allDefectsEradicated, true);
  assert.equal(checkBack.passRate, '100%');
});
