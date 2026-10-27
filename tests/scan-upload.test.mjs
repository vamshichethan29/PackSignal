import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveScanSessionPanel,
  getScanSession,
  resetScanSession,
  computePerspectiveTransform,
} from '../lib/campus/scan-to-brief.mjs';

test('1. Capture upload computes unwarp homography and stores panel attributes', () => {
  const sId = `session-upload-${Date.now()}`;
  resetScanSession(sId);

  const corners = [[40, 50], [440, 45], [450, 610], [35, 600]];
  const unwarp = computePerspectiveTransform(corners, 600, 800);

  saveScanSessionPanel(sId, {
    face: 'front',
    text: 'Dancing Fish Granola',
    corners,
    unwarp,
    variance: 145,
    hasBlur: false,
    photoUrl: '/samples/campus/front.png',
  });

  const session = getScanSession(sId);
  const panel = session.panels.front;
  assert.ok(panel);
  assert.equal(panel.face, 'front');
  assert.equal(panel.variance, 145);
  assert.equal(panel.hasBlur, false);
  assert.ok(panel.unwarp);
  assert.equal(panel.unwarp.destinationSize.width, 600);
  assert.equal(panel.unwarp.destinationSize.height, 800);
});

test('2. Multiple faces upload progressively without data collision', () => {
  const sId = `session-multi-${Date.now()}`;
  resetScanSession(sId);

  saveScanSessionPanel(sId, { face: 'front', text: 'Brand PDP' });
  saveScanSessionPanel(sId, { face: 'right', text: 'Nutrition Facts' });
  saveScanSessionPanel(sId, { face: 'back', text: 'Ingredients' });
  saveScanSessionPanel(sId, { face: 'bottom', text: '012345678905' });

  const session = getScanSession(sId);
  assert.equal(Object.keys(session.panels).length, 4);
  assert.equal(session.panels.front.text, 'Brand PDP');
  assert.equal(session.panels.right.text, 'Nutrition Facts');
  assert.equal(session.panels.back.text, 'Ingredients');
  assert.equal(session.panels.bottom.text, '012345678905');
});
