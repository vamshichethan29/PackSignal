/**
 * @file tests/carton-snapshots.test.mjs
 * 
 * Tests for 3D review snapshot capture and brief embedding:
 * - Real rendered 3D snapshot captures with preset camera poses
 * - SHA-256 data hashing
 * - Metadata bindings: reviewId, documentHash, revisionId, market, foldPercent
 * - Embedding into creative brief export
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CartonSnapshotManager,
  SNAPSHOT_PRESETS,
  computeDataSha256,
} from '../public/carton-snapshots.js';

test('1. Carton snapshot manager captures rendered state with verified metadata and SHA-256 hash', async () => {
  const manager = new CartonSnapshotManager({
    reviewId: 'review-berry-crunch-01',
    documentHash: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
    revisionId: 'rev-01',
    market: 'us',
  });

  const snapshot = await manager.captureSnapshot({
    preset: SNAPSHOT_PRESETS.ISOMETRIC,
    foldPercent: 100,
    isXRay: false,
  });

  assert.ok(snapshot.snapshotId);
  assert.equal(snapshot.presetId, 'isometric');
  assert.equal(snapshot.reviewId, 'review-berry-crunch-01');
  assert.equal(snapshot.documentHash, 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be');
  assert.equal(snapshot.market, 'us');
  assert.equal(snapshot.foldPercent, 100);
  assert.equal(snapshot.isXRay, false);
  assert.ok(snapshot.dataUri.startsWith('data:image/'));
  assert.equal(typeof snapshot.sha256, 'string');
  assert.equal(snapshot.sha256.length, 64, 'SHA-256 must be a 64-character hex string');
});

test('2. Multiple snapshot presets capture distinct inspection views', async () => {
  const manager = new CartonSnapshotManager();

  const snapFront = await manager.captureSnapshot({ preset: SNAPSHOT_PRESETS.FRONT, foldPercent: 100 });
  const snapBack = await manager.captureSnapshot({ preset: SNAPSHOT_PRESETS.BACK, foldPercent: 100 });
  const snapXray = await manager.captureSnapshot({ preset: SNAPSHOT_PRESETS.XRAY, foldPercent: 100, isXRay: true });

  const snapshots = manager.getSnapshots();
  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[0].presetId, 'front');
  assert.equal(snapshots[1].presetId, 'back');
  assert.equal(snapshots[2].presetId, 'xray');
  assert.equal(snapshots[2].isXRay, true);
});
