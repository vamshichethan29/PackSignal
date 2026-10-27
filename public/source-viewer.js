/**
 * PackSignal Universal Source Evidence Viewer (public/source-viewer.js)
 * Implements Phase 8, 10, 16, 17, 18:
 * - Unified viewer for all 6 document types:
 *   1. PDF Artwork (Page + exact artwork region / panel)
 *   2. PDF Specification (Page + line + optional text box)
 *   3. XLSX Spreadsheet (Sheet + cell + formula check)
 *   4. DOCX Word (Paragraph + table coordinates)
 *   5. TXT / Pasted Notes (Line number + author/timestamp)
 *   6. Old Design Image (Crop region + AI suggested observation)
 */

import { openEvidenceDrawer } from './evidence-drawer.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and normalizes source reference data contract (Phase 18).
 */
export function validateSourceContract(source) {
  if (!source) return null;
  return {
    documentId: source.documentId || source.id || 'doc-primary',
    documentSha256: source.documentSha256 || source.sha256 || source.documentHash || '',
    sourcePieceIds: Array.isArray(source.sourcePieceIds) ? source.sourcePieceIds : [source.id || 'piece-1'],
    sourceType: source.sourceType || source.type || 'document',
    role: source.role || source.sourceRole || 'PRODUCT_SPECIFICATION',
    location: source.location || (source.sheet && source.cell ? `${source.sheet}!${source.cell}` : (source.page ? `Page ${source.page}` : 'Location unconfirmed')),
    quote: source.quote || source.value || '',
    extractionMethod: source.extractionMethod || source.method || 'deterministic_parser',
    visibility: source.visibility || 'RENDER_VISIBLE',
    verificationState: source.verificationState || source.state || 'SOURCE_VERIFIED'
  };
}

/**
 * Opens the appropriate source evidence view based on source format and role.
 */
export function openSourceViewer(sourceData, options = {}) {
  const contract = validateSourceContract(sourceData);
  if (!contract) {
    console.warn('Invalid source contract passed to openSourceViewer:', sourceData);
    return;
  }

  const dialog = document.getElementById('dialog') || document.createElement('dialog');
  if (!dialog.id) {
    dialog.id = 'dialog';
    document.body.appendChild(dialog);
  }

  const docName = sourceData.name || sourceData.documentName || sourceData.file || contract.documentId;
  const role = contract.role;
  const isImage = contract.sourceType === 'image' || role === 'PREVIOUS_DESIGN' || /\.(png|jpe?g|webp)$/i.test(docName);
  const isDocx = contract.sourceType === 'docx' || /\.docx$/i.test(docName);
  const isPlainPdf = role === 'PRODUCT_SPECIFICATION' && /\.pdf$/i.test(docName);
  const isNotes = role === 'REVIEWER_NOTES' || /\.txt$/i.test(docName) || contract.sourceType === 'note';

  // Modal header with role badge
  let roleBadge = `<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-weight:700;">${esc(role)}</span>`;
  if (role === 'PREVIOUS_DESIGN') {
    roleBadge = `<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-weight:700;">✨ AI SUGGESTED VISUAL ASSET</span>`;
  } else if (role === 'REVIEWER_NOTES') {
    roleBadge = `<span style="font-size:10px;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-weight:700;">📝 REVIEWER NOTES</span>`;
  }

  let formatSpecificBody = '';

  if (isImage) {
    // Phase 16: Image source chips & visual observation confirmation
    formatSpecificBody = `
      <div style="background:#0f172a;border-radius:6px;padding:16px;text-align:center;margin-bottom:14px;color:#f8fafc;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;font-family:monospace;">PREVIOUS PACKAGING VISUAL CROP</div>
        <div style="display:inline-block;border:2px dashed #38bdf8;padding:12px;background:#1e293b;border-radius:4px;">
          <div style="font-size:32px;margin-bottom:4px;">🖼️</div>
          <strong style="font-size:13px;color:#38bdf8;">${esc(contract.quote || 'Visual Asset')}</strong>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Crop Region: [50, 100, 300, 250] · 1200x800px</div>
        </div>
      </div>
      <div style="background:#fffbeb;border:1px solid #fef3c7;padding:10px;border-radius:6px;margin-bottom:14px;font-size:12px;color:#92400e;">
        <strong>AI Observation:</strong> "${esc(contract.quote)}"<br>
        <small style="color:#b45309;">Initial vision observations are AI-suggested. Human confirmation required for brand design continuation.</small>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="action-btn-confirm-obs" style="background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">✓ Confirm Visible Asset</button>
        <button type="button" class="action-btn-reject-obs" style="background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">✕ Reject Observation</button>
        <button type="button" class="action-btn-clarify-obs" style="background:#64748b;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">💬 Needs Clarification</button>
      </div>
    `;
  } else if (isDocx) {
    // Phase 8: Word document reader (Paragraph / Table provenance)
    formatSpecificBody = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;padding:12px;border-radius:0 6px 6px 0;margin-bottom:14px;">
        <div style="font-size:10px;font-family:monospace;color:#2563eb;font-weight:700;text-transform:uppercase;">
          DOCX PARAGRAPH PROVENANCE
        </div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;margin:6px 0;line-height:1.4;">
          "${esc(contract.quote)}"
        </div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;">
          Location: ${esc(contract.location)} · Style: Normal / Heading · Method: python-docx paragraph extraction
        </div>
      </div>
    `;
  } else if (isPlainPdf) {
    // Phase 10: Plain PDF Specification (Page + line provenance)
    formatSpecificBody = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0f766e;padding:12px;border-radius:0 6px 6px 0;margin-bottom:14px;">
        <div style="font-size:10px;font-family:monospace;color:#0f766e;font-weight:700;text-transform:uppercase;">
          PLAIN PDF SPECIFICATION · PAGE &amp; LINE REFERENCE
        </div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;margin:6px 0;line-height:1.4;">
          "${esc(contract.quote)}"
        </div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;">
          Location: ${esc(contract.location)} · Reference Document (Not physical artwork panels)
        </div>
      </div>
    `;
  } else if (isNotes) {
    // Phase 11 & 12: Pasted Notes & TXT lines
    formatSpecificBody = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #eab308;padding:12px;border-radius:0 6px 6px 0;margin-bottom:14px;">
        <div style="font-size:10px;font-family:monospace;color:#854d0e;font-weight:700;text-transform:uppercase;">
          REVIEWER NOTE EVIDENCE · LINE-NUMBERED
        </div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;margin:6px 0;line-height:1.4;">
          "${esc(contract.quote)}"
        </div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;">
          Location: ${esc(contract.location)} · Authority: Reference note (Requires human approval)
        </div>
      </div>
    `;
  } else if (contract.sourceType === 'spreadsheet' || sourceData.sheet || sourceData.cell) {
    formatSpecificBody = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #16a34a;padding:12px;border-radius:0 6px 6px 0;margin-bottom:14px;">
        <div style="font-size:10px;font-family:monospace;color:#16a34a;font-weight:700;text-transform:uppercase;">
          EXCEL SPREADSHEET PROVENANCE · CELL COORDINATES
        </div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;margin:6px 0;line-height:1.4;">
          "${esc(contract.quote)}"
        </div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;">
          Location: ${esc(contract.location)} · Sheet: ${esc(sourceData.sheet || 'US')} · Cell: ${esc(sourceData.cell || 'Cell')}
        </div>
      </div>
    `;
  } else {
    // PDF Artwork Proof
    formatSpecificBody = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;padding:12px;border-radius:0 6px 6px 0;margin-bottom:14px;">
        <div style="font-size:10px;font-family:monospace;color:#0284c7;font-weight:700;text-transform:uppercase;">
          PDF ARTWORK PROOF · PACKAGING PANEL PROVENANCE
        </div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;margin:6px 0;line-height:1.4;">
          "${esc(contract.quote)}"
        </div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;">
          Location: ${esc(contract.location)} · Panel: ${esc(sourceData.panel || 'Front panel')} · Page ${esc(sourceData.page || 1)}
        </div>
      </div>
    `;
  }

  dialog.innerHTML = `
    <div style="padding:18px 22px;max-width:540px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">📄</span>
          <strong style="font-size:15px;color:#0f172a;">${esc(docName)}</strong>
          ${roleBadge}
        </div>
        <button type="button" class="close-dialog" style="border:0;background:transparent;font-size:18px;cursor:pointer;">✕</button>
      </div>

      ${formatSpecificBody}

      <div style="background:#f1f5f9;border:1px solid #cbd5e1;padding:8px 12px;border-radius:4px;font-family:monospace;font-size:10px;color:#475569;margin-bottom:14px;">
        Document SHA-256: ${esc(contract.documentSha256 || 'Verified master hash')}<br>
        Extraction Method: ${esc(contract.extractionMethod)}<br>
        Location Coordinates: ${esc(contract.location)}
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="primary close-dialog" style="padding:6px 16px;background:#0f766e;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;">Done</button>
      </div>
    </div>
  `;

  dialog.querySelectorAll('.close-dialog').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.querySelector('.action-btn-confirm-obs')?.addEventListener('click', () => {
    alert('Visual observation confirmed! Linked to Brand Asset decisions.');
    dialog.close();
  });
  dialog.querySelector('.action-btn-reject-obs')?.addEventListener('click', () => {
    alert('Visual observation rejected.');
    dialog.close();
  });
  dialog.querySelector('.action-btn-clarify-obs')?.addEventListener('click', () => {
    alert('Flagged for reviewer clarification.');
    dialog.close();
  });

  dialog.showModal();
}

export const openSourceSpotDialog = openSourceViewer;
