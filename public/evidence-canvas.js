import { artworkOccurrences, normalizeEvidenceBox, markersAt, clusterMarkers, filterFindings } from './evidence-geometry.js';
import { zoomAt } from './artwork-viewport.js';
import { renderDepartmentFilterBar, renderDepartmentBadge, filterFindingsByDepartment } from './department-filters.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {issue:'Issue', review:'Human review', match:'Match', unable:'Unable to verify'};
const symbols = {issue:'!', review:'?', match:'✓', unable:'—'};
const imageURL = (review, page) => `/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}`;

export function mountEvidenceCanvas(root, options = {}) {
  const { review, viewport, selectedId, evidenceIndex = 0, pageNumber = 1, initialFilter = 'all', onSelect, onPage, shopperPersona = 'all', onPersonaChange, overlayMode: initialOverlayMode = 'all' } = options;
  const frame = root?.querySelector('[data-workbench-frame]');
  if (!frame || !viewport || frame.dataset.evidenceMounted) return;
  frame.dataset.evidenceMounted = 'true';
  const workspace = root.querySelector('.review-workbench');
  workspace.classList.add('evidence-workstation');
  const queue = root.querySelector('.workbench-queue');
  const content = frame.querySelector('[data-workbench-image]');
  const img = content.querySelector('img');
  const controls = frame.closest('.workbench-artwork');
  const pages = review.documents.filter(d => d.role === 'artwork').flatMap(document => (document.pages || []).filter(p => p.image).map(page => ({document, page, key:`${document.id}:${page.number}`})));
  if (!pages.length) return;
  const markers = review.findings.flatMap(finding => artworkOccurrences(review, finding));
  const views = new Map(), cleanups = [];
  let currentPage = pages.find(p => p.page.number === pageNumber) || pages[0];
  let selected = review.findings.find(f => f.id === selectedId) || review.findings[0];
  let activeIndex = evidenceIndex, filter = initialFilter, query = '', overlayMode = initialOverlayMode, labelsVisible = true;
  let activeDept = 'all', includeCollab = true;
  let activePersona = shopperPersona || 'all';
  let disposed = false, densityMode = null, pendingFocus = null;
  const on = (node, event, callback, options) => { node.addEventListener(event,callback,options); cleanups.push(() => node.removeEventListener(event,callback,options)); };
  const currentMarkers = () => {
    if (overlayMode === 'none') return [];
    if (overlayMode === 'selected') {
      const occ = selectedOccurrence();
      return (occ && occ.document.id === currentPage.document.id && occ.page.number === currentPage.page.number) ? [occ] : [];
    }
    return markers.filter(m => m.document.id === currentPage.document.id && m.page.number === currentPage.page.number && (overlayMode !== 'issues' || m.finding.status === 'issue'));
  };
  const selectedOccurrence = () => markers.find(m => m.finding.id === selected?.id && m.index === activeIndex);
  content.querySelectorAll('.workbench-region,.workbench-diff-card').forEach(node => node.remove());
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox','0 0 1000 1000'); svg.setAttribute('preserveAspectRatio','none');
  svg.classList.add('evidence-overlay'); svg.setAttribute('aria-label','Located artwork findings');
  content.append(svg);
  const chooser = document.createElement('div'); chooser.className = 'evidence-chooser'; chooser.hidden = true;
  chooser.setAttribute('role','dialog'); chooser.setAttribute('aria-label','Choose overlapping finding');
  frame.append(chooser);
  const loupe = document.createElement('div');
  loupe.className = 'evidence-loupe';
  loupe.hidden = true;
  loupe.setAttribute('aria-hidden', 'true');
  loupe.innerHTML = '<div class="evidence-loupe-lens"><img src="" alt="" draggable="false"></div><div class="evidence-loupe-crosshair"></div><span class="evidence-loupe-zoom">2.5×</span>';
  frame.append(loupe);
  const loupeImg = loupe.querySelector('img');
  let loupeActive = false;
  const notice = document.createElement('p'); notice.className = 'canvas-notice'; notice.setAttribute('role','status');
  frame.after(notice);
  const tools = document.createElement('div'); tools.className = 'evidence-tools';
  tools.innerHTML = `<div class="tools-page-group"><button type="button" data-canvas-prev aria-label="Previous page">← Page</button><button type="button" data-canvas-next aria-label="Next page">Page →</button></div><div class="tools-zoom-group"><button type="button" data-canvas-zoomout aria-label="Zoom out" title="Zoom out">−</button><button type="button" data-canvas-fit aria-label="Fit to page">Fit</button><button type="button" data-canvas-actual aria-label="Actual pixels 100%">1:1</button><button type="button" data-canvas-zoomin aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-canvas-focus aria-label="Focus selected finding">Focus</button><button type="button" data-canvas-reset aria-label="Reset view">Full page</button></div><button type="button" data-canvas-loupe aria-pressed="false" title="Toggle interactive magnifier lens (M)">🔍 Loupe</button><label>Overlays <select data-overlay-mode><option value="selected" ${overlayMode==='selected'?'selected':''}>Focused finding boundary</option><option value="issues" ${overlayMode==='issues'?'selected':''}>All issue boundaries</option><option value="all" ${overlayMode==='all'?'selected':''}>All check boundaries</option><option value="none" ${overlayMode==='none'?'selected':''}>Clean carton (no boundaries)</option></select></label><label><input type="checkbox" data-overlay-labels checked> Labels</label><button type="button" data-inspector-toggle aria-expanded="true">Evidence inspector</button>`;
  controls.querySelector('.artwork-navigation')?.after(tools);
  const thumbnails = document.createElement('nav'); thumbnails.className = 'evidence-pages'; thumbnails.setAttribute('aria-label','Artwork pages');
  controls.append(thumbnails);
  const pageSelect = controls.querySelector('[data-workbench-page]');
  // Document ID is part of the page key: two uploaded documents can both have page 1.
  if (pageSelect) {
    pageSelect.innerHTML = pages.map((p,i) => `<option value="${i}">${esc(p.document.name)} · Page ${p.page.number}</option>`).join('');
  }
  
  function updateDeptBar() {
    const existingBar = queue.querySelector('[data-dept-filter-bar]');
    if (existingBar) {
      existingBar.outerHTML = renderDepartmentFilterBar(review, activeDept, includeCollab);
    }
  }

  queue.innerHTML = `
    <div class="queue-head"><b>Findings explorer</b><span>${review.findings.length} checks</span></div>
    ${renderDepartmentFilterBar(review, activeDept, includeCollab)}
    <div class="queue-filters-row" style="display:flex;align-items:center;gap:6px;margin:6px 0;">
      <label class="shopper-persona-filter-label" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#0f172a;">
        <span>👥 Shopper Lens:</span>
        <select data-action="filter-queue-persona" class="shopper-view-select" style="padding:2px 6px;border-radius:4px;border:1px solid #cbd5e1;font-size:11px;background:#fff;font-weight:600;cursor:pointer;">
          <option value="all" ${activePersona==='all'?'selected':''}>All Shoppers</option>
          <option value="nut-allergy" ${activePersona==='nut-allergy'?'selected':''}>🥜 Nut Allergy</option>
          <option value="vegan" ${activePersona==='vegan'?'selected':''}>🌱 Vegan</option>
          <option value="sugar-watcher" ${activePersona==='sugar-watcher'?'selected':''}>🩺 Sugar Watcher</option>
        </select>
      </label>
    </div>
    <label class="evidence-search">Search findings<input type="search" data-evidence-search placeholder="Title, rule, actual or expected…"></label>
    <label class="evidence-search">Filter<select data-evidence-filter>${[['all','All findings'],['issue','Issues'],['review','Human review'],['match','Matches'],['unable','Unable to verify'],['located','Located findings'],['unlocated','Unlocated findings'],['attention','All needing attention']].map(([value,title])=>`<option value="${value}">${title}</option>`).join('')}</select></label>
    <div class="queue-list"></div>
  `;
  queue.querySelector('[data-evidence-filter]').value = filter;

  on(queue, 'click', e => {
    const btn = e.target.closest('[data-action="filter-department"]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      activeDept = btn.dataset.department || 'all';
      updateDeptBar();
      drawQueue();
    }
  });

  on(queue, 'change', e => {
    if (e.target.matches('[data-action="toggle-collab-dept"]')) {
      includeCollab = e.target.checked;
      updateDeptBar();
      drawQueue();
    }
    if (e.target.matches('[data-action="filter-queue-persona"], [data-action="select-shopper-persona"]')) {
      activePersona = e.target.value;
      if (typeof onPersonaChange === 'function') {
        onPersonaChange(activePersona);
      }
      drawQueue();
    }
  });

  function drawQueue() {
    let rows = filterFindings(review,filter,query);
    rows = filterFindingsByDepartment(rows, activeDept, includeCollab);
    if (activePersona && activePersona !== 'all' && typeof window !== 'undefined' && window.shopperPersonas?.isFindingRelevantToPersona) {
      rows = rows.filter(f => window.shopperPersonas.isFindingRelevantToPersona(f, activePersona));
    }
    queue.querySelector('.queue-list').innerHTML = rows.map(f => {
      const occurrences = markers.filter(m => m.finding.id === f.id), first = occurrences[0];
      return `<button type="button" class="queue-finding ${esc(f.status)} ${f.id === selected?.id?'selected':''}" data-id="${esc(f.id)}" data-action="select-finding" data-canvas-finding="${esc(f.id)}" aria-current="${f.id === selected?.id}"><span class="queue-index">${review.findings.indexOf(f)+1}</span><span class="queue-copy"><b>${esc(f.title)}</b>${renderDepartmentBadge(f)}<small>${esc(labels[f.status])}${f.severity?` · Severity: ${esc(f.severity)}`:''}</small><small>Rule: ${esc(f.rule?.id || 'Not assigned')}</small><small>${occurrences.length} located occurrence${occurrences.length===1?'':'s'}${first?` · Page ${first.page.number}${first.evidence.panel?` · ${esc(first.evidence.panel)}`:''}`:' · No precise location'}</small></span><span class="queue-status">${esc(symbols[f.status])}</span></button>`;
    }).join('') || '<p class="queue-empty">No findings match this search. The current inspection remains selected.</p>';
  }

  function drawPages() {
    pageSelect.value = String(pages.indexOf(currentPage));
    tools.querySelector('[data-canvas-prev]').disabled = pages.indexOf(currentPage) === 0;
    tools.querySelector('[data-canvas-next]').disabled = pages.indexOf(currentPage) === pages.length-1;
    thumbnails.hidden = pages.length < 2;
    thumbnails.innerHTML = pages.map((p,i) => {
      const located = markers.filter(m => m.document.id === p.document.id && m.page.number === p.page.number);
      const ids = status => new Set(located.filter(m => !status || m.finding.status === status).map(m => m.finding.id)).size;
      return `<button type="button" data-canvas-page="${i}" aria-current="${p===currentPage}" aria-label="${esc(p.document.name)}, page ${p.page.number}, ${ids()} located findings"><img src="${imageURL(review,p.page)}" alt="" loading="lazy"><b>Page ${p.page.number}</b><small>${ids()} located · ${ids('issue')} issues · ${ids('review')} review</small></button>`;
    }).join('');
  }

  function drawMarkers() {
    const list = currentMarkers(), view = viewport.getView(), layout = viewport.getLayout();
    svg.style.setProperty('--svg-font-factor', String(1000/layout.pageHeight));
    const clustered = view.scale < 1.8;
    densityMode = clustered;
    const groups = clustered ? clusterMarkers(list, layout.pageWidth*view.scale, layout.pageHeight*view.scale) : list.map(m=>({members:[m]}));
    const display = [];
    for (const group of groups) {
      const selectedMember = group.members.find(m => m.finding.id === selected?.id && m.index === activeIndex);
      if (group.members.length > 1) {
        display.push(`<g role="button" tabindex="0" data-cluster="${esc(group.members.map(m=>m.key).join('|'))}" aria-label="Choose ${group.members.length} nearby evidence regions" class="evidence-cluster" transform="translate(${group.x*1000} ${group.y*1000})"><rect x="-16" y="-16" width="32" height="32" rx="8" vector-effect="non-scaling-stroke"/><text text-anchor="middle" y="5">${group.members.length}</text></g>`);
        if (selectedMember) display.push(markerMarkup(selectedMember));
      } else display.push(markerMarkup(group.members[0]));
    }
    svg.innerHTML = display.join('');
    svg.classList.toggle('without-labels',!labelsVisible);
    const chosen = [...svg.querySelectorAll('[data-marker]')].find(n => n.dataset.marker === selectedOccurrence()?.key);
    if (chosen) svg.append(chosen); // Selected region remains on top, without discarding overlaps.
  }
  function markerMarkup(m) {
    const [x0,y0,x1,y1]=m.box, active=m.finding.id===selected?.id&&m.index===activeIndex;
    const isIssue = m.finding.status === 'issue';
    const color = isIssue ? '#ef4444' : m.finding.status === 'review' ? '#f59e0b' : '#10b981';
    const findingIdx = review.findings.indexOf(m.finding)+1;
    const badgeLabel = `${symbols[m.finding.status] || '!'} CHK-${findingIdx} · ${labels[m.finding.status] || 'Finding'}${active ? ' (Focused)' : ''}`;
    const badgeWidth = Math.min(280, (badgeLabel.length * 7.2) + 16);
    
    return `
      <g role="button" tabindex="0" data-marker="${esc(m.key)}" aria-label="${esc(labels[m.finding.status])}: ${esc(m.finding.title)}, page ${m.page.number}, ${esc(m.evidence.quote)}" aria-pressed="${active}" class="evidence-marker ${esc(m.finding.status)} ${active?'selected':''}">
        <!-- Outer Contrast Halo -->
        <rect x="${x0*1000 - 3}" y="${y0*1000 - 3}" width="${(x1-x0)*1000 + 6}" height="${(y1-y0)*1000 + 6}" rx="4" fill="none" stroke="#000000" stroke-width="4" stroke-opacity="0.5" vector-effect="non-scaling-stroke"/>
        <!-- Active Finding Bounding Box -->
        <rect x="${x0*1000}" y="${y0*1000}" width="${(x1-x0)*1000}" height="${(y1-y0)*1000}" rx="3" fill="${color}20" stroke="${color}" stroke-width="${active ? '3.5' : '2'}" vector-effect="non-scaling-stroke"/>
        <!-- Finding Badge Pin -->
        <g transform="translate(${x0*1000}, ${Math.max(22, y0*1000 - 6)})">
          <rect x="0" y="-18" width="${badgeWidth}" height="20" rx="4" fill="#0f172a" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          <text x="8" y="-4" fill="#ffffff" font-size="11" font-weight="700" font-family="-apple-system, sans-serif">${esc(badgeLabel)}</text>
        </g>
        <title>${esc(m.evidence.quote || m.finding.title)}</title>
      </g>
    `;
  }
  function updateInspector() {
    onSelect?.(selected.id, activeIndex, currentPage.page.number);
    const inspector = root.querySelector('.workbench-evidence');
    inspector.dataset.findingId = selected.id;
    inspector.dataset.findingStatus = selected.status;
    const occurrence = selectedOccurrence();
    const source = (selected.evidence || []).filter(e => e.role !== 'artwork');
    const locationReason = (selected.evidence || []).filter(e=>e.role==='artwork').map(e => {
      const doc = review.documents.find(d=>d.id===e.documentId && d.role==='artwork');
      const page = doc?.pages?.find(p=>p.number===e.page);
      return page ? normalizeEvidenceBox(e,page).reason : 'The artwork document or page could not be resolved.';
    }).filter(Boolean);
    const detail = document.createElement('section'); detail.className = 'canvas-evidence-details';
    detail.innerHTML = `<dl><dt>Finding ID</dt><dd>${esc(selected.id)}</dd><dt>Rule ID</dt><dd>${esc(selected.rule?.id || 'Not assigned')}</dd>${selected.severity?`<dt>Severity</dt><dd>${esc(selected.severity)}</dd>`:''}<dt>Check methodology</dt><dd>${esc(selected.method || 'Not recorded')}</dd><dt>Human review</dt><dd>${selected.status==='review'||selected.status==='unable'?'Required to resolve this finding':'Human release decision remains required'}</dd><dt>Reviewer decision</dt><dd>${esc(review.decisions?.[selected.id]?.disposition || 'Not recorded')}${review.decisions?.[selected.id]?.note?` — ${esc(review.decisions[selected.id].note)}`:''}</dd></dl>${occurrence?`<p>${esc(occurrence.document.name)} · Page ${occurrence.page.number}${occurrence.evidence.panel?` · ${esc(occurrence.evidence.panel)}`:''}</p><p>Extraction: ${esc(occurrence.evidence.method || occurrence.page.method || 'Not recorded')}</p><details><summary>Evidence coordinates</summary><p>Rendered normalized: ${occurrence.box.map(n=>n.toFixed(5)).join(', ')}</p><p>Original: ${esc(JSON.stringify(occurrence.original))} · ${esc(occurrence.evidence.coordinateSpace || 'normalized')}</p></details>${occurrence.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}`:`<p><strong>No precise artwork location available.</strong></p><p>${esc(locationReason.join(' ') || 'This finding has no extracted artwork bounding box. Missing copy, source approval, or whole-document requirements need visual investigation.')}</p><button type="button" data-canvas-reset>Inspect full page</button>`}<div class="evidence-snapshot-row"><button type="button" class="secondary" data-export-snapshot title="Export evidence crop snapshot image">📷 Export evidence snapshot</button></div>${!source.length?'<p>No source quotation is attached; the expected requirement is not a verified replacement for artwork text.</p>':''}`;
    inspector.querySelector('h3').after(detail);
    // Existing inspector/actions are retained. Show full evidence text, without truncation.
    const actual = inspector.querySelector('.detail-values > div:first-child b');
    if(actual) actual.textContent = occurrence?.evidence.quote || selected.observed || 'Not detected in extracted content';
    const expected = inspector.querySelector('.detail-values > div:nth-child(2) b');
    if(expected) expected.textContent = selected.expected || 'No source-backed value available';
    const occurrences = markers.filter(m=>m.finding.id===selected.id), position = occurrences.findIndex(m=>m.index===activeIndex);
    const tray = root.querySelector('.workbench-occurrences');
    tray.innerHTML = occurrences.length ? `<div class="occurrence-navigation"><button type="button" data-occurrence-step="-1" ${position<=0?'disabled':''}>← Previous</button><span>Occurrence ${position+1} of ${occurrences.length}</span><button type="button" data-occurrence-step="1" ${position>=occurrences.length-1?'disabled':''}>Next →</button></div>${occurrences.map((m,i)=>`<button type="button" class="occurrence-button ${m.index===activeIndex?'active':''}" data-canvas-occurrence="${m.index}"><span>${i+1}</span><b>${esc(m.evidence.quote)}</b><small>${esc(m.document.name)} · Page ${m.page.number} · ${esc(m.evidence.method || m.page.method || 'Extracted')}</small></button>`).join('')}` : '<p>No precise artwork location available. Inspect the source evidence and full page.</p>';
  }
  function imageReady() {
    if (!img.complete || !img.naturalWidth) return;
    notice.textContent = '';
    if (pendingFocus) { const box = pendingFocus; pendingFocus = null; viewport.focusOnBox(box,{animate:true}); }
  }
  function showPage(next) {
    if (!next || next === currentPage) return;
    pendingFocus = null; chooser.hidden = true;
    views.set(currentPage.key,viewport.getView()); currentPage = next;
    frame.dataset.unit = next.page.unit || 'px';
    frame.dataset.pageKey = next.key;
    content.querySelectorAll('.workbench-zone-overlay').forEach(n=>n.remove());
    viewport.setPage(next.page.width,next.page.height,views.get(next.key));
    img.src = imageURL(review,next.page); img.alt = `Original ${next.document.name}, page ${next.page.number}`;
    notice.textContent = 'Loading artwork page…';
    controls.querySelector('.proof-surface-label').textContent = `ORIGINAL ARTWORK · ${next.document.name} · Page ${next.page.number}`;
    const hash = controls.querySelector('[data-source-hash]');
    if(hash) { hash.textContent = next.document.sha256 ? `Source SHA-256 ${next.document.sha256.slice(0,12)}…` : 'Source hash unavailable'; delete hash.dataset.state; }
    onPage?.(next.page.number); drawPages(); drawMarkers(); updateFocus(); imageReady();
  }
  function updateFocus() {
    const m=selectedOccurrence(), here=m&&m.document.id===currentPage.document.id&&m.page.number===currentPage.page.number;
    viewport.setFocus(here?m.box:null);
    controls.querySelector('[data-viewport-focus]').disabled = !here;
    frame.dataset.focusBox = here?m.box.join(','):'';
  }
  function select(id, index, { focus=true, scroll=false } = {}) {
    const finding = review.findings.find(f=>f.id===id); if(!finding)return;
    viewport.setView(viewport.getView()); // Cancel an earlier transition, including marker selections.
    selected=finding; chooser.hidden=true;
    const occurrences=markers.filter(m=>m.finding.id===id);
    const occurrence=occurrences.find(m=>m.index===index)||occurrences[0];
    activeIndex=occurrence?.index??0;
    if(occurrence) showPage(pages.find(p=>p.document.id===occurrence.document.id&&p.page.number===occurrence.page.number));
    pendingFocus=null;
    updateInspector(); drawQueue(); drawMarkers(); updateFocus();
    if(occurrence&&focus) {
      if (occurrence.box) {
        pendingFocus=occurrence.box;
        imageReady();
      } else {
        viewport.fit?.({animate:true});
      }
    }
    if(scroll) {
      // Keep a marker-selected finding visible even when the current queue filter excludes it.
      if(!filterFindings(review,filter,query).some(f=>f.id===id)) {
        filter='all';query='';queue.querySelector('[data-evidence-filter]').value=filter;queue.querySelector('[data-evidence-search]').value='';drawQueue();
      }
      [...queue.querySelectorAll('[data-canvas-finding]')].find(n=>n.dataset.canvasFinding===id)?.scrollIntoView({block:'nearest'});
    }
  }
  function choose(candidates) {
    if(candidates.length===1) { select(candidates[0].finding.id,candidates[0].index,{focus:false,scroll:true}); return; }
    chooser.hidden=false;
    chooser.innerHTML=`<b>${candidates.length} overlapping or nearby regions</b><button type="button" data-close-chooser aria-label="Close region chooser">×</button>${candidates.map(m=>`<button type="button" data-choose-marker="${esc(m.key)}">${esc(labels[m.finding.status])} · ${esc(m.finding.title)}<small>${esc(m.evidence.quote)}</small></button>`).join('')}`;
    chooser.querySelector('[data-choose-marker]')?.focus({preventScroll:true});
  }

  async function exportSnapshot() {
    if (typeof document === 'undefined') return;
    const occurrence = selectedOccurrence();
    const page = currentPage.page;
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const srcImg = new Image();
    srcImg.crossOrigin = 'anonymous';
    srcImg.src = imageURL(review, page);
    await new Promise(r => { if (srcImg.complete) return r(); srcImg.onload = r; srcImg.onerror = r; });
    const pw = srcImg.naturalWidth || page.width || 1200;
    const ph = srcImg.naturalHeight || page.height || 800;
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    if (occurrence?.box) {
      [x0, y0, x1, y1] = occurrence.box;
      const padX = (x1 - x0) * 0.25 + 0.02, padY = (y1 - y0) * 0.25 + 0.02;
      x0 = Math.max(0, x0 - padX); x1 = Math.min(1, x1 + padX);
      y0 = Math.max(0, y0 - padY); y1 = Math.min(1, y1 + padY);
    }
    const sx = x0 * pw, sy = y0 * ph, sw = Math.max(1, (x1 - x0) * pw), sh = Math.max(1, (y1 - y0) * ph);
    const targetW = Math.min(1200, Math.max(600, Math.round(sw * 1.5)));
    const targetH = Math.max(150, Math.round(targetW * (sh / sw)));
    const cardH = targetH + 130;
    canvas.width = targetW; canvas.height = cardH;
    ctx.fillStyle = '#0f221a'; ctx.fillRect(0, 0, targetW, cardH);
    ctx.fillStyle = '#173327'; ctx.fillRect(0, 0, targetW, 40);
    ctx.fillStyle = '#bad49d'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`PackSignal Evidence Snapshot · ${currentPage.document.name} · Page ${page.number}`, 14, 25);
    const statusColor = selected.status === 'issue' ? '#ef6455' : selected.status === 'review' ? '#e9b750' : selected.status === 'match' ? '#48b989' : '#a4afb1';
    ctx.fillStyle = statusColor; ctx.font = 'bold 11px system-ui, sans-serif';
    const statusText = `● ${selected.status.toUpperCase()}`;
    ctx.fillText(statusText, targetW - ctx.measureText(statusText).width - 14, 25);
    try { ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 40, targetW, targetH); } catch {}
    if (occurrence?.box) {
      const [bx0, by0, bx1, by1] = occurrence.box;
      const boxX = ((bx0 - x0) / (x1 - x0)) * targetW, boxY = 40 + ((by0 - y0) / (y1 - y0)) * targetH;
      const boxW = ((bx1 - bx0) / (x1 - x0)) * targetW, boxH = ((by1 - by0) / (y1 - y0)) * targetH;
      ctx.strokeStyle = statusColor; ctx.lineWidth = 3; ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = statusColor + '26'; ctx.fillRect(boxX, boxY, boxW, boxH);
    }
    ctx.fillStyle = '#142b21'; ctx.fillRect(0, 40 + targetH, targetW, 90);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`${selected.title} (${selected.id})`, 14, 40 + targetH + 22);
    ctx.fillStyle = '#f09a86'; ctx.font = '11px monospace';
    ctx.fillText(`Artwork: ${selected.observed || occurrence?.evidence.quote || 'Not detected'}`, 14, 40 + targetH + 44);
    ctx.fillStyle = '#b3dc9c';
    ctx.fillText(`Expected: ${selected.expected || 'No value'}`, 14, 40 + targetH + 64);
    ctx.fillStyle = '#8ca594'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`Unaltered source crop · Inspection snapshot for review`, 14, 40 + targetH + 82);
    if (canvas.toBlob) {
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = `evidence-${selected.id}-p${page.number}.png`;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    }
  }

  on(frame, 'pointermove', event => {
    if (!loupeActive) return;
    const rect = frame.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) { loupe.hidden = true; return; }
    loupe.hidden = false;
    loupe.style.left = `${x}px`; loupe.style.top = `${y}px`;
    const layout = viewport.getLayout();
    const pt = viewport.point(event);
    const mag = 2.5;
    const lw = layout.pageWidth * mag, lh = layout.pageHeight * mag;
    loupeImg.style.width = `${lw}px`; loupeImg.style.height = `${lh}px`;
    loupeImg.style.transform = `translate(${-pt.x * lw + 70}px, ${-pt.y * lh + 70}px)`;
  });
  on(frame, 'pointerleave', () => { if (loupeActive) loupe.hidden = true; });

  on(root,'click',event=>{
    const target=event.target.closest('button,[data-marker],[data-cluster]'); if(!target)return;
    const d=target.dataset;
    if(d.marker || d.cluster) {
      event.stopPropagation();
      if(d.cluster) choose(currentMarkers().filter(m=>d.cluster.split('|').includes(m.key)));
      else { const m=markers.find(m=>m.key===d.marker); const point=event.detail===0?{x:(m.box[0]+m.box[2])/2,y:(m.box[1]+m.box[3])/2}:viewport.point(event); choose(markersAt(currentMarkers(),point.x,point.y)); }
      return;
    }
    if(d.chooseMarker) { const m=markers.find(m=>m.key===d.chooseMarker); select(m.finding.id,m.index,{focus:false,scroll:true}); }
    else if('closeChooser' in d) { chooser.hidden=true; frame.focus(); }
    else if(d.canvasFinding || d.action==='select-finding') select(d.canvasFinding||d.id,Number(d.evidenceIndex));
    else if('canvasOccurrence' in d || d.action==='select-evidence') select(selected.id,Number(d.canvasOccurrence??d.index));
    else if('occurrenceStep' in d) {const all=markers.filter(m=>m.finding.id===selected.id), i=all.findIndex(m=>m.index===activeIndex); if(all[i+Number(d.occurrenceStep)])select(selected.id,all[i+Number(d.occurrenceStep)].index);}
    else if('canvasPage' in d) showPage(pages[Number(d.canvasPage)]);
    else if('canvasPrev' in d) showPage(pages[pages.indexOf(currentPage)-1]);
    else if('canvasNext' in d) showPage(pages[pages.indexOf(currentPage)+1]);
    else if('canvasReset' in d) {pendingFocus=null;viewport.reset();}
    else if('canvasFit' in d) {pendingFocus=null;viewport.fit();}
    else if('canvasFocus' in d) {updateFocus();viewport.focus();}
    else if('canvasZoomin' in d) {
      pendingFocus=null;
      const layout=viewport.getLayout(), current=viewport.getView();
      viewport.setView(zoomAt(current, current.scale + 0.35, {x:0, y:0}, layout), {animate:true});
    }
    else if('canvasZoomout' in d) {
      pendingFocus=null;
      const layout=viewport.getLayout(), current=viewport.getView();
      viewport.setView(zoomAt(current, current.scale - 0.35, {x:0, y:0}, layout), {animate:true});
    }
    else if('canvasLoupe' in d) {
      loupeActive = !loupeActive;
      const btn = tools.querySelector('[data-canvas-loupe]');
      btn?.setAttribute('aria-pressed', String(loupeActive));
      btn?.classList.toggle('active', loupeActive);
      if (!loupeActive) loupe.hidden = true;
      else { loupeImg.src = imageURL(review, currentPage.page); }
    }
    else if('exportSnapshot' in d) { exportSnapshot(); }
    else if('canvasActual' in d) {
      pendingFocus=null;
      const scale=img.naturalWidth/viewport.getLayout().pageWidth;
      viewport.setView({scale,x:0,y:0},{animate:true});
      notice.textContent=scale>16||scale<.1?'Actual pixel size is outside the supported zoom range. Displaying the nearest available zoom.':'';
    }
    else if('inspectorToggle' in d) {workspace.classList.toggle('inspector-collapsed');target.setAttribute('aria-expanded',String(!workspace.classList.contains('inspector-collapsed')));}
    else return;
    event.stopPropagation();
  });
  on(root,'keydown',event=>{
    if(event.key==='Escape'&&!chooser.hidden) {chooser.hidden=true;frame.focus();event.stopPropagation();}
    const marker=event.target.closest('[data-marker],[data-cluster]');
    if(marker&&['Enter',' '].includes(event.key)) {event.preventDefault();marker.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));}
    if((event.key==='m'||event.key==='M')&&!event.target.closest('input,textarea,select')) {event.preventDefault();tools.querySelector('[data-canvas-loupe]')?.click();}
  });
  on(root,'input',event=>{
    if(event.target.matches('[data-evidence-search]')) {query=event.target.value;drawQueue();}
  });
  on(root,'change',event=>{
    const t=event.target;
    if(t===pageSelect) {event.stopPropagation();showPage(pages[Number(t.value)]);}
    else if(t.matches('[data-evidence-filter]')) {filter=t.value;drawQueue();}
    else if(t.matches('[data-overlay-mode]')) {overlayMode=t.value;chooser.hidden=true;drawMarkers();}
    else if(t.matches('[data-overlay-labels]')) {labelsVisible=t.checked;svg.classList.toggle('without-labels',!labelsVisible);}
  });
  on(frame,'viewportchange',()=>{if(densityMode!==(viewport.getView().scale<1.8))drawMarkers();});
  on(img,'load',imageReady);
  on(img,'error',()=>{pendingFocus=null;notice.textContent='Artwork image could not be loaded. Select another page or reopen the review.';});
  frame.dataset.pageKey=currentPage.key;
  drawQueue();drawPages();drawMarkers();updateInspector();updateFocus();
  return { select, showPage, getSelection:()=>({findingId:selected.id,index:activeIndex,pageKey:currentPage.key}), dispose(){if(disposed)return;disposed=true;pendingFocus=null;cleanups.forEach(fn=>fn());viewport.dispose();} };
}
