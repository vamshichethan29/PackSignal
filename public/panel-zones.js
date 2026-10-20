import { captureFaceSuggestions, sourcePreviewZones } from './artwork-ui.js';
import { packageFaceLabel, packageType, packageTypes, suggestDielineMapping } from './dieline-layout.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const faces = packageTypes[0].faces.map(face => [face, packageFaceLabel('carton', face)]);

function artwork(review) {
  return review.documents?.find(document => document.role === 'artwork');
}

function zoneBox(zone, page, selectedFace) {
  if (!zone?.box || zone.page !== page) return '';
  const [x0, y0, x1, y1] = zone.box;
  return `<div class="panel-zone ${escape(zone.name)} ${zone.name===selectedFace?'selected-face':'muted-face'}" style="left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%"><span>${escape(zone.name)} face</span></div>`;
}

export function selectedFacePreview(review, zones, face, draft = false, type = review.options?.packageType || 'carton') {
  const mapped=zones[face], zone=mapped||sourcePreviewZones(review)[face];
  const page=artwork(review)?.pages.find(item=>item.number===zone?.page);
  const label=packageFaceLabel(type, face);
  if(!page||!zone?.box) return `<div class="zone-preview-empty"><strong>${escape(label)}</strong><span>No artwork mapped to this face yet. Draw its rectangle on the full sheet below.</span></div>`;
  const [x0,y0,x1,y1]=zone.box, width=x1-x0, height=y1-y0;
  if(width<=0||height<=0) return `<div class="zone-preview-empty"><strong>${escape(label)}</strong><span>Drag to define the face crop…</span></div>`;
  const ratio=width*(page.width||1)/(height*(page.height||1));
  // Clamp preview height to 180px and compute width from ratio
  const previewH=180;
  const previewW=Math.min(Math.round(previewH*ratio), 300);
  const faceSuggestions=captureFaceSuggestions(review),captured=!mapped&&Boolean(faceSuggestions[face]);
  const explicitlyNamed=(review.options?.captureFaces||[]).some(item=>item.page===zone.page&&item.face===face);
  const aiSuggestion=captured&&faceSuggestions[face]?.page===zone.page&&faceSuggestions[face]?.aiSuggested
    ? faceSuggestions[face]
    : captured&&!explicitlyNamed&&(review.ai?.faceSuggestions||[]).find(item=>item.face===face&&item.page===zone.page);
  const aiReason=String(aiSuggestion?.reason||'the visible package face appeared to match').trim().replace(/[.!?]+$/,'');
  const caption=mapped?(draft?'Unsaved face crop':'Saved face crop'):review.sample?'Organizer preview · not a saved map':aiSuggestion?'AI face and crop suggestion · not a saved map':captured?'Captured face photo · not a saved map':'Full page preview · not a saved map';
  const copy=mapped?'This crop is the artwork used on this carton face.':review.sample?'This supplied sample crop helps locate the face. Draw a rectangle below to create your own mapping.':aiSuggestion?.captureLabelled?`You selected this as the ${label.toLowerCase()}; image analysis suggests this crop because ${escape(aiReason)}. Inspect and adjust it before confirming.`:aiSuggestion?`Vision suggested this as the ${label.toLowerCase()} because ${escape(aiReason)}. Inspect the still and crop to the flat face before confirming.`:captured?'This photo was labelled during capture. Crop to the visible flat face, excluding the background and neighboring faces, before confirming.':'The complete supplied page is shown as an illustration only. Draw the actual face rectangle below to create a package-specific mapping.';
  // Use CSS variables so the absolute img is reliably clipped inside the container
  return `<div class="zone-preview-crop" style="width:${previewW}px;height:${previewH}px;flex:none"><img draggable="false" src="/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}" alt="${escape(label)} artwork crop" style="width:${100/width}%;height:${100/height}%;left:${-100*x0/width}%;top:${-100*y0/height}%"></div><div class="zone-preview-copy"><strong>${escape(label)}</strong><span>${caption} · Page ${page.number}</span><p>${copy}</p></div>`;
}

function dielinePagePreview(review, dieline, type, pageNumber) {
  const page = dieline.pages.find(item => item.number === pageNumber) || dieline.pages[0];
  const suggestion = suggestDielineMapping(dieline, type);
  const overlays = Object.entries(suggestion.zones).filter(([, zone]) => zone.page === page.number).map(([face, zone]) => {
    const [x0, y0, x1, y1] = zone.box;
    return `<div class="dieline-suggestion-zone ${escape(face)}" style="left:${x0*100}%;top:${y0*100}%;width:${(x1-x0)*100}%;height:${(y1-y0)*100}%"><span>${escape(packageFaceLabel(type, face))}</span></div>`;
  }).join('');
  const folds = suggestion.folds.filter(item => item.page === page.number).map(fold => {
    const extent = fold.extent || [0, 1];
    const position = fold.axis === 'horizontal'
      ? `top:${fold.position*100}%;left:${extent[0]*100}%;width:${(extent[1]-extent[0])*100}%;right:auto`
      : `left:${fold.position*100}%;top:${extent[0]*100}%;height:${(extent[1]-extent[0])*100}%;bottom:auto`;
    return `<div class="dieline-fold ${fold.axis} ${fold.source ? 'candidate-edge' : ''}" style="${position}" aria-hidden="true"></div>`;
  }).join('');
  const candidateRegions = suggestion.candidateRegions.filter(region => region.page === page.number &&
    !Object.values(suggestion.zones).some(zone => zone.page === region.page && zone.box.every((value, index) => Math.abs(value - region.box[index]) < 0.0001))
  ).map((region, index) => {
    const [x0, y0, x1, y1] = region.box;
    return `<div class="dieline-suggestion-zone unlabelled" style="left:${x0*100}%;top:${y0*100}%;width:${(x1-x0)*100}%;height:${(y1-y0)*100}%"><span>${escape(region.label || `Unlabelled region ${index+1}`)}</span></div>`;
  }).join('');
  const vectorLegend = dieline.vectorGeometry?.format === 'DXF'
    ? `<div class="dxf-geometry-legend" aria-label="DXF line layer legend"><span><i class="cut"></i>Cut layer</span><span><i class="crease"></i>Crease / score layer</span><span><i class="glue"></i>Glue layer</span><span><i class="perforation"></i>Perforation layer</span><span><i class="unclassified"></i>Unclassified layer</span><small>Colors come from explicit DXF layer or linetype names.</small></div>`
    : '';
  return { suggestion, html: `<div class="dieline-suggestion-stage"><img data-dieline-image src="/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}" alt="Uploaded dieline page ${page.number} with unconfirmed face and line suggestions"><div data-dieline-overlay>${overlays}${candidateRegions}${folds}</div></div>${vectorLegend}` };
}

function dielineMapper(review, zones) {
  const dieline = review.documents?.find(document => document.role === 'dieline');
  if (!dieline?.pages?.length) return photoMapper(review, zones);
  const type = review.options?.packageType || 'carton';
  const page = dieline.pages[0];
  const { suggestion, html: preview } = dielinePagePreview(review, dieline, type, page.number);
  const faceSummary = suggestion.faces.map(item => `<span class="dieline-face-chip ${item.suggested ? 'suggested' : ''}">${item.suggested ? '✓' : '○'} ${escape(item.label)}</span>`).join('');
  const hasFront = Boolean(zones.front?.box);
  const mappingDescription = dieline.vectorGeometry?.format === 'DXF'
    ? 'ASCII DXF line and lightweight-polyline geometry is preserved in the preview. Explicit layer or linetype names identify cut, crease, glue, perforation, or unclassified strokes; labeled closed panels can suggest face crops. A six-face rectangular carton with physical units and explicit crease boundaries can use a DXF-derived, dimensionally faithful shell after mapping is confirmed. Board thickness, tabs, and non-rectangular details remain outside that shell.'
    : 'Positioned labels suggest face identities. For image-only or unlabeled dielines, long straight strokes outline candidate regions. Those visual cues cannot distinguish cut from crease. Inspect the original and map the matching artwork crops; the 3D preview stays hidden until you confirm.';
  return `<section class="package-mapping panel" data-package-mapping>
    <div class="eyebrow">DIELINE-AWARE PACKAGE PREVIEW</div>
    <h3>Suggest faces, then confirm the mapping</h3>
    <p class="subtle">${escape(mappingDescription)}</p>
    <div class="package-mapping-controls">
      <label>Package type<select name="packageType" data-package-type>${packageTypes.map(item => `<option value="${item.id}" ${item.id === type ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
      ${dieline.pages.length > 1 ? `<label>Dieline page<select data-dieline-page>${dieline.pages.map(item => `<option value="${item.number}" ${item.number === page.number ? 'selected' : ''}>Page ${item.number}</option>`).join('')}</select></label>` : ''}
    </div>
    <div class="package-mapping-layout"><div data-dieline-preview>${preview}</div><div class="package-mapping-notes"><b>Suggested faces</b><div class="dieline-face-list" data-dieline-faces>${faceSummary}</div><p data-dieline-note class="subtle">${escape(suggestion.note)}</p><button type="button" class="secondary" data-dieline-apply ${Object.keys(suggestion.zones).length ? '' : 'disabled'}>Copy face regions to artwork map</button><small>Copies are only a starting point. Adjust them on the artwork below.</small></div></div>
    <label class="checkrow package-confirm"><input type="checkbox" name="packageMappingConfirmed" data-package-confirm ${review.options?.packageMappingConfirmed && hasFront ? 'checked' : ''} ${hasFront ? '' : 'disabled'}><span>I inspected the artwork crops against the dieline and confirm this package type and face assignment.<br><small class="subtle" data-package-confirm-hint>${hasFront ? 'The next 3D preview will use these reviewer-confirmed face crops.' : 'Map at least the front face on the artwork before confirming.'}</small></span></label>
    <p class="notice" data-package-mapping-status>${review.options?.staleConfirmations?.packageMappingConfirmed ? 'The dieline, artwork, package type or face map changed. Please inspect and confirm again.' : ''}</p>
  </section>`;
}

function photoMapper(review, zones) {
  if (review.sample) return '';
  const type = review.options?.packageType || 'carton';
  const suggestions = captureFaceSuggestions(review), hasFront = Boolean(zones.front?.box);
  const pages = artwork(review)?.pages || [];
  const unassigned = (review.options?.captureFaces || [])
    .filter(item => item?.face === 'unassigned' && pages.some(page => page.number === item.page))
    .map(item => ({ ...item, artworkPage: pages.find(page => page.number === item.page) }));
  return `<section class="package-mapping panel" data-package-mapping>
    <div class="eyebrow">PHOTO & ARTWORK PACKAGE PREVIEW</div><h3>Choose a package and confirm its faces</h3>
    <p class="subtle">Map each visible face from its own artwork page. A square-on photo works best: crop away background and neighboring faces. The 3D shape uses these textures with illustrative proportions.</p>
    <div class="package-mapping-controls"><label>Package type<select name="packageType" data-package-type>${packageTypes.map(item => `<option value="${item.id}" ${item.id === type ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label></div>
    ${Object.keys(suggestions).length ? `<p class="subtle">${Object.keys(suggestions).length} labelled or AI-suggested face photo(s) are available as starting crops. Confirm and adjust every crop yourself.</p><button type="button" class="secondary" data-capture-apply>Use suggested faces as starting crops</button>` : ''}
    ${unassigned.length ? `<section class="capture-frame-mapper"><b>Review captured pages</b><p class="subtle">Inspect each image. PackSignal may suggest a visible face from its artwork cues, but confirm the orientation and crop the flat package face.</p><div class="capture-frame-grid">${unassigned.map(item => { const suggested=Object.entries(suggestions).find(([,zone])=>zone.page===item.page); const suggestedFace=suggested?.[0]||''; return `<article class="capture-frame-card"><img src="/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(item.artworkPage.image)}" alt="Captured artwork page ${item.page}"><small>Captured page ${item.page}${suggestedFace?` · AI suggests ${escape(packageFaceLabel(type,suggestedFace))}`:''}</small><label>Visible face<select data-capture-map-face="${item.page}"><option value="">Choose face…</option>${packageType(type).faces.map(face => `<option value="${face}" ${face===suggestedFace?'selected':''}>${escape(packageFaceLabel(type, face))}</option>`).join('')}</select></label><button type="button" class="secondary" data-capture-map-page="${item.page}">Use this image as a crop</button></article>`; }).join('')}</div></section>` : ''}
    <label class="checkrow package-confirm"><input type="checkbox" name="packageMappingConfirmed" data-package-confirm ${review.options?.packageMappingConfirmed && hasFront ? 'checked' : ''} ${hasFront ? '' : 'disabled'}><span>I inspected the visible artwork crops and confirm this package type and face assignment.<br><small class="subtle" data-package-confirm-hint>${hasFront ? 'The next 3D preview will use these reviewer-confirmed face crops.' : 'Map at least the front face on the artwork before confirming.'}</small></span></label>
    <p class="notice" data-package-mapping-status>${review.options?.staleConfirmations?.packageMappingConfirmed ? 'The artwork, package type or face map changed. Please inspect and confirm again.' : ''}</p>
  </section>`;
}


function locatedEvidence(finding) {
  return finding?.evidence?.find(item => item.role === 'artwork' && Number.isInteger(item.page) && Array.isArray(item.box));
}

function insideZone(evidence, page, box) {
  if (!evidence?.box || evidence.page !== page || !box) return false;
  const [x0, y0, x1, y1] = evidence.box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return cx >= box[0] && cx <= box[2] && cy >= box[1] && cy <= box[3];
}

function impactText(review, face, page, box) {
  const checks = (review.findings || []).filter(finding => finding.rule?.panel === face && finding.method !== 'panel_geometry');
  if (!checks.length) return `No supplied checklist checks target the ${face} face. Only checks that name this face can be evaluated against its zone.`;
  if (!box) return `${checks.length} supplied check${checks.length === 1 ? '' : 's'} target ${face}. Draw the face to preview located evidence.`;
  const located = checks.map(locatedEvidence).filter(Boolean);
  const onPage = located.filter(evidence => evidence.page === page);
  const inside = onPage.filter(evidence => insideZone(evidence, page, box)).length;
  const outside = onPage.length - inside;
  const elsewhere = located.length - onPage.length;
  const unlocated = checks.length - located.length;
  const details = [
    inside && `${inside} inside`, outside && `${outside} outside`,
    elsewhere && `${elsewhere} on another page`, unlocated && `${unlocated} without a text box`,
  ].filter(Boolean).join(' · ');
  return `${checks.length} supplied check${checks.length === 1 ? '' : 's'} target ${face}${details ? ` · ${details}` : ''}. Save to rerun those checklist geometry checks.`;
}

export function panelZoneMapper(review) {
  const artDocument = artwork(review);
  if (!artDocument?.pages?.length) return '';
  const zones = Object.entries(review.options?.panelZones || {}).map(([name, zone]) => ({ name, ...zone }));
  const page = artDocument.pages[0];
  const type = review.options?.packageType || 'carton';
  const faceOptions = packageType(type).faces;
  const zoneNote = review.options?.panelZoneSource === 'authored synthetic sample geometry'
    ? 'Sample rectangles are illustrative starting points. Inspect them before use; they do not establish legal panel definitions.'
    : 'Draw each supplied artwork face. Only supplied checklist checks assigned to that face are recalculated.';
  return `<section class="panel panel-zone-panel" data-panel-zone-mapper>
    <div class="eyebrow">ARTWORK GEOMETRY</div>
    <h3>Map package faces</h3>
    <p class="subtle">${escape(zoneNote)}</p>
    ${dielineMapper(review, review.options?.panelZones || {})}
    <div class="zone-controls">
      <label>Preview / map face<select data-zone-name>${faceOptions.map(value => `<option value="${value}" ${value === 'front' ? 'selected' : ''}>${escape(packageFaceLabel(type, value))}</option>`).join('')}</select></label>
      <label>Artwork page<select data-zone-page>${artDocument.pages.map(item => `<option value="${item.number}">Page ${item.number}</option>`).join('')}</select></label>
      <button type="button" class="secondary" data-zone-clear>Clear this face</button>
      ${!review.sample ? '<button type="button" class="secondary" data-zone-page-use>Use page as starting crop</button>' : ''}
    </div>
    <div class="zone-face-preview" data-zone-face-preview aria-live="polite">${selectedFacePreview(review, review.options?.panelZones || {}, 'front', false, type)}</div>
    <div class="zone-impact" data-zone-impact aria-live="polite"></div>
    <details class="zone-screening"><summary>Optional text-height screening</summary><p class="subtle">This adds an approximate human-review finding when PDF text height can be measured. It is not a legal minimum.</p><label>Screening value (mm)<input type="number" data-legibility-threshold min="0.1" max="10" step="0.1" value="${Number(review.options?.legibilityThresholdMm) || 1.6}"></label></details>
    <input type="hidden" name="panelZones" data-panel-zones-value value="${escape(JSON.stringify(review.options?.panelZones || {}))}">
    <div class="zone-stage" data-zone-stage aria-label="Drag a rectangle around the selected package face on the artwork page">
      <img data-zone-image src="/api/reviews/${escape(review.id)}/images/${escape(page.image)}" alt="Artwork page ${page.number} for package face mapping">
      <div data-zone-overlay>${zones.map(zone => zoneBox(zone, page.number, 'front')).join('')}</div>
    </div>
    <p class="subtle" data-zone-status></p>
  </section>`;
}

export function mountPanelZoneMapper(container, review) {
  let root = container?.querySelector?.('[data-panel-zone-mapper]');
  if (!root) {
    const form = container?.querySelector?.('#source-form');
    if (!form) return;
    const fragment = globalThis.document.createElement('template');
    fragment.innerHTML = panelZoneMapper(review);
    root = fragment.content.firstElementChild;
    form.querySelector('h3')?.after(root);
  }
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  const artDocument = artwork(review);
  const zoneValue = root.querySelector('[data-panel-zones-value]');
  const form = root.closest('#source-form');
  const threshold = root.querySelector('[data-legibility-threshold]');
  const mapping = root.querySelector('[data-package-mapping]');
  const packageTypeInput = mapping?.querySelector('[data-package-type]');
  const packageConfirm = mapping?.querySelector('[data-package-confirm]');
  const packageStatus = mapping?.querySelector('[data-package-mapping-status]');
  const dieline = review.documents?.find(document => document.role === 'dieline');
  form?.addEventListener('formdata', event => {
    event.formData.set('panelZones', zoneValue.value);
    event.formData.set('legibilityThresholdMm', threshold.value);
    if (packageTypeInput) event.formData.set('packageType', packageTypeInput.value);
  });
  const stage = root.querySelector('[data-zone-stage]');
  const image = root.querySelector('[data-zone-image]');
  const faceInput = root.querySelector('[data-zone-name]');
  const pageInput = root.querySelector('[data-zone-page]');
  const overlay = root.querySelector('[data-zone-overlay]');
  const status = root.querySelector('[data-zone-status]');
  const impact = root.querySelector('[data-zone-impact]');
  let zones = {};
  try { zones = JSON.parse(zoneValue.value || '{}'); } catch { zones = {}; }
  let start = null;
  const dirtyFaces = new Set();
  const facePreview = root.querySelector('[data-zone-face-preview]');
  const selected = () => faceInput.value;
  const selectedType = () => packageTypeInput?.value || review.options?.packageType || 'carton';
  const selectedPage = () => Number(pageInput.value);
  const currentPage = () => artDocument.pages.find(page => page.number === selectedPage()) || artDocument.pages[0];
  const persist = () => { zoneValue.value = JSON.stringify(zones); };
  const updateImpact = (previewBox = null) => {
    const box = previewBox || zones[selected()]?.box;
    impact.textContent = impactText(review, selected(), selectedPage(), box);
  };
  const redraw = () => {
    const page = currentPage();
    image.src = `/api/reviews/${encodeURIComponent(review.id)}/images/${encodeURIComponent(page.image)}`;
    image.alt = `Artwork page ${page.number} for package face mapping`;
    overlay.innerHTML = Object.entries(zones).map(([name, zone]) => zoneBox({ name, ...zone }, page.number, selected())).join('');
    const mapped = zones[selected()]?.page === page.number;
    status.textContent = mapped
      ? `${selected()} face mapped on page ${page.number}. Save to recalculate the supplied checklist geometry.`
      : `${selected()} face is not mapped on page ${page.number}. Drag over its artwork area to map it.`;
    facePreview.innerHTML = selectedFacePreview(review, zones, selected(), dirtyFaces.has(selected()), selectedType());
    updateImpact();
    if (packageConfirm) {
      packageConfirm.disabled = !zones.front?.box;
      const hint = mapping.querySelector('[data-package-confirm-hint]');
      if (hint) hint.textContent = zones.front?.box
        ? 'The next 3D preview will use these reviewer-confirmed face crops.'
        : 'Map at least the front face on the artwork before confirming.';
    }
  };
  const invalidatePackageConfirmation = message => {
    if (!mapping) return;
    packageConfirm.checked = false;
    packageStatus.textContent = message || 'Mapping changed. Confirm again after inspecting the artwork crops.';
  };
  const refreshPackageType = () => {
    if (!mapping || !packageTypeInput) return;
    const supported = packageType(selectedType()).faces;
    const currentFace = supported.includes(faceInput.value) ? faceInput.value : 'front';
    faceInput.innerHTML = supported.map(face => `<option value="${face}" ${face === currentFace ? 'selected' : ''}>${escape(packageFaceLabel(selectedType(), face))}</option>`).join('');
    if (!supported.includes(faceInput.value)) faceInput.value = 'front';
    pageInput.value = String(zones[selected()]?.page || artDocument.pages[0].number);
    redraw();
    if (!dieline?.pages?.length) return;
    const pageSelect = mapping.querySelector('[data-dieline-page]');
    const renderDieline = () => {
      const selectedPage = Number(pageSelect?.value || dieline.pages[0].number);
      const { suggestion, html } = dielinePagePreview(review, dieline, selectedType(), selectedPage);
      mapping.querySelector('[data-dieline-preview]').innerHTML = html;
      mapping.querySelector('[data-dieline-faces]').innerHTML = suggestion.faces.map(item => `<span class="dieline-face-chip ${item.suggested ? 'suggested' : ''}">${item.suggested ? '✓' : '○'} ${escape(item.label)}</span>`).join('');
      mapping.querySelector('[data-dieline-note]').textContent = suggestion.note;
      mapping.querySelector('[data-dieline-apply]').disabled = !Object.keys(suggestion.zones).length;
    };
    renderDieline();
    if (pageSelect && !pageSelect.dataset.bound) {
      pageSelect.dataset.bound = 'true';
      pageSelect.addEventListener('change', renderDieline);
    }
  };
  const point = event => {
    const rect = stage.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
  };
  const preview = (from, to) => {
    const [x0, y0] = from, [x1, y1] = to;
    const box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    overlay.querySelectorAll('.panel-zone.preview').forEach(node => node.remove());
    const node = globalThis.document.createElement('div');
    node.className = `panel-zone ${selected()} preview`;
    node.style.left = `${box[0] * 100}%`; node.style.top = `${box[1] * 100}%`;
    node.style.width = `${(box[2] - box[0]) * 100}%`; node.style.height = `${(box[3] - box[1]) * 100}%`;
    node.innerHTML = `<span>${escape(selected())} face</span>`; overlay.append(node);
    facePreview.innerHTML = selectedFacePreview(review, {...zones,[selected()]:{page:selectedPage(),box}}, selected(), true);
    updateImpact(box);
  };
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    start = point(event); stage.setPointerCapture?.(event.pointerId); event.preventDefault(); preview(start, start);
  });
  stage.addEventListener('pointermove', event => { if (start) preview(start, point(event)); });
  stage.addEventListener('pointerup', event => {
    if (!start) return;
    const end = point(event); const box = [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[0], end[0]), Math.max(start[1], end[1])];
    start = null; overlay.querySelectorAll('.panel-zone.preview').forEach(node => node.remove());
    if ((box[2] - box[0]) < 0.03 || (box[3] - box[1]) < 0.03) { redraw(); status.textContent = 'Draw a larger rectangle to map this face.'; return; }
    zones[selected()] = { page: selectedPage(), box }; dirtyFaces.add(selected()); persist(); invalidatePackageConfirmation(); redraw();
  });
  stage.addEventListener('pointercancel', () => { start = null; overlay.querySelectorAll('.panel-zone.preview').forEach(node => node.remove()); redraw(); });
  faceInput.addEventListener('change', () => {
    start = null;
    const zone = zones[selected()] || sourcePreviewZones(review)[selected()];
    if(zone && artDocument.pages.some(page=>page.number===zone.page)) pageInput.value=String(zone.page);
    redraw();
  });
  pageInput.addEventListener('change', redraw);
  root.querySelector('[data-zone-clear]').addEventListener('click', () => { delete zones[selected()]; dirtyFaces.add(selected()); persist(); invalidatePackageConfirmation(); redraw(); });
  root.querySelector('[data-zone-page-use]')?.addEventListener('click', () => {
    const capture = (review.options?.captureFaces || []).find(item => item.page === selectedPage());
    const box = capture?.box;
    const validBox = Array.isArray(box) && box.length === 4 && box.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && box[2] > box[0] && box[3] > box[1];
    zones[selected()] = { page: selectedPage(), box: validBox ? [...box] : [0, 0, 1, 1] };
    dirtyFaces.add(selected()); persist(); invalidatePackageConfirmation('Starting crop added. Adjust it to the visible flat face, then confirm.'); redraw();
  });
  if (mapping) {
    packageTypeInput.addEventListener('change', () => {
      invalidatePackageConfirmation('Package type changed. Inspect the suggested faces and confirm the mapping again.');
      refreshPackageType();
    });
    mapping.querySelector('[data-capture-apply]')?.addEventListener('click', () => {
      for (const [face, zone] of Object.entries(captureFaceSuggestions(review))) {
        if (packageType(selectedType()).faces.includes(face) && !zones[face]) {
          zones[face] = { page: zone.page, box: [...zone.box] }; dirtyFaces.add(face);
        }
      }
      persist(); invalidatePackageConfirmation('Suggested photos copied. Crop each visible flat face before confirming.'); refreshPackageType();
    });
    mapping.querySelectorAll('[data-capture-map-page]').forEach(button => button.addEventListener('click', () => {
      const page = Number(button.dataset.captureMapPage);
      const face = mapping.querySelector(`[data-capture-map-face="${page}"]`)?.value;
      if (!face || !packageType(selectedType()).faces.includes(face)) {
        status.textContent = 'Choose the visible face for this still before mapping it.';
        return;
      }
      const suggestion=captureFaceSuggestions(review)[face];
      zones[face] = { page, box: suggestion?.page===page&&Array.isArray(suggestion.box)?[...suggestion.box]:[0,0,1,1] };
      dirtyFaces.add(face); persist(); invalidatePackageConfirmation('Frame assigned as a starting crop. Adjust it to the visible flat face, then confirm.'); redraw();
    }));
    mapping.querySelector('[data-dieline-apply]')?.addEventListener('click', () => {
      const suggestion = suggestDielineMapping(dieline, selectedType());
      if (!Object.keys(suggestion.zones).length) return;
      const artworkPage = currentPage().number;
      for (const [face, zone] of Object.entries(suggestion.zones)) {
        if (packageType(selectedType()).faces.includes(face)) {
          // Dieline page numbers belong to a separate document. Suggestions
          // copy normalized regions onto the currently selected artwork page;
          // the reviewer then adjusts each crop against the actual artwork.
          zones[face] = { page: artworkPage, box: [...zone.box] };
          dirtyFaces.add(face);
        }
      }
      persist();
      invalidatePackageConfirmation('Suggested regions copied. Adjust the artwork crops, then confirm.');
      refreshPackageType();
    });
  }
  if(zones.front?.page) pageInput.value=String(zones.front.page);
  if (mapping) refreshPackageType();
  redraw();
}
