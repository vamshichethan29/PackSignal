const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const sourceFor = fact => fact.evidence?.name || fact.sourceContext?.name || fact.documentName || 'Source not identified';
const locationFor = fact => fact.evidence?.location || [fact.sourceContext?.sheet, fact.sourceContext?.cell].filter(Boolean).join(' · ') || 'Location not supplied';
const valueFor = fact => fact.value == null || fact.value === '' ? 'No extracted value' : typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value);
const needsAttention = finding => finding.status !== 'match';

function factRows(review) {
  return (review.facts || []).map(fact => `<tr><th scope="row">${esc(fact.label || fact.field || 'Product detail')}</th><td>${esc(valueFor(fact))}</td><td>${esc(sourceFor(fact))}<small>${esc(locationFor(fact))}</small></td><td>${fact.aiProposed ? 'AI proposal · confirm' : 'Supplied source'}</td></tr>`).join('');
}

export function renderReviewFactSheet(review) {
  const facts = review.facts || [];
  const sourced = facts.filter(fact => !fact.aiProposed).length;
  return `<section class="review-output" aria-label="Fact Sheet for this review"><div class="review-output-head"><div><div class="eyebrow">CURRENT REVIEW · SOURCE FACTS</div><h2>Fact Sheet</h2><p>${esc(review.name)} · ${facts.length} extracted details · ${sourced} from supplied sources</p></div></div>${facts.length ? `<div class="review-output-table-wrap"><table class="review-output-table"><thead><tr><th>Product detail</th><th>Value</th><th>Source and location</th><th>Authority</th></tr></thead><tbody>${factRows(review)}</tbody></table></div>` : '<p class="review-output-empty">No product facts were extracted from this review. Add a product specification or content sheet to compare against the artwork.</p>'}</section>`;
}

export function renderReviewLenses(review) {
  const findings = (review.findings || []).filter(needsAttention);
  const counts = ['issue', 'review', 'unable'].map(status => `${findings.filter(f => f.status === status).length} ${status === 'unable' ? 'unverified' : status}`).join(' · ');
  return `<section class="review-output" aria-label="Reviewer lenses for this review"><div class="review-output-head"><div><div class="eyebrow">CURRENT REVIEW · EVIDENCE MARKUP</div><h2>Reviewer Lenses</h2><p>${esc(review.name)} · ${counts}</p></div></div>${findings.length ? `<div class="review-output-list">${findings.map((finding, index) => { const items = Array.isArray(finding.evidence) ? finding.evidence : finding.evidence ? [finding.evidence] : []; const evidence = items.find(item => item.role === 'artwork') || items[0] || {}; const decision = review.decisions?.[finding.id]; return `<article class="review-output-finding ${esc(finding.status)}"><div class="review-output-finding-top"><span class="review-output-index">${String(index + 1).padStart(2, '0')}</span><strong>${esc(finding.title || finding.check || 'Review finding')}</strong><span class="review-output-status">${esc(finding.status)}</span></div><p>${esc(finding.explanation || finding.observed || 'Inspect the attached evidence before deciding.')}</p><div class="review-output-evidence"><span>Observed: ${esc(finding.observed || evidence.quote || 'Not recorded')}</span><span>Expected: ${esc(finding.expected || 'Needs reviewer confirmation')}</span><span>Evidence: ${esc(evidence.name || evidence.location || 'No precise source location supplied')}${evidence.page ? ` · page ${esc(evidence.page)}` : ''}</span>${decision ? `<span>Decision: ${esc(decision.disposition || decision.status || 'Recorded')}</span>` : ''}</div><button class="secondary" data-action="proof" data-id="${esc(finding.id)}">Inspect evidence →</button></article>`; }).join('')}</div>` : '<p class="review-output-empty">No findings currently need a reviewer decision. Open the Checks tab to inspect all matches and evidence.</p>'}</section>`;
}

export function renderReviewCreativeBrief(review) {
  const facts = (review.facts || []).filter(fact => !fact.aiProposed);
  const attention = (review.findings || []).filter(needsAttention);
  const groups = [
    ['Product identity', /product|brand|flavour|flavor|variant|identity|name/i],
    ['Pack quantity and format', /quantity|weight|volume|count|size|pack/i],
    ['Ingredients and nutrition', /ingredient|allergen|nutrition|calorie|sugar|fat|protein/i],
    ['Claims and required copy', /claim|certif|warning|storage|address|manufacturer|origin|barcode/i],
  ];
  const used = new Set();
  const sections = groups.map(([title, pattern]) => { const selected = facts.filter(fact => pattern.test(`${fact.field} ${fact.label}`)); selected.forEach(fact => used.add(fact)); return [title, selected]; });
  const other = facts.filter(fact => !used.has(fact));
  if (other.length) sections.push(['Other supplied details', other]);
  return `<section class="review-output" aria-label="Creative Brief for this review"><div class="review-output-head"><div><div class="eyebrow">CURRENT REVIEW · SOURCE-BACKED HANDOFF</div><h2>Creative Brief</h2><p>${esc(review.name)} · ${facts.length} supplied facts · ${attention.length} checks requiring attention</p></div><button class="secondary" data-action="download-review-brief">Download brief ↓</button></div><p class="review-output-note">This draft uses supplied product details. Resolve open checks before approving packaging copy.</p>${sections.length ? `<div class="review-output-sections">${sections.map(([title, selected]) => `<section><h3>${esc(title)}</h3><dl>${selected.map(fact => `<div><dt>${esc(fact.label || fact.field || 'Detail')}</dt><dd>${esc(valueFor(fact))}<small>${esc(sourceFor(fact))} · ${esc(locationFor(fact))}</small></dd></div>`).join('')}</dl></section>`).join('')}</div>` : '<p class="review-output-empty">No supplied product facts are available yet. Add a specification or content sheet to create a source-backed brief.</p>'}<h3>Review before release</h3>${attention.length ? `<ul class="review-output-issues">${attention.map(finding => `<li><span>${esc(finding.status.toUpperCase())}</span> ${esc(finding.title || finding.check || 'Finding')}</li>`).join('')}</ul>` : '<p>No open findings are recorded for this review.</p>'}</section>`;
}

export function downloadReviewCreativeBrief(review) {
  const lines = [`# Creative Brief — ${review.name || 'Packaging review'}`, '', 'Source-backed draft. Resolve open checks before approving packaging copy.', '', '## Supplied product details', ''];
  for (const fact of (review.facts || []).filter(item => !item.aiProposed)) lines.push(`- ${fact.label || fact.field || 'Detail'}: ${valueFor(fact)} (Source: ${sourceFor(fact)}, ${locationFor(fact)})`);
  lines.push('', '## Review before release', '');
  for (const finding of (review.findings || []).filter(needsAttention)) lines.push(`- [${finding.status}] ${finding.title || finding.check || 'Finding'}: ${finding.explanation || finding.observed || 'Inspect evidence'}`);
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `PackSignal-Creative-Brief-${String(review.id || 'review').slice(0, 8)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
