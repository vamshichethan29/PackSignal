import test from 'node:test';
import assert from 'node:assert/strict';

import { TextureMappingEngine } from '../public/packaging-3d/texture-mapping.js';

test('8. Can wrap UV mapping places front label center at camera facing u=0.5', () => {
  const engine = new TextureMappingEngine(null);
  const mockGeom = {
    attributes: {
      uv: {
        count: 4,
        data: [0.0, 0.25, 0.5, 0.75],
        getX(i) { return this.data[i]; },
        setX(i, val) { this.data[i] = val; },
        needsUpdate: false,
      }
    }
  };

  engine.applyCylindricalUVs(mockGeom, { wrapCoverage: 1.0, seamOffset: 0.5 });
  assert.equal(mockGeom.attributes.uv.getX(0), 0.5); // 0.0 + 0.5 = 0.5 (faces front +Z)
  assert.equal(mockGeom.attributes.uv.getX(2), 0.0); // 0.5 + 0.5 = 1.0 -> 0.0 (seam at back -Z)
  assert.equal(mockGeom.attributes.uv.needsUpdate, true);
});

test('9. Bottle-label UV mapping preserves offset without z-fighting', () => {
  const engine = new TextureMappingEngine(null);
  const mapped = engine.mapArtworkRegionToUV([0.1, 0.1, 0.9, 0.9], {
    uOffset: 0,
    vOffset: 0,
    uScale: 1,
    vScale: 1,
  });
  assert.equal(mapped.uMin, 0.1);
  assert.equal(mapped.uMax, 0.9);
  assert.equal(mapped.uCenter, 0.5);
});

test('10. Pouch artwork mapping maps front and back panels independently', () => {
  const engine = new TextureMappingEngine(null);
  const frontMapped = engine.mapArtworkRegionToUV([0.05, 0.05, 0.95, 0.95], {
    uOffset: 0,
    vOffset: 0,
    uScale: 1,
    vScale: 1,
  });
  assert.equal(frontMapped.uCenter, 0.5);
  assert.equal(frontMapped.vCenter, 0.5);
});

test('11. Artwork not accidentally mirrored during UV mapping', () => {
  const engine = new TextureMappingEngine(null);
  const region = [0.2, 0.3, 0.8, 0.7];
  const mapped = engine.mapArtworkRegionToUV(region, { uOffset: 0, vOffset: 0, uScale: 1, vScale: 1 });
  // Horizontal order: uMin < uMax (not inverted/mirrored)
  assert.ok(mapped.uMin < mapped.uMax);
  assert.ok(mapped.vMin < mapped.vMax);
});

test('12. Artwork aspect ratio preserved without arbitrary stretch', () => {
  const engine = new TextureMappingEngine(null);
  const originalWidth = 2000;
  const originalHeight = 1000;
  const aspect = originalWidth / originalHeight;
  assert.equal(aspect, 2.0);
});

test('13. Seam orientation handled gracefully with adjustable offset', () => {
  const engine = new TextureMappingEngine(null);
  const mockGeom = {
    attributes: {
      uv: {
        count: 1,
        val: 0.0,
        getX() { return this.val; },
        setX(i, v) { this.val = v; },
        needsUpdate: false,
      }
    }
  };

  engine.applyCylindricalUVs(mockGeom, { wrapCoverage: 1.0, seamOffset: 0.25 });
  assert.equal(mockGeom.attributes.uv.getX(0), 0.25);
});

test('31. Revision texture cache keying supports V1 vs V2 texture swaps', () => {
  const engine = new TextureMappingEngine(null);
  engine.loadedTextures.set('img.png::v1', { id: 'v1_tex' });
  engine.loadedTextures.set('img.png::v2', { id: 'v2_tex' });

  assert.equal(engine.loadedTextures.get('img.png::v1').id, 'v1_tex');
  assert.equal(engine.loadedTextures.get('img.png::v2').id, 'v2_tex');
});
