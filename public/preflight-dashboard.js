import { summarizePreflight } from "./preflight-engine.js";

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function preflightDashboardView(review, activeCategory = null, selectedCheckId = null) {
  const art = (review.documents || []).find(d => d.role === 'artwork');
  const findings = review.findings || [];
  
  // Categorize PDF preflight findings
  const pfFindings = findings.filter(f => f.method === 'pdf_preflight_screening' || f.id?.startsWith('pdf-preflight:'));
  const legacyFindings = findings.filter(f => f.method === 'preflight_engine' || (f.id?.startsWith('preflight:') && !f.id?.startsWith('pdf-preflight:')));
  
  // Group findings into the four core prepress screening categories
  const catVisibility = pfFindings.filter(f => f.check === 'PVP-001' || f.category === 'visibility');
  const catOverlap = pfFindings.filter(f => f.check === 'PVP-002' || f.category === 'overlap');
  const catTypography = pfFindings.filter(f => f.check === 'PVP-003' || f.category === 'text_height' || f.category === 'typography');
  const catClearance = pfFindings.filter(f => f.check === 'PVP-004' || f.category === 'clearance' || f.category === 'safe_area');

  // Summary counts
  const countVisWarn = catVisibility.filter(f => f.status === 'review' || f.status === 'issue').length;
  const countOverWarn = catOverlap.filter(f => f.status === 'review' || f.status === 'issue').length;
  const countTypoWarn = catTypography.filter(f => f.status === 'review' || f.status === 'issue').length;
  const countClearWarn = catClearance.filter(f => f.status === 'review' || f.status === 'issue').length;

  const pdfPreflight = review.pdfPreflight || null;
  const parser = pdfPreflight?.coverage?.parser || 'PyMuPDF (fitz)';
  const totalInspectedSpans = pdfPreflight?.coverage?.totalSpansInspected || 0;
  const totalDielineSegments = pdfPreflight?.coverage?.dielineSegmentsInspected || 0;
  const totalChecks = pdfPreflight?.coverage?.totalChecks || (pfFindings.length + legacyFindings.length);

  const sections = [
    {
      id: 'visibility',
      code: 'PVP-001',
      title: '1. Rendered Text Visibility',
      subtitle: 'Screens for non-rendering modes (Tr 3), zero opacity, and unconfirmed raster crops.',
      colorClass: 'preflight-amber',
      badgeColor: '#f59e0b',
      findings: catVisibility,
      warningCount: countVisWarn,
      method: 'PDF operator rendering mode & rendered crop pixel contrast inspection',
      sourceGeometry: 'PDF textstream & rendered 150 DPI page pixels',
      thresholdProvenance: 'PDF Specification ISO 32000-1 (Tr rendering modes)'
    },
    {
      id: 'overlap',
      code: 'PVP-002',
      title: '2. Hidden / Overlapping Text',
      subtitle: 'Screens for drawing-order occlusions, opaque coverings, and independent text collisions.',
      colorClass: 'preflight-amber',
      badgeColor: '#d97706',
      findings: catOverlap,
      warningCount: countOverWarn,
      method: 'Drawing sequence order analysis & spatial text collision suppression',
      sourceGeometry: 'Vector path painting sequence (seqno) & text bounding boxes',
      thresholdProvenance: 'Prepress drawing-order & multi-pass glyph suppression rules'
    },
    {
      id: 'typography',
      code: 'PVP-003',
      title: '3. Estimated Text Height',
      subtitle: 'Approximate native text-box height scaled via verified PDF points (1 pt = 25.4 / 72 mm).',
      colorClass: 'preflight-purple',
      badgeColor: '#8b5cf6',
      findings: catTypography,
      warningCount: countTypoWarn,
      method: 'Approximate native glyph/span height in physical millimeters',
      sourceGeometry: 'PDF font point size & glyph bounding box geometry',
      thresholdProvenance: 'Reviewer-defined screening setting (default 1.6 mm)'
    },
    {
      id: 'clearance',
      code: 'PVP-004',
      title: '4. Dieline / Trim Clearance',
      subtitle: 'Measures minimum 2D distance to trusted PDF TrimBox, cut segments, or crease lines.',
      colorClass: 'preflight-orange',
      badgeColor: '#ea580c',
      findings: catClearance,
      warningCount: countClearWarn,
      method: 'Exact 2D rectangle-to-segment Euclidean minimum distance calculation',
      sourceGeometry: 'Trusted PDF TrimBox & verified DXF structural dieline lines',
      thresholdProvenance: 'Reviewer-defined safety margin (Cut: 2.0 mm, Crease: 1.5 mm)'
    }
  ];

  const totalWarnings = countVisWarn + countOverWarn + countTypoWarn + countClearWarn;

  return `
    <div class="preflight-dashboard" data-preflight-dashboard style="padding: 16px;">
      <!-- Header -->
      <header class="preflight-header" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
          <div>
            <div class="preflight-eyebrow" style="color:#b45309;font-weight:700;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;">
              PDF PREFLIGHT · PREPRESS SCREENING
            </div>
            <h2 style="margin:4px 0 6px;color:#1e293b;font-size:24px;">Visibility, Typography &amp; Trim-Clearance Screening</h2>
            <p class="preflight-desc" style="color:#475569;font-size:13px;max-width:760px;margin:0 0 10px;line-height:1.5;">
              Conservative prepress engineering checks operating on native PDF vector objects, verified drawing sequence order,
              and trusted dieline geometry. Identifies suspicious regions for qualified prepress review.
            </p>
            <div style="display:flex;gap:16px;font-size:12px;color:#64748b;flex-wrap:wrap;">
              <span><b>Engine:</b> ${esc(parser)}</span>
              <span><b>Spans Inspected:</b> ${totalInspectedSpans}</span>
              <span><b>Dieline Segments:</b> ${totalDielineSegments}</span>
              <span><b>Total Checks:</b> ${totalChecks}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
            <button type="button" class="primary btn-run-pdf-preflight" style="background:#b45309;padding:10px 18px;font-weight:600;" data-action="run-pdf-preflight" data-review-id="${esc(review.id)}">
              ⚡ Run PDF Preflight Screening
            </button>
            <span style="font-size:11px;color:#94a3b8;">Deterministic local execution</span>
          </div>
        </div>

        <!-- 4-Category Summary Bar -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px;">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;">
            <div style="font-size:11px;color:#92400e;font-weight:700;">1. VISIBILITY (PVP-001)</div>
            <div style="font-size:18px;font-weight:700;color:#78350f;margin:2px 0;">
              ${countVisWarn ? `${countVisWarn} need review` : 'No concerns'}
            </div>
            <div style="font-size:11px;color:#b45309;">Tr 3, zero opacity, blank crops</div>
          </div>

          <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:8px;padding:12px 14px;">
            <div style="font-size:11px;color:#9a3412;font-weight:700;">2. OVERLAP (PVP-002)</div>
            <div style="font-size:18px;font-weight:700;color:#7c2d12;margin:2px 0;">
              ${countOverWarn ? `${countOverWarn} suspicious` : 'No collisions'}
            </div>
            <div style="font-size:11px;color:#c2410c;">Drawing occlusions, colliding text</div>
          </div>

          <div style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:8px;padding:12px 14px;">
            <div style="font-size:11px;color:#5b21b6;font-weight:700;">3. TEXT HEIGHT (PVP-003)</div>
            <div style="font-size:18px;font-weight:700;color:#4c1d95;margin:2px 0;">
              ${countTypoWarn ? `${countTypoWarn} below threshold` : 'Meets setting'}
            </div>
            <div style="font-size:11px;color:#6d28d9;">Est. box height &lt; 1.6 mm</div>
          </div>

          <div style="background:#fff1f2;border:1px solid #ffe4e6;border-radius:8px;padding:12px 14px;">
            <div style="font-size:11px;color:#9f1239;font-weight:700;">4. TRIM CLEARANCE (PVP-004)</div>
            <div style="font-size:18px;font-weight:700;color:#881337;margin:2px 0;">
              ${countClearWarn ? `${countClearWarn} near cut / crease` : 'Clearances met'}
            </div>
            <div style="font-size:11px;color:#be123c;">Distance &lt; 2.0mm cut / 1.5mm fold</div>
          </div>
        </div>
      </header>

      <!-- Reviewer Screening Threshold Tuning -->
      <details class="preflight-settings-panel" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <summary style="font-weight:600;color:#334155;cursor:pointer;">
          ⚙️ Configurable Prepress Screening Thresholds &amp; Provenance
        </summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:14px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">
              Text-Box Height Threshold (mm)
            </label>
            <input type="number" step="0.1" min="0.5" max="10.0" value="1.6" id="input-preflight-typo-threshold" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            <small style="color:#64748b;font-size:11px;">Screening approximation (not legal x-height).</small>
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">
              Cut-Line Safety Margin (mm)
            </label>
            <input type="number" step="0.1" min="0.5" max="10.0" value="2.0" id="input-preflight-cut-margin" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            <small style="color:#64748b;font-size:11px;">Minimum distance from text to verified cut line.</small>
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">
              Crease-Line Safety Margin (mm)
            </label>
            <input type="number" step="0.1" min="0.5" max="10.0" value="1.5" id="input-preflight-crease-margin" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            <small style="color:#64748b;font-size:11px;">Minimum distance to fold/score crease line.</small>
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">
              Threshold Provenance Origin
            </label>
            <select id="select-preflight-threshold-origin" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
              <option value="reviewer_defined" selected>Reviewer-defined screening setting</option>
              <option value="company_rule">Company Brand Packaging Rulebook</option>
              <option value="regulatory_rule">Applicable Regulatory Guideline</option>
            </select>
            <small style="color:#64748b;font-size:11px;">Recorded in audit trail and reports.</small>
          </div>
        </div>
      </details>

      <!-- Visual Overlay Inspector Legend -->
      <div class="preflight-legend-bar" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <span style="font-size:12px;font-weight:700;color:#334155;">2D ARTWORK OVERLAY LEGEND:</span>
        <div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:14px;height:14px;border:2px solid #f59e0b;background:rgba(245,158,11,0.25);border-radius:3px;display:inline-block;"></span>
            <b>Amber:</b> Hidden / Overlapping Text
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:14px;height:14px;border:2px solid #8b5cf6;background:rgba(139,92,246,0.25);border-radius:3px;display:inline-block;"></span>
            <b>Purple:</b> Estimated Small Text
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:14px;height:14px;border:2px solid #ea580c;background:rgba(234,88,12,0.25);border-radius:3px;display:inline-block;"></span>
            <b>Orange:</b> Trim / Crease Clearance
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:14px;height:14px;border:2px solid #6b7280;background:rgba(107,114,128,0.25);border-radius:3px;display:inline-block;"></span>
            <b>Gray:</b> Unable to Evaluate
          </span>
        </div>
      </div>

      <!-- Categories Grid -->
      <div class="preflight-sections-container" style="display:flex;flex-direction:column;gap:24px;">
        ${sections.map(sec => `
          <div class="preflight-category-card" data-category="${sec.id}" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #f1f5f9;padding-bottom:14px;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="background:${sec.badgeColor};color:#ffffff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">
                    ${esc(sec.code)}
                  </span>
                  <h3 style="margin:0;font-size:18px;color:#1e293b;">${esc(sec.title)}</h3>
                </div>
                <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${esc(sec.subtitle)}</p>
              </div>

              <div style="display:flex;gap:8px;align-items:center;">
                <span class="pbadge ${sec.warningCount ? 'review' : 'match'}" style="font-size:12px;padding:4px 10px;border-radius:99px;font-weight:600;background:${sec.warningCount ? '#fef3c7' : '#ecfdf5'};color:${sec.warningCount ? '#92400e' : '#065f46'};">
                  ${sec.warningCount ? `${sec.warningCount} concern${sec.warningCount === 1 ? '' : 's'} flagged` : 'No concern detected'}
                </span>
                <span style="font-size:12px;color:#94a3b8;">${sec.findings.length} findings</span>
              </div>
            </div>

            <!-- Findings List for Category -->
            <div class="category-findings-list" style="display:flex;flex-direction:column;gap:14px;">
              ${sec.findings.length ? sec.findings.map((f, idx) => {
                const pf = f.preflight || {};
                const isWarning = f.status === 'review' || f.status === 'issue';
                return `
                  <div class="preflight-finding-item ${sec.colorClass}" data-finding-id="${esc(f.id)}" style="background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid ${sec.badgeColor};border-radius:8px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                      <div>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="font-size:11px;font-weight:700;color:#64748b;">#${String(idx + 1).padStart(2, '0')}</span>
                          <strong style="font-size:15px;color:#1e293b;">${esc(f.title.replace(/^\[PREPRESS SCREENING\]\s*/, ''))}</strong>
                          <span class="status ${esc(f.status)}" style="font-size:10px;padding:2px 8px;border-radius:99px;text-transform:uppercase;">
                            ${esc(pf.screeningOutcome || f.status)}
                          </span>
                        </div>
                        <p style="margin:6px 0 0;font-size:13px;color:#334155;">${esc(f.explanation)}</p>
                      </div>

                      <div style="display:flex;gap:8px;">
                        <button type="button" class="secondary btn-inspect-canvas" data-action="inspect-finding-canvas" data-finding-id="${esc(f.id)}" data-page="${esc(f.evidence?.[0]?.page || 1)}" style="font-size:12px;padding:6px 12px;">
                          🔍 Inspect on 2D Artwork Canvas →
                        </button>
                      </div>
                    </div>

                    <!-- Finding 7-Point Prepress Transparency Details -->
                    <details class="finding-transparency-disclosure" style="margin-top:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;" open>
                      <summary style="font-size:12px;font-weight:600;color:#475569;cursor:pointer;">
                        Detailed Prepress Evidence &amp; Measurements
                      </summary>
                      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px;margin-top:10px;font-size:12px;line-height:1.5;">
                        <div><b style="color:#64748b;">WHAT WAS OBSERVED?</b><br><span style="color:#0f172a;">${esc(pf.observations || f.observed || 'Prepress observation')}</span></div>
                        <div><b style="color:#64748b;">WHERE WAS IT OBSERVED?</b><br><span style="color:#0f172a;">Page ${esc(f.evidence?.[0]?.page || 1)} · ${esc(pf.sourceGeometry || 'Vector text bounds')}</span></div>
                        <div><b style="color:#64748b;">WHICH SCREENING METHOD WAS USED?</b><br><span style="color:#0f172a;">${esc(pf.method || sec.method)}</span></div>
                        <div><b style="color:#64748b;">WHAT NUMERIC THRESHOLD WAS USED?</b><br><span style="color:#0f172a;">${esc(pf.threshold || f.expected || 'Specified by setting')}</span></div>
                        <div><b style="color:#64748b;">WHERE DID THAT THRESHOLD COME FROM?</b><br><span style="color:#0f172a;"><code>${esc(pf.thresholdOrigin || sec.thresholdProvenance)}</code></span></div>
                        <div><b style="color:#64748b;">WHAT IS STILL UNCERTAIN?</b><br><span style="color:#0f172a;">${esc(pf.limitations || f.verificationLimitations)}</span></div>
                        <div style="grid-column: 1 / -1;"><b style="color:#64748b;">WHAT SHOULD THE REVIEWER CHECK?</b><br><span style="color:#b45309;font-weight:600;">👉 ${esc(pf.suggestedReviewerAction || 'Inspect the rendered artwork crop at intended production scale.')}</span></div>
                      </div>
                    </details>
                  </div>
                `;
              }).join('') : `
                <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:16px;text-align:center;color:#64748b;font-size:13px;">
                  No concerns identified in this category. (Supported screening did not detect discrepancies in the inspected regions.)
                </div>
              `}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Prepress Disclaimer -->
      <footer style="margin-top:24px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:12px;color:#92400e;line-height:1.5;">
        <b>PREPRESS SCREENING DISCLAIMER:</b> These results are limited technical prepress screening observations.
        They do not establish legal labeling compliance, guaranteed readability, manufacturing tolerance conformance,
        or print-release authorization.
      </footer>
    </div>
  `;
}
