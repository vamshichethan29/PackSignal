const findingTemplates = [
  {
    id: "quantity",
    kind: "issue",
    title: "Net quantity doesn’t match",
    summary: "The front panel shows <b>750 mL</b>; approved product data says <b>1 L</b>.",
    expectedLabel: "APPROVED SPECIFICATION",
    expected: "1 L",
    observedLabel: "ON ARTWORK · FRONT",
    observed: "750 mL",
    explanation: "The printed quantity is different from the approved product specification. Check that the artwork uses the current fill volume before print.",
    file: "data/product-spec.json",
    location: "Page 1 · Product identity · Net contents",
    quote: "Net contents: 1 L (1000 mL). This value is the approved pack size for SKU FD-OAT-1042.",
    rule: "The net quantity shown on the retail artwork must match the approved product specification, including the value and unit.",
    artworkLocation: "Front panel · lower left · observed text: ‘750 mL’",
    marker: "quantity",
    action: "Mark addressed"
  },
  {
    id: "storage",
    kind: "issue",
    title: "Storage statement not found",
    summary: "The checklist requires <b>“Refrigerate after opening.”</b> No matching statement was detected.",
    expectedLabel: "CHECKLIST REQUIREMENT",
    expected: "Refrigerate after opening",
    observedLabel: "ON ARTWORK · BACK",
    observed: "Not detected",
    explanation: "The supplied sample checklist requires this statement on the retail pack. The back panel has no matching storage copy in the designated area.",
    file: "data/packaging-checklist.json",
    location: "Page 2 · Storage · Requirement 04",
    quote: "After-opening storage statement: ‘Refrigerate after opening.’ Include on each retail package.",
    rule: "Required statement · exact copy · every retail pack",
    artworkLocation: "Back panel · Package care section · no matching storage statement",
    marker: "storage",
    action: "Mark addressed"
  },
  {
    id: "claim",
    kind: "human",
    title: "Verify claim approval",
    summary: "The artwork says <b>“No Added Sugar”</b>; the supplied claims register has no matching approval record.",
    expectedLabel: "APPROVED CLAIMS REGISTER",
    expected: "Approval record",
    observedLabel: "ON ARTWORK · FRONT",
    observed: "No Added Sugar",
    explanation: "The phrase is visible on the artwork, but the supplied materials do not show whether this claim was reviewed and approved. A reviewer must confirm its status and intended use.",
    file: "data/approved-claims.json",
    location: "Page 1 · Approved claims · No entry found",
    quote: "The supplied claims register contains no approval entry for ‘No Added Sugar’. This is a gap in the provided evidence, not proof that the claim is invalid.",
    rule: "Marketing claims require a traceable approval record in the supplied claims register.",
    artworkLocation: "Front panel · claim badge · text: ‘NO ADDED SUGAR’",
    marker: "claim",
    action: "Confirm cleared"
  }
];

let findings = [];
let checksClear = 0;
let totalChecks = 12;
let sourcesReady = false;
let checkResults = [];

function normalized(text) { return String(text || "").replace(/\s+/g, " ").trim().toLocaleLowerCase(); }
function hasPhrase(artworkText, phrase) { return normalized(artworkText).includes(normalized(phrase)); }

function analyzeSources(productSpec, checklist, claimsRegister, artworkXml) {
  const artworkText = [...artworkXml.querySelectorAll("text")].map(node => node.textContent || "").join(" ");
  const netNode = artworkXml.querySelector('[data-evidence="net-quantity"]');
  const quantityText = (netNode?.textContent || "").trim();
  const quantityMatch = quantityText.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
  let artworkQuantityMl = null;
  if (quantityMatch) artworkQuantityMl = Number(quantityMatch[1]) * (quantityMatch[2].toLowerCase() === "l" ? 1000 : 1);
  const templates = Object.fromEntries(findingTemplates.map(item => [item.id, item]));
  const found = [];
  let passed = 0;
  checkResults = [];

  checklist.requirements.forEach(requirement => {
    let clear = false;
    if (requirement.type === "phrase_present") clear = hasPhrase(artworkText, requirement.phrase);
    if (requirement.type === "all_phrases_present") clear = requirement.phrases.every(phrase => hasPhrase(artworkText, phrase));
    if (requirement.type === "net_quantity_match") clear = artworkQuantityMl !== null && artworkQuantityMl === productSpec.product.netQuantity.millilitres;
    const itemObserved = requirement.type === "net_quantity_match"
      ? (quantityText || "Not detected")
      : requirement.type === "all_phrases_present"
        ? requirement.phrases.filter(phrase => hasPhrase(artworkText, phrase)).join(" · ") || "Not detected"
        : hasPhrase(artworkText, requirement.phrase || "")
          ? requirement.expected
          : "Not detected";
    checkResults.push({
      title: requirement.title,
      status: clear ? "Clear" : "Issue found",
      expected: requirement.expected || (requirement.phrase ? requirement.phrase : requirement.phrases.join(" · ")),
      observed: itemObserved,
      rule: requirement.rule,
      source: checklist.source,
      location: requirement.sourcePath
    });
    if (clear) { passed += 1; return; }

    const templateId = requirement.id === "net-quantity" ? "quantity" : requirement.id === "storage-statement" ? "storage" : null;
    if (!templateId) return;
    const template = templates[templateId];
    const isQuantity = templateId === "quantity";
    found.push({
      ...template,
      expected: isQuantity ? `${productSpec.product.netQuantity.display} (${productSpec.product.netQuantity.millilitres} mL)` : requirement.phrase,
      observed: isQuantity ? (quantityText || "Not detected") : "Not detected",
      file: isQuantity ? productSpec.source : checklist.source,
      location: isQuantity ? "$.product.netQuantity" : requirement.sourcePath,
      quote: isQuantity ? JSON.stringify(productSpec.product.netQuantity) : JSON.stringify({storageStatement: requirement.phrase}),
      rule: requirement.rule,
      evidenceText: isQuantity ? quantityText : ""
    });
  });

  const claimNodes = [...artworkXml.querySelectorAll('[data-evidence="claim"]')];
  const approvedClaims = (claimsRegister.approvedClaims || []).map(normalized);
  claimNodes.forEach(node => {
    const claimText = (node.textContent || "").trim();
    const claimApproved = !claimText || approvedClaims.some(approved => approved === normalized(claimText));
    checkResults.push({
      title: "Marketing claim approval record",
      status: claimApproved ? "Clear" : "Human review",
      expected: "A traceable approval entry for each marketing claim",
      observed: claimText || "No claim detected",
      rule: "Confirm that each printed marketing claim has an approval record in the supplied claims register.",
      source: claimsRegister.source,
      location: "$.approvedClaims"
    });
    if (claimApproved) { passed += 1; return; }
    const template = templates.claim;
    found.push({
      ...template,
      expected: "Approval record",
      observed: claimText,
      file: claimsRegister.source,
      location: "$.approvedClaims",
      quote: claimsRegister.note,
      rule: "Confirm that each printed marketing claim has an approval record in the supplied claims register.",
      evidenceText: claimText
    });
  });

  checksClear = passed;
  totalChecks = checklist.requirements.length + Math.max(claimNodes.length, 1);
  return found;
}

async function initializeReview() {
  try {
    const [specResponse, checklistResponse, claimsResponse, artworkResponse] = await Promise.all([
      fetch("data/product-spec.json"),
      fetch("data/packaging-checklist.json"),
      fetch("data/approved-claims.json"),
      fetch("assets/fieldday-artwork.svg")
    ]);
    if (![specResponse, checklistResponse, claimsResponse, artworkResponse].every(response => response.ok)) throw new Error("A sample source file could not be loaded.");
    const [productSpec, checklist, claimsRegister, artworkSource] = await Promise.all([
      specResponse.json(), checklistResponse.json(), claimsResponse.json(), artworkResponse.text()
    ]);
    const artworkXml = new DOMParser().parseFromString(artworkSource, "image/svg+xml");
    findings = analyzeSources(productSpec, checklist, claimsRegister, artworkXml);
    sourcesReady = true;
    if (findings.length) activeFinding = findings[0].id;
    renderReview();
  } catch (error) {
    showToast("Couldn’t load the sample sources. Start the app using the README command.");
    document.querySelector("#finding-list").innerHTML = '<div class="finding-empty">Start the local server to load the sample source files.</div>';
  }
}

const pageIds = ["overview", "reviews", "rules", "sources"];
let activePage = "overview";
let activeFinding = "quantity";
let activeFilter = "all";
let zoom = 1;
let markersVisible = true;
let toastTimer;

const pageElements = {
  overview: document.querySelector("#overview-page"),
  lenses: document.querySelector("#lenses-page"),
  canvas: document.querySelector("#canvas-page"),
  desk: document.querySelector("#desk-page"),
  brief: document.querySelector("#brief-page"),
  reviews: document.querySelector("#review-page"),
  rules: document.querySelector("#rules-page"),
  sources: document.querySelector("#sources-page")
};

function goTo(page) {
  if (!pageElements[page]) return;
  activePage = page;
  Object.entries(pageElements).forEach(([key, element]) => {
    if (element) element.classList.toggle("hidden", key !== page);
  });
  document.querySelectorAll(".nav-item[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  document.querySelector("#topbar-context").textContent = ({overview: "Overview", lenses: "Reviewer Lenses", canvas: "Pack Canvas", desk: "Evidence Desk", brief: "Creative Brief", reviews: "Artwork review", rules: "Rule library", sources: "Source files"})[page] || "Overview";
  window.scrollTo({top: 0, behavior: "smooth"});
  if (page === "reviews") renderReview();
  if (page === "desk") renderDesk();
  if (page === "brief") renderBrief();
  if (page === "lenses") renderLenses();
  if (page === "canvas") renderCanvas();
}


function unresolved() { return findings.filter(item => !item.resolved); }

function renderFindingList() {
  const list = document.querySelector("#finding-list");
  const shown = findings.filter(item => {
    if (activeFilter === "issue") return item.kind === "issue" && !item.resolved;
    if (activeFilter === "human") return item.kind === "human" && !item.resolved;
    return true;
  });
  if (!shown.length) {
    list.innerHTML = '<div class="finding-empty">No findings in this view.</div>';
    return;
  }
  list.innerHTML = shown.map(item => {
    const status = item.resolved ? "Addressed" : item.kind === "human" ? "Human review" : "Issue found";
    const glyph = item.resolved ? "✓" : item.kind === "human" ? "↗" : "!";
    return `<article class="finding-card ${item.id === activeFinding ? "selected" : ""} ${item.resolved ? "resolved" : ""}" data-finding="${item.id}" tabindex="0" role="button" aria-label="Open finding: ${item.title}">
      <span class="finding-icon ${item.resolved ? "resolved" : item.kind}">${glyph}</span><div class="finding-copy"><div class="finding-meta"><strong>${item.title}</strong><span class="finding-status ${item.resolved ? "resolved" : item.kind}">${status}</span></div><p>${item.summary}</p></div><span class="finding-chevron">›</span>
    </article>`;
  }).join("");
  list.querySelectorAll("[data-finding]").forEach(card => {
    const activate = () => { activeFinding = card.dataset.finding; renderReview(); };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
  });
}

function renderDetail() {
  const detail = document.querySelector("#finding-detail");
  const item = findings.find(candidate => candidate.id === activeFinding) || findings[0];
  if (!item) {
    detail.innerHTML = '<div class="finding-empty">Load the local sample sources to inspect review evidence.</div>';
    return;
  }
  const observedClass = item.kind === "human" ? "human-value" : "";
  detail.innerHTML = `<div class="detail-top"><span class="detail-label">${item.kind === "human" ? "HUMAN VERIFICATION" : "CHECK DETAILS"}</span><button class="detail-source-link" data-source="${item.id}">↗ View source</button></div>
    <div class="proof-comparison"><div class="proof-cell"><small>${item.expectedLabel}</small><strong>${item.expected}</strong></div><div class="proof-cell observed ${observedClass}"><small>${item.observedLabel}</small><strong>${item.observed}</strong></div></div>
    <p class="finding-explanation">${item.explanation}</p><div class="detail-evidence"><span class="evidence-glyph">⌕</span><span><b>Artwork location:</b> ${item.artworkLocation}</span></div>
    ${item.resolved ? '<div class="resolved-inline">✓ Reviewer marked this finding as addressed.</div>' : `<div class="detail-actions"><button class="detail-action" data-resolve="${item.id}">${item.action}</button><button class="detail-action secondary" data-locate="${item.id}">Locate on artwork ↗</button></div>`}`;
  detail.querySelector("[data-source]")?.addEventListener("click", () => showEvidence(item));
  detail.querySelector("[data-resolve]")?.addEventListener("click", () => resolveFinding(item));
  detail.querySelector("[data-locate]")?.addEventListener("click", () => locateFinding(item));
}

function updateCounts() {
  const open = unresolved();
  const issueCount = open.filter(item => item.kind === "issue").length;
  const humanCount = open.filter(item => item.kind === "human").length;
  const addressed = findings.length - open.length;
  const clearCount = checksClear + addressed;
  document.querySelector("#summary-issue-count").textContent = issueCount;
  document.querySelector("#summary-human-count").textContent = humanCount;
  document.querySelector("#findings-count").textContent = String(open.length).padStart(2, "0");
  document.querySelector("#attention-total").textContent = String(open.length).padStart(2, "0");
  document.querySelector(".summary-score span").innerHTML = `${Math.round(clearCount / totalChecks * 100)}<small>%</small>`;
  document.querySelector(".summary-score strong").textContent = `${clearCount} of ${totalChecks} checks clear`;
  document.querySelector(".summary-score small").textContent = open.length ? `${open.length} finding${open.length === 1 ? "" : "s"} still need a decision` : "All sample findings have been addressed";
  document.querySelector(".review-card .mini-progress span").style.width = `${Math.round(clearCount / totalChecks * 100)}%`;
  document.querySelector(".review-progress-row > span").textContent = `${clearCount} of ${totalChecks} checks clear`;
  document.querySelector(".attention-count b").textContent = String(open.length).padStart(2, "0");
  document.querySelector(".attention-count").innerHTML = `<b>${String(open.length).padStart(2, "0")}</b> findings`;
  document.querySelector(".review-card-meta .review-type").innerHTML = `<span class="status-dot ${open.length ? "status-amber" : "status-green"}"></span>${open.length ? "PRE-PRINT REVIEW" : "REVIEW COMPLETE"}`;
  document.querySelectorAll(".nav-count").forEach(node => node.textContent = open.length);
  document.querySelectorAll(".filter-tab").forEach(button => {
    if (button.dataset.filter === "all") button.querySelector("span").textContent = open.length;
    if (button.dataset.filter === "issue") button.querySelector("span").textContent = issueCount;
    if (button.dataset.filter === "human") button.querySelector("span").textContent = humanCount;
  });
}

function updateMarker() {
  document.querySelectorAll(".art-hotspot").forEach(marker => marker.classList.remove("active"));
  document.querySelector("#canvas-caption-text").textContent = "Select a finding to locate evidence on artwork";
  if (!markersVisible) return;
  const item = findings.find(candidate => candidate.id === activeFinding);
  if (!item) return;
  const marker = document.querySelector(`#hotspot-${item.marker}`);
  marker?.classList.add("active");
  document.querySelector("#canvas-caption-text").textContent = item.artworkLocation;
}

function renderReview() {
  updateCounts();
  renderFindingList();
  renderDetail();
  updateMarker();
}

function locateFinding(item) {
  activeFinding = item.id;
  renderReview();
  document.querySelector("#artwork-panel")?.scrollIntoView({behavior: "smooth", block: "nearest"});
  showToast(`Evidence located on the ${item.marker === "quantity" || item.marker === "claim" ? "front" : "back"} panel`);
}

function resolveFinding(item) {
  item.resolved = true;
  renderReview();
  renderOverviewCounts();
  showToast("Reviewer decision saved for this sample review");
}

function renderOverviewCounts() {
  const count = unresolved().length;
  document.querySelector("#attention-total").textContent = String(count).padStart(2, "0");
}

function showEvidence(item) {
  document.querySelector("#evidence-title").textContent = item.file;
  document.querySelector("#evidence-description").textContent = item.rule;
  document.querySelector("#evidence-quote").innerHTML = `“${item.quote}”`;
  document.querySelector("#evidence-location").textContent = `${item.location}  ·  ${item.artworkLocation}`;
  document.querySelector("#evidence-dialog").showModal();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function downloadReport() {
  if (!sourcesReady) { showToast("Wait for the sample source files to load"); return; }
  const generated = new Date().toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"});
  const openItems = unresolved();
  const report = [
    "# PackSignal — Artwork review report",
    "",
    "**Product:** Fieldday Original Oat Drink  ·  **SKU:** FD-OAT-1042  ·  **Artwork:** V07",
    "**Market:** India (demo scope)  ·  **Run:** PP-2026-1042  ·  **Generated:** " + generated,
    "**Sources:** data/product-spec.json; data/packaging-checklist.json; data/approved-claims.json; assets/fieldday-artwork.svg",
    "",
    `## Summary: ${checksClear + findings.filter(item => item.resolved).length}/${totalChecks} checks clear · ${openItems.length} findings open`,
    "",
    "## Checks",
    "",
    ...checkResults.map((check, index) => `${index + 1}. **${check.status} — ${check.title}** · expected: ${check.expected} · observed: ${check.observed} · source: ${check.source} ${check.location}`),
    "",
    "## Findings and evidence",
    "",
    ...findings.map((item, index) => [
      `### ${index + 1}. ${item.title} — ${item.resolved ? "ADDRESSED BY REVIEWER" : item.kind === "human" ? "HUMAN REVIEW" : "ISSUE FOUND"}`,
      "",
      `- **Expected:** ${item.expected}`,
      `- **Observed:** ${item.observed}`,
      `- **Rule:** ${item.rule}`,
      `- **Source:** ${item.file}, ${item.location}`,
      `- **Artwork evidence:** ${item.artworkLocation}`,
      `- **Explanation:** ${item.explanation}`,
      ""
    ]).flat(),
    "## Scope and limitations",
    "This report reflects a fictional product, sample artwork illustration, and fictional internal checklist. It is not a regulatory assessment or legal sign-off. Findings are checked against the supplied sample sources; a qualified reviewer is responsible for the final release decision.",
    ""
  ].join("\n");
  const blob = new Blob([report], {type: "text/markdown;charset=utf-8"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "packproof-fieldday-review-PP-2026-1042.md";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("Review report downloaded");
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.page)));
document.querySelectorAll(".filter-tab").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab === button));
  const visible = findings.filter(item => activeFilter === "all" || (activeFilter === "issue" ? item.kind === "issue" && !item.resolved : item.kind === "human" && !item.resolved));
  if (visible.length && !visible.some(item => item.id === activeFinding)) activeFinding = visible[0].id;
  renderReview();
}));
document.querySelector("#export-report").addEventListener("click", downloadReport);
document.querySelector("#view-findings").addEventListener("click", () => document.querySelector("#findings-panel").scrollIntoView({behavior: "smooth", block: "center"}));
document.querySelector("#zoom-in").addEventListener("click", () => { zoom = Math.min(1.3, +(zoom + .1).toFixed(1)); document.querySelector("#artwork-wrap").style.transform = `scale(${zoom})`; document.querySelector("#zoom-level").textContent = `${Math.round(zoom * 100)}%`; });
document.querySelector("#zoom-out").addEventListener("click", () => { zoom = Math.max(.8, +(zoom - .1).toFixed(1)); document.querySelector("#artwork-wrap").style.transform = `scale(${zoom})`; document.querySelector("#zoom-level").textContent = `${Math.round(zoom * 100)}%`; });
document.querySelector("#fit-artwork").addEventListener("click", () => { zoom = 1; document.querySelector("#artwork-wrap").style.transform = "scale(1)"; document.querySelector("#zoom-level").textContent = "100%"; });
// ============================================================================
// Phase 4: Evidence Desk Controller & Handlers
// ============================================================================
let deskSession = null;
let activeFactFilter = "all";
let factSearchQuery = "";

async function fetchDeskState() {
  try {
    const res = await fetch("/api/desk/state");
    if (!res.ok) throw new Error("Failed to load desk state");
    deskSession = await res.json();
    updateDeskBadgeCounts();
    return deskSession;
  } catch (err) {
    console.error("Desk state fetch error:", err);
    return null;
  }
}

function updateDeskBadgeCounts() {
  if (!deskSession) return;
  const openConflicts = deskSession.conflicts.filter(c => c.status === "OPEN").length;
  const deskCountEl = document.querySelector("#desk-nav-count");
  if (deskCountEl) deskCountEl.textContent = openConflicts;
  const attentionTotal = document.querySelector("#attention-total");
  if (attentionTotal) attentionTotal.textContent = String(openConflicts).padStart(2, "0");
}

async function renderDesk() {
  if (!deskSession) {
    await fetchDeskState();
  }
  if (!deskSession) return;

  // 1. Metrics Strip
  const dFiles = document.querySelector("#d-metric-files");
  if (dFiles) dFiles.textContent = deskSession.files.length;
  const dPieces = document.querySelector("#d-metric-pieces");
  if (dPieces) dPieces.textContent = deskSession.summary.totalPieces;
  const dProven = document.querySelector("#d-metric-proven");
  if (dProven) dProven.textContent = deskSession.facts.filter(f => f.state === "PROVEN").length;
  const dAi = document.querySelector("#d-metric-ai");
  if (dAi) dAi.textContent = deskSession.facts.filter(f => f.state === "AI_SUGGESTED").length;
  const openConflicts = deskSession.conflicts.filter(c => c.status === "OPEN").length;
  const dConflicts = document.querySelector("#d-metric-conflicts");
  if (dConflicts) dConflicts.textContent = openConflicts;
  const openQuestions = deskSession.questions.filter(q => q.status === "OPEN").length;
  const dQuestions = document.querySelector("#d-metric-questions");
  if (dQuestions) dQuestions.textContent = openQuestions;

  const fBadge = document.querySelector("#files-badge-count");
  if (fBadge) fBadge.textContent = deskSession.files.length;
  const cBadge = document.querySelector("#conflicts-badge-count");
  if (cBadge) cBadge.textContent = openConflicts;
  const qBadge = document.querySelector("#questions-badge-count");
  if (qBadge) qBadge.textContent = openQuestions;
  const factsBadge = document.querySelector("#facts-badge-count");
  if (factsBadge) factsBadge.textContent = deskSession.facts.length;

  // Filter tabs counts
  const tabAll = document.querySelector("#tab-cnt-all");
  if (tabAll) tabAll.textContent = deskSession.facts.length;
  const tabProven = document.querySelector("#tab-cnt-proven");
  if (tabProven) tabProven.textContent = deskSession.facts.filter(f => f.state === "PROVEN").length;
  const tabAi = document.querySelector("#tab-cnt-ai");
  if (tabAi) tabAi.textContent = deskSession.facts.filter(f => f.state === "AI_SUGGESTED").length;
  const tabConflict = document.querySelector("#tab-cnt-conflict");
  if (tabConflict) tabConflict.textContent = deskSession.facts.filter(f => f.state === "CONFLICT").length;

  updateDeskBadgeCounts();

  // 2. Render Source Files List
  const filesListEl = document.querySelector("#desk-files-list");
  if (filesListEl) {
    filesListEl.innerHTML = deskSession.files.map(file => {
      const extClass = `format-${file.type}`;
      const featTags = (file.features || []).map(f => `<span class="file-feat-tag">${f}</span>`).join("");
      return `
        <article class="desk-file-card" data-file-id="${file.id}">
          <div class="file-card-top">
            <span class="file-format-badge ${extClass}">${file.formatLabel}</span>
            <span class="file-pieces-count">${file.piecesCount} pieces</span>
          </div>
          <strong>${file.name}</strong>
          <div class="file-features-list">${featTags}</div>
        </article>
      `;
    }).join("");
  }

  // 3. Render Conflict Cards
  const conflictsEl = document.querySelector("#conflict-cards-container");
  if (conflictsEl) {
    conflictsEl.innerHTML = deskSession.conflicts.map(c => {
      const isResolved = c.status === "RESOLVED";
      const statusPill = isResolved
        ? `<span class="conflict-status-badge status-badge-resolved">✓ RESOLVED</span>`
        : `<span class="conflict-status-badge status-badge-open">! OPEN CONFLICT</span>`;

      let actionsHtml = "";
      if (isResolved) {
        actionsHtml = `
          <div class="conflict-resolved-banner">
            <span>✓</span>
            <strong>Resolved: ${c.resolvedValue}</strong>
            <span>(${c.resolvedSource})</span>
          </div>
        `;
      } else {
        const optButtons = (c.options || []).map(opt => `
          <button class="btn-resolve-opt" data-conflict-id="${c.id}" data-val="${opt.value}" data-src="${opt.source}">
            ${opt.label}
          </button>
        `).join("");
        actionsHtml = `<div class="conflict-actions-row">${optButtons}</div>`;
      }

      return `
        <article class="conflict-card ${isResolved ? 'resolved' : ''}" id="card-${c.id}">
          <div class="conflict-card-header">
            <span class="conflict-category">${c.category}</span>
            ${statusPill}
          </div>
          <h3 class="conflict-title">${c.label}</h3>
          <p class="conflict-explanation">${c.explanation}</p>
          <div class="conflict-vs-grid">
            <div class="conflict-side side-spec">
              <small>SPECIFICATION</small>
              <strong>${c.specValue}</strong>
              <em>${c.specSource}</em>
            </div>
            <div class="conflict-side side-art">
              <small>ARTWORK PRINT</small>
              <strong>${c.artworkValue}</strong>
              <em>${c.artworkSource}</em>
            </div>
          </div>
          ${actionsHtml}
        </article>
      `;
    }).join("");

    // Attach resolve handlers
    conflictsEl.querySelectorAll(".btn-resolve-opt").forEach(btn => {
      btn.addEventListener("click", async () => {
        const conflictId = btn.dataset.conflictId;
        const chosenValue = btn.dataset.val;
        const chosenSource = btn.dataset.src;
        await resolveConflict(conflictId, chosenValue, chosenSource);
      });
    });
  }

  // 4. Render Questions Stack
  const questionsEl = document.querySelector("#questions-stack-container");
  if (questionsEl) {
    questionsEl.innerHTML = deskSession.questions.map(q => {
      const isAnswered = q.status === "ANSWERED";
      const priorityClass = `priority-${q.priority.toLowerCase()}`;

      let optionsHtml = "";
      if (isAnswered) {
        optionsHtml = `
          <div class="question-answered-banner">
            <span>✓</span>
            <strong>Answered:</strong> ${q.answer?.answerValue || "Completed"}
          </div>
        `;
      } else {
        const optBtns = (q.options || []).map(opt => `
          <button class="q-opt-btn" data-question-id="${q.id}" data-opt-id="${opt.id}">
            ${opt.label}
          </button>
        `).join("");
        optionsHtml = `<div class="question-options-list">${optBtns}</div>`;
      }

      return `
        <article class="question-card ${isAnswered ? 'answered' : ''}">
          <div class="question-header">
            <span class="question-rank-pill">#${q.rank} RANK</span>
            <span class="priority-badge ${priorityClass}">${q.priority}</span>
          </div>
          <h4 class="question-text">${q.question}</h4>
          <div class="question-reason"><strong>AI Rationale:</strong> ${q.reason}</div>
          ${optionsHtml}
        </article>
      `;
    }).join("");

    // Attach question answer handlers
    questionsEl.querySelectorAll(".q-opt-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const questionId = btn.dataset.questionId;
        const answerId = btn.dataset.optId;
        await answerQuestion(questionId, answerId);
      });
    });
  }

  // 5. Render Creative Brief Feed
  renderBriefFeed();

  // 6. Render Fact Sheet
  renderFactSheet();
}

function renderBriefFeed() {
  if (!deskSession?.briefFeed) return;
  const feed = deskSession.briefFeed;
  const renderList = (elId, items) => {
    const el = document.querySelector(elId);
    if (!el) return;
    if (!items?.length) {
      el.innerHTML = '<li style="opacity:0.5;">None recorded</li>';
      return;
    }
    el.innerHTML = items.map(item => `<li>${item}</li>`).join("");
  };
  renderList("#brief-matrix-keep", feed.keep);
  renderList("#brief-matrix-change", feed.change);
  renderList("#brief-matrix-add", feed.add);
  renderList("#brief-matrix-remove", feed.remove);
}

function renderFactSheet() {
  if (!deskSession) return;
  const listEl = document.querySelector("#fact-sheet-list");
  if (!listEl) return;
  let filtered = deskSession.facts;

  if (activeFactFilter === "proven") {
    filtered = filtered.filter(f => f.state === "PROVEN");
  } else if (activeFactFilter === "ai") {
    filtered = filtered.filter(f => f.state === "AI_SUGGESTED");
  } else if (activeFactFilter === "conflict") {
    filtered = filtered.filter(f => f.state === "CONFLICT");
  }

  if (factSearchQuery) {
    const q = factSearchQuery.toLowerCase();
    filtered = filtered.filter(f =>
      (f.label && f.label.toLowerCase().includes(q)) ||
      (f.value && String(f.value).toLowerCase().includes(q)) ||
      (f.category && f.category.toLowerCase().includes(q))
    );
  }

  if (!filtered.length) {
    listEl.innerHTML = `<div class="finding-empty">No facts match filter: "${activeFactFilter}".</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(fact => {
    const stateClass = fact.state === "PROVEN" ? "pill-proven" : (fact.state === "CONFLICT" ? "pill-conflict" : "pill-ai");
    const stateLabel = fact.state === "PROVEN" ? "PROVEN" : (fact.state === "CONFLICT" ? "CONFLICT" : "AI-SUGGESTED");
    const cardClass = fact.state === "PROVEN" ? "fact-proven" : (fact.state === "CONFLICT" ? "fact-conflict" : "fact-ai");

    const chipsHtml = (fact.sources || []).map(src => {
      let icon = "📄";
      if (src.type === "excel") icon = "📊";
      if (src.type === "docx") icon = "📝";
      if (src.type === "plain_pdf") icon = "📋";
      if (src.type === "note") icon = "📌";
      if (src.type === "image") icon = "🖼️";

      const locText = src.location || src.cell || src.panel || src.paragraph || src.line || "Source";
      const shortFile = src.file.length > 25 ? src.file.slice(0, 22) + "..." : src.file;

      return `
        <button class="source-chip"
          data-file="${src.file}"
          data-location="${locText}"
          data-quote="${encodeURIComponent(src.quote || fact.value)}"
          data-type="${src.type || ''}"
          title="Open ${src.file} at ${locText}">
          <span class="chip-icon">${icon}</span>
          <span>${shortFile} [${locText}]</span>
        </button>
      `;
    }).join("");

    let conflictBanner = "";
    if (fact.state === "CONFLICT" && fact.conflictReason) {
      conflictBanner = `<div style="font-size:8px; color:#ba4837; margin-bottom:5px; line-height:1.4;"><strong>Conflict:</strong> ${fact.conflictReason}</div>`;
    }

    return `
      <article class="fact-card ${cardClass}" id="fact-${fact.id}">
        <div class="fact-row-top">
          <span class="fact-category-tag">${fact.category}</span>
          <span class="fact-state-pill ${stateClass}">${stateLabel}</span>
        </div>
        <div class="fact-field-label">${fact.label}</div>
        <div class="fact-field-value">${fact.value}</div>
        ${conflictBanner}
        <div class="source-chips-row">${chipsHtml}</div>
      </article>
    `;
  }).join("");

  // Attach chip click handlers to open file spot modal
  listEl.querySelectorAll(".source-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const file = chip.dataset.file;
      const location = chip.dataset.location;
      const quote = decodeURIComponent(chip.dataset.quote || "");
      const type = chip.dataset.type;
      openFileSpotModal(file, location, quote, type);
    });
  });
}

async function resolveConflict(conflictId, chosenValue, chosenSource) {
  try {
    showToast(`Resolving conflict: accepting ${chosenValue}...`);
    const res = await fetch("/api/desk/resolve-conflict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conflictId,
        chosenValue,
        chosenSource,
        note: `Reviewer approved ${chosenValue} from ${chosenSource}`
      })
    });
    const data = await res.json();
    if (data.status === "SUCCESS") {
      deskSession = data.session;
      showToast(`Conflict resolved! Fact Sheet updated to ${chosenValue}.`);
      renderDesk();
    } else {
      showToast(data.error || "Failed to resolve conflict");
    }
  } catch (err) {
    showToast("Network error resolving conflict");
    console.error(err);
  }
}

async function answerQuestion(questionId, answerId) {
  try {
    showToast("Saving decision...");
    const res = await fetch("/api/desk/answer-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        answerId
      })
    });
    const data = await res.json();
    if (data.status === "SUCCESS") {
      deskSession = data.session;
      showToast("Question answered! Fact Sheet and Brief Matrix updated.");
      renderDesk();
    } else {
      showToast(data.error || "Failed to answer question");
    }
  } catch (err) {
    showToast("Network error answering question");
    console.error(err);
  }
}

async function openFileSpotModal(file, location, quote, type) {
  const dialog = document.querySelector("#file-spot-dialog");
  if (!dialog) return;
  document.querySelector("#spot-file-title").textContent = file;
  document.querySelector("#spot-location-badge").textContent = location;
  document.querySelector("#spot-type-badge").textContent = (type || "SOURCE").toUpperCase();
  document.querySelector("#spot-quote-text").textContent = `"${quote}"`;

  try {
    const spotRes = await fetch(`/api/file-spot?file=${encodeURIComponent(file)}&location=${encodeURIComponent(location)}&quote=${encodeURIComponent(quote)}`);
    const spotData = await spotRes.json();
    document.querySelector("#spot-context-snippet").textContent = spotData.snippet || `File: ${file}\nPosition: ${location}\nExtract: "${quote}"`;
  } catch {
    document.querySelector("#spot-context-snippet").textContent = `File: ${file}\nPosition: ${location}\nVerbatim extract: "${quote}"`;
  }

  dialog.showModal();
}

// Dialog listeners for Phase 4
const closeFileSpot = document.querySelector("#close-file-spot");
if (closeFileSpot) closeFileSpot.addEventListener("click", () => document.querySelector("#file-spot-dialog")?.close());
const spotCloseBtn = document.querySelector("#spot-close-btn");
if (spotCloseBtn) spotCloseBtn.addEventListener("click", () => document.querySelector("#file-spot-dialog")?.close());

const deskLoadSamples = document.querySelector("#desk-load-samples");
if (deskLoadSamples) {
  deskLoadSamples.addEventListener("click", async () => {
    showToast("Reloading Esko samples + extra inputs...");
    const res = await fetch("/api/desk/reset", { method: "POST" });
    const data = await res.json();
    if (data.status === "SUCCESS") {
      deskSession = data.session;
      showToast("Esko samples and all inputs loaded fresh!");
      renderDesk();
    }
  });
}

const deskReset = document.querySelector("#desk-reset");
if (deskReset) {
  deskReset.addEventListener("click", async () => {
    showToast("Resetting Evidence Desk...");
    const res = await fetch("/api/desk/reset", { method: "POST" });
    const data = await res.json();
    if (data.status === "SUCCESS") {
      deskSession = data.session;
      showToast("Evidence Desk reset to baseline.");
      renderDesk();
    }
  });
}

// Facts Search & Filter Tabs
const searchInput = document.querySelector("#facts-search-input");
if (searchInput) {
  searchInput.addEventListener("input", e => {
    factSearchQuery = e.target.value.trim();
    renderFactSheet();
  });
}

document.querySelectorAll(".fact-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activeFactFilter = tab.dataset.factFilter;
    document.querySelectorAll(".fact-tab").forEach(t => t.classList.toggle("active", t === tab));
    renderFactSheet();
  });
});

// Upload Modal
const uploadDialog = document.querySelector("#upload-dialog");
const openUploadBtn = document.querySelector("#desk-open-upload");
const quickUploadBtn = document.querySelector("#btn-quick-upload");
const closeUploadBtn = document.querySelector("#close-upload-dialog");
const cancelUploadBtn = document.querySelector("#cancel-upload-btn");

if (openUploadBtn) openUploadBtn.addEventListener("click", () => uploadDialog?.showModal());
if (quickUploadBtn) quickUploadBtn.addEventListener("click", () => uploadDialog?.showModal());
if (closeUploadBtn) closeUploadBtn.addEventListener("click", () => uploadDialog?.close());
if (cancelUploadBtn) cancelUploadBtn.addEventListener("click", () => uploadDialog?.close());

const tabBtnFile = document.querySelector("#tab-btn-file");
const tabBtnPaste = document.querySelector("#tab-btn-paste");
const uploadFilePane = document.querySelector("#upload-file-pane");
const uploadPastePane = document.querySelector("#upload-paste-pane");

if (tabBtnFile && tabBtnPaste) {
  tabBtnFile.addEventListener("click", () => {
    tabBtnFile.classList.add("active");
    tabBtnPaste.classList.remove("active");
    uploadFilePane.classList.remove("hidden");
    uploadPastePane.classList.add("hidden");
  });
  tabBtnPaste.addEventListener("click", () => {
    tabBtnPaste.classList.add("active");
    tabBtnFile.classList.remove("active");
    uploadPastePane.classList.remove("hidden");
    uploadFilePane.classList.add("hidden");
  });
}

// Dropzones
const mainDropzone = document.querySelector("#desk-dropzone");
const mainFileInput = document.querySelector("#desk-file-input");
if (mainDropzone && mainFileInput) {
  mainDropzone.addEventListener("click", () => mainFileInput.click());
  mainFileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (file) {
      showToast(`Ingesting ${file.name}...`);
      const reader = new FileReader();
      reader.onload = async () => {
        const content = reader.result;
        await fetch("/api/desk/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, content: typeof content === 'string' ? content : '', fileType: file.name.split('.').pop() })
        });
        await fetchDeskState();
        renderDesk();
        showToast(`${file.name} parsed into Evidence Desk!`);
      };
      if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
  });
}

const submitUploadBtn = document.querySelector("#submit-upload-btn");
if (submitUploadBtn) {
  submitUploadBtn.addEventListener("click", async () => {
    const isPaste = tabBtnPaste?.classList.contains("active");
    if (isPaste) {
      const title = document.querySelector("#paste-note-title")?.value || "QA_Pasted_Notes.txt";
      const text = document.querySelector("#paste-note-content")?.value || "";
      if (!text.trim()) {
        showToast("Please enter notes content.");
        return;
      }
      showToast("Ingesting pasted notes...");
      await fetch("/api/desk/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: title, content: text, fileType: "txt" })
      });
      uploadDialog?.close();
      await fetchDeskState();
      renderDesk();
      showToast("Notes parsed with line numbers as source!");
    } else {
      uploadDialog?.close();
      showToast("File selected for intake.");
    }
  });
}

// Fetch desk state on boot and render
fetchDeskState().then(() => {
  if (activePage === "desk") renderDesk();
});

async function renderBrief() {
  const container = document.querySelector("#brief-page");
  if (!container) return;
  try {
    const mod = await import('/creative-brief.js');
    mod.mountCreativeBrief(container);
  } catch (err) {
    console.error('Failed to mount Creative Brief:', err);
  }
}

async function renderLenses() {
  const container = document.querySelector("#lenses-page");
  if (!container) return;
  try {
    const mod = await import('/reviewer-lenses.js');
    mod.mountReviewerLenses(container);
  } catch (err) {
    console.error('Failed to mount Reviewer Lenses:', err);
  }
}

async function renderCanvas() {
  const container = document.querySelector("#canvas-page");
  if (!container) return;
  try {
    const mod = await import('/pack-canvas.js');
    mod.mountPackCanvas(container);
  } catch (err) {
    console.error('Failed to mount Pack Canvas:', err);
  }
}

initializeReview();


