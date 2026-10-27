/**
 * PackSignal — Phase 6A: 3-Second Glance Visual Attention Overlay
 * Canvas-based visual saliency rendering, mandatory declaration polygon overlays,
 * and scientific attention proxy disclaimers.
 *
 * (public/glance-heatmap.js)
 */

export class GlanceHeatmapRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = {
      opacity: 0.65,
      showMandatoryBoxes: true,
      ...options
    };
    this.salientRegions = [];
    this.mandatoryItems = [];
    this.activeHoverItem = null;
  }

  setData({ salientRegions = [], mandatoryItems = [] }) {
    this.salientRegions = salientRegions;
    this.mandatoryItems = mandatoryItems;
    this.render();
  }

  setOpacity(opacity) {
    this.options.opacity = Math.max(0.1, Math.min(1.0, opacity));
    this.render();
  }

  toggleMandatoryBoxes(show) {
    this.options.showMandatoryBoxes = Boolean(show);
    this.render();
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  render() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.salientRegions.length === 0) {
      return;
    }

    // Step 1: Render smooth saliency heatmap blobs
    ctx.save();
    ctx.globalAlpha = this.options.opacity;

    // Render each salient region as a radial gradient
    for (const region of this.salientRegions) {
      const b = region.bounds || { x: 0.2, y: 0.2, width: 0.6, height: 0.2 };
      const cx = (b.x + b.width / 2) * w;
      const cy = (b.y + b.height / 2) * h;
      const rx = (b.width / 2) * w * 1.2;
      const ry = (b.height / 2) * h * 1.2;
      const maxRadius = Math.max(rx, ry);

      const score = region.predictedSaliency || 0.5;

      const grad = ctx.createRadialGradient(cx, cy, maxRadius * 0.1, cx, cy, maxRadius);

      if (score >= 0.8) {
        // High attention: Vivid Crimson -> Amber -> Transparent
        grad.addColorStop(0.0, 'rgba(235, 30, 60, 0.85)');
        grad.addColorStop(0.4, 'rgba(255, 140, 0, 0.65)');
        grad.addColorStop(0.7, 'rgba(255, 220, 0, 0.35)');
        grad.addColorStop(1.0, 'rgba(255, 220, 0, 0.0)');
      } else if (score >= 0.5) {
        // Moderate attention: Warm Gold -> Soft Yellow -> Transparent
        grad.addColorStop(0.0, 'rgba(255, 180, 0, 0.70)');
        grad.addColorStop(0.5, 'rgba(255, 225, 50, 0.40)');
        grad.addColorStop(1.0, 'rgba(255, 255, 100, 0.0)');
      } else {
        // Lower attention: Cool Cyan -> Soft Blue -> Transparent
        grad.addColorStop(0.0, 'rgba(0, 160, 220, 0.45)');
        grad.addColorStop(0.6, 'rgba(0, 180, 255, 0.20)');
        grad.addColorStop(1.0, 'rgba(0, 200, 255, 0.0)');
      }

      ctx.save();
      ctx.beginPath();
      // Elliptical scaling
      ctx.translate(cx, cy);
      ctx.scale(1.0, ry / (rx || 1));
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Step 2: Overlay mandatory declaration bounding polygons
    if (this.options.showMandatoryBoxes && this.mandatoryItems.length > 0) {
      ctx.save();
      for (const item of this.mandatoryItems) {
        const box = item.itemBounds || item.actualTextGeometry || item.bounds;
        if (!box) continue;

        const bx = box.x * w;
        const by = box.y * h;
        const bw = box.width * w;
        const bh = box.height * h;

        const isHigh = item.attentionCategory === 'HIGH_PREDICTED_ATTENTION';
        const isHovered = this.activeHoverItem === item.requirementId;

        // Bounding box border
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeStyle = isHigh ? '#10B981' : '#F59E0B';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Label tag
        ctx.fillStyle = isHigh ? 'rgba(16, 185, 129, 0.90)' : 'rgba(245, 158, 11, 0.90)';
        const tagText = `${item.name || 'Mandatory'}: ${item.predictedSaliencyScore ? (item.predictedSaliencyScore * 100).toFixed(0) + '%' : 'Quiet'}`;
        ctx.font = '10px Inter, system-ui, sans-serif';
        const textMetrics = ctx.measureText(tagText);

        ctx.fillRect(bx, Math.max(0, by - 14), textMetrics.width + 8, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(tagText, bx + 4, Math.max(10, by - 3));
      }
      ctx.restore();
    }
  }
}
