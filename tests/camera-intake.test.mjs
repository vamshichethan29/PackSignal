import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPhotoQuality, buildArtworkPdf, captureFaceFromFilename, videoFrameTimes } from '../public/camera-intake.js';

function pixels(width, height, colorAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4, color = colorAt(x, y);
    data[offset] = data[offset + 1] = data[offset + 2] = color; data[offset + 3] = 255;
  }
  return { data, width, height };
}

test('photo preflight warns about low-detail blur and overexposed glare', () => {
  const flat = assessPhotoQuality(pixels(40, 40, () => 255));
  assert.equal(flat.blur, true);
  assert.equal(flat.glare, true);
  const detailed = assessPhotoQuality(pixels(40, 40, (x, y) => (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 130 : 70));
  assert.equal(detailed.blur, false);
  assert.equal(detailed.glare, false);
});
test('camera pages are assembled without treating generated photo labels as artwork evidence', () => {
  const pdf = buildArtworkPdf([
    { bytes: Uint8Array.from([255, 216, 255, 217]), width: 1200, height: 800, label: 'front-face.jpg' },
    { bytes: Uint8Array.from([255, 216, 255, 217]), width: 800, height: 1200, label: 'back-face.jpg' },
  ]);
  const source = Buffer.from(pdf).toString('latin1');
  assert.ok(source.startsWith('%PDF-1.4'));
  assert.match(source, /\/Count 2/);
  assert.doesNotMatch(source, /front-face\.jpg|back-face\.jpg/);
  const start = Number(source.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(source.slice(start, start + 4), 'xref');
  const entries = source.slice(start).match(/\n(\d{10}) 00000 n /g) || [];
  assert.equal(entries.length, 8);
  entries.forEach((entry, index) => {
    const offset = Number(entry.match(/\d{10}/)[0]);
    assert.ok(source.startsWith(`${index + 1} 0 obj`, offset), `object ${index + 1} offset points to its object`);
  });
});

test('browser video fallback samples four sides of a short turn when space allows', () => {
  assert.deepEqual(videoFrameTimes(5), [.625, 1.875, 3.125, 4.375]);
  assert.equal(videoFrameTimes(20).length, 5);
  assert.equal(videoFrameTimes(120).length, 8);
  assert.equal(videoFrameTimes(5, 2).length, 2, 'remaining intake capacity still bounds the frame count');
  assert.deepEqual(videoFrameTimes(0), []);
});

test('clearly named capture photos retain their face labels in a batch', () => {
  assert.equal(captureFaceFromFilename('wellman-label-01-front.jpg'), 'front');
  assert.equal(captureFaceFromFilename('wellman-label-02-back.jpg'), 'back');
  assert.equal(captureFaceFromFilename('wellman-label-03-right.jpg'), 'right');
  assert.equal(captureFaceFromFilename('wellman-label-04-left.jpg'), 'left');
  assert.equal(captureFaceFromFilename('IMG_0420.jpg'), null);
});
