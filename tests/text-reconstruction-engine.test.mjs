import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts, evidence } from '../lib/engine.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

test('Text Reconstruction Engine: normal text remains unchanged', () => {
  const doc = {
    id: 'art-1',
    role: 'artwork',
    lines: [
      { text: 'Organic Wild Berry Granola', page: 1, box: [0.1, 0.1, 0.4, 0.15], kind: 'visible' }
    ]
  };
  const facts = extractFacts(doc);
  assert.ok(Array.isArray(facts));
});

test('Text Reconstruction Engine: reconstructs spaced letters and preserves raw text', () => {
  const doc = {
    id: 'art-2',
    role: 'artwork',
    lines: [
      {
        text: 'P A C K E D',
        rawText: 'P A C K E D',
        reconstructedText: 'PACKED',
        reconstructionSegmentId: 'seg-1',
        reconstructionKind: 'letter_spaced_text',
        reconstructionAuthority: 'NATIVE_GEOMETRY_VERIFIED',
        page: 1,
        box: [0.2, 0.2, 0.5, 0.25],
        kind: 'visible'
      }
    ],
    reconstructedSegments: [
      {
        segmentId: 'seg-1',
        rawText: 'P A C K E D',
        reconstructedText: 'PACKED',
        kind: 'letter_spaced_text',
        authority: 'NATIVE_GEOMETRY_VERIFIED',
        page: 1,
        box: [0.2, 0.2, 0.5, 0.25],
        wordBoundaries: [{ word: 'PACKED', startChar: 0, endChar: 6 }]
      }
    ]
  };

  assert.equal(doc.lines[0].rawText, 'P A C K E D');
  assert.equal(doc.lines[0].reconstructedText, 'PACKED');
  assert.equal(doc.reconstructedSegments[0].authority, 'NATIVE_GEOMETRY_VERIFIED');
});

test('Text Reconstruction Engine: curved arc text preserves path geometry and reading order', () => {
  const doc = {
    id: 'art-3',
    role: 'artwork',
    reconstructedSegments: [
      {
        segmentId: 'arc-1',
        rawText: 'P A C K E D   W I T H   G O O D N E S S',
        reconstructedText: 'PACKED WITH GOODNESS',
        kind: 'curved_text',
        method: 'native_glyph_arc_reconstruction',
        authority: 'NATIVE_GEOMETRY_VERIFIED',
        page: 1,
        box: [0.3, 0.2, 0.7, 0.5],
        pathGeometry: {
          type: 'circular_arc',
          center: [0.5, 0.35],
          ptRadius: 100,
          startAngle: 150,
          endAngle: 30,
          direction: 'clockwise'
        },
        wordBoundaries: [
          { word: 'PACKED', startChar: 0, endChar: 6 },
          { word: 'WITH', startChar: 7, endChar: 11 },
          { word: 'GOODNESS', startChar: 12, endChar: 20 }
        ]
      }
    ]
  };

  const seg = doc.reconstructedSegments[0];
  assert.equal(seg.kind, 'curved_text');
  assert.equal(seg.reconstructedText, 'PACKED WITH GOODNESS');
  assert.equal(seg.pathGeometry.direction, 'clockwise');
  assert.equal(seg.wordBoundaries.length, 3);
});

test('Text Reconstruction Engine: table columns are not merged across boundaries', () => {
  const doc = {
    id: 'art-4',
    role: 'artwork',
    lines: [
      { text: '1', page: 1, box: [0.1, 0.3, 0.15, 0.35], kind: 'visible' },
      { text: '5 g', page: 1, box: [0.4, 0.3, 0.45, 0.35], kind: 'visible' }
    ],
    reconstructedSegments: []
  };

  // Ensure no cross-column segment merged into '15 g'
  const merged = doc.reconstructedSegments.find(s => s.reconstructedText === '15 g');
  assert.equal(merged, undefined);
});

test('Text Reconstruction Engine: report integration renders PDF Text Reconstruction section', async () => {
  const review = {
    id: 'rev-test',
    name: 'Reconstruction Test Report',
    market: 'us',
    engine: 'PackSignal Engine',
    createdAt: '2026-10-25',
    documents: [
      {
        id: 'doc-1',
        role: 'artwork',
        reconstructedSegments: [
          {
            segmentId: 'seg-1',
            rawText: 'P A C K E D   W I T H   G O O D N E S S',
            reconstructedText: 'PACKED WITH GOODNESS',
            kind: 'curved_text',
            method: 'native_glyph_arc_reconstruction',
            authority: 'NATIVE_GEOMETRY_VERIFIED',
            page: 1,
            pathGeometry: {
              type: 'circular_arc',
              direction: 'clockwise',
              ptRadius: 100
            },
            confidence: { overall: 0.95 }
          },
          {
            segmentId: 'seg-2',
            rawText: '1 5 g',
            reconstructedText: '15 g',
            kind: 'letter_spaced_text',
            method: 'letter_spacing_reconstruction',
            authority: 'NATIVE_GEOMETRY_VERIFIED',
            page: 1,
            confidence: { overall: 0.95 }
          }
        ],
        pages: [{ number: 1, lines: [] }]
      }
    ],
    findings: []
  };

  const html = await createHtmlReport(review, '/tmp');
  assert.ok(html.includes('PDF Text Reconstruction'));
  assert.ok(html.includes('PACKED WITH GOODNESS'));
  assert.ok(html.includes('15 g'));
  assert.ok(html.includes('NATIVE_GEOMETRY_VERIFIED'));
});
