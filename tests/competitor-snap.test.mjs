import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCompetitorClaims, benchmarkCompetitorAgainstBrief } from '../lib/campus/competitor-snap.mjs';

test('Competitor Snap — Public Packaging Claim Extraction & Benchmark', () => {
  const sampleOcrText = `
    NATURE VALLEY PROTEIN CRUNCH
    100% Whole Grain Oats · 10g Plant Protein
    Gluten Free Certified · No High Fructose Corn Syrup
    Net Wt 14.2 oz (402g)
    Contains Almonds and Peanuts.
  `;

  const result = extractCompetitorClaims(sampleOcrText, 'Nature Valley');
  assert.equal(result.competitorBrand, 'Nature Valley');
  assert.ok(Array.isArray(result.claims), 'Must extract array of claims');
  assert.ok(result.claims.length >= 3, 'Must extract at least 3 visible claims');

  // Verify extraction honesty: only claims visible in supplied text
  assert.ok(result.claims.some(c => c.claim.toLowerCase().includes('whole grain')), 'Must find Whole Grain');
  assert.ok(result.claims.some(c => c.claim.toLowerCase().includes('protein')), 'Must find Protein claim');
  assert.equal(result.claims.some(c => c.claim.toLowerCase().includes('keto')), false, 'Must NOT fabricate unseen claims');

  // Benchmark against internal creative brief
  const internalBrief = {
    claims: ['100% Whole Grain', 'High Fiber', 'Vegan Certified'],
  };
  const comparison = benchmarkCompetitorAgainstBrief(result, internalBrief);
  assert.equal(comparison.competitor, 'Nature Valley');
  assert.ok(Array.isArray(comparison.comparisonMatrix), 'Must return comparisonMatrix array');
  assert.ok(comparison.benchmarkedCount >= 3);
  const wholeGrainRow = comparison.comparisonMatrix.find(r => r.claim.includes('Whole Grain'));
  assert.ok(wholeGrainRow);
  assert.equal(wholeGrainRow.ourSpecification, 'Approved in Brief');
});
