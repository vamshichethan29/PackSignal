/**
 * PackSignal — Progressive 3D Package Twin (public/scan-3d-twin.js)
 * Phase 10A: Maps the four reviewer-captured package faces onto a folding carton twin.
 */

export const GEOMETRY_AUTHORITIES = {
  VERIFIED_DIELINE: 'VERIFIED_DIELINE_TWIN',
  REVIEWER_MEASURED: 'REVIEWER_MEASURED_CARTON_TWIN',
  REFERENCE_SCALED: 'REFERENCE_SCALED_APPROXIMATE_TWIN',
  ILLUSTRATIVE_SHELL: 'ILLUSTRATIVE_SHELL',
  UNKNOWN: 'UNKNOWN_GEOMETRY',
};

export class Scan3DTwin {
  constructor(containerEl, options = {}) {
    this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
    this.options = options;
    this.faceTextures = {
      front: null,
      right: null,
      back: null,
      left: null,
    };
    this.geometryAuthority = options.scale?.valid
      ? GEOMETRY_AUTHORITIES.REFERENCE_SCALED
      : GEOMETRY_AUTHORITIES.ILLUSTRATIVE_SHELL;
    this.render();
  }

  updateFaceTexture(face, photoUrl) {
    if (this.faceTextures.hasOwnProperty(face)) {
      this.faceTextures[face] = photoUrl;
      this.render();
    }
  }

  updateScale(scaleResult) {
    if (scaleResult && scaleResult.valid) {
      this.geometryAuthority = GEOMETRY_AUTHORITIES.REFERENCE_SCALED;
    } else {
      this.geometryAuthority = GEOMETRY_AUTHORITIES.ILLUSTRATIVE_SHELL;
    }
    this.render();
  }

  render() {
    if (!this.container) return;

    const registeredCount = Object.values(this.faceTextures).filter(Boolean).length;
    const authorityLabel = {
      [GEOMETRY_AUTHORITIES.REFERENCE_SCALED]: 'Reference-Scaled Twin (ID-1 Card Calibrated)',
      [GEOMETRY_AUTHORITIES.ILLUSTRATIVE_SHELL]: 'Illustrative 3D Carton Shell (Approximate Geometry)',
      [GEOMETRY_AUTHORITIES.UNKNOWN]: 'Unknown Physical Geometry',
    }[this.geometryAuthority] || 'Illustrative Shell';

    this.container.innerHTML = `
      <div class="twin-viewport" style="background:#0b0f19;border-radius:10px;padding:12px;border:1px solid rgba(255,255,255,0.1);text-align:center;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:11px;">
          <span style="color:#38bdf8;font-weight:700;">📦 Progressive 3D Carton Twin</span>
          <span style="background:#1e293b;color:#a5f3fc;padding:2px 8px;border-radius:12px;font-size:10px;">${authorityLabel}</span>
        </div>

        <!-- 3D Perspective Box Preview -->
        <div class="twin-faces-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;max-width:280px;margin:10px auto;">
          <!-- Captured review faces -->
          <div style="grid-column: 1;">
            ${this.renderFaceChip('left', 'Left Side')}
          </div>
          <div style="grid-column: 2;">
            ${this.renderFaceChip('front', 'Front PDP')}
          </div>
          <div style="grid-column: 3;">
            ${this.renderFaceChip('right', 'Right Side')}
          </div>

          <!-- Back -->
          <div style="grid-column: 2;">
            ${this.renderFaceChip('back', 'Back Panel')}
          </div>
        </div>

        <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
          ${registeredCount} of 6 faces textured (${registeredCount} of 4 required panels captured).
        </div>
      </div>
    `;
  }

  renderFaceChip(face, label) {
    const photo = this.faceTextures[face];
    if (photo) {
      return `
        <div class="twin-face-chip captured" style="border:2px solid #22c55e;border-radius:6px;height:55px;overflow:hidden;background:#166534;position:relative;">
          <img src="${photo}" style="width:100%;height:100%;object-fit:cover;" alt="${label}">
          <span style="position:absolute;bottom:2px;left:2px;right:2px;background:rgba(0,0,0,0.7);color:#86efac;font-size:8px;font-weight:700;border-radius:2px;padding:1px;">✓ ${face.toUpperCase()}</span>
        </div>
      `;
    }
    return `
      <div class="twin-face-chip placeholder" style="border:1px dashed rgba(255,255,255,0.25);border-radius:6px;height:55px;display:flex;align-items:center;justify-content:center;background:#1e293b;color:#64748b;font-size:9px;font-weight:700;padding:2px;">
        ○ ${label}
      </div>
    `;
  }
}
