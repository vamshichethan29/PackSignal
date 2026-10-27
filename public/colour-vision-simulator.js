/**
 * PackSignal — Phase 6A: Colour-Vision Deficiency Simulator
 * Deterministic colorimetric transformation matrices (Brettel / Viénot),
 * SVG filter injection, side-by-side comparison, and secondary-cue validation.
 *
 * (public/colour-vision-simulator.js)
 */

export const CVD_MODES = Object.freeze({
  NORMAL: 'normal',
  PROTANOPIA: 'protanopia',       // L-cone deficiency (red-blind)
  DEUTERANOPIA: 'deuteranopia',   // M-cone deficiency (green-blind)
  TRITANOPIA: 'tritanopia',       // S-cone deficiency (blue-blind)
  ACHROMATOPSIA: 'achromatopsia'  // Monochromacy (total color blindness)
});

export const CVD_DESCRIPTIONS = Object.freeze({
  normal: 'Standard trichromatic color vision.',
  protanopia: 'Protanopia simulation (L-cone red insensitivity). Red wavelengths appear darker and shift toward yellow/brown.',
  deuteranopia: 'Deuteranopia simulation (M-cone green insensitivity, most common form). Green and red hues converge into khaki/tan.',
  tritanopia: 'Tritanopia simulation (S-cone blue insensitivity, rare). Blue and yellow hues converge into cyan and pink.',
  achromatopsia: 'Achromatopsia simulation (complete loss of color sensation). Luminance and lightness perception only.'
});

/**
 * Injects reusable SVG color matrix filter elements into the document head if not already present.
 */
export function ensureCvdSvgFilters() {
  if (document.getElementById('packsignal-cvd-filters-svg')) {
    return;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'packsignal-cvd-filters-svg';
  svg.setAttribute('style', 'position:absolute; width:0; height:0; pointer-events:none; overflow:hidden;');
  svg.setAttribute('aria-hidden', 'true');

  svg.innerHTML = `
    <defs>
      <!-- Protanopia: Brettel/Viénot approximation -->
      <filter id="cvd-filter-protanopia" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="
          0.56667 0.43333 0.00000 0 0
          0.55833 0.44167 0.00000 0 0
          0.00000 0.24167 0.75833 0 0
          0       0       0       1 0
        "/>
      </filter>

      <!-- Deuteranopia: Brettel/Viénot approximation -->
      <filter id="cvd-filter-deuteranopia" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="
          0.62500 0.37500 0.00000 0 0
          0.70000 0.30000 0.00000 0 0
          0.00000 0.30000 0.70000 0 0
          0       0       0       1 0
        "/>
      </filter>

      <!-- Tritanopia: Brettel/Viénot approximation -->
      <filter id="cvd-filter-tritanopia" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="
          0.95000 0.05000 0.00000 0 0
          0.00000 0.43333 0.56667 0 0
          0.00000 0.47500 0.52500 0 0
          0       0       0       1 0
        "/>
      </filter>

      <!-- Achromatopsia: Standard Rec.709 luminance weights -->
      <filter id="cvd-filter-achromatopsia" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="
          0.2126 0.7152 0.0722 0 0
          0.2126 0.7152 0.0722 0 0
          0.2126 0.7152 0.0722 0 0
          0      0      0      1 0
        "/>
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
}

/**
 * Applies a CVD filter to a target DOM container element.
 */
export function applyCvdFilterToElement(element, mode = CVD_MODES.NORMAL) {
  if (!element) return;
  ensureCvdSvgFilters();

  if (!mode || mode === CVD_MODES.NORMAL) {
    element.style.filter = '';
    element.dataset.activeCvdMode = 'normal';
    return;
  }

  const filterId = `cvd-filter-${mode.toLowerCase()}`;
  element.style.filter = `url(#${filterId})`;
  element.dataset.activeCvdMode = mode.toLowerCase();
}

/**
 * Checks whether graphical statutory elements rely purely on color (hue) or provide secondary cues.
 */
export function evaluateColorDependencyCues(elements = []) {
  return elements.map((elem) => {
    const hasSecondaryCues = Boolean(elem.hasIcon || elem.hasText || elem.hasBorder || elem.hasDistinctShape);
    return {
      elementId: elem.id || elem.name,
      name: elem.name,
      primaryColor: elem.color || '#000000',
      hasSecondaryCues,
      cues: {
        text: Boolean(elem.hasText),
        distinctShape: Boolean(elem.hasDistinctShape),
        border: Boolean(elem.hasBorder),
        icon: Boolean(elem.hasIcon)
      },
      assessment: hasSecondaryCues
        ? 'COMPLIANT_ACCESSIBLE_CUES'
        : 'POTENTIAL_COLOR_DEPENDENCY_RISK',
      recommendation: hasSecondaryCues
        ? 'Information is redundantly encoded via shape or text; decipherable under all color vision simulations.'
        : 'Warning/status relies exclusively on hue; add an accompanying icon, textual label, or geometric enclosure.'
    };
  });
}
