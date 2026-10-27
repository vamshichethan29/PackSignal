import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMRIT_CHAI_SPECIFICATION,
  evaluateIndiaBilingualPack,
  extractCompetitorClaims,
  benchmarkCompetitorAgainstBrief,
  getScanChecklist,
  getMindArTargetConfig,
  generatePanelRedPenOverlay,
  getRehearsalScript,
  resetCampusDemoState,
} from '../lib/campus/index.mjs';

test('AMRIT_CHAI_SPECIFICATION defines complete bilingual ground truth', () => {
  assert.equal(AMRIT_CHAI_SPECIFICATION.productTitleEnglish, 'Organic Masala Chai');
  assert.equal(AMRIT_CHAI_SPECIFICATION.productTitleHindi, 'ऑर्गेनिक मसाला चाय');
  assert.equal(AMRIT_CHAI_SPECIFICATION.market, 'India');
  assert.equal(AMRIT_CHAI_SPECIFICATION.fssaiLicenseNumber, '10020042000123');
  assert.equal(AMRIT_CHAI_SPECIFICATION.vegStatus, 'vegetarian');
  assert.ok(AMRIT_CHAI_SPECIFICATION.allergens.length >= 2);
});

test('evaluateIndiaBilingualPack catches bilingual discrepancies and FSSAI rules', () => {
  const artworkText = {
    front: "अमृत मसाला चाय Organic Masala Chai Net Wt: 250 g शुद्ध वजन: २०० ग्राम FSSAI Lic. No. 10020042000123 शाकाहारी",
    back: "Ingredients: Assam CTC Black Tea, Cardamom, Ginger, Cinnamon, Cloves, Milk Solids. MRP ₹250.00 (Incl. of all taxes). Best before 12 months from manufacture.",
  };

  const evalResult = evaluateIndiaBilingualPack(artworkText);
  assert.ok(evalResult);
  assert.equal(evalResult.findings.length >= 3, true);

  // Check bilingual weight mismatch finding
  const weightMismatch = evalResult.findings.find(f => f.category === 'Net Quantity' && f.verdict === 'issue');
  assert.ok(weightMismatch, 'Should catch 250g vs 200g Devnagari numeral mismatch');
  assert.equal(weightMismatch.id, 'fssai-net-qty-hindi-mismatch');

  // Check veg mark verified
  const vegMatch = evalResult.findings.find(f => f.category === 'Dietary Mark');
  assert.ok(vegMatch, 'Should evaluate vegetarian mark');
  assert.equal(vegMatch.verdict, 'match');
});

test('extractCompetitorClaims parses on-pack claims', () => {
  const competitorText = "Tata Tea Gold: Zero Added Sugar. High Protein. 100% Whole Grain. Certified Gluten-Free.";
  const claimsResult = extractCompetitorClaims(competitorText, 'Tata Tea Gold');
  assert.equal(claimsResult.competitorBrand, 'Tata Tea Gold');
  assert.ok(claimsResult.totalClaimsDetected >= 2);
  assert.ok(claimsResult.claims.some(c => c.claim === 'No Added Sugar'));
  assert.ok(claimsResult.claims.some(c => c.claim === 'Gluten Free'));
});

test('benchmarkCompetitorAgainstBrief compares claims against approved specification', () => {
  const competitorExtraction = {
    competitorBrand: 'Competitor Gold',
    claims: [
      { claim: 'No Added Sugar', category: 'Nutrition Claim' },
      { claim: 'High Protein', category: 'Nutritional Claim' },
      { claim: 'Gluten Free', category: 'Allergen / Dietary Claim' },
    ],
  };
  const approvedBrief = {
    claims: ['No Added Sugar', '100% Whole Grain'],
  };

  const benchmark = benchmarkCompetitorAgainstBrief(competitorExtraction, approvedBrief);
  assert.ok(benchmark);
  assert.equal(benchmark.competitor, 'Competitor Gold');
  assert.equal(benchmark.benchmarkedCount, 3);
  const shared = benchmark.comparisonMatrix.find(c => c.claim === 'No Added Sugar');
  assert.equal(shared.ourSpecification, 'Approved in Brief');
});

test('getScanChecklist returns panels and completion status', () => {
  const checklist = getScanChecklist({
    front: { photoUrl: '/samples/front.png', hasBlur: false, hasGlare: false },
  });
  assert.equal(checklist.length, 6);
  assert.equal(checklist[0].face, 'front');
  assert.equal(checklist[0].status, 'complete');
  assert.equal(checklist[0].isScanned, true);
  assert.equal(checklist[1].status, 'pending');
  assert.equal(checklist[1].isScanned, false);
});

test('getMindArTargetConfig returns target anchor geometry', () => {
  const targets = getMindArTargetConfig('dancing-fish');
  assert.equal(targets.sampleId, 'dancing-fish');
  assert.equal(targets.physicalCarton.width, 140);
  assert.equal(targets.physicalCarton.height, 210);
  assert.equal(targets.targets.length, 4);
  assert.equal(targets.targets[0].face, 'front');
});

test('generatePanelRedPenOverlay creates SVG markup with bounding boxes', () => {
  const findings = [
    { id: 'f-1', panel: 'front', title: 'Weight Mismatch', verdict: 'issue', box: [0.1, 0.2, 0.3, 0.4] },
  ];
  const svg = generatePanelRedPenOverlay('front', findings);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('Weight Mismatch'));
  assert.ok(svg.includes('rect'));
});

test('getRehearsalScript returns 10-minute demo outline', () => {
  const script = getRehearsalScript();
  assert.equal(script.totalMinutes, 10);
  assert.equal(script.steps.length, 6);
  assert.equal(script.steps[0].act, 'Opener: Spot the Mistakes');
});

test('resetCampusDemoState restores demo to clean baseline', async () => {
  const mockStorage = {
    clearEvidenceCaches: async () => {},
  };
  const res = await resetCampusDemoState(mockStorage);
  assert.equal(res.ok, true);
  assert.ok(res.resetAt);
});

test('calculatePhysicalScaleFromCard computes accurate pxPerMm and handles perspective distortion', async () => {
  const { calculatePhysicalScaleFromCard } = await import('../lib/campus/index.mjs');
  // Card aspect ratio: 85.60 / 53.98 = ~1.5858
  const perfectCard = { x: 10, y: 10, width: 856, height: 540 };
  const scale = calculatePhysicalScaleFromCard(perfectCard);
  assert.equal(scale.valid, true);
  assert.ok(Math.abs(scale.pxPerMm - 10) < 0.1);
  assert.ok(scale.confidence >= 0.9);

  // Distorted card rejection
  const distortedCard = { x: 0, y: 0, width: 400, height: 500 };
  const failScale = calculatePhysicalScaleFromCard(distortedCard);
  assert.equal(failScale.valid, false);
  assert.ok(failScale.error.includes('deviates significantly'));
});

test('computePerspectiveTransform calculates 4-point quadrilateral homography', async () => {
  const { computePerspectiveTransform } = await import('../lib/campus/index.mjs');
  const corners = [[50, 60], [450, 40], [460, 620], [40, 600]];
  const transform = computePerspectiveTransform(corners, 400, 600);
  assert.equal(transform.warpMatrixEstimated, true);
  assert.equal(transform.destinationSize.width, 400);
  assert.equal(transform.destinationSize.height, 600);
  assert.equal(transform.sourceCorners.length, 4);
});

test('evaluateDualReaderConsensus handles Confirmed, AI-Suggested, and Discrepancy states', async () => {
  const { evaluateDualReaderConsensus } = await import('../lib/campus/index.mjs');
  
  // Agreement -> Confirmed
  const confirmed = evaluateDualReaderConsensus(
    { values: { net_quantity: '12 oz (340 g)' } },
    { values: { net_quantity: '12 oz (340 g)' } },
    'net_quantity'
  );
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(confirmed.needsHumanConfirmation, false);
  assert.equal(confirmed.confidence, 0.99);

  // Vision only -> AI Suggested
  const aiSuggested = evaluateDualReaderConsensus(
    { values: {} },
    { values: { net_quantity: '12 oz (340 g)' } },
    'net_quantity'
  );
  assert.equal(aiSuggested.status, 'AI_SUGGESTED');
  assert.equal(aiSuggested.needsHumanConfirmation, true);

  // Mismatch -> Discrepancy
  const mismatch = evaluateDualReaderConsensus(
    { values: { net_quantity: '10 oz' } },
    { values: { net_quantity: '12 oz' } },
    'net_quantity'
  );
  assert.equal(mismatch.status, 'READER_DISCREPANCY');
  assert.equal(mismatch.needsHumanConfirmation, true);
});

test('detectPackagingFace recognizes Front PDP, Nutrition Facts, and Back panel', async () => {
  const { detectPackagingFace } = await import('../lib/campus/index.mjs');

  const front = detectPackagingFace('Dancing Fish Granola Berry Crunch Net Wt: 12 oz (340 g) 100% Natural');
  assert.equal(front.detectedFace, 'front');
  assert.ok(front.confidence > 0.7);

  const right = detectPackagingFace('Nutrition Facts Servings Per Container 8 Calories 140 Total Fat 3g Daily Value');
  assert.equal(right.detectedFace, 'right');
  assert.ok(right.confidence > 0.8);

  const back = detectPackagingFace('Ingredients: Whole Grain Rolled Oats, Honey. Contains: Almonds, Milk. Store in a cool dry place.');
  assert.equal(back.detectedFace, 'back');
  assert.ok(back.confidence > 0.7);
});

test('assessSharpnessAndAutoCapture triggers auto-capture when frame is sharp', async () => {
  const { assessSharpnessAndAutoCapture } = await import('../lib/campus/index.mjs');

  const sharp = assessSharpnessAndAutoCapture(145, { threshold: 110 });
  assert.equal(sharp.isSharp, true);
  assert.equal(sharp.readyForAutoCapture, true);
  assert.equal(sharp.qualityRating, 'sharp');

  const blurry = assessSharpnessAndAutoCapture(45, { threshold: 110 });
  assert.equal(blurry.isSharp, false);
  assert.equal(blurry.readyForAutoCapture, false);
  assert.equal(blurry.isBlurry, true);
});

test('evaluateCloseUpNecessity requests macro shot when text height is near statutory threshold', async () => {
  const { evaluateCloseUpNecessity } = await import('../lib/campus/index.mjs');

  const scale = { valid: true, pxPerMm: 10 }; // 10 px = 1mm
  const elements = [
    { type: 'net_quantity', pixelHeight: 22 }, // 2.2 mm < 3.2mm FDA minimum
    { type: 'barcode', confidence: 0.65, cleanQuietZone: false },
  ];

  const evalResult = evaluateCloseUpNecessity('front', elements, scale);
  assert.equal(evalResult.needsCloseUp, true);
  assert.equal(evalResult.requests.length, 2);
  assert.ok(evalResult.requests.some(r => r.element === 'net_quantity'));
  assert.ok(evalResult.requests.some(r => r.element === 'barcode'));
});

test('compareShelfVsApproved finds shelf-vs-approved conflicts', async () => {
  const { compareShelfVsApproved } = await import('../lib/campus/index.mjs');

  const shelfPanels = {
    front: { values: { brand_name: 'Dancing Fish', net_quantity: '10 oz (283 g)' } },
    back: { values: { allergen_statement: 'Contains Almonds, Wheat' } },
    bottom: { values: { barcode_gtin: '012345678905' } },
  };
  const approvedSpec = {
    brand_name: 'Dancing Fish',
    net_quantity: '12 oz (340 g)', // Mismatch with shelf!
    allergen_statement: 'Contains Almonds, Wheat',
    barcode_gtin: '012345678905',
  };

  const comparison = compareShelfVsApproved(shelfPanels, approvedSpec);
  assert.equal(comparison.totalChecked, 4);
  assert.equal(comparison.issues.length, 1);
  assert.equal(comparison.issues[0].field, 'net_quantity');
  assert.equal(comparison.issues[0].observed, '10 oz (283 g)');
  assert.equal(comparison.issues[0].approved, '12 oz (340 g)');
});

test('verifyTwoRoutesSameAnswer proves identical defects and excludes hidden EU table', async () => {
  const { verifyTwoRoutesSameAnswer } = await import('../lib/campus/index.mjs');

  const pdfFindings = [
    { id: 'f-1', title: 'Honey Ingredient Conflict', verdict: 'issue', category: 'Ingredients' },
    { id: 'f-2', title: 'Net Quantity Format Mismatch', verdict: 'issue', category: 'Net Quantity' },
  ];
  const scannedFindings = [
    { id: 's-1', title: 'Honey Ingredient Conflict', verdict: 'issue', category: 'Ingredients' },
    { id: 's-2', title: 'Net Quantity Format Mismatch', verdict: 'issue', category: 'Net Quantity' },
    { id: 's-3', title: 'Brand Name Match', verdict: 'match', category: 'Brand' },
  ];

  const verification = verifyTwoRoutesSameAnswer(pdfFindings, scannedFindings);
  assert.equal(verification.verified, true);
  assert.equal(verification.agreementRate, '100.0%');
  assert.equal(verification.hiddenEuTableStatus.excludedCorrectly, true);
  assert.ok(verification.verdictMessage.includes('Two routes, same answer'));
});
