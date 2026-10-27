import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getReconstructedSegmentsForPage,
  renderReconstructedTextOverlayLayer
} from '../public/pdf-reconstruction-overlays.js';

test('Text Reconstruction UI: getReconstructedSegmentsForPage extracts page segments', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        reconstructedSegments: [
          { segmentId: 's1', page: 1, box: [0.1, 0.1, 0.5, 0.2], rawText: 'P A C K E D', reconstructedText: 'PACKED' },
          { segmentId: 's2', page: 2, box: [0.1, 0.1, 0.5, 0.2], rawText: '1 5 g', reconstructedText: '15 g' }
        ]
      }
    ]
  };

  const p1 = getReconstructedSegmentsForPage(review, 1);
  assert.equal(p1.length, 1);
  assert.equal(p1[0].segmentId, 's1');
  assert.equal(p1[0].reconstructedText, 'PACKED');

  const p2 = getReconstructedSegmentsForPage(review, 2);
  assert.equal(p2.length, 1);
  assert.equal(p2[0].segmentId, 's2');
  assert.equal(p2[0].reconstructedText, '15 g');
});

test('Text Reconstruction UI: renderReconstructedTextOverlayLayer renders letter-spaced box and curved arc path', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        reconstructedSegments: [
          {
            segmentId: 'ls-1',
            page: 1,
            box: [0.2, 0.2, 0.6, 0.3],
            kind: 'letter_spaced_text',
            rawText: '1 5 g',
            reconstructedText: '15 g',
            glyphBoxes: [[0.2, 0.2, 0.3, 0.3], [0.35, 0.2, 0.45, 0.3], [0.5, 0.2, 0.6, 0.3]]
          },
          {
            segmentId: 'arc-1',
            page: 1,
            box: [0.2, 0.5, 0.8, 0.8],
            kind: 'curved_text',
            rawText: 'P A C K E D   W I T H   G O O D N E S S',
            reconstructedText: 'PACKED WITH GOODNESS',
            pathGeometry: {
              type: 'circular_arc',
              center: [0.5, 0.65],
              radius: 0.25,
              startAngle: 150,
              endAngle: 30,
              direction: 'clockwise'
            }
          }
        ]
      }
    ]
  };

  const html = renderReconstructedTextOverlayLayer(review, 1);
  assert.ok(html.includes('workbench-reconstructed-text-layer'));
  assert.ok(html.includes('data-recon-segment-id="ls-1"'));
  assert.ok(html.includes('data-recon-segment-id="arc-1"'));
  assert.ok(html.includes('class="curved-arc-path"'));
  assert.ok(html.includes('15 g'));
  assert.ok(html.includes('PACKED WITH GOODNESS'));
});

test('Text Reconstruction UI: renderReconstructedTextOverlayLayer respects enabled=false option', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        reconstructedSegments: [
          { segmentId: 's1', page: 1, box: [0.1, 0.1, 0.5, 0.2], rawText: 'P A C K E D', reconstructedText: 'PACKED' }
        ]
      }
    ]
  };

  const html = renderReconstructedTextOverlayLayer(review, 1, { enabled: false });
  assert.equal(html, '');
});
