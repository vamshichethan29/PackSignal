/**
 * PackSignal 3D Packaging Studio — Texture & UV Mapping Engine
 * (public/packaging-3d/texture-mapping.js)
 */

export class TextureMappingEngine {
  constructor(THREE) {
    this.THREE = THREE;
    this.loadedTextures = new Map();
  }

  /**
   * Loads a packaging artwork image as a Three.js Texture with optimal sampling and wrapping.
   */
  async loadArtworkTexture(url, { version = 'v1', flipY = true } = {}) {
    const key = `${url}::${version}`;
    if (this.loadedTextures.has(key)) {
      return this.loadedTextures.get(key);
    }

    if (!this.THREE || !this.THREE.TextureLoader) {
      return null;
    }

    const loader = new this.THREE.TextureLoader();
    return new Promise((resolve) => {
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = this.THREE.SRGBColorSpace || 'srgb';
          texture.generateMipmaps = true;
          texture.minFilter = this.THREE.LinearMipmapLinearFilter || 1008;
          texture.magFilter = this.THREE.LinearFilter || 1006;
          texture.flipY = flipY;
          texture.wrapS = this.THREE.ClampToEdgeWrapping || 1001;
          texture.wrapT = this.THREE.ClampToEdgeWrapping || 1001;
          texture.needsUpdate = true;

          this.loadedTextures.set(key, texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          console.warn('[TextureMappingEngine] Failed to load artwork texture:', url, err);
          resolve(null);
        }
      );
    });
  }

  /**
   * Applies cylindrical wrap UV mapping to a cylinder geometry.
   * Ensures u=0.5 faces the camera (+Z) and avoids mirrored or inverted labels.
   */
  applyCylindricalUVs(geometry, { wrapCoverage = 1.0, seamOffset = 0.5 } = {}) {
    if (!geometry || !geometry.attributes || !geometry.attributes.uv) return;

    const uvAttr = geometry.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      let u = uvAttr.getX(i);
      // Offset so u=0.5 faces +Z
      u = (u * wrapCoverage + seamOffset) % 1.0;
      uvAttr.setX(i, u);
    }
    uvAttr.needsUpdate = true;
  }

  /**
   * Maps 2D artwork normalized bounding box [minX, minY, maxX, maxY] into surface UV bounds.
   */
  mapArtworkRegionToUV(artworkRegion = [0, 0, 1, 1], surfaceMapping = { uOffset: 0, vOffset: 0, uScale: 1, vScale: 1 }) {
    const [minX, minY, maxX, maxY] = artworkRegion;
    return {
      uMin: surfaceMapping.uOffset + minX * surfaceMapping.uScale,
      uMax: surfaceMapping.uOffset + maxX * surfaceMapping.uScale,
      vMin: surfaceMapping.vOffset + minY * surfaceMapping.vScale,
      vMax: surfaceMapping.vOffset + maxY * surfaceMapping.vScale,
      uCenter: surfaceMapping.uOffset + ((minX + maxX) / 2) * surfaceMapping.uScale,
      vCenter: surfaceMapping.vOffset + ((minY + maxY) / 2) * surfaceMapping.vScale,
    };
  }

  dispose() {
    for (const tex of this.loadedTextures.values()) {
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
      }
    }
    this.loadedTextures.clear();
  }
}
