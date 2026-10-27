import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeShelfReadability,
  buildAskPrepressMessage,
  getSmartCorrectionSuggestions,
  compareReadabilityRevisions,
  DECLARATION_TYPES
} from '../lib/readability/shelf-readability.mjs';

import {
  READABILITY_RISK,
  READABILITY_PROFILES
} from '../lib/readability/readability-profiles.mjs';

const CANDIDATE_TEXT_REGIONS = [
  {
    textRunId: 'tr-logo',
    originalText: 'Dancing Fish',
    category: 'brand',
    fontName: 'BrandBold',
    nominalFontSizePt: 72.0,
    measuredGlyphHeightMm: 25.0,
    boundingBox: [0.1, 0.1, 0.6, 0.25],
    page: 1,
    visibility: 'visible'
  },
  {
    textRunId: 'tr-identity',
    originalText: 'Berry Crunch Granola',
    category: 'identity',
    fontName: 'HeaderSans',
    nominalFontSizePt: 24.0,
    measuredGlyphHeightMm: 8.5,
    boundingBox: [0.1, 0.26, 0.7, 0.35],
    page: 1,
    visibility: 'visible'
  },
  {
    textRunId: 'tr-net-qty',
    originalText: 'Net Wt 16 oz (454 g)',
    category: 'net_quantity',
    fontName: 'BodySans-Bold',
    nominalFontSizePt: 12.0,
    measuredGlyphHeightMm: 3.2,
    boundingBox: [0.1, 0.88, 0.5, 0.94],
    page: 1,
    visibility: 'visible'
  },
  {
    textRunId: 'tr-claims',
    originalText: 'Suitable for Vegans · No Added Sugar',
    category: 'claim',
    fontName: 'BodySans-Medium',
    nominalFontSizePt: 11.0,
    measuredGlyphHeightMm: 2.8,
    boundingBox: [0.1, 0.78, 0.8, 0.85],
    page: 1,
    visibility: 'visible'
  },
  {
    textRunId: 'tr-ingredients',
    originalText: 'Ingredients: Whole grain rolled oats, honey (1%), almonds, pecans, walnuts, coconut sugar.',
    category: 'ingredients',
    fontName: 'BodySans-Regular',
    nominalFontSizePt: 7.5,
    measuredGlyphHeightMm: 1.8,
    boundingBox: [0.1, 0.45, 0.9, 0.60],
    page: 1,
    visibility: 'visible'
  },
  {
    textRunId: 'tr-allergens',
    originalText: 'Contains: Almonds. May contain pecans, walnuts and milk.',
    category: 'allergen',
    fontName: 'BodySans-Bold',
    nominalFontSizePt: 7.5,
    measuredGlyphHeightMm: 1.8,
    boundingBox: [0.1, 0.61, 0.9, 0.68],
    page: 1,
    visibility: 'visible'
  },
  {
    textRunId: 'tr-address',
    originalText: 'Manufactured for Dancing Fish Foods, Seattle WA 98101',
    category: 'contact',
    fontName: 'BodySans-Light',
    nominalFontSizePt: 6.0,
    measuredGlyphHeightMm: 1.4,
    boundingBox: [0.1, 0.92, 0.8, 0.97],
    page: 1,
    visibility: 'visible'
  }
];

const PACK_DIMENSIONS = {
  widthInches: 4.5,
  heightInches: 8.0 // PDP = 36 sq in (> 25 sq in tier -> requires 3/16" = 4.7625 mm)
};

test('1. Distance slider clamps inputs outside the 30 cm – 200 cm range', () => {
  const belowMin = analyzeShelfReadability({ textRegions: CANDIDATE_TEXT_REGIONS, distanceCm: 10 });
  const aboveMax = analyzeShelfReadability({ textRegions: CANDIDATE_TEXT_REGIONS, distanceCm: 350 });

  assert.equal(belowMin.distanceCm, 30.0);
  assert.equal(aboveMax.distanceCm, 200.0);
});

test('2. First dropout identification correctly pinpoints fine print elements as distance increases', () => {
  // At 30 cm (close handheld): small print is readable
  const at30cm = analyzeShelfReadability({ textRegions: CANDIDATE_TEXT_REGIONS, distanceCm: 30 });
  assert.equal(at30cm.metrics.highRiskCount, 0);

  // At 150 cm (shelf distance): 1.4 mm contact address drops out first
  const at150cm = analyzeShelfReadability({ textRegions: CANDIDATE_TEXT_REGIONS, distanceCm: 150 });
  assert.ok(at150cm.metrics.highRiskCount > 0);
  assert.ok(at150cm.metrics.firstDropoutElement.includes('Manufactured for') || at150cm.metrics.firstDropoutElement.includes('contact'));
});

test('3. Visual profiles scale threshold difficulty (Standard 20/20 vs Age 40+ vs Low Vision)', () => {
  const resStandard = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    viewingProfile: 'STANDARD_20_20'
  });
  const resAge40 = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    viewingProfile: 'AGE_RELATED_40_PLUS'
  });
  const resLowVision = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    viewingProfile: 'MILD_LOW_VISION'
  });

  // Low vision shopper experiences higher risk count at the same distance
  assert.ok(resLowVision.metrics.highRiskCount >= resAge40.metrics.highRiskCount);
  assert.ok(resAge40.metrics.highRiskCount >= resStandard.metrics.highRiskCount);
});

test('4. Persona filter tags relevant regions without altering underlying findings', () => {
  // Nut Allergy Persona
  const nutSim = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    shopperPersona: 'nut-allergy'
  });
  const nutRegions = nutSim.evaluatedRegions.filter(r => r.isPersonaRelevant);
  assert.ok(nutRegions.length >= 2, 'Should tag ingredients and allergen declaration');
  assert.ok(nutRegions.some(r => r.originalText.includes('Contains: Almonds')));

  // Vegan Persona
  const veganSim = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    shopperPersona: 'vegan'
  });
  const veganRegions = veganSim.evaluatedRegions.filter(r => r.isPersonaRelevant);
  assert.ok(veganRegions.some(r => r.originalText.includes('Suitable for Vegans')));
  assert.ok(veganRegions.some(r => r.originalText.includes('honey')));

  // Sugar Watcher Persona
  const sugarSim = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    shopperPersona: 'sugar-watcher'
  });
  const sugarRegions = sugarSim.evaluatedRegions.filter(r => r.isPersonaRelevant);
  assert.ok(sugarRegions.some(r => r.originalText.includes('No Added Sugar')));
  assert.ok(sugarRegions.some(r => r.originalText.includes('coconut sugar')));
});

test('5. Ask Prepress message generates factual, evidence-backed text with real metrics', () => {
  const sim = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 120,
    packageGeometry: { dimensions: PACK_DIMENSIONS }
  });
  const netQty = sim.evaluatedRegions.find(r => r.category === 'net_quantity');

  const msg = buildAskPrepressMessage(netQty, 'DancingFish_Carton_V1.pdf');
  assert.ok(msg.includes('DancingFish_Carton_V1.pdf'));
  assert.ok(msg.includes('3.20 mm'));
  assert.ok(msg.includes('120 cm'));
  assert.ok(msg.includes('21 CFR 101.105(h)'));
  assert.ok(msg.includes('Ask Prepress') || msg.includes('Hi Prepress Team'));
});

test('6. Smart correction suggestions offer exact statutory remediation and visual design advice', () => {
  const sim = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 150,
    packageGeometry: { dimensions: PACK_DIMENSIONS }
  });
  const netQty = sim.evaluatedRegions.find(r => r.category === 'net_quantity');

  const suggestions = getSmartCorrectionSuggestions(netQty);
  assert.ok(suggestions.length >= 1);
  // Net quantity on 36 sq in PDP requires 4.76 mm; observed is 3.20 mm -> needs +1.56 mm
  assert.ok(suggestions[0].includes('STATUTORY REMEDIATION'));
  assert.ok(suggestions[0].includes('4.76 mm') || suggestions[0].includes('3/16'));
});

test('7. V1 vs V2 revision comparison detects resolution of statutory deficiency and visual improvement', () => {
  const v1Sim = analyzeShelfReadability({
    textRegions: CANDIDATE_TEXT_REGIONS,
    distanceCm: 100,
    packageGeometry: { dimensions: PACK_DIMENSIONS }
  });

  // V2 where net quantity is enlarged to 5.0 mm (meeting 4.76 mm requirement)
  const v2Regions = CANDIDATE_TEXT_REGIONS.map(r => {
    if (r.category === 'net_quantity') {
      return { ...r, measuredGlyphHeightMm: 5.0, nominalFontSizePt: 16.0 };
    }
    return r;
  });

  const v2Sim = analyzeShelfReadability({
    textRegions: v2Regions,
    distanceCm: 100,
    packageGeometry: { dimensions: PACK_DIMENSIONS }
  });

  const diff = compareReadabilityRevisions(v1Sim, v2Sim);
  assert.equal(diff.status, 'COMPARISON_COMPLETE');
  assert.equal(diff.summary.statutoryResolvedCount, 1);

  const netQtyComp = diff.comparisons.find(c => c.category === 'net_quantity');
  assert.equal(netQtyComp.legalResolved, true);
  assert.equal(netQtyComp.verdict, 'RESOLVED_STATUTORY_DEFICIENCY');
  assert.equal(netQtyComp.heightDeltaMm, 1.8);
});

test('8. Limitations explicitly state that simulation is not a medical or clinical prediction', () => {
  const sim = analyzeShelfReadability({ textRegions: CANDIDATE_TEXT_REGIONS });
  assert.ok(sim.limitations.some(l => l.includes('clinical') || l.includes('human-subject')));
  assert.ok(sim.limitations.some(l => l.includes('independent')));
});
