/**
 * PackSignal 3D Texture Manager (public/three/texture-manager.js)
 * Manages loading, caching, UV coordinate extraction, and orientation validation
 * of artwork textures for multi-format 3D packaging models.
 */

import { TextureMapper } from './texture-mapper.js';

export class TextureManager {
  constructor(THREE) {
    this.THREE = THREE;
    this.mapper = new TextureMapper(THREE);
    this.cache = new Map();
  }

  /**
   * Extract a cropped texture from review artwork.
   */
  async extractCropTexture(review, pageNumber, box, faceName = '') {
    const key = `${review?.id}_p${pageNumber}_${box?.join(',')}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const texture = await this.mapper.extractCropTexture(review, pageNumber, box, faceName);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Generates a neutral labeled fallback texture for unmapped panels.
   */
  createNeutralPlaceholder(label = 'Artwork Unmapped', width = 512, height = 512) {
    return this.mapper.createNeutralPlaceholder(label, width, height);
  }

  /**
   * Generates an orientation verification test grid texture.
   * Contains FRONT, BACK, LEFT, RIGHT, barcode digits, and directional arrows
   * to ensure no mirroring or axis inversion.
   *
   * @param {number} [width=1024]
   * @param {number} [height=512]
   * @returns {THREE.CanvasTexture}
   */
  createOrientationTestTexture(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background checkerboard
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e5e7eb';
    const tileSize = 64;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }

    // Grid lines & labels
    const sections = [
      { name: 'BACK (L)', x: 0, w: width * 0.25, color: '#4b5563' },
      { name: 'LEFT', x: width * 0.25, w: width * 0.25, color: '#2563eb' },
      { name: 'FRONT', x: width * 0.5, w: width * 0.25, color: '#16a34a' },
      { name: 'RIGHT', x: width * 0.75, w: width * 0.25, color: '#dc2626' },
    ];

    for (const sec of sections) {
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.strokeRect(sec.x, 0, sec.w, height);

      ctx.fillStyle = sec.color;
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sec.name, sec.x + sec.w / 2, height * 0.35);

      // Directional arrow pointing UP
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillText('▲ UP', sec.x + sec.w / 2, height * 0.18);

      // Non-mirrored barcode digits
      ctx.font = '20px monospace';
      ctx.fillStyle = '#111827';
      ctx.fillText('0 12345 67890 5', sec.x + sec.w / 2, height * 0.75);
    }

    // Top border indicator
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, width, 16);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('TOP EDGE', width / 2, 12);

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.wrapS = this.THREE.ClampToEdgeWrapping;
    texture.wrapT = this.THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    this.mapper.dispose();
    for (const tex of this.cache.values()) {
      if (tex && tex.dispose) tex.dispose();
    }
    this.cache.clear();
  }
}
