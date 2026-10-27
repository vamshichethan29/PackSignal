/**
 * PackSignal Packaging Geometry Workbench
 * (public/packaging-geometry.js)
 *
 * Implements Step 23, 24, 25:
 * Dedicated tab for panel inference, structural boundaries, fold adjacency graph, and layout-fit screening.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function packagingGeometryView(review) {
  const geom = review?.packagingGeometry || {};
  const coverage = geom.coverage || {};
  const panels = geom.panels || [];
  const foldGraph = geom.foldGraph || { nodes: [], edges: [] };
  const registration = geom.registration || { status: 'UNKNOWN', verified: false };
  const layoutFits = geom.layoutFits || [];
  const panelRules = (review?.findings || []).filter(f => f.method?.includes('panel') || f.key?.startsWith('panel-'));

  const dielineDoc = review?.documents?.find(d => d.role === 'dieline') || review?.documents?.find(d => d.role === 'artwork');
  const dielineName = dielineDoc?.name || 'No Dieline Document';
  const units = coverage.units || dielineDoc?.pages?.[0]?.unit || 'unverified';

  // Section A: Summary
  const summaryHtml = `
    <div class="geometry-summary-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Dieline Source</div>
        <div style="font-weight:600;color:#1e293b;margin-top:4px;">${esc(dielineName)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Format: ${esc(coverage.dielineFormat || 'Vector')}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Physical Scale</div>
        <div style="font-weight:600;color:#1e293b;margin-top:4px;">${esc(units)}</div>
        <div style="font-size:11px;color:${units === 'unverified' ? '#b45309' : '#15803d'};margin-top:2px;">
          ${units === 'unverified' ? '⚠ Scale unverified' : '✓ Verified physical scale'}
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Registration Status</div>
        <div style="font-weight:600;color:#1e293b;margin-top:4px;">${esc(registration.status || 'UNREGISTERED')}</div>
        <div style="font-size:11px;color:${registration.verified ? '#15803d' : '#b45309'};margin-top:2px;">
          ${registration.verified ? '✓ Alignment Verified' : '⚠ Action Required'}
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Detected Panels</div>
        <div style="font-weight:600;color:#1e293b;margin-top:4px;">${panels.length} Closed Polygons</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">
          ${coverage.panelCounts?.confirmed || 0} confirmed · ${coverage.panelCounts?.unresolved || 0} unresolved
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Fold Connectivity</div>
        <div style="font-weight:600;color:#1e293b;margin-top:4px;">${foldGraph.edges?.length || 0} Crease Hinges</div>
        <div style="font-size:11px;color:${foldGraph.isFullyConnected ? '#15803d' : '#b45309'};margin-top:2px;">
          ${foldGraph.isFullyConnected ? '✓ Continuous Net' : 'Disconnected Components'}
        </div>
      </div>
    </div>
  `;

  // Action Bar for Registration
  const registrationBar = !registration.verified ? `
    <div class="notice warn" style="display:flex;justify-content:space-between;align-items:center;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
      <div>
        <strong style="color:#b45309;">Registration Alignment Needed:</strong>
        <span style="color:#78350f;margin-left:6px;">Artwork and dieline require confirmed coordinate transformation before clearance screening can pass.</span>
      </div>
      <button type="button" class="primary" style="background:#b45309;font-size:12px;padding:6px 12px;" data-action="geometry-align-dieline">Align Artwork to Dieline →</button>
    </div>
  ` : '';

  // Section B: Panel Map
  const panelMapHtml = `
    <div style="margin-bottom:28px;">
      <h3 style="margin-bottom:6px;font-size:16px;color:#1e293b;">B. Panel Map &amp; Face Inference</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:12px;">Evidence-based carton face inference with reviewer confirmation workflow. No confidence percentages are fabricated.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
        ${panels.map(p => {
          const isConfirmed = p.verificationState === 'REVIEWER_CONFIRMED';
          const isLabeled = p.verificationState === 'EXPLICITLY_LABELED';
          const isAmbiguous = p.verificationState === 'AMBIGUOUS';
          const badgeBg = isConfirmed ? '#dcfce7' : isLabeled ? '#e0e7ff' : isAmbiguous ? '#fee2e2' : '#f1f5f9';
          const badgeColor = isConfirmed ? '#15803d' : isLabeled ? '#3730a3' : isAmbiguous ? '#991b1b' : '#475569';

          return `
            <div class="panel-card" style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#ffffff;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-weight:700;font-size:15px;color:#0f172a;">${esc(p.face.toUpperCase())}</span>
                  <span style="background:${badgeBg};color:${badgeColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;">${esc(p.verificationState)}</span>
                </div>
                <div style="font-size:12px;color:#64748b;margin-bottom:6px;">ID: <code>${esc(p.panelId)}</code></div>
                <div style="font-size:12px;color:#334155;line-height:1.4;margin-bottom:10px;">
                  ${esc(p.inferenceReason || 'Detected structural boundary.')}
                </div>
                <div style="font-size:11px;color:#94a3b8;font-family:monospace;">
                  Bounds: [${p.boundingBox.map(v => v.toFixed(3)).join(', ')}]
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;">
                ${!isConfirmed ? `
                  <button type="button" class="button secondary" style="font-size:11px;padding:4px 8px;" data-action="geometry-confirm-panel" data-panel-id="${esc(p.panelId)}" data-face="${esc(p.face)}" data-box='${JSON.stringify(p.boundingBox)}'>Confirm Face ✓</button>
                ` : `
                  <span style="font-size:11px;color:#15803d;font-weight:600;display:inline-flex;align-items:center;">✓ Confirmed</span>
                `}
                <button type="button" class="button secondary" style="font-size:11px;padding:4px 8px;" data-action="geometry-focus-panel" data-box='${JSON.stringify(p.boundingBox)}'>Focus 2D 🔍</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Section C: Structural Features
  const structuralHtml = `
    <div style="margin-bottom:28px;">
      <h3 style="margin-bottom:6px;font-size:16px;color:#1e293b;">C. Structural Features &amp; Line Classification</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:12px;">Structural edges categorized by CAD layer tokens (cut, crease, glue, bleed). Colors adhere to prepress packaging conventions.</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;background:#f8fafc;padding:12px 16px;border-radius:6px;border:1px solid #e2e8f0;font-size:13px;">
        <div><span style="display:inline-block;width:12px;height:12px;background:#d94f3d;border-radius:2px;margin-right:6px;vertical-align:middle;"></span><b>Cut Lines:</b> ${coverage.lineCounts?.cut || 0}</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#367aa1;border-radius:2px;margin-right:6px;vertical-align:middle;"></span><b>Crease Lines:</b> ${coverage.lineCounts?.crease || 0}</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#c28b20;border-radius:2px;margin-right:6px;vertical-align:middle;"></span><b>Glue Areas:</b> ${coverage.lineCounts?.glue || 0}</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#8b62a5;border-radius:2px;margin-right:6px;vertical-align:middle;"></span><b>Bleed Guides:</b> ${coverage.lineCounts?.bleed || 0}</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#64748b;border-radius:2px;margin-right:6px;vertical-align:middle;"></span><b>Unclassified:</b> ${coverage.lineCounts?.unknown || 0}</div>
      </div>
    </div>
  `;

  // Section D: Fold Graph
  const foldGraphHtml = `
    <div style="margin-bottom:28px;">
      <h3 style="margin-bottom:6px;font-size:16px;color:#1e293b;">D. Fold Adjacency Graph</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:12px;">Topological fold connections verified across shared collinear boundaries of non-zero length.</p>
      ${foldGraph.edges?.length > 0 ? `
        <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;text-align:left;color:#475569;">
                <th style="padding:8px 12px;">Connected Panels</th>
                <th style="padding:8px 12px;">Hinge Type</th>
                <th style="padding:8px 12px;">Shared Length</th>
                <th style="padding:8px 12px;">Verification Status</th>
              </tr>
            </thead>
            <tbody>
              ${foldGraph.edges.map(e => `
                <tr style="border-top:1px solid #e2e8f0;">
                  <td style="padding:8px 12px;font-weight:600;">${esc(e.faceA.toUpperCase())} ⟷ ${esc(e.faceB.toUpperCase())}</td>
                  <td style="padding:8px 12px;"><span class="pill" style="font-size:10px;">${esc(e.boundaryType)}</span></td>
                  <td style="padding:8px 12px;font-family:monospace;">${(e.sharedBoundaryLength * 100).toFixed(1)}% dieline span</td>
                  <td style="padding:8px 12px;color:#15803d;font-weight:600;">${esc(e.verificationState)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;color:#64748b;font-size:13px;">
          No shared crease boundaries detected between panel polygons.
        </div>
      `}
    </div>
  `;

  // Section E: Panel Placement Rules
  const panelRulesHtml = `
    <div style="margin-bottom:28px;">
      <h3 style="margin-bottom:6px;font-size:16px;color:#1e293b;">E. Panel Placement Rules</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:12px;">Deterministic verification of required copy placement and cut/crease boundary clearances.</p>
      ${panelRules.length > 0 ? `
        <div style="display:grid;gap:10px;">
          ${panelRules.map(r => {
            const statusBg = r.status === 'match' ? '#dcfce7' : r.status === 'issue' ? '#fee2e2' : '#fef3c7';
            const statusColor = r.status === 'match' ? '#15803d' : r.status === 'issue' ? '#b91c1c' : '#b45309';
            return `
              <div style="border:1px solid #e2e8f0;border-left:4px solid ${statusColor};border-radius:6px;padding:12px 14px;background:#ffffff;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:14px;color:#0f172a;">${esc(r.title)}</strong>
                  <span style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;text-transform:uppercase;">${esc(r.status)}</span>
                </div>
                <div style="font-size:12px;color:#475569;margin-bottom:4px;">${esc(r.explanation)}</div>
                <div style="font-size:11px;color:#64748b;">
                  <b>Expected:</b> ${esc(r.expected)} · <b>Observed:</b> ${esc(r.observed)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;color:#64748b;font-size:13px;">
          No panel-specific rules currently compiled. Add a rule requiring copy on a specific panel in Rulebook Trust.
        </div>
      `}
    </div>
  `;

  // Section F: Layout Fit
  const layoutFitHtml = `
    <div style="margin-bottom:28px;">
      <h3 style="margin-bottom:6px;font-size:16px;color:#1e293b;">F. Bounded Layout-Fit Assessment</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:12px;">Evaluates whether approved copy fits inside safe copy regions at source-specified minimum font sizes without modifying text or original PDF.</p>
      ${layoutFits.length > 0 ? `
        <div style="display:grid;gap:12px;">
          ${layoutFits.map(lf => {
            const isOverflow = lf.outcome === 'OVERFLOW_RISK';
            const badgeBg = isOverflow ? '#fee2e2' : '#dcfce7';
            const badgeColor = isOverflow ? '#b91c1c' : '#15803d';

            return `
              <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#ffffff;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong style="font-size:14px;color:#0f172a;">Target Panel: ${esc(lf.face?.toUpperCase() || 'UNASSIGNED')}</strong>
                  <span style="background:${badgeBg};color:${badgeColor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;">${esc(lf.outcome)}</span>
                </div>
                <div style="font-size:13px;color:#334155;margin-bottom:8px;">
                  ${lf.reasons?.map(r => `<div>• ${esc(r)}</div>`).join('') || ''}
                </div>
                ${lf.recommendations?.length > 0 ? `
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-top:10px;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Bounded Design Options</div>
                    ${lf.recommendations.map(rec => `<div style="font-size:12px;color:#0369a1;margin-bottom:2px;">→ ${esc(rec)}</div>`).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;color:#64748b;font-size:13px;">
          No layout-fit screens executed. Rules specifying minimum font sizes on target panels will evaluate available space here.
        </div>
      `}
    </div>
  `;

  return `
    <div class="packaging-geometry-studio" style="max-width:1100px;margin:0 auto;padding:10px 0;">
      <div style="margin-bottom:20px;">
        <h2 style="font-size:22px;color:#0f172a;margin-bottom:4px;">PACKAGING GEOMETRY &amp; LAYOUT WORKBENCH</h2>
        <p style="font-size:14px;color:#64748b;">Panel inference, structural boundaries and layout-fit screening.</p>
      </div>
      ${summaryHtml}
      ${registrationBar}
      ${panelMapHtml}
      ${structuralHtml}
      ${foldGraphHtml}
      ${panelRulesHtml}
      ${layoutFitHtml}
      <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:20px;font-size:12px;color:#94a3b8;line-height:1.5;">
        ${(coverage.limitations || []).map(l => `<div>• ${esc(l)}</div>`).join('')}
      </div>
    </div>
  `;
}

export function mountPackagingGeometry(container, { reviewId, api, onReviewUpdated }) {
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const alignBtn = e.target.closest('[data-action="geometry-align-dieline"]');
    if (alignBtn) {
      alignBtn.disabled = true;
      alignBtn.textContent = 'Aligning…';
      try {
        const res = await api.request(`/api/reviews/${reviewId}/geometry/align`, {
          method: 'POST',
          body: JSON.stringify({
            matrix: [1, 0, 0, 1, 0, 0],
            method: 'REVIEWER_CONFIRMED',
            reason: 'Reviewer confirmed dieline and artwork coordinate alignment.'
          })
        });
        if (onReviewUpdated && res.review) {
          onReviewUpdated(res.review);
        }
      } catch (err) {
        alert('Registration error: ' + (err.message || err));
      } finally {
        alignBtn.disabled = false;
      }
      return;
    }

    const confirmPanelBtn = e.target.closest('[data-action="geometry-confirm-panel"]');
    if (confirmPanelBtn) {
      const panelId = confirmPanelBtn.getAttribute('data-panel-id');
      const face = confirmPanelBtn.getAttribute('data-face');
      const boxJson = confirmPanelBtn.getAttribute('data-box');
      let box = null;
      try { box = JSON.parse(boxJson); } catch {}

      confirmPanelBtn.disabled = true;
      confirmPanelBtn.textContent = 'Confirming…';
      try {
        const res = await api.request(`/api/reviews/${reviewId}/geometry/confirm-panel`, {
          method: 'POST',
          body: JSON.stringify({
            panelId,
            face,
            box,
            reason: `Reviewer explicitly confirmed panel as ${face.toUpperCase()}`
          })
        });
        if (onReviewUpdated && res.review) {
          onReviewUpdated(res.review);
        }
      } catch (err) {
        alert('Panel confirmation error: ' + (err.message || err));
      } finally {
        confirmPanelBtn.disabled = false;
      }
      return;
    }

    const focusBtn = e.target.closest('[data-action="geometry-focus-panel"]');
    if (focusBtn) {
      const boxJson = focusBtn.getAttribute('data-box');
      try {
        const box = JSON.parse(boxJson);
        window.dispatchEvent(new CustomEvent('packsignal:focus-artwork-box', { detail: { box } }));
      } catch {}
    }
  });
}
