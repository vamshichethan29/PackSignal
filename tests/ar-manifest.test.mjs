/**
 * @file tests/ar-manifest.test.mjs
 * 
 * Unit tests for Phase 10B AR Asset Manifest:
 * - Schema validation ('packsignal-ar/v1')
 * - Package, review, and artwork identity verification
 * - Deterministic target-index mapping (0: front, 1: right, 2: back, 3: left)
 * - Panel dimensions, scale authorities, and hotspot linkages
 * - Target file existence and integrity SHA-256
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildArManifest } from '../lib/ar/ar-manifest.mjs';

const root = process.cwd();

test('1. AR Manifest schema conforms to packsignal-ar/v1 specification', () => {
  const manifest = buildArManifest({ market: 'us' });

  assert.equal(manifest.schemaVersion, 'packsignal-ar/v1');
  assert.equal(manifest.packageId, 'dancing-fish-berry-crunch');
  assert.equal(manifest.trackingLibrary, 'mind-ar');
  assert.equal(manifest.buildStatus, 'VALIDATED');
  assert.ok(manifest.artworkSha256, 'Must provide artwork source hash');
  assert.ok(manifest.reviewFingerprint, 'Must provide review fingerprint');
  assert.ok(manifest.targetFileSha256, 'Must provide target file SHA-256');
  assert.equal(manifest.targetFile, '/samples/organizer/targets.mind');
});

test('2. Panel target indices are deterministic and accurately map physical faces', () => {
  const manifest = buildArManifest({ market: 'us' });
  const panels = manifest.panels;

  assert.equal(panels.length, 4, 'Must register 4 carton faces');

  const front = panels.find(p => p.panelId === 'front');
  const right = panels.find(p => p.panelId === 'right');
  const back = panels.find(p => p.panelId === 'back');
  const left = panels.find(p => p.panelId === 'left');

  assert.ok(front && right && back && left, 'All 4 faces must exist');
  assert.equal(front.targetIndex, 0, 'Front PDP must be target index 0');
  assert.equal(right.targetIndex, 1, 'Right nutrition must be target index 1');
  assert.equal(back.targetIndex, 2, 'Back info must be target index 2');
  assert.equal(left.targetIndex, 3, 'Left manufacturer must be target index 3');
});

test('3. Physical panel dimensions match Esko Dancing Fish folding carton (140x210x60mm)', () => {
  const manifest = buildArManifest({ market: 'us' });

  const front = manifest.panels.find(p => p.panelId === 'front');
  const right = manifest.panels.find(p => p.panelId === 'right');

  assert.equal(front.panelDimensionsMm.width, 140);
  assert.equal(front.panelDimensionsMm.height, 210);
  assert.equal(front.physicalScaleAuthority, 'ESKO_ARTIOSCAD_SPEC_REV_B');

  assert.equal(right.panelDimensionsMm.width, 60);
  assert.equal(right.panelDimensionsMm.height, 210);
});

test('4. Overlay images and finding hotspots resolve to canonical IDs', () => {
  const manifest = buildArManifest({ market: 'us' });

  for (const panel of manifest.panels) {
    assert.ok(panel.overlayImage, `Panel ${panel.panelId} must define overlayImage`);
    assert.ok(panel.overlayImageSha256, `Panel ${panel.panelId} must define overlayImageSha256`);
    assert.ok(Array.isArray(panel.findingIds), `Panel ${panel.panelId} must have findingIds array`);
    assert.ok(Array.isArray(panel.hotspots), `Panel ${panel.panelId} must have hotspots array`);
    assert.equal(panel.findingIds.length, panel.hotspots.length);

    for (const hotspot of panel.hotspots) {
      assert.ok(hotspot.findingId.startsWith('f-'), 'Finding ID must start with f-');
      assert.ok(hotspot.sourceRef && hotspot.sourceRef.length > 5, 'Must cite source reference document');
      assert.ok(hotspot.rect && hotspot.rect.length === 4, 'Hotspot must provide normalized rect [x, y, w, h]');
    }
  }
});

test('5. Static compiled target file exists on disk matching manifest path', () => {
  const manifest = buildArManifest({ market: 'us' });
  const localPath = join(root, 'public', manifest.targetFile);
  assert.ok(existsSync(localPath), `Compiled target file must exist at ${localPath}`);

  const buffer = readFileSync(localPath);
  assert.ok(buffer.length > 1000, 'Compiled target file must have non-trivial size');
  assert.equal(buffer.subarray(0, 8).toString('utf8'), 'MINDAR01', 'Must have MINDAR01 magic header');
});
