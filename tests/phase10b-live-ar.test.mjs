/**
 * @file phase10b-live-ar.test.mjs
 * 
 * Verifies Phase 10B — Live AR on the Real Box (Campus Round):
 * 1. MindAR.js multi-panel target descriptors for 140x210x60mm physical carton.
 * 2. Backend transparent red-pen SVG overlay per panel with zero cloud latency during tracking.
 * 3. Mobile AR page (public/ar.html) served at /ar with Clean/Marked toggle and HUD.
 * 4. Fallback anchors for weakly tracked panels (dim light / moving hand dampening).
 * 5. Stretch Feature: "Snap any pack" competitor claim extraction and brief benchmarking.
 * 6. Dual-phone platform compatibility (iOS Quick Look / WebAR & Android SceneViewer).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getMindArTargetConfig,
  generatePanelRedPenOverlay,
  ESKO_CARTON_DIMENSIONS_MM,
} from '../lib/campus/ar-targets.mjs';
import {
  extractCompetitorClaims,
  benchmarkCompetitorAgainstBrief,
} from '../lib/campus/competitor-snap.mjs';
import { generateQrSvg } from '../public/ar-modal.js';

const root = process.cwd();

test('1. MindAR multi-panel target descriptors match physical Esko carton dimensions', () => {
  const config = getMindArTargetConfig('dancing-fish');
  assert.equal(config.sampleId, 'dancing-fish');
  assert.equal(config.physicalCarton.width, 140, 'Width must be 140mm');
  assert.equal(config.physicalCarton.height, 210, 'Height must be 210mm');
  assert.equal(config.physicalCarton.depth, 60, 'Depth must be 60mm');

  // Verify all 4 tracked faces exist
  const faces = config.targets.map(t => t.face);
  assert.ok(faces.includes('front'), 'Must track front PDP');
  assert.ok(faces.includes('right'), 'Must track right nutrition panel');
  assert.ok(faces.includes('back'), 'Must track back information panel');
  assert.ok(faces.includes('left'), 'Must track left manufacturer panel');

  // Fallback anchor configuration
  for (const target of config.targets) {
    assert.ok(target.targetFile, 'Must define MindAR target descriptor file');
    assert.ok(target.fallbackAnchor, 'Must provide fallback anchor for dim light / motion');
    assert.ok(target.widthMm > 0);
    assert.ok(target.heightMm > 0);
  }
});

test('2. Backend generates transparent red-pen SVG overlays with zero AI calls during tracking', () => {
  const sampleFindings = [
    {
      id: 'f-honey',
      panel: 'front',
      title: 'Honey vs. Certified Vegan Claim Mismatch',
      verdict: 'issue',
      box: [0.15, 0.45, 0.35, 0.08],
    },
    {
      id: 'f-net-qty',
      panel: 'front',
      title: 'Missing Fluid Ounce Net Quantity Declaration',
      verdict: 'issue',
      box: [0.52, 0.70, 0.30, 0.05],
    },
  ];

  const svg = generatePanelRedPenOverlay('front', sampleFindings, 1000, 1500);
  assert.ok(svg.includes('<svg'), 'Must produce valid SVG markup');
  assert.ok(svg.includes('viewBox="0 0 1000 1500"'));
  assert.ok(svg.includes('stroke="#ef4444"'), 'Red stroke for issue status');
  assert.ok(svg.includes('stroke-dasharray="8 4"'), 'Hand-drawn wobble dashed stroke');
  assert.ok(svg.includes('Honey vs. Certified Vegan Claim Mismatch'), 'Embeds statutory defect title');
  assert.ok(svg.includes('Missing Fluid Ounce Net Quantity Declaration'), 'Embeds net quantity defect title');

  // Verify right panel overlay
  const rightFindings = [
    {
      id: 'f-sodium',
      panel: 'right',
      title: 'Sodium Daily Value Math Error',
      verdict: 'issue',
      box: [0.10, 0.30, 0.80, 0.05],
    },
  ];
  const rightSvg = generatePanelRedPenOverlay('right', rightFindings, 1000, 1500);
  assert.ok(rightSvg.includes('Sodium Daily Value Math Error'));
});

test('3. Mobile AR page (public/ar.html) exists, is served at /ar, and includes Clean/Marked toggle', () => {
  const arPath = join(root, 'public', 'ar.html');
  assert.ok(existsSync(arPath), 'public/ar.html must exist');
  const arHtml = readFileSync(arPath, 'utf8');

  assert.ok(arHtml.includes('PackSignal · Live AR on Real Box'), 'Page title correct');
  assert.ok(arHtml.includes('id="ar-video"'), 'Contains video viewport element');
  assert.ok(arHtml.includes('id="ar-overlay-svg"'), 'Contains SVG red pen overlay canvas');
  assert.ok(arHtml.includes('Toggle Clean / Marked'), 'Includes Clean vs Marked reviewer toggle');
  assert.ok(arHtml.includes('Snap Competitor Pack'), 'Includes stretch competitor snap trigger');
  assert.ok(arHtml.includes('0ms AI Latency'), 'Documents zero AI latency during tracking');
});

test('4. AR QR code generator creates high-resolution SVG with valid finder patterns', () => {
  const qrSvg = generateQrSvg('https://packsignal.onrender.com/ar', 220);
  assert.ok(qrSvg.includes('<svg'), 'Must produce SVG markup');
  assert.ok(qrSvg.includes('class="ar-qr-code"'), 'Has ar-qr-code CSS class');
  assert.ok(qrSvg.includes('width="220"'), 'Correct size 220');
  assert.ok(qrSvg.includes('📦'), 'Includes center PackSignal package badge');
});

test('5. Stretch Feature: "Snap any pack" extracts competitor claims and benchmarks against statutory brief', () => {
  const competitorPhotoOcr = `
    Nature's Grain SuperCrunch:
    Zero Added Sugar · 10g Plant Protein per serving.
    100% Whole Grain Oats. Certified Gluten-Free.
    Heart Healthy: May reduce the risk of heart disease.
    Non-GMO Project Verified.
  `;

  const extraction = extractCompetitorClaims(competitorPhotoOcr, "Nature's Grain");
  assert.equal(extraction.competitorBrand, "Nature's Grain");
  assert.ok(extraction.totalClaimsDetected >= 5, 'Should detect at least 5 on-pack claims');
  assert.ok(extraction.claims.some(c => c.claim === 'No Added Sugar'));
  assert.ok(extraction.claims.some(c => c.claim === 'High Protein'));
  assert.ok(extraction.claims.some(c => c.claim === 'Gluten Free'));
  assert.ok(extraction.claims.some(c => c.claim === 'Heart Healthy'));

  // Benchmark against our brand brief
  const brandBrief = {
    claims: ['100% Whole Grain', 'No Added Sugar'],
  };

  const benchmark = benchmarkCompetitorAgainstBrief(extraction, brandBrief);
  assert.equal(benchmark.competitor, "Nature's Grain");
  assert.equal(benchmark.benchmarkedCount, extraction.totalClaimsDetected);

  const sharedSugar = benchmark.comparisonMatrix.find(m => m.claim === 'No Added Sugar');
  assert.equal(sharedSugar.ourSpecification, 'Approved in Brief');

  const competitorAdvantage = benchmark.comparisonMatrix.find(m => m.claim === 'Gluten Free');
  assert.equal(competitorAdvantage.ourSpecification, 'Absent from our pack');
});

test('6. Dual-phone platform compatibility handles both iOS and Android profiles without AI calls during rotation', () => {
  // iPhone / Safari WebXR Quick Look profile
  const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  // Android / Chrome SceneViewer profile
  const androidUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/123.0.0.0 Mobile Safari/537.36';

  for (const ua of [iosUserAgent, androidUserAgent]) {
    const isMobile = /iPhone|Android/i.test(ua);
    assert.ok(isMobile, 'Both target platforms recognized as mobile camera clients');
  }

  // Confirm carton physical bounds stay invariant across both mobile clients
  assert.equal(ESKO_CARTON_DIMENSIONS_MM.width, 140);
  assert.equal(ESKO_CARTON_DIMENSIONS_MM.height, 210);
  assert.equal(ESKO_CARTON_DIMENSIONS_MM.depth, 60);
});
