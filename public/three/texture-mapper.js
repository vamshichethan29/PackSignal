/**
 * PackSignal 3D Texture Mapper
 * Extracts real uploaded packaging artwork crops from rendered pages
 * and applies them to 3D carton panels with proper UV orientation.
 * Fallbacks are visibly labeled (e.g. "BACK — artwork mapping required").
 */

export class TextureMapper {
  constructor(THREE) {
    this.THREE = THREE;
    this.cache = new Map();
    this.imageCache = new Map();
  }

  /**
   * Loads an HTMLImageElement with caching.
   */
  async loadImage(url) {
    if (this.imageCache.has(url)) return this.imageCache.get(url);

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load artwork image at ${url}`));
      img.src = url;
    });

    this.imageCache.set(url, promise);
    return promise;
  }

  /**
   * Creates a neutral fallback texture when artwork mapping is not confirmed.
   */
  createFallbackTexture(faceName, label) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Neutral premium packaging board tone (SBS board with subtle gradient)
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#f8faf6');
    grad.addColorStop(1, '#e9ece6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle substrate border
    ctx.strokeStyle = 'rgba(156, 168, 152, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 488, 488);

    // Subtle fold crease guide
    ctx.strokeStyle = 'rgba(175, 186, 172, 0.35)';
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(24, 24, 464, 464);
    ctx.setLineDash([]);

    // Subtle, elegant panel watermark
    ctx.fillStyle = 'rgba(65, 82, 67, 0.45)';
    ctx.font = 'bold 24px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((label || faceName).toUpperCase(), 256, 256);

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.colorSpace = this.THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.userData = { fallback: true, faceName };
    return texture;
  }

  /**
   * Generates a Texture for a carton face from the review's artwork document and panel zone.
   *
   * @param {Object} options
   * @param {Object} options.review
   * @param {string} options.faceName
   * @param {Object} options.zone - { page: number, box: [x0, y0, x1, y1] }
   * @param {number} [options.maxDim=2048]
   */
  async createPanelTexture({ review, faceName, label, zone, maxDim = 2048 }) {
    const cacheKey = `${review?.id}:${faceName}:${zone?.page}:${zone?.box?.join(',')}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const doc = review?.documents?.find(d => d.role === 'artwork');
    const page = doc?.pages?.find(p => p.number === zone?.page);

    if (!doc || !page || !zone?.box) {
      const fallback = this.createFallbackTexture(faceName, label);
      this.cache.set(cacheKey, fallback);
      return fallback;
    }

    try {
      const imageUrl = `/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}`;
      const img = await this.loadImage(imageUrl);

      const [x0, y0, x1, y1] = zone.box;
      const cropX = Math.max(0, Math.min(img.width - 1, x0 * img.width));
      const cropY = Math.max(0, Math.min(img.height - 1, y0 * img.height));
      const cropW = Math.max(1, Math.min(img.width - cropX, (x1 - x0) * img.width));
      const cropH = Math.max(1, Math.min(img.height - cropY, (y1 - y0) * img.height));

      // Compute canvas resolution preserving crop aspect ratio up to maxDim
      const aspect = cropW / cropH;
      let targetW, targetH;
      if (aspect >= 1) {
        targetW = Math.min(maxDim, Math.round(cropW));
        targetH = Math.max(32, Math.round(targetW / aspect));
      } else {
        targetH = Math.min(maxDim, Math.round(cropH));
        targetW = Math.max(32, Math.round(targetH * aspect));
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Draw real artwork crop
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      const texture = new this.THREE.CanvasTexture(canvas);
      texture.colorSpace = this.THREE.SRGBColorSpace;
      texture.minFilter = this.THREE.LinearMipmapLinearFilter;
      texture.magFilter = this.THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.userData = { fallback: false, faceName, page: zone.page, box: zone.box };

      this.cache.set(cacheKey, texture);
      return texture;
    } catch (err) {
      console.warn(`[TextureMapper] Failed to extract texture for ${faceName}, using labeled fallback`, err);
      const fallback = this.createFallbackTexture(faceName, label);
      this.cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  /**
   * Clean up all cached textures and GPU memory.
   */
  dispose() {
    for (const texture of this.cache.values()) {
      if (texture?.dispose) texture.dispose();
    }
    this.cache.clear();
    this.imageCache.clear();
  }
}
