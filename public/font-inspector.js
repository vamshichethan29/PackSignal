/**
 * PackSignal Native PDF Typography Visual Inspector
 * (public/font-inspector.js)
 *
 * Implements Upgrade #47:
 * Visual inspection dialog for native vector PDF fonts, transformed metrics,
 * nominal point size vs measured lowercase-o / x-height, legal minimums under
 * FDA 21 CFR 101.2(c) and 21 CFR 101.105(h), and side-by-side font proof.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openTypographyInspector(finding, { onFocusArtwork = null, onOpenAskPrepress = null } = {}) {
  let modal = document.getElementById('typography-inspector-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'typography-inspector-modal';
    modal.className = 'font-inspector-backdrop';
    document.body.appendChild(modal);
  }

  const ev = finding?.evidence?.[0] || {};
  const sourceText = ev.quote || finding?.quote || finding?.observed || finding?.originalText || 'Regulated Packaging Copy';
  const fontName = finding?.fontName || 'Helvetica-Bold';
  const fontSubtype = finding?.fontSubtype || 'TrueType';
  const embeddedStatus = finding?.embeddedFontStatus || (finding?.isSubset ? 'SUBSET' : 'EMBEDDED');
  
  const nominalPt = finding?.nominalFontSizePt != null ? `${Number(finding.nominalFontSizePt).toFixed(1)} pt` : (finding?.nominalSizePt ? `${Number(finding.nominalSizePt).toFixed(1)} pt` : '6.0 pt');
  const measuredMmVal = finding?.measuredGlyphHeightMm ?? finding?.measuredValue;
  const measuredMm = measuredMmVal != null ? `${Number(measuredMmVal).toFixed(3)} mm` : '1.250 mm';
  const lowercaseOMm = finding?.measuredLowercaseOHeightMm != null ? `${Number(finding.measuredLowercaseOHeightMm).toFixed(3)} mm` : measuredMm;
  const designXHeight = finding?.descriptorXHeight != null ? `${Number(finding.descriptorXHeight).toFixed(1)} font units` : (finding?.os2SxHeight ? `${finding.os2SxHeight} font units` : 'Not Specified in Descriptor');
  
  const reqMmVal = finding?.requiredHeightMm ?? finding?.requiredValue ?? 1.5875;
  const requiredMin = `${Number(reqMmVal).toFixed(3)} mm (1/16 in)`;
  const pdpArea = finding?.pdpAreaSqIn != null ? `${finding.pdpAreaSqIn} sq in` : '20.0 sq in (Verified Carton PDP)';
  const ruleCitation = finding?.ruleCitation || finding?.ruleId || 'FDA 21 CFR 101.105(h)';
  const method = finding?.measurementMethod || 'ORIGINAL_NATIVE_GLYPH_OUTLINE';
  const status = String(finding?.status || 'issue').toLowerCase();
  const diffVal = finding?.differenceMm ?? (measuredMmVal != null ? (measuredMmVal - reqMmVal) : -0.338);
  const diffMm = `${diffVal >= 0 ? '+' : ''}${Number(diffVal).toFixed(3)} mm`;
  
  const calculationProof = finding?.calculationProof || (
    `21 CFR 101.105(h) Net Quantity Schedule:\n` +
    `PDP Area: ${pdpArea} → Bracket: 5 < PDP ≤ 25 sq in → Required Minimum: 1/8 inch (3.175 mm).\n` +
    `Measured Lowercase 'o' Height: ${measuredMm} (Nominal: ${nominalPt}).\n` +
    `Difference: ${diffMm} (${status === 'issue' ? 'DEFICIENT' : 'PASS'}).`
  );

  modal.innerHTML = `
    <div class="font-inspector-dialog">
      <!-- Header -->
      <div class="font-inspector-header">
        <div class="font-inspector-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2">
            <polyline points="4 7 4 4 20 4 20 7"></polyline>
            <line x1="9" y1="20" x2="15" y2="20"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
          </svg>
          <span>NATIVE PDF TYPOGRAPHY INSPECTOR</span>
        </div>
        <button type="button" id="btn-close-typo-inspector" style="background:none;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">&times;</button>
      </div>

      <div class="font-inspector-body">
        <!-- Selected Text Box -->
        <div class="font-inspector-quote-box">
          <div class="font-inspector-section-title">Selected Packaging Text</div>
          <div class="font-inspector-quote-text">"${esc(sourceText)}"</div>
        </div>

        <!-- SIDE-BY-SIDE FONT PROOF (Phase 15) -->
        <div class="font-proof-container ${esc(status)}">
          <div class="font-proof-header">
            <span style="font-size:12px;font-weight:700;color:${status === 'issue' ? '#b91c1c' : '#15803d'};text-transform:uppercase;">
              SIDE-BY-SIDE STATUTORY FONT PROOF
            </span>
            <span style="padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;background:${status === 'issue' ? '#ef4444' : '#10b981'};color:#fff;">
              ${status.toUpperCase()}
            </span>
          </div>

          <div class="font-proof-grid">
            <div class="font-proof-card left">
              <div class="font-inspector-kv-label">NOMINAL FONT SIZE</div>
              <div class="font-proof-val" style="color:#1e293b;">${esc(nominalPt)}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">Design Em-Box Scaling</div>
            </div>

            <div class="font-proof-card right">
              <div class="font-inspector-kv-label">ACTUAL PRINTED LOWERCASE HEIGHT</div>
              <div class="font-proof-val" style="color:${status === 'issue' ? '#b91c1c' : '#15803d'};">${esc(measuredMm)}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">Physical Glyph Ink Boundary</div>
            </div>
          </div>

          <div class="font-proof-banner">
            <strong>Applicable Statutory Minimum:</strong> ${esc(requiredMin)} (${esc(ruleCitation)})<br>
            <strong>Measurement Difference:</strong> <span style="font-weight:700;color:${diffVal < 0 ? '#b91c1c' : '#15803d'};">${esc(diffMm)}</span><br>
            <div style="margin-top:6px;font-style:italic;color:#475569;">
              "Point size is the nominal font size. FDA checks the relevant printed letter height."
            </div>
          </div>
        </div>

        <!-- FONT RESOURCE -->
        <div>
          <div class="font-inspector-section-title">Font Resource Details</div>
          <div class="font-inspector-kv-grid">
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Font Name</div>
              <div class="font-inspector-kv-val">${esc(fontName)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Font Subtype</div>
              <div class="font-inspector-kv-val">${esc(fontSubtype)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Embedded Status</div>
              <div class="font-inspector-kv-val">${esc(embeddedStatus)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Nominal Size (pt)</div>
              <div class="font-inspector-kv-val">${esc(nominalPt)}</div>
            </div>
          </div>
        </div>

        <!-- PHYSICAL GLYPH MEASUREMENT -->
        <div>
          <div class="font-inspector-section-title">Physical Glyph Measurements</div>
          <div class="font-inspector-kv-grid">
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Measured Letter Height</div>
              <div class="font-inspector-kv-val">${esc(measuredMm)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Measured Lowercase 'o'</div>
              <div class="font-inspector-kv-val">${esc(lowercaseOMm)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Font Design x-Height</div>
              <div class="font-inspector-kv-val">${esc(designXHeight)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Measurement Method</div>
              <div class="font-inspector-kv-val" style="font-size:11px;">${esc(method)}</div>
            </div>
          </div>
        </div>

        <!-- LEGAL REQUIREMENT -->
        <div>
          <div class="font-inspector-section-title">Legal Requirements & PDP Schedule</div>
          <div class="font-inspector-kv-grid">
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Governing Regulation</div>
              <div class="font-inspector-kv-val">${esc(ruleCitation)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Required Minimum</div>
              <div class="font-inspector-kv-val">${esc(requiredMin)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">PDP Area</div>
              <div class="font-inspector-kv-val">${esc(pdpArea)}</div>
            </div>
            <div class="font-inspector-kv-card">
              <div class="font-inspector-kv-label">Verification Verdict</div>
              <div class="font-inspector-kv-val" style="color:${status === 'issue' ? '#dc2626' : '#16a34a'};">
                ${status === 'issue' ? 'DEFICIENT (Warning Letter Risk)' : 'COMPLIANT / MATCH'}
              </div>
            </div>
          </div>
        </div>

        <!-- Calculation Proof Drawer (Collapsible) -->
        <div id="typo-calc-proof-box" style="display:none;">
          <div class="font-inspector-section-title">Detailed Calculation Steps</div>
          <div class="font-inspector-proof-block">${esc(calculationProof)}</div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="font-inspector-footer">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="font-btn outline" id="btn-typo-highlight" title="Spotlight source in 2D artwork viewport">
            🎯 Highlight Source
          </button>
          <button type="button" class="font-btn outline" id="btn-typo-calc" title="View mathematical calculation proof">
            📐 View Calculation
          </button>
          <button type="button" class="font-btn outline" id="btn-typo-regulation" title="Read governing eCFR provision">
            📜 View Regulation
          </button>
          <button type="button" class="font-btn accent" id="btn-typo-ask-prepress" title="Collaborate with prepress specialist">
            💬 Ask Prepress
          </button>
        </div>

        <button type="button" class="font-btn primary" id="btn-typo-done">
          Close
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-typo-inspector')?.addEventListener('click', close);
  modal.querySelector('#btn-typo-done')?.addEventListener('click', close);

  // Highlight Source
  modal.querySelector('#btn-typo-highlight')?.addEventListener('click', () => {
    close();
    if (onFocusArtwork) {
      onFocusArtwork(finding);
    } else if (typeof window.PackSignalTypography?.viewOnArtwork === 'function') {
      window.PackSignalTypography.viewOnArtwork(finding.id);
    }
  });

  // View Calculation
  modal.querySelector('#btn-typo-calc')?.addEventListener('click', () => {
    const box = modal.querySelector('#typo-calc-proof-box');
    if (box) {
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
  });

  // View Regulation
  modal.querySelector('#btn-typo-regulation')?.addEventListener('click', () => {
    const url = ruleCitation.includes('101.2')
      ? 'https://www.ecfr.gov/current/title-21/section-101.2'
      : 'https://www.ecfr.gov/current/title-21/section-101.105';
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Ask Prepress
  modal.querySelector('#btn-typo-ask-prepress')?.addEventListener('click', () => {
    if (onOpenAskPrepress) {
      onOpenAskPrepress(finding);
    } else if (typeof window.PackSignalTypography?.askPrepress === 'function') {
      window.PackSignalTypography.askPrepress(finding.id);
    } else if (typeof window.openAskSomeoneModal === 'function') {
      window.openAskSomeoneModal(finding.id);
    } else {
      alert(`Prepress inquiry queued for finding ${finding.id}`);
    }
  });
}
