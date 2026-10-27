/**
 * PackSignal — Phase 6A: Shelf-Distance Simulator (Client-side Optical Geometry)
 * Live 30–200 cm slider, apparent scale preview, real-time angular recalculation,
 * first-dropout item detector, and strict separation of legal typography from readability.
 *
 * (public/shelf-distance.js)
 */

export const DISTANCE_PRESETS = [30, 50, 75, 100, 150, 200];

/**
 * Calculates angular height in arcminutes for physical height h (mm) at distance d (cm).
 * theta_rad = 2 * atan(h / (20 * d))
 */
export function calculateLiveAngularArcmin(heightMm, distanceCm) {
  if (!heightMm || heightMm <= 0 || !distanceCm || distanceCm <= 0) return 0;
  const dMm = distanceCm * 10;
  const rad = 2.0 * Math.atan(heightMm / (2.0 * dMm));
  const deg = rad * (180.0 / Math.PI);
  return Number((deg * 60.0).toFixed(2));
}

/**
 * Calculates the exact distance in cm where a glyph of height h (mm) crosses threshold (arcmin).
 */
export function calculateLiveCrossingDistanceCm(heightMm, thresholdArcmin = 5.0) {
  if (!heightMm || heightMm <= 0 || !thresholdArcmin || thresholdArcmin <= 0) return null;
  const thresholdDeg = thresholdArcmin / 60.0;
  const thresholdRad = thresholdDeg * (Math.PI / 180.0);
  const halfRad = thresholdRad / 2.0;
  const dMm = heightMm / (2.0 * Math.tan(halfRad));
  return Number((dMm / 10.0).toFixed(1));
}

export class ShelfDistanceController {
  constructor({
    sliderElement,
    displayElement,
    packagePreviewElement,
    itemsTableElement,
    summaryElement,
    onDistanceChange = null
  }) {
    this.slider = sliderElement;
    this.display = displayElement;
    this.preview = packagePreviewElement;
    this.table = itemsTableElement;
    this.summary = summaryElement;
    this.onDistanceChange = onDistanceChange;

    this.currentDistanceCm = 60.0;
    this.thresholdArcmin = 5.0; // Standard 20/20 threshold
    this.items = [];

    this.init();
  }

  init() {
    if (this.slider) {
      this.slider.min = '30';
      this.slider.max = '200';
      this.slider.step = '1';
      this.slider.value = String(this.currentDistanceCm);

      this.slider.addEventListener('input', (e) => {
        this.setDistance(parseFloat(e.target.value));
      });
    }
  }

  setItems(items = []) {
    this.items = items;
    this.update();
  }

  setThreshold(thresholdArcmin) {
    this.thresholdArcmin = Number(thresholdArcmin) || 5.0;
    this.update();
  }

  setDistance(distanceCm) {
    this.currentDistanceCm = Math.max(30, Math.min(200, Number(distanceCm) || 60));
    if (this.slider && parseFloat(this.slider.value) !== this.currentDistanceCm) {
      this.slider.value = String(this.currentDistanceCm);
    }
    if (this.display) {
      this.display.textContent = `${this.currentDistanceCm} cm (${(this.currentDistanceCm / 100).toFixed(2)} m)`;
    }

    // Apparent packaging scale: relative to 60cm arm's length
    if (this.preview) {
      const scale = 60.0 / this.currentDistanceCm;
      this.preview.style.transform = `scale(${scale.toFixed(3)})`;
      this.preview.style.transformOrigin = 'center center';
    }

    this.update();

    if (typeof this.onDistanceChange === 'function') {
      this.onDistanceChange(this.currentDistanceCm);
    }
  }

  update() {
    if (this.items.length === 0) return;

    // Recalculate angular size for all items
    const evaluated = this.items.map((item) => {
      const hMm = Number(item.physicalHeightMm) || 0;
      const arcmin = calculateLiveAngularArcmin(hMm, this.currentDistanceCm);
      const crossingCm = calculateLiveCrossingDistanceCm(hMm, this.thresholdArcmin);
      
      let status = 'ABOVE_MODELED_THRESHOLD';
      if (arcmin < this.thresholdArcmin) {
        status = 'BELOW_MODELED_THRESHOLD';
      } else if (arcmin < this.thresholdArcmin * 1.25) {
        status = 'NEAR_MODELED_THRESHOLD';
      }

      return {
        ...item,
        currentArcmin: arcmin,
        crossingCm,
        status
      };
    });

    // Render items table
    if (this.table) {
      this.renderTable(evaluated);
    }

    // Identify first item to cross threshold
    if (this.summary) {
      this.renderFirstCrossingSummary(evaluated);
    }
  }

  renderTable(evaluated) {
    this.table.innerHTML = evaluated.map((item) => {
      const statusClass = item.status === 'BELOW_MODELED_THRESHOLD' ? 'status-below' :
                          item.status === 'NEAR_MODELED_THRESHOLD' ? 'status-near' : 'status-above';
      const statusLabel = item.status === 'BELOW_MODELED_THRESHOLD' ? 'Below Threshold' :
                          item.status === 'NEAR_MODELED_THRESHOLD' ? 'Near Threshold' : 'Legible';

      return `
        <tr class="readability-row ${statusClass}" data-req-id="${item.requirementId}">
          <td class="req-name">
            <strong>${item.name}</strong>
            <div class="legal-badge">${item.legalRule || 'Statutory Requirement'}</div>
          </td>
          <td>${item.physicalHeightMm} mm</td>
          <td><strong>${item.currentArcmin} arcmin</strong></td>
          <td>${item.crossingCm ? item.crossingCm + ' cm' : 'N/A'}</td>
          <td><span class="readability-chip ${statusClass}">${statusLabel}</span></td>
        </tr>
      `;
    }).join('');
  }

  renderFirstCrossingSummary(evaluated) {
    const valid = evaluated.filter((i) => i.crossingCm !== null);
    if (valid.length === 0) {
      this.summary.innerHTML = `<div class="alert-box">CANNOT_DETERMINE_RELIABLY: Incomplete physical text measurements.</div>`;
      return;
    }

    // Sort by crossing distance ascending
    valid.sort((a, b) => a.crossingCm - b.crossingCm);
    const first = valid[0];

    this.summary.innerHTML = `
      <div class="first-crossing-card">
        <div class="card-header">
          <span class="card-icon">📏</span>
          <strong>FIRST REQUIRED ITEM TO CROSS MODELED THRESHOLD:</strong>
        </div>
        <div class="crossing-details">
          <div class="crossing-title">${first.name}</div>
          <div class="crossing-metrics">
            <span>Threshold Crossing Distance: <strong>${first.crossingCm} cm</strong></span>
            <span>Printed Height: <strong>${first.physicalHeightMm} mm</strong></span>
            <span>Model Threshold: <strong>${this.thresholdArcmin} arcmin</strong></span>
          </div>
          <p class="crossing-disclaimer">
            <em>"Modeled readability estimate, not a measured human reading result."</em>
          </p>
        </div>
      </div>
    `;
  }
}
