/**
 * tests/revision-mapping.test.mjs
 * Unit and integration tests for 3D artwork revision mapping and geometry registration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  check3DGeometryCompatibility,
  evaluateComparisonBasis,
  registerArtworkPanels,
  calculateCameraSyncState,
} from '../lib/revision/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('3D Revision Artwork Mapping & Geometry Registration Suite', async t => {
  const v1PdfPath = join(root, 'samples/fieldday-v2/artwork/fieldday-v1.pdf');
  const v2PdfPath = join(root, 'samples/fieldday-v2/artwork/fieldday-v2.pdf');

  await t.test('1. Actual controlled Fieldday V1 and V2 PDFs exist on disk', () => {
    assert.ok(existsSync(v1PdfPath), 'fieldday-v1.pdf must exist');
    assert.ok(existsSync(v2PdfPath), 'fieldday-v2.pdf must exist');
  });

  await t.test('2. Compatible geometry: identical package structure allows spatial registration', () => {
    const geomV1 = {
      packageType: 'folding_carton',
      widthMm: 120,
      heightMm: 240,
      depthMm: 70,
      dielineConfirmed: true,
      panelCount: 6,
    };
    const geomV2 = {
      packageType: 'folding_carton',
      widthMm: 120,
      heightMm: 240,
      depthMm: 70,
      dielineConfirmed: true,
      panelCount: 6,
    };

    const compat = check3DGeometryCompatibility(geomV1, geomV2);
    assert.equal(compat.compatible, true);
    assert.equal(compat.comparisonMode, 'SWIPE_3D');
    assert.equal(compat.spatialRegistrationAvailable, true);
  });

  await t.test('3. Incompatible geometry: different package dimensions trigger honest fallback', () => {
    const geomV1 = {
      packageType: 'folding_carton',
      widthMm: 120,
      heightMm: 240,
      depthMm: 70,
      dielineConfirmed: true,
    };
    const geomV2 = {
      packageType: 'folding_carton',
      widthMm: 150, // Modified width
      heightMm: 240,
      depthMm: 70,
      dielineConfirmed: true,
    };

    const compat = check3DGeometryCompatibility(geomV1, geomV2);
    assert.equal(compat.compatible, false);
    assert.equal(compat.comparisonMode, 'SIDE_BY_SIDE_ONLY');
    assert.equal(compat.spatialRegistrationAvailable, false);
    assert.ok(compat.message.includes('Exact spatial registration unavailable') || compat.reason.includes('dimension'));
  });

  await t.test('4. Incompatible geometry: different package types trigger honest side-by-side fallback', () => {
    const geomV1 = { packageType: 'folding_carton', widthMm: 100, heightMm: 200, depthMm: 50 };
    const geomV2 = { packageType: 'aluminium_can', diameterMm: 66, heightMm: 115 };

    const compat = check3DGeometryCompatibility(geomV1, geomV2);
    assert.equal(compat.compatible, false);
    assert.equal(compat.comparisonMode, 'SIDE_BY_SIDE_ONLY');
    assert.equal(compat.spatialRegistrationAvailable, false);
  });

  await t.test('5. Synchronized camera state: returns identical transformation matrix & fov', () => {
    const cameraState = {
      position: [0, 0, 400],
      target: [0, 0, 0],
      rotation: [0, 0, 0],
      fov: 45,
      zoom: 1.0,
    };

    const synced = calculateCameraSyncState(cameraState);
    assert.deepEqual(synced.v1Camera, cameraState);
    assert.deepEqual(synced.v2Camera, cameraState);
    assert.equal(synced.synchronized, true);
  });

  await t.test('6. Panel UV mapping preservation: panel coordinates translate consistently', () => {
    const panelLayout = {
      panels: [
        { id: 'pdp', face: 'front', bounds: [0.25, 0.2, 0.5, 0.8] },
        { id: 'infopanel', face: 'right', bounds: [0.5, 0.2, 0.75, 0.8] },
      ],
    };

    const mapped = registerArtworkPanels(panelLayout, panelLayout);
    assert.equal(mapped.success, true);
    assert.equal(mapped.matchedPanels.length, 2);
    assert.equal(mapped.matchedPanels[0].face, 'front');
  });

  await t.test('7. Comparison basis detection: distinguishes source changes from artwork changes', () => {
    const revSameSources = {
      documents: [{ role: 'artwork', sha256: 'art-v1' }, { role: 'spec', id: 's1', sha256: 'spec-01' }],
    };
    const revUpdatedArtwork = {
      documents: [{ role: 'artwork', sha256: 'art-v2' }, { role: 'spec', id: 's1', sha256: 'spec-01' }],
    };
    const revUpdatedSpec = {
      documents: [{ role: 'artwork', sha256: 'art-v1' }, { role: 'spec', id: 's1', sha256: 'spec-02' }],
    };

    const artCmp = evaluateComparisonBasis(revSameSources, revUpdatedArtwork);
    assert.equal(artCmp.frozenBasis, true);
    assert.equal(artCmp.sourcesUnchanged, true);

    const specCmp = evaluateComparisonBasis(revSameSources, revUpdatedSpec);
    assert.equal(specCmp.frozenBasis, false);
    assert.equal(specCmp.sourcesUnchanged, false);
  });
});
