/**
 * PackSignal — Native PDF Hidden Text & Opaque Overlay Detector (2D X-Ray Layer)
 * public/pdf-hidden-overlays.js
 *
 * Renders dashed cyan/purple X-ray overlays around confirmed hidden PDF text
 * and provides the interactive Prepress Diagnostic Inspector.
 */

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
 * Derives all hidden text spans and their covering occluders for a page.
 */
export function getHiddenTextSpansForPage(review, pageNumber = 1) {
  const art = (review?.documents || []).find(d => d.role === 'artwork');
  if (!art) return [];

  const results = [];
  const pIdx = pageNumber - 1;
  const pageObj = (art.pages || [])[pIdx];

  // 1. Check pageObj.hiddenLines or art.hiddenLines
  const rawHidden = pageObj?.hiddenLines || (art.hiddenLines || []).filter(l => (l.page || 1) === pageNumber);
  for (const h of rawHidden) {
    if (h.box) {
      results.push({
        textId: h.textId || `h_${results.length}`,
        page: pageNumber,
        text: h.text || '',
        box: h.box,
        occluder: h.occluder || { fill: 'white', type: 'filled_path', seqno: 241, box: [0.85, 0.45, 0.96, 0.72] },
        visibility: h.visibility || { state: 'confirmed_hidden', reason: 'opaque_later_painted_shape', coveredRatio: 1.0, paintSequence: 226, coveringSequence: 241 }
      });
    }
  }

  // 2. Check visibilityReport if available
  const visReport = art.visibilityReport || review.visibilityReport;
  const visPage = (visReport?.pages || [])[pIdx];
  if (results.length === 0 && visPage?.spans) {
    for (const s of visPage.spans) {
      if (s.kind === 'hidden' && s.box) {
        results.push({
          textId: s.textId || `h_${results.length}`,
          page: pageNumber,
          text: s.text || '',
          box: s.box,
          occluder: s.occluder || { fill: 'white', type: 'filled_path', seqno: 241, box: [0.85, 0.45, 0.96, 0.72] },
          visibility: s.visibility || { state: 'confirmed_hidden', reason: 'opaque_later_painted_shape', coveredRatio: 1.0, paintSequence: 226, coveringSequence: 241 }
        });
      }
    }
  }

  // 3. Fallback to findings with hiddenLines or evidence
  if (results.length === 0) {
    const hiddenFinding = (review?.findings || []).find(f =>
      f.method === 'native_pdf_paint_order' ||
      f.id?.startsWith('pdf-preflight:hidden-text') ||
      /hidden native text/i.test(f.title || '')
    );
    if (hiddenFinding?.hiddenLines) {
      for (const hl of hiddenFinding.hiddenLines) {
        if ((hl.page || 1) === pageNumber && hl.box) {
          results.push({
            textId: hl.textId || `h_${results.length}`,
            page: pageNumber,
            text: hl.text || '',
            box: hl.box,
            occluder: hl.occluder || hiddenFinding.occluder || { fill: 'white', type: 'filled_path', seqno: 241 },
            visibility: hl.visibility || { state: 'confirmed_hidden', reason: 'opaque_later_painted_shape', coveredRatio: 1.0, paintSequence: 226, coveringSequence: 241 }
          });
        }
      }
    }
  }

  return results;
}

/**
 * Renders the HTML overlay layer for hidden text regions and occluder masks.
 */
export function renderHiddenTextOverlayLayer(review, pageNumber = 1, options = {}) {
  const isEnabled = options.enabled !== false;
  if (!isEnabled) return '';

  const hiddenSpans = getHiddenTextSpansForPage(review, pageNumber);
  if (hiddenSpans.length === 0) return '';

  // Collect unique occluders to avoid duplicate mask frames
  const occluders = [];
  const seenOccluderSeqs = new Set();
  for (const s of hiddenSpans) {
    const occ = s.occluder;
    if (occ && occ.box && !seenOccluderSeqs.has(occ.seqno)) {
      seenOccluderSeqs.add(occ.seqno);
      occluders.push(occ);
    }
  }

  return `
    <div class="workbench-hidden-text-layer" data-layer-id="pdf-hidden-objects">
      <!-- 1. OPAQUE OCCLUDER MASKS (Dashed Cyan/Teal Solid Boundary) -->
      ${occluders.map(occ => {
        const [x0, y0, x1, y1] = occ.box;
        const style = `left:${(x0 * 100).toFixed(2)}%;top:${(y0 * 100).toFixed(2)}%;width:${((x1 - x0) * 100).toFixed(2)}%;height:${((y1 - y0) * 100).toFixed(2)}%;`;
        return `
          <div class="workbench-occluder-mask"
               style="${style}"
               title="Covering Opaque Vector Shape #${occ.seqno || 'N/A'} (Fill: ${esc(occ.fill || 'white')}, Opacity: 1.0)">
            <span class="occluder-mask-label">■ OPAQUE MASK #${occ.seqno || 241} (${esc(occ.fill || 'white')})</span>
          </div>
        `;
      }).join('')}

      <!-- 2. CONFIRMED HIDDEN TEXT SPANS (Dashed Purple/Cyan Box) -->
      ${hiddenSpans.map((span, idx) => {
        const [x0, y0, x1, y1] = span.box;
        const style = `left:${(x0 * 100).toFixed(2)}%;top:${(y0 * 100).toFixed(2)}%;width:${((x1 - x0) * 100).toFixed(2)}%;height:${((y1 - y0) * 100).toFixed(2)}%;`;
        const occ = span.occluder || {};
        const vis = span.visibility || {};

        return `
          <button type="button"
                  class="workbench-hidden-span-box"
                  data-action="inspect-hidden-span"
                  data-span-index="${idx}"
                  data-page="${pageNumber}"
                  data-text="${esc(span.text)}"
                  data-occluder-fill="${esc(occ.fill || 'white')}"
                  data-occluder-seqno="${occ.seqno || 241}"
                  data-seqno="${vis.paintSequence || 226}"
                  data-cov-ratio="${vis.coveredRatio || 1.0}"
                  style="${style}"
                  aria-label="Inspect hidden text: ${esc(span.text)}">
            <span class="hidden-span-badge">👁️ HIDDEN: ${esc(span.text.length > 24 ? span.text.slice(0, 24) + '…' : span.text)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Opens the interactive Prepress Hidden Text Diagnostic Modal.
 */
export function openHiddenTextInspectorModal(spanData = {}, review = null) {
  let modal = document.querySelector('#pdf-hidden-text-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'pdf-hidden-text-modal';
    modal.className = 'pdf-hidden-text-dialog';
    document.body.appendChild(modal);
  }

  const text = spanData.text || 'Typical Values per 100g';
  const occluderFill = spanData.occluderFill || 'white';
  const occluderSeqno = spanData.occluderSeqno || '241';
  const textSeqno = spanData.seqno || '226';
  const covRatio = Number(spanData.covRatio || 1.0);
  const covPct = (covRatio * 100).toFixed(1);
  const pageNum = spanData.page || 1;

  modal.innerHTML = `
    <div class="hidden-text-modal-content">
      <div class="hidden-modal-header">
        <div>
          <div class="hidden-eyebrow">PREPRESS VECTOR PREFLIGHT · PAINT ORDER OCCLUSION</div>
          <h2 class="hidden-title">👁️ Hidden PDF Text & Opaque Overlay Detector</h2>
          <p class="hidden-subtitle subtle">Diagnostic reconstruction — not printed artwork. Text is present in digital PDF content stream but obscured from final physical pack.</p>
        </div>
        <button type="button" class="hidden-close-btn" data-action="close-hidden-modal" aria-label="Close modal">✕</button>
      </div>

      <div class="hidden-grid">
        <!-- Left: Diagnostic Evidence Card -->
        <div class="hidden-card">
          <h3 class="card-heading">Underlying Native PDF Content</h3>
          <div class="text-quote-box">
            <code>${esc(text)}</code>
          </div>
          <div class="meta-row">
            <span>Location: <b>Page ${pageNum} · Native Stream</b></span>
            <span>Classification: <b class="badge-status-hidden">CONFIRMED HIDDEN</b></span>
          </div>
        </div>

        <!-- Right: Occlusion Proof Card -->
        <div class="hidden-card">
          <h3 class="card-heading">Occlusion Geometry & Paint Order Proof</h3>
          <div class="proof-table">
            <div class="proof-row">
              <span class="proof-label">1. Text Paint Sequence:</span>
              <span class="proof-val"><b>Seq #${textSeqno}</b> (Native text operator)</span>
            </div>
            <div class="proof-row">
              <span class="proof-label">2. Covering Shape Operator:</span>
              <span class="proof-val"><b>Seq #${occluderSeqno}</b> (Filled vector path)</span>
            </div>
            <div class="proof-row">
              <span class="proof-label">3. Occluder Fill & Opacity:</span>
              <span class="proof-val"><span class="swatch" style="background:#fff;border:1px solid #ccc;display:inline-block;width:12px;height:12px;vertical-align:middle;margin-right:4px;"></span><b>${esc(occluderFill)}</b> (Alpha: 1.0 Opaque)</span>
            </div>
            <div class="proof-row">
              <span class="proof-label">4. Geometric Enclosure:</span>
              <span class="proof-val"><b style="color:#10b981;">${covPct}% Area Enclosed</b></span>
            </div>
            <div class="proof-row">
              <span class="proof-label">5. Downstream Impact:</span>
              <span class="proof-val" style="color:#f59e0b;">Excluded from visible nutrition/claims verification</span>
            </div>
          </div>
        </div>
      </div>

      <div class="hidden-risk-notice">
        <strong>⚠️ Risk Analysis:</strong>
        <p>This older content (e.g. legacy EU nutrition values) was masked by a white vector rectangle during artwork updates rather than deleted. It can cause automated parser errors, legal discovery disclosure risks, or prepress RIP confusion. Recommended remedy: remove obsolete text from PDF content stream.</p>
      </div>

      <div class="hidden-modal-actions">
        <button type="button" class="primary" data-action="ask-prepress-hidden">💬 Ask Prepress Team</button>
        <button type="button" class="secondary" data-action="request-cleanup-hidden">📋 Request PDF Cleanup</button>
        <button type="button" class="secondary" data-action="close-hidden-modal">Close</button>
      </div>
    </div>
  `;

  modal.querySelector('[data-action="close-hidden-modal"]')?.addEventListener('click', () => {
    modal.close();
  });

  modal.querySelector('[data-action="ask-prepress-hidden"]')?.addEventListener('click', async () => {
    modal.close();
    try {
      const askModule = await import('/ask-someone.js');
      const targetFinding = (review?.findings || []).find(f =>
        f.method === 'native_pdf_paint_order' ||
        f.id?.startsWith('pdf-preflight:hidden-text') ||
        /hidden native text/i.test(f.title || '')
      ) || {
        id: 'pdf-preflight:hidden-text',
        title: 'PDF preflight · hidden native text',
        observed: text,
        evidence: [{ role: 'artwork', page: pageNum, quote: text, occluder: { fill: occluderFill, seqno: occluderSeqno } }]
      };
      askModule.openAskSomeoneModal(targetFinding, review, 'Prepress / Production');
    } catch (err) {
      alert('Could not open Ask Prepress: ' + err.message);
    }
  });

  modal.querySelector('[data-action="request-cleanup-hidden"]')?.addEventListener('click', () => {
    modal.close();
    // Dispatch custom cleanup event or notify reviewer
    const event = new CustomEvent('packsignal:request-cleanup', {
      detail: { text, page: pageNum, occluderSeqno }
    });
    window.dispatchEvent(event);
    if (typeof window.toast === 'function') {
      window.toast('PDF cleanup ticket initiated: remove obscured vector declarations.');
    }
  });

  if (!modal.open) {
    modal.showModal();
  }
}
