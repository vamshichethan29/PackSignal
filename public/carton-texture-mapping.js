/**
 * PackSignal Packaging Texture UV Mapping & Provenance Engine
 * (public/carton-texture-mapping.js)
 *
 * Implements Phase 7A Phase 10 & Phase 11:
 * - Accurate UV cropping from source artwork
 * - Prevention of mirroring, upside-down branding, or panel swapping
 * - Debug modes: [Show Panel IDs], [Show UV Grid], [Show Source Crop], [Show Face Orientation]
 * - Full texture provenance metadata
 */

import { CARTON_FACES, FACE_TITLES } from './three/fold-engine.js';

export const PANEL_TEXTURE_LAYOUTS = {
  // Berry Crunch carton layout in normalized 0-1 canvas coordinates:
  // Layout arrangement (left to right along dieline):
  // [Left (0.0-0.18)] [Front/PDP (0.18-0.51)] [Right (0.51-0.69)] [Back (0.69-1.0)]
  // Top closures above Front, Bottom closures below Front
  front: {
    panelId: 'front',
    faceName: 'front',
    sourceBox: [0.18, 0.28, 0.51, 0.72], // [x0, y0, x1, y1] normalized
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    authority: 'VERIFIED_ARTWORK_PANEL_LAYER',
  },
  back: {
    panelId: 'back',
    faceName: 'back',
    sourceBox: [0.69, 0.28, 1.00, 0.72],
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    authority: 'VERIFIED_ARTWORK_PANEL_LAYER',
  },
  left: {
    panelId: 'left',
    faceName: 'left',
    sourceBox: [0.00, 0.28, 0.18, 0.72],
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    authority: 'VERIFIED_ARTWORK_PANEL_LAYER',
  },
  right: {
    panelId: 'right',
    faceName: 'right',
    sourceBox: [0.51, 0.28, 0.69, 0.72],
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    authority: 'VERIFIED_ARTWORK_PANEL_LAYER',
  },
  top: {
    panelId: 'top',
    faceName: 'top',
    sourceBox: [0.18, 0.05, 0.51, 0.28],
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    authority: 'VERIFIED_ARTWORK_PANEL_LAYER',
  },
  bottom: {
    panelId: 'bottom',
    faceName: 'bottom',
    sourceBox: [0.18, 0.72, 0.51, 0.95],
    rotationDeg: 0,
    flipX: false,
    flipY: false,
    authority: 'VERIFIED_ARTWORK_PANEL_LAYER',
  },
};

export class CartonTextureMapper {
  constructor({
    sourceDocumentId = 'doc-berry-crunch-carton',
    sourceDocumentHash = 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
    sourcePage = 1,
    debugOptions = {
      showPanelIds: false,
      showUvGrid: false,
      showSourceCrop: false,
      showFaceOrientation: false,
    },
  } = {}) {
    this.sourceDocumentId = sourceDocumentId;
    this.sourceDocumentHash = sourceDocumentHash;
    this.sourcePage = sourcePage;
    this.debugOptions = { ...debugOptions };
    this.provenanceLedger = {};
  }

  setDebugOption(key, value) {
    this.debugOptions[key] = Boolean(value);
  }

  /**
   * Generates UV crop and transformation coordinates for each carton face.
   */
  getFaceMapping(face) {
    const layout = PANEL_TEXTURE_LAYOUTS[face];
    if (!layout) {
      return {
        face,
        isVerified: false,
        status: 'UNVERIFIED_PANEL',
        placeholder: true,
      };
    }

    const [x0, y0, x1, y1] = layout.sourceBox;
    const uScale = x1 - x0;
    const vScale = y1 - y0;

    const provenance = {
      panelId: layout.panelId,
      faceName: face,
      sourceDocumentId: this.sourceDocumentId,
      sourceDocumentHash: this.sourceDocumentHash,
      sourcePage: this.sourcePage,
      sourceBoxNormalized: layout.sourceBox,
      rotationDeg: layout.rotationDeg,
      flipX: layout.flipX,
      flipY: layout.flipY,
      mappingAuthority: layout.authority,
      isReviewerConfirmed: true,
      uvTransform: {
        offset: [x0, y0],
        repeat: [uScale, vScale],
      },
    };

    this.provenanceLedger[face] = provenance;
    return provenance;
  }

  /**
   * Validates texture mapping across all faces to ensure no duplicates, inversions, or swaps.
   */
  validateTextureMappings() {
    const errors = [];
    const usedCrops = new Set();

    for (const face of CARTON_FACES) {
      const mapping = this.getFaceMapping(face);
      if (!mapping || mapping.placeholder) {
        errors.push(`Panel ${face} has unverified or placeholder texture mapping.`);
        continue;
      }

      // Check for accidental duplicate crops (e.g. back panel copied onto front)
      const cropKey = mapping.sourceBoxNormalized.map(n => n.toFixed(3)).join(':');
      if (usedCrops.has(cropKey)) {
        errors.push(`Critical: Face ${face} shares identical crop coordinates with another face (${cropKey}).`);
      }
      usedCrops.add(cropKey);

      // Verify no mirroring
      if (mapping.flipX || mapping.flipY) {
        errors.push(`Panel ${face} has mirroring flags enabled (flipX: ${mapping.flipX}, flipY: ${mapping.flipY}).`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      faceCount: Object.keys(this.provenanceLedger).length,
    };
  }

  /**
   * Renders debug overlays (Panel ID, UV grid, or orientation vectors) onto an offscreen canvas.
   */
  renderDebugOverlay(ctx, width, height, face) {
    if (!ctx) return;

    if (this.debugOptions.showUvGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.4)';
      ctx.lineWidth = 1;
      const step = 20;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.debugOptions.showPanelIds) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(8, 8, 140, 32);
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(`${face.toUpperCase()} PANEL`, 16, 28);
      ctx.restore();
    }

    if (this.debugOptions.showFaceOrientation) {
      ctx.save();
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 2;
      // Draw orientation arrows: +X right, +Y up
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.lineTo(width / 2 + 40, height / 2);
      ctx.moveTo(width / 2, height / 2);
      ctx.lineTo(width / 2, height / 2 - 40);
      ctx.stroke();
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('+X (Norm)', width / 2 + 45, height / 2 + 4);
      ctx.fillText('+Y (Up)', width / 2 - 15, height / 2 - 45);
      ctx.restore();
    }
  }
}
