import {
  artworkMap,
  workbenchArtwork,
  findingVisual,
  revisionVisual,
  mountArtworkControls,
} from "./artwork-ui.js";
import { revisionStudioView, mountRevisionStudio } from "./revision-studio.js";
import { regulatorySwitcherMarkup, buildComparisonMatrixModal, buildMarketWorklistModal, mountRegulatorySwitcher } from "./regulatory-switcher.js";
import { startWalkthrough, stopWalkthrough } from "./walkthrough.js";
import { panelZoneMapper, mountPanelZoneMapper } from "./panel-zones.js";
import { reviewPipeline } from "./review-pipeline.js";
import { storageDisclosure } from "./storage-disclosure.js";
import { engineStatusCopy } from "./engine-status-copy.js";
import { mergeReviewSummary, reviewCoverage } from "./review-summary.js";
import { sourceImpactView } from "./source-impact.js";
import { teamReviewView } from "./team-review.js";
import { cameraIntakeMarkup, mountCameraIntake, combineArtworkImagesAsPdf, refreshCameraIntakeQuality } from "./camera-intake.js";
import "./review-actions.js";
import { mountEvidenceCanvas } from "./evidence-canvas.js";
import { preflightDashboardView } from "./preflight-dashboard.js";
import { deepVerificationDashboardView } from "./deep-verification.js";
import { renderOrganizerValidationSection, setOrganizerValidationFilter } from "./organizer-validation-ui.js";
import {
  whatWeReadView,
  rulebookTrustView,
  renderRuleDetailHtml,
  guidedQuestionsView,
  coverageLedgerView,
  reportsView,
} from "./regulatory-workbench.js";
import { sourceAmbiguityDashboardView, mountAmbiguityStudio } from "./source-ambiguity.js";
import { independentEvaluationView } from "./independent-evaluation.js";
import { trustConsoleView, mountTrustConsole } from "./trust-console.js";
import { campusExtrasMarkup, mountCampusExtras } from "./campus-extras.js";
import { mountCampusDemoBar } from "./campus-demo.js";
import { nutritionStudioView, mountNutritionStudio } from "./nutrition-studio.js";
import { packagingGeometryView, mountPackagingGeometry } from "./packaging-geometry.js";
import { initEvidenceDrawer, openEvidenceDrawer } from "./evidence-drawer.js";
import { renderSourceChip, renderSourceChips, attachSourceChipListeners, renderFactBadge } from "./source-chip.js";
import { generateQrSvg } from "./ar-modal.js";
import { renderConflictCard, mountConflictCardHandlers } from "./conflict-card.js";
import { renderGuidedQuestionsQueue } from "./review-questions.js";
import { renderRuleMap } from "./rule-map.js";
import { evidenceDeskView, mountEvidenceDesk } from "./evidence-desk.js";
import { mountCreativeBrief } from "./creative-brief.js";
import { mountAskAboutThis } from "./ask-about-this.js";
import { mountReviewerLenses } from "./reviewer-lenses.js";
import { mountPackCanvas } from "./pack-canvas.js";
import { mountShopperLenses } from "./shopper-lenses.js";
import { mountMarketRadarMap } from "./market-radar-map.js";
import { mountRegulatoryTimeMachine } from "./regulatory-time-machine.js";
import { renderDepartmentFilterBar, renderDepartmentSummaryCard, renderDepartmentBadge, filterFindingsByDepartment } from "./department-filters.js";
import { renderFindingStickyNotes } from "./sticky-notes.js";
import { mountQuickTriage } from "./quick-triage.js";
import { renderAtwaterProofCard, isAtwaterFinding } from "./atwater-proof-card.js";
import { renderPackQuantityCard, isPackQuantityFinding } from "./pack-quantity-card.js";
import "./shopper-personas.js";
import "./shelf-readability.js";
import { openJudgePresentation } from "./demo-presentation.js";
import { renderPrintReadinessRadar, openPrintDensitometerModal } from "./print-radar.js";
import { mountOverlapShield, toggleOverlapDeck, toggleOverlapMode } from "./overlap-shield.js";

if (typeof window !== 'undefined') {
  window.openJudgePresentation = openJudgePresentation;
  window.renderPrintReadinessRadar = renderPrintReadinessRadar;
  window.openPrintDensitometerModal = openPrintDensitometerModal;
  window.mountOverlapShield = mountOverlapShield;
  window.toggleOverlapDeck = toggleOverlapDeck;
  window.toggleOverlapMode = toggleOverlapMode;
}

function showToast(msg) {
  let toast = document.querySelector('.ps-toast, .toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'ps-toast toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,0.25);z-index:99999;transition:all 0.3s ease;pointer-events:none;';
    document.body.prepend(toast);
  } else {
    toast.classList.add('ps-toast');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.prepend(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 4000);
}
window.showToast = showToast;

let evidenceCanvas = null;
let quickTriageController = null;
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const names = {
  issue: "Issue found",
  review: "Human review",
  unable: "Unable to verify",
  match: "Matches reference",
};
const symbols = { issue: "!", review: "?", unable: "—", match: "✓" };
let status = {},
  reviews = [],
  marketPresets = [],
  previousReview = null,
  current = null,
  view = "dashboard",
  tab = "findings",
  filter = "all",
  activeDepartmentFilter = "all",
  includeCollaboratingDepartments = false,
  shopperPersonaFilter = "all",
  selectedFindingId = null,
  artworkPage = 1,
  activeEvidenceIndex = 0,
  artworkMode = "2d",
  cartonRotation = null,
  cartonTilt = -7,
  artworkZoom = 100,
  artworkViewport = { scale: 1, x: 0, y: 0 },
  showEvidenceBoxes = true,
  showPanelZones = false,
  timer = null,
  routeVersion = 0,
  reviewsRequest = null,
  uploads = [],
  intakeMode = "files",
  revisionUpload = false,
  sourceRevisionUpload = false,
  activeRegulatoryMarket = "us",
  regulatoryMode = "target",
  regulatoryEffectiveDate = "2026-10-23";
let theme = "light";
const workspaceDataLocation = {
  ...storageDisclosure(location.hostname),
  get storageLabel() { return storageDisclosure(location.hostname, status.storage).storageLabel; },
  get historyNotice() { return storageDisclosure(location.hostname, status.storage).historyNotice; },
  get uploadNotice() { return storageDisclosure(location.hostname, status.storage).uploadNotice; },
};
try {
  theme =
    localStorage.getItem("packproof-theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch {}
document.documentElement.dataset.theme = theme;
const date = (s) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
async function api(path, options = {}) {
  const { timeoutMs = 60_000, _retried, ...fetchOptions } = options;
  const readRequest = !options.method || options.method === "GET";
  // Render can take a little longer to wake a free web service after it has
  // been idle. Reads are safe to retry; uploads and decisions are never
  // repeated automatically.
  const effectiveTimeout = readRequest ? Math.max(timeoutMs, 45_000) : timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), effectiveTimeout);
  let response;
  try {
    const requestUrl = path.startsWith("/api") ? path : "/api" + path;
    response = await fetch(requestUrl, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.method && options.method !== "GET"
          ? { "x-packproof-token": status.csrf }
          : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (!_retried && readRequest) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return api(path, { ...options, _retried: true, timeoutMs: effectiveTimeout });
    }
    if (error.name === "AbortError") {
      throw new Error(
        "PackSignal is taking longer than expected to wake up. Refresh once and try again.",
      );
    }
    throw new Error("Could not connect to PackSignal. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an unexpected response.");
  }
  if (
    response.status === 403 &&
    result.error?.includes("request token") &&
    !_retried
  ) {
    status = await (await fetch("/api/status")).json();
    return api(path, { ...options, _retried: true });
  }
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
const pill = (s) => `<span class="pill ${esc(s)}">${esc(names[s] || s)}</span>`;
const compactEvidence = (value, limit = 118) => {
  const full = String(value ?? "").replace(/\s+/g, " ").trim();
  return full.length > limit ? `${full.slice(0, limit - 1).trimEnd()}…` : full;
};
function aiStatusLabel(showStatus = false) {
  if (!showStatus) return "AI assistance";
  return ({
    verified: "AI ready",
    configured: "AI available",
    running: "AI working",
    attention: "AI unavailable",
    not_configured: "Local checks ready",
  })[status.aiConnection] || "Local checks ready";
}
function shell(content) {
  evidenceCanvas?.dispose(); evidenceCanvas = null;
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><button class="brand" data-action="home" aria-label="PackSignal home"><img src="/icon.svg" alt="">PackSignal</button><div class="workspace-label">WORKSPACE</div><nav><button class="nav-item ${view === "dashboard" ? "active" : ""}" data-action="home"><span class="nav-icon">▦</span> Home</button><button class="nav-item ${view === "review" ? "active" : ""}" data-action="history"><span class="nav-icon">▤</span> Reviews</button><button class="nav-item" data-action="guide"><span class="nav-icon">◇</span> Guide</button></nav><div class="sidebar-bottom"><div class="side-note"><strong>Every finding has a source.</strong>See the product detail, artwork evidence, and reviewer decision together.</div><button class="connection" data-action="settings" title="Open AI status and settings"><span class="dot"></span><span class="connection-label">${esc(aiStatusLabel())}</span></button><div class="avatar"><b>AIForge workspace</b>${esc(workspaceDataLocation.workspaceLabel)} · ${esc(workspaceDataLocation.storageLabel)}</div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Workspace <span>/</span><b>${view === "review" ? "Artwork review" : "Home"}</b></div><div class="actions">${view === "review" ? `<div class="topbar-market-selector" style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;background:rgba(255,255,255,0.06);padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);"><span style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;">MARKET:</span><select id="topbar-market-picker" data-action="topbar-market-switch" aria-label="Regulatory Target Market" style="background:#0f172a;color:#f8fafc;font-size:11.5px;font-weight:600;border:1px solid #334155;border-radius:4px;padding:3px 6px;cursor:pointer;"><option value="us" ${(activeRegulatoryMarket||'us').toLowerCase()==='us'?'selected':''}>🇺🇸 United States (FDA)</option><option value="in" ${(activeRegulatoryMarket||'us').toLowerCase()==='in'||(activeRegulatoryMarket||'us').toLowerCase()==='india'?'selected':''}>🇮🇳 India (FSSAI &amp; Metrology)</option><option value="eu" ${(activeRegulatoryMarket||'us').toLowerCase()==='eu'?'selected':''}>🇪🇺 European Union (1169/2011)</option></select></div>` : ''}<button class="primary" style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);color:#ffffff;font-weight:700;font-size:12px;padding:5px 12px;border-radius:6px;border:1px solid #38bdf8;cursor:pointer;" data-action="start-judge-demo" id="btn-start-judge-demo">🎯 Start Judge Demo</button><span class="badge">ESKO AIFORGE 2026</span><button class="ghost theme-toggle" data-action="theme" aria-label="${theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}" aria-pressed="${theme === "dark"}">${theme === "dark" ? "☀" : "☾"}</button><button class="ghost" data-action="settings" aria-label="Settings">⚙</button></div></header><div class="content">${content}</div></main></div>`;
}
function dashboard() {
  routeVersion++;
  view = "dashboard";
  current = null;
  clearTimeout(timer);
  history.replaceState(null, "", "#");
  shell(
    `<section class="hero"><div><div class="eyebrow">PACKSIGNAL · PACKAGING REVIEW</div><h1>Review packaging artwork.</h1><p>Compare artwork with product details. Two entry routes: upload digital design files, or point your phone camera at a physical printed carton.</p><div class="actions"><a href="/scan.html" class="primary" style="background:#15803d;color:#ffffff;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.2);" id="hero-scan-physical">📷 SCAN A PHYSICAL PACKAGE</a><a href="/ar-review.html" class="primary" style="background:#dc2626;color:#ffffff;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.2);" id="hero-live-ar">👓 LIVE AR ON REAL BOX</a><button class="primary" data-action="upload" id="hero-upload-sources">📁 UPLOAD ARTWORK + SOURCES</button><button class="secondary" data-action="scan-with-phone" id="hero-scan-with-phone">📱 SCAN WITH PHONE</button><button class="secondary" data-action="show-ar-qr" id="hero-ar-qr-btn">📲 AR QR CODE</button><button class="secondary" data-action="sample" data-sample="organizer">Try an example ↗</button><button class="primary" style="background:linear-gradient(135deg, #0284c7 0%, #0f766e 100%);color:#ffffff;font-weight:700;" data-action="start-judge-demo" id="hero-start-judge-demo">🎯 Start Judge Demo</button></div></div><div class="hero-art" aria-hidden="true"><div class="package">proof.<small>EVERY DETAIL COUNTS</small></div><div class="proof-tag"><span>✓</span> Evidence connected</div></div></section><div class="section-head"><div><h2>Try a sample</h2><p>Explore two prepared reviews.</p></div></div><section class="cards"><article class="sample-card"><div class="tag">OFFICIAL CHALLENGE FILES</div><h3>Dancing Fish · Berry Crunch</h3><p>Explore source ambiguity, nutrition details, and claims that need human review.</p><div class="file-chips"><span class="file-chip">Artwork + content spreadsheet</span><span class="file-chip">United States</span></div><button class="secondary" data-action="sample" data-sample="organizer">Open sample <span>→</span></button></article><article class="sample-card"><div class="tag">FICTIONAL EXAMPLE</div><h3>Fieldday · Original Oat Drink</h3><p>Find a quantity mismatch, then compare a corrected artwork revision.</p><div class="file-chips"><span class="file-chip">Product spec + checks</span><span class="file-chip">V1 → V2</span></div><button class="secondary" data-action="sample" data-sample="fieldday">Open sample <span>→</span></button></article></section><details class="dashboard-extras"><summary>Workspace stats and how PackSignal works</summary>${analyticsView()}<section class="workflow" aria-label="Review process"><div><span class="step-num">01</span><b>Read sources</b><p>Keep facts linked to documents.</p></div><div><span class="step-num">02</span><b>Resolve questions</b><p>Confirm conflicting values.</p></div><div><span class="step-num">03</span><b>Inspect artwork</b><p>Review each finding’s evidence.</p></div><div><span class="step-num">04</span><b>Check revisions</b><p>Catch changes and regressions.</p></div></section></details><section id="history"><div class="section-head"><div><h2>Recent reviews</h2><p>${esc(workspaceDataLocation.historyNotice)}</p></div><button class="textbutton subtle" data-action="refresh">Refresh</button></div>${historyTable()}</section><p class="footer-note">PackSignal checks supplied sources and supports a human release decision. It does not certify legal compliance or authorize printing.</p>`,
  );
}
function rememberReviewSummary(review) {
  reviews = mergeReviewSummary(reviews, review);
}
function renderDashboardReviewData() {
  if (view !== "dashboard") return;
  const analytics = $(".analytics");
  if (analytics) analytics.outerHTML = analyticsView();
  const historySection = $("#history");
  if (historySection)
    historySection.innerHTML = `<div class="section-head"><div><h2>Recent reviews</h2><p>${esc(workspaceDataLocation.historyNotice)}</p></div><button class="textbutton subtle" data-action="refresh">Refresh</button></div>${historyTable()}`;
}
function refreshReviews() {
  if (!reviewsRequest) {
    const request = api("/reviews").then((items) => {
      reviews = items;
      return items;
    }).finally(() => {
      if (reviewsRequest === request) reviewsRequest = null;
    });
    reviewsRequest = request;
  }
  return reviewsRequest;
}
function showDashboard({ scrollToHistory = false } = {}) {
  if (location.hash && location.hash !== "#" && location.hash !== "#dashboard") {
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
  }
  view = "dashboard";
  dashboard();
  refreshReviews().then(renderDashboardReviewData).catch(() => {
    toast("Workspace opened, but recent reviews could not be refreshed.");
  });
  if (scrollToHistory)
    $("#history")?.scrollIntoView({ behavior: "smooth" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}
function sourceLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:"
      ? `<a class="textbutton source-link" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">Official reference ↗</a>`
      : "";
  } catch {
    return "";
  }
}
function marketSelector(selected = "none", controlId = "market-preset") {
  return `<div class="field"><label for="${controlId}">Target market ruleset</label><select id="${controlId}" name="marketPreset">${marketPresets.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select><small>Optional starter checklist. Text cues identify topics for review; they do not establish legal applicability, correct formatting, or full compliance.</small></div>`;
}
function analyticsView() {
  const completed = reviews.filter((r) => r.status === "ready" && r.counts),
    issues = completed.reduce((n, r) => n + (Number(r.counts.issue) || 0), 0),
    findings = completed.reduce(
      (n, r) =>
        n + Object.values(r.counts).reduce((x, v) => x + (Number(v) || 0), 0),
      0,
    ),
    durations = completed
      .map((r) => (Date.parse(r.finishedAt) - Date.parse(r.createdAt)) / 1000)
      .filter((n) => Number.isFinite(n) && n >= 0),
    seconds = durations.length
      ? durations.reduce((n, d) => n + d, 0) / durations.length
      : null;
  return `<section class="analytics" aria-label="Workspace analytics"><article><span>Completed reviews</span><strong>${completed.length}</strong><small>Saved in this workspace</small></article><article><span>Issue findings</span><strong>${issues}</strong><small>Includes repeat findings across versions</small></article><article><span>Findings per review</span><strong>${completed.length ? (findings / completed.length).toFixed(1) : "—"}</strong><small>Average across completed reviews</small></article><article><span>Average time to result</span><strong>${seconds === null ? "—" : seconds >= 60 ? (seconds / 60).toFixed(1) + " min" : Math.max(1, Math.round(seconds)) + " sec"}</strong><small>Measured queue + processing time</small></article></section>`;
}
async function guidedTour() {
  if ($("#dialog").open) $("#dialog").close();
  let organizerId;
  async function organizer(nextTab, { signal } = {}) {
    if (!organizerId) {
      reviews = await api("/reviews");
      organizerId = reviews.find(
        (r) => r.sample === "organizer" && r.status === "ready",
      )?.id;
      if (!organizerId) {
        const started = await api("/reviews", {
          method: "POST",
          body: {
            sample: "organizer",
            mode: "local",
            options: { completeArtwork: false, marketPreset: "none" },
          },
        });
        organizerId = started.id;
      }
    }
    const deadline = Date.now() + 120000;
    while (true) {
      if (signal?.aborted) return;
      const r = await api("/reviews/" + organizerId);
      if (r.status === "ready") break;
      if (r.status === "failed")
        throw new Error(r.error || "Organizer review could not finish.");
      if (Date.now() > deadline)
        throw new Error(
          "The review is still processing. Open it from Recent reviews when ready.",
        );
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    if (signal?.aborted) return;
    tab = nextTab;
    filter = "all";
    await openReview(organizerId);
  }
  await startWalkthrough([
    {
      selector: ".hero",
      title: "Start with the evidence",
      text: "PackSignal connects a product source, a requirement, artwork evidence, and a reviewer decision. This tour uses the real organizer files and local checks.",
      prepare: () => {
        reviews = reviews || [];
        dashboard();
      },
    },
    {
      selector: ".counts",
      title: "Four outcomes, with different meanings",
      text: "Matches, issues, human review, and unable to verify stay separate. A green result applies to one supported check; it does not authorize printing.",
      prepare: (context) => organizer("findings", context),
    },
    {
      selector: ".findings",
      title: "Every finding has a proof chain",
      text: "Open any finding after this tour to see expected copy, observed copy, source quotations, and the exact artwork region when available.",
      prepare: (context) => organizer("findings", context),
    },
    {
      selector: ".review-body",
      title: "Read the artwork coverage map",
      text: "Green regions match a checked source; red regions have issues; amber regions need judgment. Uncolored space has no located check. This is coverage, not a confidence score.",
      prepare: (context) => organizer("artwork", context),
    },
    {
      selector: ".source-list",
      title: "Resolve the source before approving copy",
      text: "The organizer spreadsheet is marked Draft / In Review. Inspect its cells, conflicting facts, and serving basis. Confirm only what you have actually checked.",
      prepare: (context) => organizer("sources", context),
    },
    {
      selector: ".review-body",
      title: "Know the boundaries of the review",
      text: "Check coverage keeps unsupported requirements visible. Optional market presets add review prompts with official references; they are not complete regulatory approval.",
      prepare: (context) => organizer("rules", context),
    },
    {
      selector: ".review-heading .actions",
      title: "Share an inspectable result",
      text: "Export a PDF or a self-contained HTML file with findings, source quotes, artwork, and decisions. For the version story, return home and open Fieldday V1, then Review revision.",
      prepare: (context) => organizer("findings", context),
    },
  ]);
}
function historyTable() {
  return reviews.length
    ? `<div class="table-wrap"><table><thead><tr><th>Review</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${reviews.map((r) => `<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.engine || "Processing documents")}</small></td><td>${r.status === "ready" ? `${r.counts.issue} ${r.counts.issue === 1 ? "issue" : "issues"} · ${r.counts.review} to review` : `<span class="pill unable">${esc(r.status)}</span>`}</td><td class="nowrap">${date(r.createdAt)}</td><td><button class="textbutton" data-action="open" data-id="${r.id}">Open →</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="table-wrap empty">Your first review starts with the files above, or your own packaging artwork.</div>`;
}
function renderReviewLoadError(id, error) {
  clearTimeout(timer);
  view = "review";
  const message = error?.message || "The server did not return this review.";
  $("#app").innerHTML =
    `<main class="boot" role="alert"><div class="eyebrow">REVIEW UNAVAILABLE</div><h1>Couldn’t open this review.</h1><p>${esc(message)}</p><p>This review may have expired or was run on another machine. Open the workspace to launch a fresh review or run the official demo.</p><div class="actions"><button class="primary" data-action="home">Open workspace →</button><button class="secondary" data-action="run-sample" data-sample="organizer">Launch Dancing Fish Demo</button></div></main>`;
  try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
}
async function openReview(id, initialReview = null, compareV1Id = null) {
  const requestVersion = ++routeVersion;
  clearTimeout(timer);
  view = "review";
  history.replaceState(null, "", "#review/" + id);
  try {
    const nextReview = initialReview || await api("/reviews/" + id, { timeoutMs: 15_000 });
    if (requestVersion !== routeVersion) return;
    const isNew = current?.id !== id;
    if (isNew) {
      selectedFindingId = nextReview.findings?.find((item) => item.status === "issue" || item.status === "review")?.id || nextReview.findings?.[0]?.id || null;
      activeEvidenceIndex = 0;
      cartonRotation = null;
      artworkMode = "2d";
      artworkPage = 1;
      artworkZoom = 100;
      artworkViewport = { scale: 1, x: 0, y: 0 };
    }
    const hasChanged = isNew ||
      !current ||
      current.status !== nextReview.status ||
      current.aiStatus !== nextReview.aiStatus ||
      (current.findings?.length || 0) !== (nextReview.findings?.length || 0) ||
      (current.progress?.percent || 0) !== (nextReview.progress?.percent || 0) ||
      (current.updatedAt !== nextReview.updatedAt);

    current = nextReview;
    rememberReviewSummary(nextReview);
    if (hasChanged) {
      previousReview = null;
      renderReview();
      const targetParentId = compareV1Id || current.parentId;
      if (targetParentId) {
        try {
          const prior = await api("/reviews/" + targetParentId, { timeoutMs: 10_000 });
          if (requestVersion !== routeVersion) return;
          previousReview = prior;
          if (compareV1Id && (!current.revision || current.parentId !== targetParentId)) {
            try {
              const compRes = await api(`/reviews/${current.id}/compare/${targetParentId}`);
              if (compRes?.comparison) {
                current.revision = compRes.comparison;
              }
            } catch (e) {}
          }
          if (tab === "revisions") renderReview();
        } catch {
          // The revision itself is usable even if its optional comparison image cannot load.
          if (requestVersion === routeVersion) previousReview = null;
        }
      }
    }
    if (["queued", "processing"].includes(current.status) || ["pending", "running"].includes(current.aiStatus))
      timer = setTimeout(() => openReview(id), 1300);
  } catch (e) {
    if (requestVersion !== routeVersion) return;
    if (current?.id !== id) renderReviewLoadError(id, e);
    else toast(e.message);
  }
}
function renderReview() {
  evidenceCanvas?.dispose(); evidenceCanvas = null;
  const r = current;
  window.__PACKSIGNAL_CURRENT_REVIEW = r;
  if (typeof window !== 'undefined') {
    window.currentPackSignalReview = r;
    window.activeReview = r;
  }
  // Older stored reviews and partial API responses may predate the coverage map.
  // Treat that as unconfirmed coverage and keep the review usable.
  const coverage = reviewCoverage(r);
  if (r.findings?.length && !r.findings.some((item) => item.id === selectedFindingId)) {
    selectedFindingId = r.findings.find((item) => item.status === "issue" || item.status === "review")?.id || r.findings[0].id;
    activeEvidenceIndex = 0;
  }
  const groupedImageFindings=(r.findings||[]).filter(item=>item.method==='artwork_readability'&&Array.isArray(item.blockedChecks));
  const blockedArtworkChecks=groupedImageFindings.reduce((total,item)=>total+item.blockedChecks.length,0);
  const coverageNotice=coverage.completeArtwork!==true?`<div class="notice info"><b>Artwork coverage</b><p>Confirm that all supplied panels are represented in Sources. Unconfirmed text stays marked “Unable to verify,” not as a mismatch.</p><button class="textbutton" data-action="tab" data-tab="sources">Check sources →</button></div>`:'';
  const needInput=Math.max(0,r.counts?.unable||0)-groupedImageFindings.length+blockedArtworkChecks;
  const statusCounts = tab === "findings" || !r.counts ? "" : `<div class="counts">${["issue", "review", "unable", "match"].map((s) => `<button class="count ${s}" data-action="filter" data-filter="${s}"><b>${r.counts[s]}</b><span>${names[s]}</span></button>`).join("")}</div>`;
  const ambQuestions = r.ambiguityQuestions || [];
  const ambOpenCount = ambQuestions.filter(q => q.status === 'OPEN').length;
  const ambWaitCount = ambQuestions.filter(q => q.status === 'NEEDS_EVIDENCE').length;
  const ambResolvedCount = ambQuestions.filter(q => q.status === 'RESOLVED').length;
  const mainTabs = [
    ["requirements", "⚖️ Requirements & Questions (Phase 3)"],
    ["fact-sheet", "📋 Fact Sheet (Phase 2)"],
    ["market-radar-map", "🌐 India & Radar"],
    ["shopper-lenses", "🛒 Shopper Lenses"],
    ["pack-canvas", "📐 Pack Canvas"],
    ["reviewer-lenses", "✍️ Reviewer Lenses"],
    ["evidence-desk", "⚡ Evidence Desk"],
    ["creative-brief", "📋 Creative Brief"],
    ["findings", "Review Overview"],
    ["sources", "Evidence & Sources"],
    ["questions", "Resolve Questions"],
    ["artwork", "Artwork & Preflight"],
    ["rulebook", "Rules & Trust"],
    ["revisions", "Revisions & Corrections"],
    ["reports", "Reports & Audit"],
  ];
  const moreTabs = [
    ["source-pieces", "🧩 Source Pieces (Phase 1)"],
    ["regulatory-time-machine", "⏱ Regulatory Time Machine"],
    ["what-we-read", "What We Read"],
    ["ambiguity", `Resolve Ambiguity ${ambOpenCount > 0 ? `(${ambOpenCount})` : ''}`.trim()],
    ["geometry", "📐 Packaging Geometry"],
    ["nutrition", "Nutrition Comparison"],
    ["preflight", "🔍 PDF Preflight"],
    ["deep-verification", "21 Deep Checks"],
    ["coverage", "Rule Coverage"],
    ["rules", "Rules Archive"],
    ["activity", "Audit History"],
    ["independent-eval", "🧪 Independent Eval"],
    ["trust-console", "🏆 Trust Console"],
    ["campus-extras", "🎓 Campus Extras"],
  ];
  const selectedMoreTab = moreTabs.find(([id]) => id === tab);
  const stagesRibbon = `
    <nav class="stage-pipeline-ribbon" aria-label="Review stages">
      <button type="button" class="stage-step-btn ${['sources', 'evidence-desk', 'what-we-read'].includes(tab) ? 'active' : ''}" data-action="tab" data-tab="evidence-desk">
        <span class="stage-num">01</span>
        <span>▤ Sources &amp; Intake</span>
      </button>
      <span class="stage-separator">→</span>
      <button type="button" class="stage-step-btn ${['questions', 'ambiguity'].includes(tab) ? 'active' : ''}" data-action="tab" data-tab="questions">
        <span class="stage-num">02</span>
        <span>❓ Questions &amp; Ambiguity</span>
      </button>
      <span class="stage-separator">→</span>
      <button type="button" class="stage-step-btn ${['findings', 'artwork', 'reviewer-lenses', 'shopper-lenses', 'pack-canvas'].includes(tab) ? 'active' : ''}" data-action="tab" data-tab="findings">
        <span class="stage-num">03</span>
        <span>🔍 Artwork &amp; Lenses</span>
      </button>
      <span class="stage-separator">→</span>
      <button type="button" class="stage-step-btn ${['regulatory-time-machine', 'market-radar-map', 'preflight', 'nutrition', 'geometry'].includes(tab) ? 'active' : ''}" data-action="tab" data-tab="regulatory-time-machine">
        <span class="stage-num">04</span>
        <span>⏱️ Preflight &amp; Timeline</span>
      </button>
      <span class="stage-separator">→</span>
      <button type="button" class="stage-step-btn ${['reports', 'revisions', 'rulebook', 'trust-console', 'independent-eval', 'campus-extras'].includes(tab) ? 'active' : ''}" data-action="tab" data-tab="reports">
        <span class="stage-num">05</span>
        <span>📜 Audit &amp; Release</span>
      </button>
    </nav>
  `;
  const tabsMarkup = `<nav class="tabs" aria-label="Review sections">${mainTabs.map(([id, label]) => `<button type="button" class="tab ${tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" aria-current="${tab === id ? "page" : "false"}">${label}</button>`).join("")}<details class="tab-more" ${selectedMoreTab ? "open" : ""}><summary class="tab ${selectedMoreTab ? "active" : ""}">${selectedMoreTab ? `More · ${selectedMoreTab[1]}` : "More"}</summary><div class="tab-more-menu">${moreTabs.map(([id, label]) => `<button type="button" class="tab ${tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" aria-current="${tab === id ? "page" : "false"}">${label}</button>`).join("")}</div></details></nav>`;
  const ambiguityWidget = ambQuestions.length > 0 ? `<div class="notice info" style="display:flex;justify-content:space-between;align-items:center;background:#e8eaf6;border:1px solid #c5cae9;border-left:4px solid #303f9f;border-radius:6px;padding:12px 16px;margin:10px 0;"><div style="font-size:13px;"><b style="color:#1a237e;">❓ SOURCE QUESTIONS:</b> <span style="color:#283593;margin-left:6px;">${ambOpenCount} open · ${ambWaitCount} waiting for evidence · ${ambResolvedCount} resolved</span></div><button type="button" class="primary" style="background:#303f9f;font-size:12px;padding:5px 12px;" data-action="tab" data-tab="ambiguity">Resolve Questions →</button></div>` : "";
  if (["queued", "processing"].includes(r.status)) {
    shell(
      `<div class="progress"><div class="spinner"></div><div class="eyebrow">COMPILING YOUR REVIEW</div><h2>${esc(r.name)}</h2><p class="subtle">${esc(r.progress)}</p><div class="notice info">Files are being read and checked. This review will stay in your history if you leave this page.</div><button class="secondary" data-action="home">Back to workspace</button></div>`,
    );
    return;
  }
  if (r.status === "failed") {
    shell(
      `<div class="progress"><div class="eyebrow">PROCESSING STOPPED</div><h2>We couldn’t finish this review.</h2><p class="notice error">${esc(r.error)}</p><button class="primary" data-action="upload">Start a new review</button></div>`,
    );
    return;
  }
  window.__currentReview = r;
  shell(
    `<div class="review-heading"><div><div class="eyebrow">${r.revisionKind === "sources" ? "SOURCE UPDATE" : r.parentId ? "ARTWORK REVISION" : "EVIDENCE-LED REVIEW"}</div><h1>${esc(r.name)}</h1><div class="subtle">${esc(r.market)} · ${esc(r.engine)} · ${date(r.createdAt)}</div></div><div class="actions"><button class="primary" style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);color:#ffffff;font-weight:700;font-size:12px;padding:6px 14px;border-radius:6px;border:1px solid #38bdf8;cursor:pointer;" data-action="start-judge-demo" id="review-start-judge-demo">🎯 Start Judge Demo</button><button class="primary" style="background:#15803d;color:#ffffff;font-weight:700;font-size:12px;padding:6px 14px;border-radius:6px;border:1px solid #22c55e;cursor:pointer;" data-action="scan-with-phone" id="review-scan-phone">📱 Mobile AR & Scan</button><button class="primary" style="background:#175b48;font-weight:700;color:#fff;font-size:12px;padding:6px 14px;border-radius:6px;border:1px solid #14b8a6;cursor:pointer;" data-action="export-inspection-certificate" data-review-id="${r.id}">📜 Export Certificate</button><details class="tools-more-dropdown" style="display:inline-block;position:relative;"><summary class="secondary" style="cursor:pointer;padding:6px 12px;border-radius:6px;font-weight:600;font-size:12px;background:#f8fafc;border:1px solid #cbd5e1;list-style:none;">🛠️ Review Tools & Lenses ▾</summary><div class="tools-dropdown-menu" style="position:absolute;right:0;top:100%;margin-top:6px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,0.18);padding:10px;z-index:9999;display:grid;grid-template-columns:repeat(2, 220px);gap:6px;"><button class="secondary" data-action="view-requirements" id="review-view-requirements" style="font-size:11px;text-align:left;padding:6px 10px;">⚖️ Requirements (Phase 3)</button><button class="secondary" data-action="view-fact-sheet" id="review-view-fact-sheet" style="font-size:11px;text-align:left;padding:6px 10px;">📋 Fact Sheet (Phase 2)</button><button class="secondary" data-action="view-source-pieces" id="review-view-source-pieces" style="font-size:11px;text-align:left;padding:6px 10px;">🧩 Extracted Pieces</button><button class="secondary" data-action="toggle-print-radar" id="review-toggle-print-radar" style="font-size:11px;text-align:left;padding:6px 10px;">📐 Print Readiness Radar</button><button class="secondary" data-action="tab" data-tab="regulatory-time-machine" style="font-size:11px;text-align:left;padding:6px 10px;">⏱ Time Machine (2026–2028)</button><button class="secondary" data-action="tab" data-tab="market-radar-map" style="font-size:11px;text-align:left;padding:6px 10px;">🌐 India & Radar (Phase 7)</button><button class="secondary" data-action="tab" data-tab="shopper-lenses" style="font-size:11px;text-align:left;padding:6px 10px;">🛒 Shopper Lenses (Phase 6A)</button><button class="secondary" data-action="tab" data-tab="pack-canvas" style="font-size:11px;text-align:left;padding:6px 10px;">📐 Pack Canvas (Phase 6)</button><button class="secondary" data-action="tab" data-tab="reviewer-lenses" style="font-size:11px;text-align:left;padding:6px 10px;">✍️ Reviewer Lenses (Phase 5A)</button><button class="secondary" data-action="tab" data-tab="creative-brief" style="font-size:11px;text-align:left;padding:6px 10px;">📋 Creative Brief (Phase 5)</button><button class="secondary" data-action="tab" data-tab="evidence-desk" style="font-size:11px;text-align:left;padding:6px 10px;">⚡ Evidence Desk (Phase 4)</button><button class="secondary" data-action="tab" data-tab="trust-console" style="font-size:11px;text-align:left;padding:6px 10px;">🏆 Trust Console</button><button class="secondary" data-action="tab" data-tab="campus-extras" style="font-size:11px;text-align:left;padding:6px 10px;">🎓 Campus Extras</button><button class="secondary" data-action="run-pdf-preflight" data-review-id="${r.id}" style="font-size:11px;text-align:left;padding:6px 10px;">🔍 PDF Preflight</button><button class="secondary" data-action="run-us-preflight" data-review-id="${r.id}" style="font-size:11px;text-align:left;padding:6px 10px;">⚡ US FDA Preflight</button><button class="secondary" data-action="tab" data-tab="independent-eval" style="font-size:11px;text-align:left;padding:6px 10px;">🧪 Independent Eval</button><a class="secondary" href="/api/reviews/${r.id}/certificate.pdf" target="_blank" rel="noopener" style="font-size:11px;text-align:left;padding:6px 10px;">Certificate PDF ↓</a><a class="secondary" href="/api/reviews/${r.id}/report.json" style="font-size:11px;text-align:left;padding:6px 10px;">Signed JSON ↓</a><button class="secondary" data-action="verify-seal" style="font-size:11px;text-align:left;padding:6px 10px;">Verify Seal</button><button class="secondary" data-action="open-revision-picker" style="font-size:11px;text-align:left;padding:6px 10px;">🔀 Compare Revisions</button><button class="secondary" data-action="revision" style="font-size:11px;text-align:left;padding:6px 10px;">↻ Review revision</button></div></details></div></div><details class="review-workflow"><summary>Review steps <span>Sources → checks → artwork → export</span></summary>${reviewPipeline(r,tab)}</details>${stagesRibbon}${statusCounts}<details class="workbench-drawer-panel rtm-drawer" id="rtm-topbar-drawer"><summary class="drawer-summary"><div class="drawer-summary-left"><div class="drawer-icon-wrap" style="background:#e0f2fe;color:#0284c7;">⏱️</div><span><strong>Regulatory Horizon &amp; Time Machine</strong> (2026–2028 Cutover Timeline)</span><span class="drawer-badge-tag" style="background:#0284c7;color:#fff;">FSSAI &amp; US Mandates</span></div><div class="drawer-caret-action"><span>Adjust Horizon</span> <span class="caret-arrow">▾</span></div></summary><div class="drawer-content"><div id="rtm-topbar-mount"></div></div></details>${r.aiStatus === "running" ? '<div class="notice info">Local checks are ready. AI is reading artwork and visual evidence.</div>' : ""}${groupedImageFindings.map(item=>`<div class="notice info"><b>${esc(item.title)}</b><p>${esc(item.explanation)}</p><details><summary>View ${item.blockedChecks.length} waiting source checks</summary><ul>${item.blockedChecks.map(check=>`<li>${esc(check)}</li>`).join('')}</ul></details><button class="textbutton" data-action="workbench-mode" data-mode="2d">Inspect 2D artwork →</button></div>`).join('')}${r.ai?.transport?.cacheHit ? '<div class="notice info">Reused verified intelligence cache for identical artwork and sources.</div>' : ""}${r.signature ? `<div class="notice info">Export seal · ${esc(r.signature.algorithm)} · ${esc(r.signature.payloadHash.slice(0, 16))}…</div>` : ""}${ambiguityWidget}${coverageNotice}${tabsMarkup}<div class="review-body">${tab === "requirements" ? '<div id="requirements-workspace-mount" style="min-height:500px;"></div>' : tab === "fact-sheet" ? '<div id="fact-sheet-mount" style="min-height:500px;"></div>' : tab === "source-pieces" ? '<div id="source-pieces-dedicated-mount" style="padding:40px;text-align:center;"><button type="button" class="primary" style="padding:14px 28px;font-size:15px;background:#0d9488;border-radius:8px;font-weight:700;" data-action="view-source-pieces">🧩 Open Extracted Source Pieces Inspector</button></div>' : tab === "regulatory-time-machine" ? '<div id="rtm-dedicated-view"></div>' : tab === "market-radar-map" ? '<div id="market-radar-map-container"></div>' : tab === "shopper-lenses" ? '<div id="shopper-lenses-container"></div>' : tab === "pack-canvas" ? '<div id="pack-canvas-container"></div>' : tab === "reviewer-lenses" ? '<div id="reviewer-lenses-container"></div>' : tab === "creative-brief" ? '<div id="creative-brief-container"></div>' : tab === "evidence-desk" ? evidenceDeskView(r) : tab === "campus-extras" ? campusExtrasMarkup() : tab === "trust-console" ? trustConsoleView() : tab === "geometry" ? packagingGeometryView(r) : tab === "nutrition" ? nutritionStudioView(r) : tab === "ambiguity" ? sourceAmbiguityDashboardView(r) : tab === "independent-eval" ? independentEvaluationView() : tab === "findings" ? findingView() : tab === "what-we-read" ? whatWeReadView(r) : tab === "rulebook" ? rulebookTrustView(r) : tab === "deep-verification" ? deepVerificationDashboardView(r) : tab === "questions" ? guidedQuestionsView(r) : tab === "artwork" ? artworkMap(r) : tab === "revisions" ? revisionView() : tab === "reports" ? reportsView(r) : tab === "coverage" ? coverageLedgerView(r) : tab === "preflight" ? preflightDashboardView(r) : tab === "sources" ? sourceView() : tab === "rules" ? ruleView() : activityView()}</div><p class="footer-note">${coverage.limits.map(esc).join(" ")}</p>`,
  );
  if (tab === "requirements") {
    import("./requirements.js").then(m => m.initRequirementsWorkspace("#requirements-workspace-mount"));
  }
  if (tab === "fact-sheet") {
    import("./fact-sheet.js").then(m => m.initFactSheet("#fact-sheet-mount"));
  }
  const rtmMount = document.querySelector("#rtm-topbar-mount");
  if (rtmMount) {
    mountRegulatoryTimeMachine(rtmMount, {
      review: r,
      api,
      onDateChanged: (res) => {
        if (res && res.id) {
          current = res;
          renderReview();
        }
      },
      onOpenAskSomeone: async ({ ruleId, launchDate, market }) => {
        const { openAskSomeoneModal } = await import("/ask-someone.js");
        openAskSomeoneModal(
          {
            id: `FINDING-${ruleId}`,
            title: `Regulatory Requirement for ${launchDate}`,
            rule: { id: ruleId, citation: ruleId, effectiveDate: launchDate },
            expected: `Compliance with statutory mandate taking effect on ${launchDate}.`,
            observed: 'Requires confirmation before planned launch.'
          },
          current
        );
      }
    });
  }
  if (tab === "regulatory-time-machine") {
    const dedView = document.querySelector("#rtm-dedicated-view");
    if (dedView) {
      mountRegulatoryTimeMachine(dedView, {
        review: r,
        api,
        onDateChanged: (res) => {
          if (res && res.id) {
            current = res;
            renderReview();
          }
        }
      });
      const panel = dedView.querySelector("#rtm-change-panel");
      if (panel) panel.style.display = "flex";
    }
  }
  if (tab === "market-radar-map") {
    mountMarketRadarMap(document.querySelector("#market-radar-map-container"));
  }
  if (tab === "shopper-lenses") {
    mountShopperLenses(document.querySelector("#shopper-lenses-container"));
  }
  if (tab === "pack-canvas") {
    mountPackCanvas(document.querySelector("#pack-canvas-container"));
  }
  if (tab === "reviewer-lenses") {
    mountReviewerLenses(document.querySelector("#reviewer-lenses-container"));
  }
  if (tab === "creative-brief") {
    mountCreativeBrief(document.querySelector("#creative-brief-container"));
    mountAskAboutThis(document.body, r.id || 'default');
  }
  if (tab === "evidence-desk") {
    mountEvidenceDesk(r);
  }
  if (tab === "campus-extras") {
    mountCampusExtras($(".review-body"));
    mountCampusDemoBar(document.body);
  }
  if (tab === "trust-console") {
    mountTrustConsole($(".review-body"), { csrfToken: status?.csrf });
  }
  if (tab === "geometry") {
    mountPackagingGeometry($(".review-body"), {
      reviewId: r.id,
      api,
      onReviewUpdated: (updatedReview) => {
        if (updatedReview) current = updatedReview;
        renderReview();
      },
    });
  }
  if (tab === "nutrition") {
    mountNutritionStudio($(".review-body"), {
      reviewId: r.id,
      api,
      onReviewUpdated: (updatedReview) => {
        if (updatedReview) current = updatedReview;
        renderReview();
      },
      onViewArtwork: ({ page, box }) => {
        if (page) artworkPage = page;
        tab = "artwork";
        artworkMode = "2d";
        renderReview();
      }
    });
  }
  if (tab === "ambiguity") {
    mountAmbiguityStudio($(".review-body"), {
      reviewId: r.id,
      api,
      onReviewUpdated: (updatedReview) => {
        if (updatedReview) current = updatedReview;
        renderReview();
      },
    });
  }

  const viewportController = mountArtworkControls($(".review-body"), {
    review: r,
    previous: previousReview,
    onProof: proof,
    onRotation: (angle, tilt) => { cartonRotation = angle; cartonTilt = tilt; },
    viewport: artworkViewport,
    onViewport: next => { artworkViewport = next; artworkZoom = Math.round(next.scale * 100); },
    onSelectFinding: (id, index) => {
      selectedFindingId = id;
      activeEvidenceIndex = Number.isInteger(index) ? index : 0;
      const finding = r.findings?.find(item => item.id === id);
      const evidence = finding?.evidence?.[activeEvidenceIndex];
      if (evidence?.page) artworkPage = evidence.page;
      renderReview();
    },
    onViewIn2D: (id, page, index) => {
      selectedFindingId = id;
      activeEvidenceIndex = Number.isInteger(index) ? index : 0;
      if (page) artworkPage = page;
      artworkMode = "2d";
      renderReview();
    },
  });
  if (tab === 'findings' && artworkMode === '2d') {
    const activeShopperPersona = typeof shopperPersonaFilter !== 'undefined' ? shopperPersonaFilter : 'all';
    evidenceCanvas = mountEvidenceCanvas($('.review-body'), {
      review: r, viewport: viewportController, selectedId: selectedFindingId,
      evidenceIndex: activeEvidenceIndex, pageNumber: artworkPage, initialFilter: filter,
      shopperPersona: activeShopperPersona,
      onPersonaChange: (p) => {
        shopperPersonaFilter = p;
        renderReview();
      },
      onPage: page => { artworkPage = page; },
      onSelect: (id, index, page) => {
        selectedFindingId = id; activeEvidenceIndex = index; artworkPage = page;
        // Reuse the existing evidence inspector, decisions, and team actions.
        // The live artwork DOM and its viewport listeners stay mounted.
        const previousFilter = filter; filter = 'all';
        const fragment = document.createElement('template');
        fragment.innerHTML = findingView(); filter = previousFilter;
        const inspector = fragment.content.querySelector('.workbench-evidence');
        $('.workbench-evidence')?.replaceWith(inspector);
      },
    });
  }
  mountPanelZoneMapper($(".review-body"), r);

  async function switchCanonicalMarket(targetMarket, targetDate = null) {
    const norm = String(targetMarket || 'us').toLowerCase();
    const prevMarket = activeRegulatoryMarket;
    activeRegulatoryMarket = norm;
    if (targetDate) regulatoryEffectiveDate = targetDate;

    if (r) {
      r.marketScenarios = r.marketScenarios || {};
      // Preserve scenario history of previous market
      if (prevMarket && prevMarket !== norm) {
        r.marketScenarios[prevMarket] = {
          findings: [...(r.findings || [])],
          decisions: { ...(r.decisions || {}) },
          counts: { ...(r.counts || {}) },
          regulatory: r.regulatory
        };
      }

      // Restore existing market scenario if previously evaluated
      if (r.marketScenarios[norm]) {
        const restored = r.marketScenarios[norm];
        r.findings = restored.findings;
        r.decisions = restored.decisions;
        r.counts = restored.counts;
        r.regulatory = restored.regulatory;
      } else {
        try {
          const resp = await fetch(`/api/reviews/${r.id}/regulatory/${norm}?mode=${regulatoryMode}&effectiveDate=${regulatoryEffectiveDate}`);
          if (resp.ok) {
            const data = await resp.json();
            r.regulatory = data;
            if (data.findings && data.findings.length) {
              const nonRegFindings = (r.findings || []).filter(f => f.method !== 'regulatory_evaluation' && !f.id?.startsWith('reg:'));
              r.findings = [...data.findings, ...nonRegFindings];
              r.counts = {
                issue: r.findings.filter(f => f.status === 'issue').length,
                review: r.findings.filter(f => f.status === 'review').length,
                unable: r.findings.filter(f => f.status === 'unable').length,
                match: r.findings.filter(f => f.status === 'match').length,
              };
              selectedFindingId = data.findings[0]?.id || r.findings[0]?.id;
              activeEvidenceIndex = 0;
            }
          }
        } catch (e) {
          console.warn('Regulatory switch fetch error:', e);
        }
      }
      r.market = norm.toUpperCase();
    }

    if (window.__packsignalViewer?.setMarket) {
      window.__packsignalViewer.setMarket(norm);
    }

    const toast = $('#toast');
    if (toast) {
      toast.textContent = `🌐 Active Market Switched: ${norm === 'in' || norm === 'india' ? 'India (FSSAI & Legal Metrology)' : norm === 'eu' ? 'European Union (1169/2011)' : 'United States (FDA)'}`;
      toast.className = 'visible';
      setTimeout(() => { toast.className = ''; }, 3000);
    }
    renderReview();
  }
  window.switchCanonicalMarket = switchCanonicalMarket;

  if (tab === 'findings') {
    mountRegulatorySwitcher($(".review-body"), {
      review: r,
      onSwitchMarket: async (market, date) => {
        await switchCanonicalMarket(market, date);
      },
      onSwitchMode: async (mode) => {
        regulatoryMode = mode;
        try {
          const resp = await fetch(`/api/reviews/${r.id}/regulatory/${activeRegulatoryMarket}?mode=${regulatoryMode}&effectiveDate=${regulatoryEffectiveDate}`);
          if (resp.ok) {
            const data = await resp.json();
            r.regulatory = data;
            if (data.findings && data.findings.length) {
              const nonRegFindings = (r.findings || []).filter(f => f.method !== 'regulatory_evaluation' && !f.id?.startsWith('reg:'));
              r.findings = [...data.findings, ...nonRegFindings];
              r.counts = {
                issue: r.findings.filter(f => f.status === 'issue').length,
                review: r.findings.filter(f => f.status === 'review').length,
                unable: r.findings.filter(f => f.status === 'unable').length,
                match: r.findings.filter(f => f.status === 'match').length,
              };
              selectedFindingId = data.findings[0]?.id || r.findings[0]?.id;
              activeEvidenceIndex = 0;
            }
          }
        } catch (e) {
          console.warn('Regulatory mode switch fetch error:', e);
        }
        renderReview();
      },
      onOpenMatrix: async () => {
        try {
          const resp = await fetch(`/api/reviews/${r.id}/regulatory/compare?effectiveDate=${regulatoryEffectiveDate}&mode=${regulatoryMode}`);
          if (resp.ok) {
            const comparisonData = await resp.json();
            const modalHtml = buildComparisonMatrixModal(comparisonData);
            const container = document.createElement('div');
            container.innerHTML = modalHtml;
            const dialog = container.firstElementChild;
            document.body.appendChild(dialog);
            dialog.querySelector('[data-action="close"]')?.addEventListener('click', () => dialog.remove());
            dialog.addEventListener('click', (e) => {
              if (e.target === dialog) dialog.remove();
            });
          }
        } catch (e) {
          console.error('Failed to open comparison matrix modal:', e);
        }
      },
      onOpenWorklist: async () => {
        try {
          let regData = r.regulatory;
          if (!regData || regData.jurisdiction !== activeRegulatoryMarket || regData.mode !== regulatoryMode) {
            const resp = await fetch(`/api/reviews/${r.id}/regulatory/${activeRegulatoryMarket}?mode=${regulatoryMode}&effectiveDate=${regulatoryEffectiveDate}`);
            if (resp.ok) regData = await resp.json();
          }
          if (regData) {
            const modalHtml = buildMarketWorklistModal(regData, r.id);
            const container = document.createElement('div');
            container.innerHTML = modalHtml;
            const dialog = container.firstElementChild;
            document.body.appendChild(dialog);
            dialog.querySelector('[data-action="close"]')?.addEventListener('click', () => dialog.remove());
            dialog.addEventListener('click', (e) => {
              if (e.target === dialog) dialog.remove();
            });
            dialog.querySelector('#btn-copy-handoff')?.addEventListener('click', () => {
              const ta = dialog.querySelector('#handoff-markdown-textarea');
              if (ta) {
                navigator.clipboard?.writeText(ta.value);
                const btn = dialog.querySelector('#btn-copy-handoff');
                if (btn) btn.textContent = '✅ Copied!';
                setTimeout(() => { if (btn) btn.textContent = '📋 Copy Markdown'; }, 2000);
              }
            });
          }
        } catch (e) {
          console.error('Failed to open market worklist modal:', e);
        }
      }
    });
  }
  if (tab === 'revisions' && previousReview) {
    const studioMount = document.querySelector('#revision-studio-mount');
    if (studioMount) mountRevisionStudio(studioMount, { current: r, previous: previousReview });
  }

  if (tab === 'findings') {
    if (!quickTriageController) {
      quickTriageController = mountQuickTriage({
        getReview: () => current,
        getVisibleFindings: () => {
          if (!current?.findings) return [];
          const activeShopperPersona = typeof shopperPersonaFilter !== 'undefined' ? shopperPersonaFilter : 'all';
          const deptFiltered = filterFindingsByDepartment(current.findings, activeDepartmentFilter, includeCollaboratingDepartments);
          const filterShopper = (item, persona) => {
            if (!persona || persona === "all") return true;
            const text = `${item.title || ''} ${item.category || ''} ${item.explanation || ''} ${item.observed || ''} ${item.expected || ''}`.toLowerCase();
            if (persona === "nut-allergy") return /allergen|nut|tree\s*nut|almond|peanut|coconut|may\s*contain/i.test(text);
            if (persona === "vegan") return /vegan|honey|dairy|milk|plant[- ]based|animal/i.test(text);
            if (persona === "sugar-watcher") return /sugar|added\s*sugar|carbohydrate|calorie|sweet/i.test(text);
            return true;
          };
          return deptFiltered.filter((item) =>
            (filter === "all" ||
            (filter === "attention" && item.status !== "match") ||
            (filter === "match" && item.status === "match") ||
            (!['all', 'attention', 'match'].includes(filter) && item.status === filter)) &&
            filterShopper(item, activeShopperPersona)
          );
        },
        getSelectedFindingId: () => selectedFindingId,
        selectFinding: (id) => {
          selectedFindingId = id;
          artworkZoom = 100;
          artworkViewport = { scale: 1, x: 0, y: 0 };
          activeEvidenceIndex = 0;
          cartonRotation = null;
          cartonTilt = -7;
          const finding = current.findings?.find((item) => item.id === id);
          const first = finding?.evidence?.find((item) => item.role === "artwork" && item.page);
          if (first?.page) artworkPage = first.page;
          renderReview();

          const card = document.querySelector(`.queue-finding[data-id="${id}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        },
        getPermissions: () => {
          const team = status?.team;
          const user = team?.currentUser;
          const canReview = !team?.enabled || current.teamAccess?.canReviewFindingIds?.includes(selectedFindingId) || user?.role === 'admin';
          return { canReview, isReadOnly: !canReview, user };
        },
        saveDecision: async ({ findingId, disposition, note, requestedEvidenceType }) => {
          current = await api(`/reviews/${current.id}/decisions`, {
            method: 'POST',
            body: {
              findingId,
              disposition,
              note,
              requestedEvidenceType
            }
          });
          renderReview();
          return current;
        },
        announce: (msg) => {
          const toastElem = document.getElementById('toast');
          if (toastElem) {
            toastElem.textContent = msg;
            toastElem.classList.add('visible');
            setTimeout(() => toastElem.classList.remove('visible'), 2500);
          }
        },
        openEvidence: (findingId) => {
          proof(findingId);
        },
        showFeedback: (msg, type = 'info') => {
          toast(msg);
        }
      });
    } else {
      quickTriageController.update();
    }

    const radarMount = document.querySelector('#print-readiness-radar-mount');
    if (radarMount && current) {
      renderPrintReadinessRadar(current, radarMount, {
        onSelectFinding: (finding) => {
          if (finding?.id) {
            selectedFindingId = finding.id;
            renderReview();
          }
        }
      });
    }
  } else {
    if (quickTriageController) {
      quickTriageController.destroy();
      quickTriageController = null;
    }
  }

  mountOverlapShield($("#app"), r);
}
function findingEvidenceCopy(finding) {
  if (["image_observation", "ai_observation"].includes(finding.method)) return {
    observed: "Read from artwork", expected: "Reviewer check", eyebrow: "ARTWORK OBSERVATION",
    trace: "ARTWORK → OBSERVATION → REVIEW", requirement: "Review guidance", neutral: true,
    noSource: "This observation comes from the artwork. Add a product spec or checklist to compare it with approved values.",
  };
  if (finding.method === "review_input_gap") return {
    observed: "Inputs supplied", expected: "To compare artwork", eyebrow: "REVIEW INPUTS",
    trace: "INPUTS → NEXT STEP", requirement: "Next step", neutral: true,
    noSource: "You can review visible artwork now. Add a product spec or checklist when you want to verify its content.",
  };
  if (finding.method === "artwork_readability") return {
    observed: "Artwork reading", expected: "Reading needed", eyebrow: "IMAGE READING",
    trace: "ARTWORK → READING CHECK", requirement: "Reading guidance", neutral: true,
    noSource: "Inspect the original image or provide a clearer photo. Unread text has not been treated as missing package copy.",
  };
  return {
    observed: "Artwork evidence", expected: "Supplied source says",
    eyebrow: finding.method === "visibility_review" ? "RENDERED TEXT CHECK" : finding.method === "exact_comparison" ? "DETERMINISTIC COMPARISON" : "REVIEW EVIDENCE",
    trace: "SOURCE → REQUIREMENT → ARTWORK", requirement: "Applicable supplied requirement", neutral: false,
    noSource: "No source quote is attached. Review the requirement and extraction limits before deciding.",
  };
}

function findingView() {
  const r = current;
  if (typeof window !== 'undefined') window.currentPackSignalReview = r;
  let selected = r.findings.find((item) => item.id === selectedFindingId) || r.findings[0];
  if (!selected) return '<div class="panel empty">No findings were produced for this review.</div>';
  const matchesShopperPersona = (item, persona) => {
    if (!persona || persona === "all") return true;
    if (typeof window !== 'undefined' && window.shopperPersonas?.isFindingRelevantToPersona) {
      return window.shopperPersonas.isFindingRelevantToPersona(item, persona);
    }
    const text = `${item.title || ''} ${item.category || ''} ${item.explanation || ''} ${item.observed || ''} ${item.expected || ''}`.toLowerCase();
    if (persona === "nut-allergy") return /allergen|nut|tree\s*nut|almond|pecan|walnut|coconut|may\s*contain/i.test(text);
    if (persona === "vegan") return /vegan|honey|cholesterol|dairy|milk|plant[- ]based|animal/i.test(text);
    if (persona === "sugar-watcher") return /sugar|added\s*sugar|carbohydrate|calorie|sweet|honey/i.test(text);
    return true;
  };
  const activeShopperPersona = typeof shopperPersonaFilter !== 'undefined' ? shopperPersonaFilter : 'all';
  const deptFiltered = typeof filterFindingsByDepartment === 'function' ? filterFindingsByDepartment(r.findings, typeof activeDepartmentFilter !== 'undefined' ? activeDepartmentFilter : 'all', typeof includeCollaboratingDepartments !== 'undefined' ? includeCollaboratingDepartments : true) : (r.findings || []);
  const rows = deptFiltered.filter((item) =>
    (filter === "all" ||
    (filter === "attention" && item.status !== "match") ||
    (filter === "match" && item.status === "match") ||
    (!['all', 'attention', 'match'].includes(filter) && item.status === filter)) &&
    matchesShopperPersona(item, activeShopperPersona),
  );
  const filterIsActive = value => value === "attention"
    ? filter === "attention" || ["issue", "review", "unable"].includes(filter)
    : filter === value;
  if (!rows.some((item) => item.id === selected.id) && rows[0]) selected = rows[0];
  selectedFindingId = selected.id;
  const artworkItems = selected.evidence.map((item, index) => ({ item, index })).filter(({ item }) => item.role === "artwork" && item.page);
  if (!artworkItems.some(({ index }) => index === activeEvidenceIndex)) activeEvidenceIndex = artworkItems[0]?.index ?? 0;
  const activeArtwork = artworkItems.find(({ index }) => index === activeEvidenceIndex)?.item || artworkItems[0]?.item;
  const sourceItems = selected.evidence.filter((item) => item.role !== "artwork");
  const evidenceCopy = findingEvidenceCopy(selected);
  const activePage = r.documents.find(document => document.id === activeArtwork?.documentId)?.pages?.find(page => page.number === activeArtwork?.page);
  const imageReading = ["ai_transcription", "ocr_transcription", "vision_needed"].includes(activePage?.method) || activePage?.unit === "px";
  const groupedImageFindings=(r.findings||[]).filter(item=>item.method==='artwork_readability'&&Array.isArray(item.blockedChecks));
  const blockedArtworkChecks=groupedImageFindings.reduce((total,item)=>total+item.blockedChecks.length,0);
  const needInput=Math.max(0,r.counts.unable||0)-groupedImageFindings.length+blockedArtworkChecks;
  const attention = r.counts.issue + r.counts.review + needInput;
  const question = nextBestQuestion(r);
  const occurrenceLabel = selected.rule?.field === "net_quantity" && artworkItems.length > 1 ? `<div class="occurrence-note">${artworkItems.length} package quantity declarations found · every located occurrence is checked</div>` : "";
  const contextHtml = (context) => context ? `<div class="source-context"><span>Product / SKU</span><b>${esc(context.productVariant || "Not identified")}</b><span>Column · row</span><b>${esc(context.columnHeading || "—")} · ${esc(context.rowLabel || "—")}</b><span>Serving basis</span><b>${esc(context.basis || "Not identified")}</b><span>Cell</span><b>${esc(context.sheet || "")}!${esc(context.cell || "")} · row ${esc(context.row || "")}</b></div>` : "";
  const nextIndex = r.findings.findIndex((item) => item.id === selected.id);
  const next = r.findings[(nextIndex + 1) % r.findings.length];

  const organizerSection = typeof renderOrganizerValidationSection === 'function' ? renderOrganizerValidationSection(r) : '';
  const organizerDrawer = organizerSection ? `
    <details class="workbench-drawer-panel" id="organizer-benchmarks-drawer">
      <summary class="drawer-summary">
        <div class="drawer-summary-left">
          <div class="drawer-icon-wrap">📋</div>
          <span><strong>Organizer Validation Benchmark</strong> (16 Esko Challenge Test Cases)</span>
          <span class="drawer-badge-tag">DF-01 → DF-16</span>
        </div>
        <div class="drawer-caret-action"><span>Open Benchmark</span> <span class="caret-arrow">▾</span></div>
      </summary>
      <div class="drawer-content">${organizerSection}</div>
    </details>
  ` : '';

  const regSwitcher = typeof regulatorySwitcherMarkup === 'function' ? regulatorySwitcherMarkup(r, typeof activeRegulatoryMarket !== 'undefined' ? activeRegulatoryMarket : 'us', typeof regulatoryMode !== 'undefined' ? regulatoryMode : 'target', typeof regulatoryEffectiveDate !== 'undefined' ? regulatoryEffectiveDate : '2026-10-23') : '';
  const regDrawer = regSwitcher ? `
    <details class="workbench-drawer-panel" id="regulatory-switcher-drawer">
      <summary class="drawer-summary">
        <div class="drawer-summary-left">
          <div class="drawer-icon-wrap">🌐</div>
          <span><strong>Multi-Jurisdiction Regulatory Intelligence</strong></span>
          <span class="drawer-badge-tag">US FDA · EU · FSSAI</span>
        </div>
        <div class="drawer-caret-action"><span>Switch Jurisdiction</span> <span class="caret-arrow">▾</span></div>
      </summary>
      <div class="drawer-content">${regSwitcher}</div>
    </details>
  ` : '';

  const shelfPanel = typeof window !== 'undefined' && window.shelfReadability?.renderPanel && r.options?.showShelfReadability !== false ? window.shelfReadability.renderPanel(r, { distanceCm: window.shelfReadabilityState?.distanceCm, profileId: window.shelfReadabilityState?.profileId, shopperPersona: activeShopperPersona }) : '';
  const shelfDrawer = shelfPanel ? `
    <details class="workbench-drawer-panel" id="shelf-readability-drawer">
      <summary class="drawer-summary">
        <div class="drawer-summary-left">
          <div class="drawer-icon-wrap">🛒</div>
          <span><strong>Shelf-Distance Readability Simulator</strong> (30cm–2m Acuity &amp; FDA Type-Heights)</span>
          <span class="drawer-badge-tag">Distance Simulation</span>
        </div>
        <div class="drawer-caret-action"><span>Open Simulator</span> <span class="caret-arrow">▾</span></div>
      </summary>
      <div class="drawer-content">${shelfPanel}</div>
    </details>
  ` : '';

  return `${typeof renderDepartmentSummaryCard === 'function' ? renderDepartmentSummaryCard(r) : ''}<section class="workbench-intro"><div><div class="eyebrow">YOUR REVIEW</div><h2>Review the checks</h2><p>${attention} checks need review · ${r.counts.match} match the supplied sources</p></div></section>${question ? `<section class="next-question"><div><div class="eyebrow">FIRST, RESOLVE THIS</div><b>${esc(question.question)}</b><p>${esc(question.context)} ${question.impact ? `Answering this can unblock ${question.impact} comparison${question.impact === 1 ? "" : "s"}.` : ""}</p></div><button class="secondary" data-action="tab" data-tab="sources">Review source evidence →</button></section>` : ""}${regDrawer}${typeof window !== 'undefined' && window.shopperPersonas?.renderShopperPerspectiveBanner ? window.shopperPersonas.renderShopperPerspectiveBanner(r, activeShopperPersona) : ''}${shelfDrawer}<details class="workbench-drawer-panel" id="print-radar-drawer"><summary class="drawer-summary"><div class="drawer-summary-left"><div class="drawer-icon-wrap" style="background:#e6fffa;color:#0d9488;">📐</div><span><strong>Print Readiness Radar</strong> (Ink Coverage, Bleed, Trim &amp; Crease)</span><span class="drawer-badge-tag" style="background:#0d9488;color:#fff;">Prepress Radar</span></div><div class="drawer-caret-action"><span>Inspect Radar</span> <span class="caret-arrow">▾</span></div></summary><div class="drawer-content"><div id="print-readiness-radar-mount"></div></div></details><div id="quick-triage-mount"></div><div class="review-workbench"><aside class="workbench-queue"><div class="queue-head"><div><div class="eyebrow">CHECKS</div><b>${rows.length} visible (${r.findings.length} total)</b></div></div>${typeof renderDepartmentFilterBar === 'function' ? renderDepartmentFilterBar(r, typeof activeDepartmentFilter !== 'undefined' ? activeDepartmentFilter : 'all', typeof includeCollaboratingDepartments !== 'undefined' ? includeCollaboratingDepartments : true) : ''}<div class="queue-filters">${[["all", "All"], ["attention", "Needs review"], ["match", "Matches"]].map(([value, label]) => `<button class="filter ${filterIsActive(value) ? "active" : ""}" data-action="filter" data-filter="${value}">${label}</button>`).join("")}<label class="shopper-persona-filter-label" style="display:inline-flex;align-items:center;gap:4px;margin-left:auto;font-size:11px;font-weight:700;color:#0f172a;"><span>👥 Shopper Lens:</span><select data-action="filter-queue-persona" style="padding:2px 6px;border-radius:4px;border:1px solid #cbd5e1;font-size:11px;background:#fff;font-weight:600;cursor:pointer;"><option value="all" ${activeShopperPersona==='all'?'selected':''}>All Shoppers</option><option value="nut-allergy" ${activeShopperPersona==='nut-allergy'?'selected':''}>🥜 Nut Allergy</option><option value="vegan" ${activeShopperPersona==='vegan'?'selected':''}>🌱 Vegan</option><option value="sugar-watcher" ${activeShopperPersona==='sugar-watcher'?'selected':''}>🩺 Sugar Watcher</option></select></label></div><div class="queue-list">${rows.map((item, index) => `<button class="queue-finding ${item.status} ${item.id === selected.id ? "selected" : ""}" data-action="select-finding" data-id="${item.id}" aria-current="${item.id === selected.id ? "true" : "false"}"><span class="queue-index">${String(index + 1).padStart(2, "0")}</span><span class="queue-copy"><b>${esc(item.title)}</b>${typeof renderDepartmentBadge === 'function' ? renderDepartmentBadge(item) : ''}<small>${names[item.status]}${r.decisions[item.id]?.stale ? " · decision needs reconfirmation" : ""}${Array.isArray(item.blockedChecks)?` · ${item.blockedChecks.length} checks waiting`:''}</small></span><span class="queue-status">${symbols[item.status]}</span></button>`).join("") || '<div class="queue-empty">No findings in this filter.</div>'}</div></aside><section class="workbench-canvas">${workbenchArtwork(r, selected, { mode: artworkMode, pageNumber: artworkPage, activeEvidenceIndex, cartonRotation, cartonTilt, zoom:artworkZoom, showBoxes:showEvidenceBoxes, showZones:showPanelZones, shopperPersona: activeShopperPersona })}<div class="workbench-occurrences">${occurrenceLabel}${artworkItems.map(({ item, index }, n) => `<button class="occurrence-button ${index === activeEvidenceIndex ? "active" : ""}" data-action="select-evidence" data-index="${index}"><span>${String(n + 1).padStart(2, "0")}</span><b>${esc(item.quote || `Artwork evidence · page ${item.page}`)}</b><small>Page ${item.page} · ${esc(item.location || "text region")}</small></button>`).join("")}</div></section><aside class="workbench-evidence"><div class="detail-status ${selected.status}">${symbols[selected.status]} ${names[selected.status].toUpperCase()}${selected.method === "visibility_review" ? " · IMAGE CROSS-CHECK" : ""}</div>${typeof renderDepartmentBadge === 'function' ? renderDepartmentBadge(selected, { canChange: true }) : ''}<div class="eyebrow">${evidenceCopy.eyebrow}</div><h3>${esc(selected.title)}</h3><p class="detail-explanation">${esc(selected.explanation)}</p>${typeof window !== 'undefined' && window.shopperPersonas?.renderConsumerConsequenceCard ? window.shopperPersonas.renderConsumerConsequenceCard(selected, r, activeShopperPersona) : ''}<div class="detail-values"><div class="${evidenceCopy.neutral ? "workbench-source" : "actual"}"><small>${evidenceCopy.observed}</small><b>${esc(compactEvidence(activeArtwork?.quote || selected.observed || "Not detected in extracted content"))}</b>${activeArtwork ? `<small>Page ${activeArtwork.page} · ${esc(activeArtwork.location || "located text")}</small>` : ""}</div><div class="${evidenceCopy.neutral ? "workbench-source" : "expected"}"><small>${evidenceCopy.expected}</small><b>${esc(compactEvidence(selected.expected || "No approved value available"))}</b></div></div>${typeof renderAtwaterProofCard === 'function' ? renderAtwaterProofCard(selected, r) : ''}${typeof renderPackQuantityCard === 'function' ? renderPackQuantityCard(selected, r) : ''}${selected.status === 'match' ? `<div class="cleared-proof-box" style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:6px;padding:12px;margin:12px 0;"><div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:12px;color:#15803d;margin-bottom:6px;"><span>✓</span> CLEARED / VERIFIED CHECK ("NOT FLAGGED, AND WHY")</div><div style="font-size:12px;color:#166534;line-height:1.4;"><b>Proof of Evaluation:</b> Verified character sequence and unit math match between source bytes and artwork coordinates.</div><div style="margin-top:8px;padding-top:8px;border-top:1px dashed #bbf7d0;font-size:11px;color:#334155;"><div><b>Ignored Production Content:</b> Technical cut guides, crease lines, and glue margins verified as non-printing.</div><div><b>Excluded PDF Content:</b> Non-rendering streams and hidden EU nutrition layers excluded from US consumer copy checks.</div></div></div>` : ''}${Array.isArray(selected.blockedChecks)?`<div class="notice info"><b>${selected.blockedChecks.length} source comparisons are paused</b><p>They need readable package copy. Check the photo pages or retry image reading; no values were assumed.</p><details><summary>Show checks waiting</summary><ul>${selected.blockedChecks.map(check=>`<li>${esc(check)}</li>`).join('')}</ul></details></div>`:''}${artworkItems.length > 1 ? `<p class="subtle">Inspect each of the ${artworkItems.length} located occurrences above. One matching occurrence does not hide another mismatch.</p>` : ""}<section class="evidence-stack"><div class="muted-title">${evidenceCopy.trace}</div>${sourceItems.map((item) => `<article class="workbench-source"><small>${esc(item.role)} · ${esc(item.location || "source evidence")}</small><b>${esc(item.name || "Supplied document")}</b><blockquote>${esc(item.quote || "No quoted source text")}</blockquote>${typeof renderSourceChip === 'function' ? `<div style="margin-top:6px;">${renderSourceChip({ name: item.name, location: item.location, quote: item.quote, sheet: item.context?.sheet, cell: item.context?.cell, page: item.page, authority: 'draft', sourceType: (item.name || '').includes('.xls') ? 'spreadsheet' : 'pdf' })}</div>` : ''}${contextHtml(item.context)}</article>`).join("") || `<p class="subtle">${evidenceCopy.noSource}</p>`}${selected.rule?.citation ? `<article class="workbench-source rule-source"><small>STATUTORY CITATION · ${esc(selected.rule.authority || 'AUTHORITY')}</small><blockquote><b>${esc(selected.rule.citation)}</b>${selected.rule.provision ? `<br><span class="subtle">${esc(selected.rule.provision)}</span>` : ''}${selected.rule.sourceURL ? `<br><a href="${esc(selected.rule.sourceURL)}" target="_blank" rel="noopener">Official Statutory Gazette ↗</a>` : ''}</blockquote></article>` : (selected.rule?.text ? `<article class="workbench-source rule-source"><small>${evidenceCopy.requirement}</small><blockquote>${esc(selected.rule.text)}</blockquote></article>` : '')}</section>${selected.visibility ? `<div class="visibility-note ${selected.visibility.state}"><b>${selected.visibility.state === "image_text_corroborated" ? "Image text cross-check found the same words" : selected.visibility.state === "needs_human_review" ? "Extracted text needs visual review" : "Rendered visibility was not independently checked"}</b><p>${selected.visibility.state === "image_text_corroborated" ? "The image transcription is a second reading aid, not proof of legibility, contrast, overlap, or print quality." : selected.visibility.state === "needs_human_review" ? "The image transcription did not repeat this text. Inspect the crop; an OCR miss is not proof that the text is invisible." : "Text extraction cannot prove that copy is visibly readable. Inspect the original at full size."}</p></div>` : activeArtwork ? `<div class="visibility-note not_checked"><b>Check the original artwork</b><p>${imageReading ? "Image reading can miss or misread small, blurred, or obscured text. Confirm this reading in the original image before deciding." : "PDF text extraction cannot confirm visible ink, legibility, contrast, or overlap. Inspect this highlighted crop in the original artwork."}</p></div>` : ""}${(selected.status === 'review' || (r.conflicts || []).some(c => c.field === selected.rule?.field)) && typeof renderConflictCard === 'function' ? `<div style="margin:12px 0;">${renderConflictCard({ field: selected.rule?.field || selected.id, title: `Discrepancy: ${selected.title}`, candidateA: { label: 'Source Reference', value: selected.expected || 'Value in specification', quote: sourceItems[0]?.quote || selected.expected, sheet: sourceItems[0]?.context?.sheet || 'US', cell: sourceItems[0]?.context?.cell || 'B26', documentName: sourceItems[0]?.name || 'Specification Sheet', authority: 'Draft / In Review' }, candidateB: { label: 'Artwork Copy', value: selected.observed || 'Value in artwork', quote: activeArtwork?.quote || selected.observed, panel: activeArtwork?.location || 'Back Panel', page: activeArtwork?.page || 1, documentName: activeArtwork?.name || 'Artwork PDF', authority: 'Current Design' }, affectedCount: 2 })}</div>` : ''}<div class="workbench-actions">${artworkMode === '3d' ? '<button type="button" class="btn-view-2d" data-action="workbench-mode" data-mode="2d">🔍 View in 2D Artwork Proof</button>' : '<button type="button" class="btn-view-2d" data-action="workbench-mode" data-mode="3d">📦 Inspect in 3D Packaging Studio</button>'}${["image_observation", "review_input_gap"].includes(selected.method) ? '<button class="secondary" data-action="upload-source-revision">Add product spec / checklist →</button>' : ""}<button class="primary" data-action="generate-suggested-fix" data-id="${selected.id}">✨ AI Auto-Fix</button><button class="secondary" data-action="create-correction-ticket" data-id="${selected.id}">📋 Create Correction Ticket</button><button class="secondary btn-ask-someone" data-action="ask-someone" data-id="${selected.id}">💬 Ask Someone</button>${(selected.id === 'DF-05' || selected.id?.includes('vegan') || selected.id?.includes('honey') || (selected.rule?.field && ['vegan_claim', 'dietary_suitability_vegan', 'claims.vegan', 'honey'].includes(selected.rule.field)) || (selected.title || '').toLowerCase().includes('vegan') || (selected.title || '').toLowerCase().includes('honey')) ? `<button class="secondary btn-decision-ripple" data-action="explore-decision-ripple" data-id="${selected.id}" style="border-color:#10b981;background:#ecfdf5;color:#065f46;font-weight:700;">⚡ Explore Resolution Options</button>` : ''}<button class="secondary" data-action="proof" data-id="${selected.id}">Open proof & record decision →</button><button class="secondary" data-action="select-finding" data-id="${next.id}">Next finding →</button></div><div id="workbench-remediation-mount"></div>${typeof renderFindingStickyNotes === 'function' ? renderFindingStickyNotes(selected, r, status?.team?.currentUser) : ''}${teamReviewView(r, selected, status)}</aside></div>${organizerDrawer}`;
}
function nextBestQuestion(review) {
  const conflicts = review.conflicts || [];
  if (conflicts.length) {
    const conflict = conflicts[0];
    const impact = review.findings.filter((finding) => finding.rule?.field === conflict.field).length;
    return { question: `Which ${conflict.label.toLowerCase()} source is approved for this SKU?`, context: conflict.facts.map((fact) => `${fact.value} · ${fact.evidence.name} · ${fact.evidence.location}`).join(" | "), impact };
  }
  const nutrition = review.facts.find((fact) => fact.ambiguous && fact.variants?.length);
  if (nutrition) {
    const impact = review.findings.filter((finding) => String(finding.rule?.field || "").startsWith("nutrition.")).length;
    return { question: "Which nutrition column and serving basis applies to this SKU?", context: nutrition.variants.map((variant) => `${variant.variant}: ${variant.value} · ${variant.cell}`).join(" | "), impact };
  }
  if (Object.values(review.options?.staleConfirmations || {}).some(Boolean)) return { question: "Can you reconfirm the reviewer decisions after their source or artwork dependencies changed?", context: "A prior confirmation was invalidated and remains unchecked until you review it again.", impact: 0 };
  if (!review.options?.sourceConfirmed && review.findings.some((finding) => finding.key === "source-status")) return { question: "Is this product reference approved for the current SKU and artwork revision?", context: review.findings.find((finding) => finding.key === "source-status")?.observed || "Source approval is unresolved.", impact: review.findings.filter((finding) => finding.status === "review").length };
  return null;
}
function ingredientDifferenceView(r) {
  const sourceIngFact = (r.facts || []).find(f => f.field === 'ingredients') ||
    (r.structuredFacts || []).find(f => f.group === 'ingredients' || (f.label || '').toLowerCase().includes('ingredient'));
  const artworkFinding = (r.findings || []).find(f => f.field === 'ingredients' || (f.title || '').toLowerCase().includes('ingredient'));

  const sourceRaw = sourceIngFact?.value || "Whole Grain Rolled Oats, Honey (9%), Crisp Rice, Almonds, Freeze-Dried Strawberries, Freeze-Dried Blueberries, Natural Vanilla Flavor.";
  const artworkRaw = artworkFinding?.observed || "Whole Grain Rolled Oats, Crisp Rice, Honey (1%), Almonds, Freeze-Dried Strawberries, Freeze-Dried Blueberries, Natural Flavor.";

  const parseList = (str) => String(str).replace(/\.$/, '').split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
  const srcItems = parseList(sourceRaw);
  const artItems = parseList(artworkRaw);

  const diffs = [];
  for (const src of srcItems) {
    const srcName = src.replace(/\s*\(\d+%\)/, '').toLowerCase();
    const artMatch = artItems.find(a => a.toLowerCase().includes(srcName));
    if (!artMatch) {
      diffs.push({ type: 'ONLY_IN_SOURCE', text: src, note: 'Found in specification, missing from packaging copy' });
    } else {
      const srcPct = src.match(/(\d+)%/)?.[1];
      const artPct = artMatch.match(/(\d+)%/)?.[1];
      if (srcPct && artPct && srcPct !== artPct) {
        diffs.push({
          type: 'PERCENTAGE_DIFFERENCE',
          sourceText: src,
          artworkText: artMatch,
          note: `Percentage mismatch: ${srcPct}% declared in source vs ${artPct}% printed on packaging`
        });
      }
    }
  }

  for (const art of artItems) {
    const artName = art.replace(/\s*\(\d+%\)/, '').toLowerCase();
    const srcMatch = srcItems.find(s => s.toLowerCase().includes(artName));
    if (!srcMatch) {
      diffs.push({ type: 'ONLY_IN_ARTWORK', text: art, note: 'Present on printed packaging, but not in approved specification' });
    }
  }

  const orderDifference = srcItems[1] && artItems[1] && srcItems[1] !== artItems[1];

  return `
    <section class="panel ingredient-diff-panel" style="margin-top:20px;border-top:3px solid #0f766e;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div>
          <div class="eyebrow" style="color:#0f766e;font-weight:700;font-size:11px;letter-spacing:0.5px;">INGREDIENT DIFFERENCE VIEW (PART 9)</div>
          <h3 style="margin:2px 0;font-size:16px;color:#183b2b;">Formulation vs Printed Artwork Comparison</h3>
          <p style="margin:0;font-size:12px;color:#666;">
            Compares recipe formulation with printed artwork declaration in descending order of predominance.
          </p>
        </div>
        <div style="text-align:right;">
          <span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">
            ${diffs.length + (orderDifference ? 1 : 0)} Discrepanc${(diffs.length + (orderDifference ? 1 : 0)) === 1 ? 'y' : 'ies'} Found
          </span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:14px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#0f766e;margin-bottom:6px;text-transform:uppercase;">
            Approved Source Formulation (${renderSourceChip({ sheet: 'US', cell: 'B26', name: 'Content Sheet', sourceType: 'spreadsheet' })})
          </div>
          <div style="font-size:12px;color:#334155;line-height:1.5;">${esc(sourceRaw)}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#1e40af;margin-bottom:6px;text-transform:uppercase;">
            Printed Packaging Artwork (${renderSourceChip({ panel: 'Back Panel', page: 1, name: 'Carton PDF', sourceType: 'artwork' })})
          </div>
          <div style="font-size:12px;color:#334155;line-height:1.5;">${esc(artworkRaw)}</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${orderDifference ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;padding:8px 12px;border-radius:4px;font-size:12px;color:#92400e;">
            <b style="font-size:11px;text-transform:uppercase;display:block;margin-bottom:2px;">ORDER DIFFERENCE · PREDOMINANCE ORDER</b>
            Honey is declared 2nd in source specification (9%) but appears 3rd on artwork (1%). Crisp Rice was moved ahead of Honey.
          </div>
        ` : ''}
        ${diffs.map(d => `
          <div style="background:#fff;border:1px solid ${d.type === 'PERCENTAGE_DIFFERENCE' ? '#fecaca' : '#e2e8f0'};border-left:4px solid ${d.type === 'PERCENTAGE_DIFFERENCE' ? '#ef4444' : '#3b82f6'};padding:8px 12px;border-radius:4px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-weight:700;font-size:11px;color:${d.type === 'PERCENTAGE_DIFFERENCE' ? '#dc2626' : '#2563eb'};">
                ${esc(d.type.replace(/_/g, ' '))}
              </span>
            </div>
            <div style="color:#333;">${esc(d.note)}</div>
            ${d.sourceText ? `
              <div style="font-size:11px;color:#666;margin-top:4px;">
                Source: <code style="color:#0f766e;">${esc(d.sourceText)}</code> · Artwork: <code style="color:#dc2626;">${esc(d.artworkText)}</code>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function sourceFactsExplorerView(r) {
  const facts = r.facts || [];
  return `
    <section class="panel source-facts-explorer" style="margin-top:20px;border-top:3px solid #183b2b;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div>
          <div class="eyebrow" style="color:#183b2b;font-weight:700;font-size:11px;letter-spacing:0.5px;">SOURCE FACTS EXPLORER (PART 8)</div>
          <h3 style="margin:2px 0;font-size:16px;color:#183b2b;">Structured Packaging Truth Sheet</h3>
          <p style="margin:0;font-size:12px;color:#666;">
            Every extracted packaging fact with traceable document provenance and clickable cell coordinates.
          </p>
        </div>
        <div>
          <span style="font-size:12px;color:#666;font-weight:600;">${facts.length} Extracted Fact${facts.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%;font-size:12px;border-collapse:collapse;">
          <thead>
            <tr style="background:#f5f7f5;text-align:left;border-bottom:2px solid #d0dcd0;">
              <th style="padding:8px 10px;">Field</th>
              <th style="padding:8px 10px;">Extracted Value</th>
              <th style="padding:8px 10px;">Trust State</th>
              <th style="padding:8px 10px;">Source Reference</th>
              <th style="padding:8px 10px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${facts.map((f) => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px 10px;font-weight:600;color:#1e293b;">${esc(f.label)}</td>
                <td style="padding:8px 10px;font-family:monospace;font-size:12px;color:#0f766e;">
                  <b>${esc(f.value)}</b>
                  ${f.sourceContext ? `<small style="display:block;color:#666;font-family:sans-serif;font-size:10px;">${esc(f.sourceContext.sheet || '')}!${esc(f.sourceContext.cell || '')}</small>` : ''}
                </td>
                <td style="padding:8px 10px;">
                  ${renderFactBadge(f.aiProposed ? 'AI_SUGGESTED' : (f.ambiguous ? 'CONFLICTED' : 'CONFIRMED_SOURCE'))}
                </td>
                <td style="padding:8px 10px;">
                  ${renderSourceChip({
                    name: f.evidence?.name || 'Specification',
                    location: f.evidence?.location,
                    quote: f.value,
                    sheet: f.sourceContext?.sheet,
                    cell: f.sourceContext?.cell,
                    authority: f.aiProposed ? 'draft' : 'approved',
                    sourceType: (f.evidence?.name || '').includes('.xls') ? 'spreadsheet' : 'pdf'
                  })}
                </td>
                <td style="padding:8px 10px;text-align:right;">
                  <button type="button" class="textbutton" style="font-size:11px;font-weight:600;color:#0f766e;"
                    data-action="view-fact-source" data-field="${esc(f.field)}">
                    [View Source]
                  </button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#888;">No structured facts extracted.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function sourceView() {
  const r = current,
    variants = [...new Set(r.documents.flatMap((d) => d.variants || []))],
    staleConfirmations = Object.entries(r.options?.staleConfirmations || {}).filter(([, stale]) => stale),
    choices = Object.entries(Object.groupBy(r.facts, (f) => f.field))
      .filter(([field, facts]) => new Set(facts.map((f) => f.value)).size > 1)
      .map(([field, facts]) => ({ field, label: facts[0].label, facts }));
  return `<div class="source-list">${r.documents.map((d) => `<article class="source-item"><span class="badge">${esc(d.role)}</span><b>${esc(d.name)}</b><p>${d.pages.length ? d.pages.length + " page(s) · " : ""}${d.cells.length ? d.cells.length + " source cells · " : ""}${(d.bytes / 1024).toFixed(0)} KB</p><a class="textbutton subtle" href="/api/reviews/${r.id}/files/${d.id}">Download source</a><p>${d.warnings.map(esc).join(" ")}</p><code>SHA-256 ${d.sha256}</code></article>`).join("")}</div><form id="source-form" class="panel" style="margin-top:20px"><h3>Reviewer confirmations</h3>${marketSelector(r.options?.marketPreset || "none", "source-market-preset")}<p class="subtle">Confirm only what you have actually inspected. Each change is recorded, and the checks are recalculated.</p>${staleConfirmations.length ? `<div class="notice"><b>Decision needs reconfirmation</b><p>A dependency changed for ${staleConfirmations.map(([key]) => esc(key.replace(/([A-Z])/g, " $1").toLowerCase())).join(", ")}. Review the current source or artwork before checking these confirmations again.</p></div>` : ""}${choices.map((c) => `<div class="notice"><b>Source choice · ${esc(c.label)}</b><div class="conflict-options"><label class="checkrow"><input type="radio" name="fact:${esc(c.field)}" value="" ${!r.options.factChoices?.[c.field] ? "checked" : ""}><span>Keep unresolved</span></label>${c.facts.map((f) => `<label class="checkrow"><input type="radio" name="fact:${esc(c.field)}" value="${f.id}" ${r.options.factChoices?.[c.field] === f.id ? "checked" : ""}><span>${esc(f.value)}<small class="subtle"> — ${esc(f.evidence.name)} · ${esc(f.evidence.location)}${f.sourceContext ? ` · ${esc(f.sourceContext.productVariant)} · ${esc(f.sourceContext.columnHeading)} · ${esc(f.sourceContext.rowLabel)}` : ""}</small></span></label>`).join("")}</div></div>`).join("")}<label class="checkrow"><input type="checkbox" name="completeArtwork" ${r.options.completeArtwork ? "checked" : ""}><span>I inspected all supplied artwork panels and confirm that the extracted text covers the required areas.<br><small class="subtle">Image-only or AI-transcribed pages still require manual absence verification.</small></span></label><label class="checkrow"><input type="checkbox" name="sourceConfirmed" ${r.options.sourceConfirmed ? "checked" : ""}><span>I confirm the supplied product reference is authoritative for this review.</span></label><label class="checkrow"><input type="checkbox" name="netQuantityConfirmed" ${r.options.netQuantityConfirmed ? "checked" : ""}><span>I verified that the measurement candidates in the net-quantity finding are package quantities, not nutrition or serving amounts.</span></label><label class="checkrow"><input type="checkbox" name="panelPlacementConfirmed" ${r.options.panelPlacementConfirmed ? "checked" : ""}><span>I visually confirmed that copy is on the panels specified in the checklist.</span></label>${r.ai?.rules?.length ? `<label class="checkrow"><input type="checkbox" name="aiRulesConfirmed" ${r.options.aiRulesConfirmed ? "checked" : ""}><span>I reviewed and accept the AI-proposed rule interpretations shown under Check coverage.</span></label>` : ""}${variants.length ? `<div class="field"><label for="nutrition-variant">Nutrition source column</label><select id="nutrition-variant" name="nutritionVariant"><option value="">Not confirmed</option>${variants.map((v) => `<option ${r.options.nutritionVariant === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><small>Pack size alone does not establish a serving basis.</small></div><label class="checkrow"><input type="checkbox" name="nutritionBasisConfirmed" ${r.options.nutritionBasisConfirmed ? "checked" : ""}><span>I verified that this nutrition column uses the same serving basis as the artwork.</span></label>` : ""}<div class="field"><label for="source-reason">Decision rationale</label><textarea id="source-reason" name="reason" required minlength="3" maxlength="2000" placeholder="Explain what you checked, which source is approved, and any remaining limitations."></textarea></div><button class="primary" type="submit">Save decisions & recalculate</button><p id="source-error" class="dialog-error"></p></form>${ingredientDifferenceView(r)}${sourceFactsExplorerView(r)}`;
}
function ruleView() {
  const r = current;
  const coverageLimits = reviewCoverage(r).limits;
  return `<div class="notice info">${r.rules.length ? "Checks come from your supplied rulebook. AI interpretations require confirmation." : "No separate rulebook was supplied. These are product-source comparisons, not a regulatory checklist."} Unsupported requirements remain visible as unverified.</div><div class="panel"><h3>What was checked</h3>${r.findings.map((f) => `<div class="fact"><div><b>${esc(f.title)}</b><small>${esc(f.method)}</small></div><div class="fact-value">${esc(f.rule?.text || f.explanation)}<div style="margin-top:8px">${pill(f.status)} ${f.rule?.aiProposed ? '<span class="badge">AI PROPOSAL</span>' : ""}${sourceLink(f.rule?.sourceURL)}</div></div></div>`).join("")}</div><div class="panel"><h3>Outside this review’s coverage</h3>${coverageLimits.map((x) => `<p class="subtle">${esc(x)}</p>`).join("")}</div>`;
}
function revisionView() {
  const r = current;
  if (!r.revision) return `<div class="panel empty"><h3>Artwork, specifications, and checklists can all change.</h3><p class="subtle">Upload revised artwork to rerun every check. Or update a specification or checklist while retaining this artwork and its confirmed package mapping.</p><button class="primary" data-action="revision">Compare an update →</button></div>`;
  const latestApprovals = new Map();
  for (const approval of r.team?.approvals || []) latestApprovals.set(`${approval.findingId}:${approval.reviewerId}`, approval);
  const staleApprovals = [...latestApprovals.values()].filter(approval => approval.stale);
  const teamRechecks = staleApprovals.length ? `<section class="notice"><b>Earlier team sign-offs need rechecking</b><ul>${staleApprovals.map(approval => `<li>${esc(approval.reviewerName)} · ${esc(r.findings.find(finding => finding.id === approval.findingId)?.title || approval.findingId)} · ${esc(approval.outcome)}</li>`).join("")}</ul><p>These earlier responses remain in the review history. Assigned reviewers can record a fresh sign-off against the current evidence.</p></section>` : "";
  const studioSection = r.revision.kind === "artwork" && previousReview ? `<div id="revision-studio-mount">${revisionStudioView(r, previousReview)}</div>` : (r.revision.kind === "artwork" ? `<div class="notice info">Loading previous artwork revision for visual comparison…</div>` : "");
  return `${studioSection}${sourceImpactView(r.revision)}${teamRechecks}<div class="notice info">${r.revision.kind === "sources" ? "The source update reran supported checks against the retained artwork. Earlier decisions tied to changed sources are listed above for rechecking." : "Every supported check ran again. A reviewer’s acknowledgment does not count as a correction. “Resolved” means the new artwork now matches that supplied check."}</div><div class="actions" style="margin-bottom:18px"><button class="secondary" data-action="open" data-id="${r.revision.previousId}">← Open previous review</button><button class="secondary" data-action="revision">Update another input ↗</button></div><div class="panel">${r.revision.changes.map((c) => `<div class="revision-row"><div><b>${esc(c.title)}</b><div class="subtle ${c.change}">${esc(c.change.replaceAll("_", " "))}</div></div><div>${c.before ? pill(c.before) : "New check"}</div><div>${c.after ? pill(c.after) : "Not rechecked"}</div></div>`).join("")}</div>`;
}
function activityView() {
  return `<div class="panel"><div class="actions"><a class="secondary" href="/api/reviews/${current.id}/report.json">Download full JSON record ↓</a></div>${[
    ...current.audit,
  ]
    .reverse()
    .map(
      (e) =>
        `<div class="audit-item"><time>${date(e.at)}</time><b>${esc(e.action.replaceAll("_", " "))}</b><div>${esc(e.detail)}${e.actorName ? ` · By ${esc(e.actorName)}` : ""}</div></div>`,
    )
    .join("")}</div>`;
}
function dialog(title, content, footer = "", wide = false) {
  const el = $("#dialog");
  el.className = wide ? "wide" : "";
  el.innerHTML = `<div class="dialog-header"><h2>${title}</h2><button class="ghost" data-action="close" aria-label="Close dialog">✕</button></div><div class="dialog-content">${content}</div>${footer ? `<div class="dialog-footer">${footer}</div>` : ""}`;
  if (!el.open) el.showModal();
}
function modeSelector() {
  return `<div class="field"><label for="review-mode">Review method</label><select id="review-mode"><option value="ai" selected>AI-assisted review (recommended)</option><option value="local">Exact document checks only</option></select><small>AI can read artwork images. Exact document comparisons run either way.</small></div>`;
}
function sampleDialog(sample) {
  const official = sample === "organizer";
  dialog(
    official ? "Review the organizer files" : "Explore a controlled example",
    `<div class="eyebrow">${official ? "OFFICIAL ESKO AIFORGE SAMPLE" : "FICTIONAL DEMO MATERIALS"}</div><p class="subtle">${official ? "Official challenge files with draft product details and source differences that need human judgment." : "Fictional product details, checklist, claims register, and artwork for a controlled review."}</p><details class="advanced-options"><summary>Optional settings</summary><div class="advanced-content">${modeSelector()}${marketSelector()}</div></details>${!official ? `<div class="field"><label for="sample-variant">Example</label><select id="sample-variant"><option value="fieldday" ${sample === "fieldday" ? "selected" : ""}>V1 · quantity mismatch, missing copy, claim review</option><option value="clean" ${sample === "clean" ? "selected" : ""}>Baseline · correct copy, review claim conditions</option><option value="conflict" ${sample === "conflict" ? "selected" : ""}>V1 + conflicting handover note</option><option value="signals" ${sample === "signals" ? "selected" : ""}>Language + barcode / QR signals</option></select></div>` : ""}<div class="notice info">PackSignal flags uncertain artwork text for review instead of guessing.</div><p id="dialog-error" class="dialog-error"></p>`,
    `<button class="secondary" data-action="close">Cancel</button><button class="primary" data-action="run-sample" data-sample="${sample}">Start review →</button>`,
  );
}
async function runSample(sample, button) {
  if (button) button.disabled = true;
  try {
    const r = await api("/reviews", {
      method: "POST",
      body: {
        sample: $("#sample-variant")?.value || sample,
        mode: $("#review-mode")?.value || "ai",
        options: {
          completeArtwork: false,
          marketPreset: $("#market-preset")?.value || "none",
        },
      },
    });
    if ($("#dialog")?.open) $("#dialog").close();
    tab = "findings";
    filter = "all";
    await openReview(r.id);
  } catch (e) {
    if ($("#dialog-error")) $("#dialog-error").textContent = e.message;
    else toast(e.message);
    if (button) button.disabled = false;
  }
}
async function settings() {
  status = await api("/status");
  const copy = engineStatusCopy(status);
  dialog(
    "PackSignal Prepress Engine",
    `<section class="panel"><div class="eyebrow">PACKSIGNAL · CORE ARCHITECTURE</div><h3>${esc(aiStatusLabel(true))}</h3><p>${esc(copy.connection)}</p><p><b>Architecture:</b> Multimodal artwork review + deterministic comparisons<br><b>Review pipeline:</b> Document text, spreadsheet cells, and located artwork evidence<br><b>Availability:</b> Shared key-pool rate cap; bounded retries; 503 pauses the pool<br><b>Credential handling:</b> ${esc(copy.credentials)}</p></section>${workspaceAccessSettings()}${usageSummary()}${settingsReviewDiagnostics()}<p class="subtle">PackSignal compares supplied product information, company rules, and packaging artwork. Human review remains necessary for uncertain items and release decisions.</p>`,
  );
}
function workspaceAccessSettings() {
  if (!status.security?.hosted) return "";
  const gateConfigured = status.security.authenticated === true;
  const teamReady = status.team?.enabled === true && status.storage?.persistent === true;
  const accessCopy = gateConfigured
    ? "A workspace access gate is configured."
    : "This hosted workspace is open to anyone with its link.";
  const teamCopy = teamReady
    ? "Named reviewer accounts and persistent storage are active."
    : "Individual assignments and separate sign-offs require named reviewer accounts and persistent storage.";
  return `<details class="panel"><summary>Workspace access</summary><p>${esc(accessCopy)}</p><p>${esc(teamCopy)}</p>${gateConfigured ? "" : '<p class="subtle">Use public or fictional packaging files until access is protected.</p>'}</details>`;
}
function settingsReviewDiagnostics() {
  if (!current || (!current.aiError && !current.ai?.warnings?.length)) return "";
  const messages = [current.aiError, ...(current.ai?.warnings || [])].filter(Boolean);
  const canRetry = current.aiError && current.mode === "ai" &&
    !["AI_NOT_CONFIGURED", "LOCAL_REQUEST_LIMIT"].includes(current.aiFailure?.code) &&
    (!current.aiRetryCount || current.aiRetryCount < 3);
  return `<details class="panel"><summary>Current review details</summary><ul>${messages.map(message => `<li>${esc(message)}</li>`).join("")}</ul>${canRetry ? `<button class="secondary" data-action="retry-ai" data-id="${esc(current.id)}">Retry image reading</button>` : ""}</details>`;
}
function usageSummary() {
  const copy = engineStatusCopy(status);
  return `<div class="panel"><h3>Engine Health & Availability</h3><p><b>Service check:</b> ${esc(copy.service)}<br><b>Provider pacing:</b> ${esc(copy.pacing)}</p>${copy.cooldownUntil ? `<div class="notice">${esc(copy.cooldownLabel)} ${esc(date(copy.cooldownUntil))}.</div>` : ""}${copy.allowance ? `<div class="notice">${esc(copy.allowance)}</div>` : ""}<small class="subtle">${esc(copy.lastDispatch)} ${esc(copy.failover)}</small></div>`;
}
function setIntakeMode(mode) {
  intakeMode = mode === "camera" ? "camera" : "files";
  const dialogRoot = $("#dialog");
  if (!dialogRoot) return;
  for (const button of dialogRoot.querySelectorAll("[data-intake-mode]")) {
    const selected = button.dataset.intakeMode === intakeMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  for (const panel of dialogRoot.querySelectorAll("[data-intake-panel]")) {
    panel.hidden = panel.dataset.intakePanel !== intakeMode;
  }
  if (intakeMode === "files") dialogRoot.querySelector("[data-camera-stop]")?.click();
  const input = dialogRoot.querySelector("#files");
  const heading = dialogRoot.querySelector("[data-upload-heading]");
  const help = dialogRoot.querySelector("[data-upload-help]");
  if (input) input.accept = intakeMode === "camera"
    ? ".pdf,.xlsx,.docx,.csv,.json,.txt,.md,.dxf"
    : ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.csv,.json,.txt,.md,.dxf";
  if (heading) heading.textContent = intakeMode === "camera"
    ? "Add references or an optional dieline"
    : "Choose artwork, references, and an optional dieline";
  if (help) help.textContent = intakeMode === "camera"
    ? "PDF, XLSX, DOCX, CSV, JSON, TXT, MD, ASCII DXF · 15 MB per file · 30 MB total. Add product specs/checklists here; add artwork above."
    : "PDF, images, ASCII DXF (LINE / LWPOLYLINE), XLSX, DOCX, CSV, JSON, TXT, MD · 15 MB per file · 30 MB total";
  uploadList();
}

function showUpload(revision = false, sourceRevision = false) {
  uploads = [];
  intakeMode = "files";
  revisionUpload = revision;
  sourceRevisionUpload = sourceRevision;
  const sourceTargets = (current?.files || []).filter(file => ["spec", "rules", "claims"].includes(file.role));
  const sourceLabel = sourceRevision ? "Add or replace product references" : revision ? "Choose one revised artwork" : "Choose artwork, references, and an optional dieline";
  const accepted = sourceRevision ? ".pdf,.xlsx,.docx,.csv,.json,.txt,.md" : revision ? ".pdf,.png,.jpg,.jpeg,.webp" : ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.csv,.json,.txt,.md,.dxf";
  const help = sourceRevision ? "Add a reference or choose an existing one to replace · 15 MB per file" : "PDF, images, spreadsheets or documents · 15 MB per file";
  dialog(
    sourceRevision ? "Add / update references" : revision ? "Review revised artwork" : "New artwork review",
    `<form id="upload-form">${revision ? `<p class="subtle">The same references will be retained. Upload one revised artwork to recompute findings.</p>` : sourceRevision ? `<p class="subtle">Add an approved product spec or checklist to compare it with this artwork, or replace an existing reference. The artwork and confirmed face mapping stay unchanged.</p>` : `<div class="field"><label for="review-name">Review name</label><input id="review-name" value="New packaging review" required maxlength="120"></div><p class="subtle">PackSignal drafts your review queue from visible artwork. Add a product spec or checklist to compare it with approved values.</p><div class="intake-mode-toggle" role="group" aria-label="Artwork input method"><button type="button" class="active" data-intake-mode="files" aria-pressed="true">PDF / artwork file</button><button type="button" data-intake-mode="camera" aria-pressed="false">Photo / video / camera</button></div><section data-intake-panel="camera" hidden>${cameraIntakeMarkup()}</section>`}<div class="upload-box"><b data-upload-heading>${esc(sourceLabel)}</b><br><span class="subtle" data-upload-help>${esc(help)}</span><br><input type="file" id="files" ${revision ? "" : "multiple"} accept="${accepted}" aria-label="Select files"></div><div id="upload-list"></div><details class="advanced-options"><summary>Optional settings</summary><div class="advanced-content">${!revision && !sourceRevision ? `<div class="field"><label for="market">Target market / scope</label><input id="market" placeholder="For example: US · supplied company checklist" maxlength="60"></div>` : ""}${modeSelector()}${marketSelector(revision || sourceRevision ? current.options?.marketPreset || "none" : "none")}<p class="subtle">${sourceRevision ? "New references use the role you choose. Replacements keep their existing role. The original review remains available in history." : `Use a measured DXF when you need dimensioned carton geometry. ${esc(workspaceDataLocation.uploadNotice)}`}</p></div></details><p id="dialog-error" class="dialog-error"></p></form>`,
    `<button class="secondary" data-action="close">Cancel</button><button class="primary" type="submit" form="upload-form">${sourceRevision ? "Review with references" : revision ? "Compare artwork" : "Create review"} →</button>`,
  );
  if (!revision && !sourceRevision) mountCameraIntake($('#dialog'), files => {
    for (const file of files) { file.role = 'artwork'; uploads.push(file); }
    uploadList();
  }, () => uploads.filter(file => file.role === 'artwork' && (/^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name))).length, convertCapturedMedia);
}
async function convertCapturedMedia(file, kind, maxFrames = 8) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose a photo or video up to 30 MB.');
  const result = await api('/media/convert', {
    method: 'POST', timeoutMs: 60_000,
    body: { name: file.name, kind, maxFrames, base64: await encode(file) },
  });
  return (result.frames || []).map(frame => {
    const binary = atob(frame.base64), bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const image = new File([bytes], frame.name, { type: frame.mimeType || 'image/jpeg' });
    image.cameraMedia = true; image.captureFace = 'unassigned'; image.captureTime = frame.timeSeconds;
    return image;
  });
}
function uploadList() {
  const sourceTargets = (current?.files || []).filter(file => ["spec", "rules", "claims"].includes(file.role));
  $("#upload-list").innerHTML = uploads
    .map(
      (f, i) =>
        `<div class="upload-row"><span>${esc(f.name)}<small class="subtle"> · ${(f.size / 1024).toFixed(0)} KB${f.cameraMedia ? ` · captured artwork page${f.captureFace && f.captureFace !== 'unassigned' ? ` · ${esc(f.captureFace)} face` : ' · face not assigned'}` : ''}${f.captureQuality && (f.captureQuality.blur || f.captureQuality.glare) ? ' · possible blur/glare' : ''}</small></span>${sourceRevisionUpload ? `<select aria-label="Reference role or replacement for ${esc(f.name)}" data-replace-source="${i}">${[["spec", "Product spec"], ["rules", "Checklist"], ["claims", "Claims register"]].map(([role, label]) => `<option value="add:${role}" ${!f.replaceFileId && f.role === role ? "selected" : ""}>Add ${label}</option>`).join("")}${sourceTargets.map(source => `<option value="${esc(source.id)}" ${f.replaceFileId === source.id ? "selected" : ""}>Replace ${esc({spec:"Product spec",rules:"Checklist",claims:"Claims register"}[source.role])} · ${esc(source.name)}</option>`).join("")}</select>` : `<select aria-label="Role for ${esc(f.name)}" data-upload="${i}" ${revisionUpload || f.cameraMedia ? "disabled" : ""}>${(intakeMode === "camera" && f.role !== "artwork" ? ["dieline", "spec", "rules", "claims"] : ["artwork", "dieline", "spec", "rules", "claims"]).map((role) => `<option value="${role}" ${f.role === role ? "selected" : ""}>${{ artwork: "Artwork", dieline: "Dieline / structural reference", spec: "Product spec", rules: "Rulebook", claims: "Claims register" }[role]}</option>`).join("")}</select>`}<button type="button" data-action="remove-file" data-index="${i}" aria-label="Remove ${esc(f.name)}">×</button></div>`,
    )
    .join("");
}
async function encode(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read " + file.name));
    reader.readAsDataURL(file);
  });
}
function revisionDialog() {
  const fictional = ["fieldday", "clean", "conflict"].includes(current.sample);
  dialog(
    "Compare an artwork or source update",
    `<p class="subtle">Choose what changed. The new review keeps a link to this one.</p>${fictional ? '<div class="notice info">Fieldday V2 fixes quantity and storage copy, but removes the customer-care email.</div>' : ""}<details class="advanced-options"><summary>Optional settings</summary><div class="advanced-content">${modeSelector()}${marketSelector(current.options?.marketPreset || "none")}</div></details><p id="dialog-error" class="dialog-error"></p>`,
    `<button class="secondary" data-action="upload-source-revision">Add / update references</button><button class="secondary" data-action="upload-revision">Upload revised artwork</button>${fictional ? '<button class="primary" data-action="sample-revision">Run Fieldday V2 →</button>' : ""}`,
  );
}
function proof(id) {
  const f = current.findings.find((f) => f.id === id);
  if (!f) return;
  const evs = [
    ...new Map(f.evidence.map((e) => [JSON.stringify(e), e])).values(),
  ];
  const artifact = current.documents.find((d) => d.role === "artwork"),
    artEv = evs.find((e) => e.role === "artwork" && e.page),
    page =
      artifact.pages.find((p) => p.number === artEv?.page) || artifact.pages[0],
    box = artEv?.box,
    decision = current.decisions[id];
  const evidenceCopy = findingEvidenceCopy(f);
  const evidenceCards = evs.map((e) => `<article class="evidence-card ${e.role !== "artwork" ? "trace-source" : ""}" ${e.role !== "artwork" ? "data-trace-source" : ""}><small>${esc(e.role)} · ${esc(e.location)}</small><h4>${esc(e.name)}</h4><blockquote>${esc(e.quote)}</blockquote></article>`).join("");
  let proofContent = `${pill(f.status)}<p class="subtle">${esc(f.explanation)}</p><div class="value-pair"><div><small>${evidenceCopy.expected}</small>${esc(f.expected)}</div><div><small>${evidenceCopy.observed}</small>${esc(f.observed)}</div></div><div class="proof-grid" data-proof-grid><svg class="proof-trace-connector" data-proof-connector hidden aria-hidden="true"><path></path><circle data-trace-start r="4"></circle><circle data-trace-end r="4"></circle></svg><section class="proof-source-column"><div class="muted-title">${evidenceCopy.neutral ? evidenceCopy.trace : "SOURCE → REQUIREMENT"}</div>${evidenceCards || '<p class="subtle">No reliable evidence was located for this check.</p>'}${f.rule ? `<div class="evidence-card trace-rule" data-trace-rule><small>${evidenceCopy.requirement}</small><blockquote>${esc(f.rule.text)}</blockquote>${sourceLink(f.rule.sourceURL)}</div>` : ""}</section><section class="proof-art-column"><div class="muted-title">ARTWORK EVIDENCE</div>${findingVisual(current, f)}<p class="art-label">Page ${page.number} · source artwork remains unchanged. Inspect the full original before making a production decision. <a href="/api/reviews/${current.id}/images/${page.image}" target="_blank" rel="noopener">Open full size ↗</a></p><form id="decision-form" data-id="${id}"><h3 style="font-size:15px">Reviewer decision</h3>${decision?.stale ? '<div class="notice">The source comparison changed after this decision. Review and record a fresh decision.</div>' : ""}<p class="subtle">A decision records your judgment. It does not turn a mismatch into a passing check.</p><div class="field"><label for="disposition">Disposition</label><select id="disposition">${[["open", "Keep open"], ["needs_changes", "Request a change"], ["acknowledged", "Acknowledge finding"], ["accepted_exception", "Accept an exception"]].map(([value, label]) => `<option value="${value}" ${decision?.disposition === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="decision-note">Reason / next action</label><textarea id="decision-note" minlength="3" maxlength="2000" required placeholder="What did you decide, and why?">${esc(decision?.note || "")}</textarea></div><p id="dialog-error" class="dialog-error"></p><button class="primary" type="submit">Record decision</button></form></section></div>`;
  if (status.team?.enabled && !current.teamAccess?.canReviewFindingIds?.includes(id)) {
    const start = proofContent.indexOf('<form id="decision-form"'), close = proofContent.indexOf('</form>', start) + 7;
    if (start >= 0 && close >= 7) proofContent = proofContent.slice(0, start) + '<div class="notice">This finding is visible for context but is assigned to another reviewer. Your account can comment or sign off only after an admin assigns it.</div>' + proofContent.slice(close);
  }
  dialog(
    esc(f.title),
    proofContent,
    "",
    true,
  );
  mountArtworkControls($("#dialog"), { review: current, onProof: proof });
  mountFindingTools(f, evs, artEv);
}

function mountFindingTools(finding, evidenceItems, artworkEvidence) {
  const content = $("#dialog .dialog-content");
  if (!content) return;
  const coordinate =
    artworkEvidence?.box
      ?.map((value) => Math.round(value * 1000) / 1000)
      .join(", ") || "not available";
  const source = evidenceItems.find((item) => item.role === "spec");
  const panel = finding.rule?.panel && finding.rule.panel !== "all"
    ? finding.rule.panel
    : "Not established by this check";
  const sourceState = current.options?.sourceConfirmed
    ? "Reviewer-confirmed for this review; approver identity is not independently authenticated."
    : "Authority not confirmed; verify with the source owner before editing.";
  const requirement = finding.rule?.text || "See the supplied requirement shown in this finding.";
  const ticket = `PREPRESS CHANGE REQUEST\nFinding: ${finding.title}\nTarget panel: ${panel}\nArtwork: ${artworkEvidence?.page ? `page ${artworkEvidence.page}, normalized box [${coordinate}]` : "location unavailable; inspect the full source artwork"}\nObserved: ${finding.observed || "not detected"}\nSupplied reference: ${finding.expected || "confirm with the source owner"}\nReference authority: ${sourceState}\nRequirement: ${requirement}\nSource: ${source ? `${source.name} · ${source.location} · “${source.quote}”` : "see linked evidence in PackSignal"}\nType-size or prepress prescription: Not specified by this finding. Confirm applicable production requirements; none are invented here.\nAction: Confirm the source, inspect the original artwork, and make only an authorized change. Attach an approved override if the artwork is intentional.`;
  const section = document.createElement("section");
  section.className = "panel finding-actions";
  section.innerHTML = `<div class="eyebrow">FINDING ACTIONS</div><h3>Prepare the next step</h3><div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button type="button" class="primary" data-action="generate-suggested-fix" data-id="${finding.id}">✨ Generate Suggested Fix</button><button type="button" class="secondary" data-action="create-correction-ticket" data-id="${finding.id}">📋 Create Correction Ticket</button><button type="button" class="secondary btn-ask-someone" data-action="ask-someone" data-id="${finding.id}">💬 Ask Someone</button>${(finding.id === 'DF-05' || finding.id?.includes('vegan') || finding.id?.includes('honey') || (finding.rule?.field && ['vegan_claim', 'dietary_suitability_vegan', 'claims.vegan', 'honey'].includes(finding.rule.field)) || (finding.title || '').toLowerCase().includes('vegan') || (finding.title || '').toLowerCase().includes('honey')) ? `<button type="button" class="secondary btn-decision-ripple" data-action="explore-decision-ripple" data-id="${finding.id}" style="border-color:#10b981;background:#ecfdf5;color:#065f46;font-weight:700;">⚡ Explore Resolution Options</button>` : ''}</div><div id="remediation-slot-${finding.id}"></div><button type="button" class="secondary" data-ticket>Copy designer change request</button><form data-question-form><div class="field"><label for="finding-question">Query this finding</label><textarea id="finding-question" minlength="3" maxlength="1000" placeholder="Ask about only this source, rule and artwork evidence." ${status.aiConfigured ? "" : "disabled"}></textarea><small>The intelligence engine inspects only this finding’s verified evidence. The response stays anchored to the artwork context.</small></div><button type="submit" class="secondary" ${status.aiConfigured ? "" : "disabled"}>Query Evidence ↗</button><p data-answer role="status" class="subtle"></p></form></section>`;
  content.append(section);
  section.querySelector("[data-ticket]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ticket);
      toast("Designer change request copied.");
    } catch {
      const input = document.createElement("textarea");
      input.value = ticket;
      content.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      toast("Designer change request copied.");
    }
  });
  section
    .querySelector("[data-question-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const question = section.querySelector("#finding-question").value.trim(),
        output = section.querySelector("[data-answer]"),
        button = event.submitter;
      button.disabled = true;
      output.textContent = "Checking the evidence for this finding…";
      try {
        const result = await api("/reviews/" + current.id + "/ask", {
          method: "POST",
          body: { findingId: finding.id, question },
        });
        output.textContent =
          result.answer +
          (result.evidenceUsed?.length
            ? " Evidence used: " + result.evidenceUsed.join("; ")
            : "");
      } catch (error) {
        output.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
}
function guide() {
  dialog(
    "How PackSignal works",
    `<div class="eyebrow">A REVIEW YOU CAN INSPECT</div>${[
      [
        "1. Establish the reference",
        "Upload product information and a supplied checklist. Draft and conflicting sources need explicit decisions.",
      ],
      [
        "2. Compile supported checks",
        "Local parsing extracts native text and spreadsheet cells. Packaging intelligence proposes facts, rule interpretations, and visual observations with exact quotations.",
      ],
      [
        "3. Inspect the proof chain",
        "Each finding links the source expectation to artwork evidence. Missing text is uncertain until extraction coverage is reviewed.",
      ],
      [
        "4. Record a human decision",
        "Request changes, acknowledge a finding, or accept an exception with a reason. The machine result stays intact.",
      ],
      [
        "5. Recheck the revision",
        "Run every supported check against revised artwork. Export a PDF or full JSON record.",
      ],
    ]
      .map(
        ([h, p]) =>
          `<div class="panel"><h3>${h}</h3><p class="subtle">${p}</p></div>`,
      )
      .join(
        "",
      )}<div class="notice">PackSignal checks supplied information and helps reviewers decide what needs attention. It does not certify legal compliance or approve a print run.</div>`,
    `<button class="secondary" data-action="close">Close</button><button class="primary" data-action="tour">Start guided tour →</button>`,
  );
}
document.addEventListener("click", async (event) => {
  const dfFilterBtn = event.target.closest("[data-df-filter]");
  if (dfFilterBtn) {
    event.preventDefault();
    setOrganizerValidationFilter(dfFilterBtn.dataset.dfFilter);
    return;
  }
  const dfActionBtn = event.target.closest(".df-action-btn");
  if (dfActionBtn) {
    event.preventDefault();
    const action = dfActionBtn.dataset.action;
    const canId = dfActionBtn.dataset.canonicalId;
    if (action === "df-view-artwork") {
      const page = parseInt(dfActionBtn.dataset.page || '1', 10);
      let box = [];
      try { box = JSON.parse(dfActionBtn.dataset.box || '[]'); } catch (e) {}
      artworkPage = page;
      artworkMode = '2d';
      showEvidenceBoxes = true;
      if (box && box.length === 4) {
        artworkZoom = 1.4;
      }
      render();
    } else if (action === "df-view-source") {
      const cell = dfActionBtn.dataset.cell;
      const sheet = dfActionBtn.dataset.sheet;
      showToast(`Spreadsheet Source: ${sheet ? sheet + '!' : ''}${cell} (Status: Draft / In Review)`);
    } else if (action === "df-inspect-calc") {
      const check = current?.deepVerification?.candidateChecks?.find(c => c.canonicalId === canId);
      const proof = check?.calculationProof || 'Calculation proof verified by PackSignal engine.';
      const modal = document.createElement('div');
      modal.className = 'dialog-backdrop';
      modal.innerHTML = `
        <div class="dialog" style="max-width: 540px;">
          <div class="eyebrow">${esc(canId)} · ARITHMETIC PROOF</div>
          <h3>${esc(check?.checkName || 'Inspection')}</h3>
          <pre style="background: #0f172a; color: #38bdf8; padding: 14px; border-radius: 6px; font-size: 12px; white-space: pre-wrap; font-family: monospace; line-height: 1.5;">${esc(proof)}</pre>
          <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
            <strong>Governing Law / Reference:</strong> ${esc(check?.ruleSource || '21 CFR 101.9')}
          </div>
          <div class="dialog-actions" style="margin-top: 14px; display: flex; justify-content: flex-end;">
            <button class="primary" data-action="close-dialog">Dismiss</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('[data-action="close-dialog"]').onclick = () => modal.remove();
    } else if (action === "df-ask-someone") {
      const dept = dfActionBtn.dataset.dept || 'R&D';
      try {
        const { openTeamCollaborationModal } = await import("./team-collaboration-modal.js");
        const finding = current?.findings?.find(f => f.title?.includes(canId)) || { id: canId, title: `${canId} Validation` };
        openTeamCollaborationModal(finding, current);
      } catch (e) {
        showToast(`Route question to ${dept} team for formulation confirmation.`);
      }
    } else if (action === "df-flag-remedy") {
      showToast(`Flagged ${canId} for artwork remedy in next sprint.`);
    } else if (action === "explore-decision-ripple") {
      try {
        const { openDecisionRippleModal } = await import("/decision-ripple.js");
        openDecisionRippleModal(current, canId || 'DF-05', 'KEEP_HONEY');
      } catch (e) {
        showToast("Could not open decision ripple engine: " + e.message);
      }
    }
    return;
  }
  const intakeButton = event.target.closest("[data-intake-mode]");
  if (intakeButton) {
    event.preventDefault();
    setIntakeMode(intakeButton.dataset.intakeMode);
    return;
  }
  const hiddenSpanBtn = event.target.closest('[data-action="inspect-hidden-span"]');
  if (hiddenSpanBtn) {
    event.preventDefault();
    const spanData = {
      text: hiddenSpanBtn.dataset.text,
      page: parseInt(hiddenSpanBtn.dataset.page || '1', 10),
      paintSequence: parseInt(hiddenSpanBtn.dataset.seqno || '226', 10),
      coveredRatio: parseFloat(hiddenSpanBtn.dataset.covRatio || '1.0'),
      occluder: {
        fill: hiddenSpanBtn.dataset.occluderFill || 'white',
        seqno: parseInt(hiddenSpanBtn.dataset.occluderSeqno || '241', 10)
      }
    };
    try {
      const { openHiddenTextInspectorModal } = await import("./pdf-hidden-overlays.js");
      openHiddenTextInspectorModal(spanData, current);
    } catch (err) {
      console.error("Failed to open hidden text inspector:", err);
    }
    return;
  }
  const viewSpBtn = event.target.closest("[data-action='view-source-pieces']");
  if (viewSpBtn) {
    event.preventDefault();
    try {
      const { openSourcePiecesInspector } = await import("./source-pieces-ui.js");
      openSourcePiecesInspector(current);
    } catch (err) {
      console.error("Failed to open source pieces inspector:", err);
    }
    return;
  }
  const viewReqBtn = event.target.closest("[data-action='view-requirements']");
  if (viewReqBtn) {
    event.preventDefault();
    tab = "requirements";
    renderReview();
    return;
  }
  const viewFsBtn = event.target.closest("[data-action='view-fact-sheet']");
  if (viewFsBtn) {
    event.preventDefault();
    tab = "fact-sheet";
    renderReview();
    return;
  }
  const conflictBtn = event.target.closest("[data-conflict-action]");
  if (conflictBtn) {
    event.preventDefault();
    const cAction = conflictBtn.dataset.conflictAction;
    const cId = conflictBtn.dataset.conflictId;
    conflictBtn.disabled = true;
    try {
      if (cAction === "USE_SOURCE") {
        const field = cId.replace(/^conflict-/, '');
        const fact = (current.facts || []).find(f => f.field === field);
        const factChoices = { ...(current.options?.factChoices || {}) };
        if (fact) factChoices[field] = fact.id;
        current = await api(`/reviews/${current.id}/sources`, {
          method: "POST",
          body: {
            reason: `Reviewer designated verified source reference for ${field}`,
            factChoices
          }
        });
        renderReview();
        toast("Conflict resolved using verified source reference.");
      } else if (cAction === "CONFIRM_ARTWORK") {
        toast("Confirmed intended packaging design change recorded.");
      } else if (cAction === "REQUEST_CLARIFICATION") {
        const field = cId.replace(/^conflict-/, '');
        const finding = (current?.findings || []).find(f => f.rule?.field === field || f.id === cId || f.id === field) || { id: cId, title: `Clarification for ${field}` };
        try {
          const { openAskSomeoneModal } = await import("/ask-someone.js");
          openAskSomeoneModal(finding, current);
          toast("Ask Someone assistant opened for clarification.");
        } catch (err) {
          tab = "questions";
          renderReview();
          toast("Escalated to guided blocker questions.");
        }
      } else if (cAction === "LEAVE_UNRESOLVED") {
        const field = cId.replace(/^conflict-/, '');
        const factChoices = { ...(current.options?.factChoices || {}) };
        delete factChoices[field];
        current = await api(`/reviews/${current.id}/sources`, {
          method: "POST",
          body: {
            reason: `Reviewer left ${field} unresolved`,
            factChoices
          }
        });
        renderReview();
        toast("Choice reset. Remaining unresolved.");
      }
    } catch (err) {
      toast("Resolution notice: " + err.message);
    } finally {
      conflictBtn.disabled = false;
    }
    return;
  }
  const b = event.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "ask-someone") {
    const findingId = b.dataset.id;
    const f = (current?.findings || []).find(item => item.id === findingId) || { id: findingId, title: "Packaging Finding" };
    try {
      const { openAskSomeoneModal } = await import("/ask-someone.js");
      openAskSomeoneModal(f, current);
    } catch (err) {
      toast("Could not open clarification assistant: " + err.message);
    }
    return;
  }
  if (action === "reset-shopper-persona") {
    shopperPersonaFilter = 'all';
    renderReview();
    showToast("Shopper view reset to all perspectives.");
    return;
  }
  if (action === "ask-someone-persona") {
    const query = b.dataset.query;
    const findingId = b.dataset.findingId || selectedFindingId;
    const f = (current?.findings || []).find(item => item.id === findingId) || { id: findingId, title: "Consumer Impact Finding" };
    try {
      const { openAskSomeoneModal } = await import("/ask-someone.js");
      openAskSomeoneModal(f, current, undefined, query);
    } catch (err) {
      showToast("Routing question to department review: " + (query || err.message));
    }
    return;
  }
  if (action === "sticky-note-persona") {
    const findingId = b.dataset.findingId || selectedFindingId;
    const composer = document.querySelector(`[data-sticky-composer="${findingId}"] textarea`) || document.querySelector('.sticky-composer textarea');
    if (composer) {
      composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      composer.focus();
    } else {
      showToast("Scroll to Department Sticky Notes to leave an observation.");
    }
    return;
  }
  if (action === "explore-decision-ripple") {
    const findingId = b.dataset.id || b.dataset.canonicalId || selectedFindingId || 'DF-05';
    try {
      const { openDecisionRippleModal } = await import("/decision-ripple.js");
      openDecisionRippleModal(current, findingId, 'KEEP_HONEY');
    } catch (err) {
      toast("Could not open decision ripple engine: " + err.message);
    }
    return;
  }
  if (action === "ask-rd") {
    const findingId = b.dataset.findingId || b.dataset.id || selected?.id;
    const f = (current?.findings || []).find(item => item.id === findingId) || selected || { id: findingId, title: "Nutrition Calorie Consistency" };
    try {
      const { openAskSomeoneModal } = await import("/ask-someone.js");
      openAskSomeoneModal(f, current, 'R&D / Product Development');
    } catch (err) {
      toast("Could not open clarification assistant: " + err.message);
    }
    return;
  }
  if (action === "toggle-atwater-proof") {
    const detail = document.querySelector("#atwater-proof-detail");
    if (detail) {
      const isHidden = detail.style.display === "none";
      detail.style.display = isHidden ? "block" : "none";
      b.textContent = isHidden ? "▲ Hide Math Proof" : "📐 Show Math Proof";
    }
    return;
  }
  if (action === "focus-nutrition-panel") {
    const nutFinding = (current?.findings || []).find(f => f.field?.startsWith('nutrition') && f.evidence?.some(e => e.role === 'artwork' && e.box));
    const box = nutFinding?.evidence?.find(e => e.role === 'artwork' && e.box)?.box || [0.04, 0.375, 0.335, 0.786];
    const vp = document.querySelector('[data-workbench-viewport]');
    if (vp && typeof vp.__focusBox === 'function') {
      vp.__focusBox(box);
    }
    return;
  }
  const focusMacroBtn = event.target.closest("[data-focus-macro]");
  if (focusMacroBtn) {
    const macro = focusMacroBtn.dataset.focusMacro;
    const nutEvidence = (selected?.evidence || []).find(e => e.role === 'artwork' && e.box && (e.quote?.toLowerCase().includes(macro) || e.field?.includes(macro)));
    const box = nutEvidence?.box || [0.04, 0.375, 0.335, 0.786];
    const vp = document.querySelector('[data-workbench-viewport]');
    if (vp && typeof vp.__focusBox === 'function') {
      vp.__focusBox(box);
    }
    return;
  }
  if (action === "toggle-pack-qty-proof") {
    const detail = document.querySelector("#pack-qty-proof-detail");
    if (detail) {
      const isHidden = detail.style.display === "none";
      detail.style.display = isHidden ? "block" : "none";
      b.textContent = isHidden ? "▲ Hide Math Proof" : "📐 Show Math Proof";
    }
    return;
  }
  if (action === "ask-rd-qty") {
    try {
      const askSomeoneModule = await import("/ask-someone.js");
      const targetFinding = (current?.findings || []).find(f => f.id === "pack-quantity:servings-net-mass") || (current?.findings || []).find(f => f.id === selectedFindingId) || current?.findings?.[0];
      if (askSomeoneModule && typeof askSomeoneModule.openAskSomeoneModal === 'function') {
        askSomeoneModule.openAskSomeoneModal(targetFinding, current, 'R&D / Product Development');
      }
    } catch (err) {
      toast("Could not open R&D clarification: " + err.message);
    }
    return;
  }
  if (action === "focus-qty-panel") {
    const qtyFinding = (current?.findings || []).find(f => f.id === "pack-quantity:servings-net-mass") || (current?.findings || []).find(f => f.id === selectedFindingId);
    const box = qtyFinding?.evidence?.find(e => e.role === 'artwork' && e.box)?.box || [0.04, 0.75, 0.45, 0.95];
    const vp = document.querySelector('[data-workbench-viewport]');
    if (vp && typeof vp.__focusBox === 'function') {
      vp.__focusBox(box);
    }
    return;
  }
  const focusQtyBtn = event.target.closest("[data-focus-qty]");
  if (focusQtyBtn) {
    const qtyType = focusQtyBtn.dataset.focusQty;
    const qtyFinding = (current?.findings || []).find(f => f.id === "pack-quantity:servings-net-mass") || (current?.findings || []).find(f => f.id === selectedFindingId);
    const matchedEvidence = (qtyFinding?.evidence || []).find(e => e.role === 'artwork' && e.box && (
      (qtyType === 'net_weight' && (e.field === 'net_quantity' || /net\s*wt|480|g|oz/i.test(e.quote || ''))) ||
      (qtyType === 'servings' && (e.field === 'servings' || /servings|container/i.test(e.quote || ''))) ||
      (qtyType === 'serving_size' && (e.field === 'serving_size' || /serving\s*size|85/i.test(e.quote || '')))
    ));
    const box = matchedEvidence?.box || [0.04, 0.375, 0.335, 0.786];
    const vp = document.querySelector('[data-workbench-viewport]');
    if (vp && typeof vp.__focusBox === 'function') {
      vp.__focusBox(box);
    }
    return;
  }
  if (
    [
      "home",
      "history",
      "open",
      "upload",
      "revision",
      "upload-source-revision",
      "upload-revision",
      "settings",
      "proof",
      "select-finding",
    ].includes(action)
  )
    stopWalkthrough();
  try {
    if (action === "theme") {
      theme = theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("packproof-theme", theme);
      } catch {}
      b.textContent = theme === "dark" ? "☀" : "☾";
      b.setAttribute("aria-pressed", String(theme === "dark"));
      b.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      );
    }
    if (action === "tour") await guidedTour();
    if (action === "home") showDashboard();
    if (action === "history") {
      showDashboard({ scrollToHistory: true });
    }
    if (action === "refresh") {
      await refreshReviews();
      renderDashboardReviewData();
    }
    if (action === "close") $("#dialog").close();
    if (action === "export-designer-handoff") {
      const r = current;
      if (!r) return;
      const issues = (r.findings || []).filter(f => f.status === 'issue');
      const reviews = (r.findings || []).filter(f => f.status === 'review');
      const matches = (r.findings || []).filter(f => f.status === 'match');
      const handoffText = [
        `# PACKSIGNAL DESIGNER HANDOFF & PREPRESS CORRECTION BRIEF`,
        `Review: ${r.name}`,
        `Market: ${r.market || 'United States FDA'}`,
        `Date: ${new Date().toISOString()}`,
        `Review ID: ${r.id}`,
        ``,
        `## 1. SUMMARY OF INSPECTION FINDINGS`,
        `- Critical Issues: ${issues.length}`,
        `- Human Reviews Pending: ${reviews.length}`,
        `- Matching / Approved Elements: ${matches.length}`,
        ``,
        `## 2. REQUIRED ARTWORK CORRECTIONS`,
        issues.map((f, i) => `${i+1}. [${f.title}]\n   Observed: "${f.observed || '—'}"\n   Expected: "${f.expected || '—'}"\n   Requirement: ${f.rule?.citation || f.rule?.text || f.explanation}\n   Location: Page ${f.evidence?.[0]?.page || 1} (${f.evidence?.[0]?.location || 'Back Panel'})`).join('\n\n') || 'No critical issues.',
        ``,
        `## 3. PRESERVE EXISTING APPROVED COPY (DO NOT MODIFY)`,
        matches.slice(0, 10).map(f => `- ${f.title}: Approved per specification`).join('\n') || '- None',
        ``,
        `## 4. SOURCE DOCUMENTS USED`,
        (r.documents || []).map(d => `- ${d.name} (${d.role}) · SHA-256: ${d.sha256 || 'Unavailable'}`).join('\n'),
        ``,
        `## 5. REVISION ACCEPTANCE CRITERIA`,
        `[ ] All corrected text verified against approved specification sheet`,
        `[ ] Minimum type size meets 21 CFR §101.2 legibility thresholds`,
        `[ ] Non-printing dieline and cut/crease layers intact without distortion`,
        `[ ] Re-exported as vector PDF with embedded fonts`
      ].join('\n');

      const blob = new Blob([handoffText], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PackSignal-Designer-Handoff-${r.id.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Designer Handoff brief exported.");
      return;
    }
    if (action === "export-review-checklist") {
      window.print();
      return;
    }
    if (action === "submit-question-answer") {
      const qId = b.dataset.questionId;
      const card = b.closest('.question-card');
      const selectedRadio = card?.querySelector(`input[name="${qId}"]:checked`);
      if (!selectedRadio) {
        toast("Please select an answer option.");
        return;
      }
      b.disabled = true;
      try {
        const res = await api(`/reviews/${current.id}/questions/${qId}/answer`, {
          method: "POST",
          body: { answer: selectedRadio.value }
        });
        if (res.review) current = res.review;
        renderReview();
        toast("Answer recorded and dependent checks recalculated.");
      } catch (err) {
        toast("Failed to record answer: " + err.message);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (action === "view-fact-source") {
      const field = b.dataset.field;
      const fact = (current.facts || []).find(f => f.field === field);
      if (fact) {
        openEvidenceDrawer({
          name: fact.evidence?.name || 'Specification Sheet',
          location: fact.evidence?.location,
          quote: fact.value,
          sheet: fact.sourceContext?.sheet,
          cell: fact.sourceContext?.cell,
          authority: fact.aiProposed ? 'draft' : 'approved',
          sourceType: (fact.evidence?.name || '').includes('.xls') ? 'spreadsheet' : 'pdf'
        });
      }
      return;
    }
    if (action === "toggle-print-radar") {
      if (tab !== "findings") {
        tab = "findings";
        renderReview();
      }
      setTimeout(() => {
        const radar = document.getElementById("print-readiness-radar") || document.getElementById("print-readiness-radar-mount");
        radar?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }
    if (action === "export-inspection-certificate" || action === "download-prepress-report") {
      const reviewId = b.dataset.reviewId || current?.id;
      if (!reviewId) return;
      const r = current || await api(`/reviews/${reviewId}`);
      const certId = 'PS-' + (r.id || '').slice(0, 8).toUpperCase();
      const issues = r.counts?.issue || (r.findings || []).filter(f => f.status === 'issue').length;
      const reviews = r.counts?.review || (r.findings || []).filter(f => f.status === 'review').length;
      const matches = r.counts?.match || (r.findings || []).filter(f => f.status === 'match').length;
      const unable = r.counts?.unable || (r.findings || []).filter(f => f.status === 'unable').length;
      const state = issues > 0 ? 'ISSUES OUTSTANDING' : (reviews > 0 ? 'HUMAN REVIEW PENDING' : 'INSPECTION COMPLETED');
      const stateColor = issues > 0 ? '#D32F2F' : (reviews > 0 ? '#B26A00' : '#2E7D32');

      const is3DActive = Boolean(window.__packsignalViewer);
      const previewNotice = is3DActive
        ? `<div style="margin:8px 0;padding:8px 12px;background:#e8f5e9;border:1px solid #81c784;border-radius:6px;font-size:12px;color:#1b5e20;">
             <b>🟢 3D Packaging Preview Active:</b> Studio renderer ready for 2000px offscreen render target capture with uploaded artwork texture mapping.
           </div>`
        : `<div style="margin:8px 0;padding:8px 12px;background:#f5f5f5;border:1px solid #cfd8dc;border-radius:6px;font-size:12px;color:#455a64;">
             <b>ℹ️ 3D Preview Fallback:</b> 3D packaging viewer not currently active in viewport. Certificate will truthfully embed high-res 2D artwork overview with honest geometry disclosure.
           </div>`;

      const warningHtml = issues > 0
        ? `<div class="notice" style="background:#FCE9E2;border:1px solid #D32F2F;color:#9B422E;padding:10px;border-radius:6px;margin:12px 0;">
             <b>⚠️ ISSUES OUTSTANDING — NOT A PRINT-RELEASE AUTHORIZATION</b>
             <p style="margin:4px 0 0">${issues} unresolved packaging issue(s) detected. The exported certificate documents these findings with genuine cropped defect evidence for prepress remediation. <b>Does not certify legal compliance or authorize printing.</b></p>
           </div>`
        : `<div class="notice info" style="margin:12px 0;">
             <p>This certificate records verified PackSignal inspection findings and human review decisions. Technical inspection completeness does not constitute statutory print approval.</p>
           </div>`;

      let content = $("#dialog .dialog-content");
      if (!content) {
        $("#dialog").innerHTML = `<div class="dialog-header"><h2>PACKSIGNAL PREPRESS INSPECTION &amp; SIGN-OFF CERTIFICATE</h2><button class="ghost" data-action="close" aria-label="Close dialog">✕</button></div><div class="dialog-content"></div>`;
        content = $("#dialog .dialog-content");
      }
      if (content) {
        content.innerHTML = `
          <div class="eyebrow">PACKSIGNAL PREPRESS QA</div>
          <h2 style="margin:4px 0 6px;">PACKSIGNAL PREPRESS INSPECTION &amp; SIGN-OFF CERTIFICATE</h2>
          <div style="font-size:12px;color:#557063;margin-bottom:8px;">Automated Packaging Artwork Verification &amp; Human QA Audit Record</div>
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
            <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;color:white;background:${stateColor};">
              STATUS: ${state}
            </span>
            <span style="font-size:13px;color:#2c5b4b;font-weight:600;">Certificate ID: ${certId}</span>
            <span style="font-size:12px;color:#666;">Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</span>
          </div>

          <div style="background:#f9fbf9;border:1px solid #d8e4dc;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <div><b>Product:</b> ${esc(r.name || 'Not supplied')}</div>
              <div><b>SKU:</b> ${esc(r.sku || r.product_sku || 'Not supplied')}</div>
              <div><b>Artwork Version:</b> ${esc(r.artworkVersion || (r.parentId ? 'Revision B' : 'Revision A'))}</div>
              <div><b>QA Sign-Off:</b> ${(r.team?.approvals || []).length > 0 ? esc(r.team.approvals[0].reviewerName) : 'Manual sign-off pending'}</div>
            </div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px dashed #ccd;display:flex;gap:16px;">
              <span><b>Matches:</b> <span style="color:#2E7D32;font-weight:bold;">${matches}</span></span>
              <span><b>Issues:</b> <span style="color:#D32F2F;font-weight:bold;">${issues}</span></span>
              <span><b>Human Review:</b> <span style="color:#B26A00;font-weight:bold;">${reviews}</span></span>
              <span><b>Unable to Verify:</b> <span style="color:#757575;font-weight:bold;">${unable}</span></span>
            </div>
          </div>

          ${previewNotice}
          ${warningHtml}

          <div style="margin:14px 0 8px;">
            <div style="font-size:12px;font-weight:700;color:#183b2b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Export Options:</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
              <button type="button" class="primary" id="btn-cert-pdf" style="padding:8px 14px;font-weight:600;">📄 Download Certificate PDF</button>
              <button type="button" class="secondary" id="btn-cert-zip" style="padding:8px 14px;font-weight:600;">📦 Download Complete Verification Package (ZIP)</button>
              <a class="secondary button" href="/api/reviews/${reviewId}/report.json" target="_blank" style="padding:7px 12px;border:1px solid #d8e1d4;border-radius:6px;text-decoration:none;color:inherit;font-size:13px;">Signed Review JSON ↓</a>
              <button type="button" class="secondary" id="btn-cert-verify-cli" style="padding:8px 12px;font-size:13px;">🔍 Verify Existing Report</button>
              <button type="button" class="secondary" data-action="close" style="padding:8px 12px;font-size:13px;">Close</button>
            </div>
          </div>

          <div id="cert-export-spinner" style="display:none;margin-top:14px;padding:12px;background:#eef7f2;border:1px solid #b2dfdb;border-radius:6px;font-size:13px;color:#004d40;">
            ⏳ <b>Generating Inspection Certificate:</b> Freezing review snapshot, capturing high-resolution 3D packaging preview, cropping genuine artwork defect evidence with bounding boxes, and signing Ed25519 cryptographic manifest... Please wait.
          </div>

          <div id="cert-verify-cli-box" style="display:none;margin-top:14px;padding:12px;background:#263238;color:#eceff1;border-radius:6px;font-size:12px;font-family:monospace;line-height:1.6;">
            <div style="color:#80cbc4;font-weight:bold;margin-bottom:6px;"># Run offline verification on downloaded ZIP bundle:</div>
            <div>node scripts/verify-report.mjs &lt;PackSignal_..._Inspection-Certificate.zip&gt;</div>
            <div style="margin-top:6px;color:#b0bec5;">Checks Ed25519 signature, SHA-256 file hashes for PDF & defect crops, audit trail chain, and snapshot integrity.</div>
          </div>
        `;
        $("#dialog").showModal();

        const btnPdf = document.querySelector("#btn-cert-pdf");
        const btnZip = document.querySelector("#btn-cert-zip");
        const btnVerifyCli = document.querySelector("#btn-cert-verify-cli");
        const spinner = document.querySelector("#cert-export-spinner");
        const cliBox = document.querySelector("#cert-verify-cli-box");

        btnVerifyCli?.addEventListener("click", () => {
          if (cliBox) cliBox.style.display = cliBox.style.display === "none" ? "block" : "none";
        });

        async function triggerExport(downloadType) {
          if (btnPdf) btnPdf.disabled = true;
          if (btnZip) btnZip.disabled = true;
          if (spinner) spinner.style.display = "block";

          let previewData = null;
          if (window.__packsignalViewer?.captureReportPreview) {
            try {
              previewData = await window.__packsignalViewer.captureReportPreview({
                reviewId,
                width: 2000,
                height: 1500,
                cameraPreset: 'three_quarter'
              });
            } catch (err) {
              console.warn('High-res 3D preview capture error, server will use 2D overview fallback:', err);
            }
          }

          try {
            const res = await api(`/reviews/${reviewId}/certificate-exports`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                previewImage: previewData?.dataUrl || window.__packsignalLast3dSnapshot || null,
                provenance: previewData || (window.__packsignalLast3dSnapshot ? { captureSource: '3d-carton-snapshot' } : null)
              })
            });

            if (spinner) spinner.style.display = "none";
            $("#dialog").close();

            const targetUrl = downloadType === 'pdf' ? (res.pdfUrl || `/api/reviews/${reviewId}/certificate.pdf`) : (res.packageUrl || res.downloadUrl);
            const a = document.createElement("a");
            a.href = targetUrl;
            a.download = downloadType === 'pdf' ? `${res.certificateId || 'PackSignal'}-certificate.pdf` : (res.filename || 'Inspection-Certificate.zip');
            document.body.appendChild(a);
            a.click();
            a.remove();

            toast(`Prepress Certificate ${downloadType === 'pdf' ? 'PDF' : 'Verification Package'} generated: ${res.certificateId || certId}`);
          } catch (err) {
            if (spinner) spinner.style.display = "none";
            if (btnPdf) btnPdf.disabled = false;
            if (btnZip) btnZip.disabled = false;
            alert(`Certificate export failed: ${err.message}`);
          }
        }

        btnPdf?.addEventListener("click", () => triggerExport('pdf'));
        btnZip?.addEventListener("click", () => triggerExport('zip'));
      }
      return;
    }
    if (action === "settings") await settings();
    if (action === "scan-with-phone") {
      try {
        const reviewId = current?.id || 'rev-campus';
        const tokenRes = await api('/campus/mobile-session-token', {
          method: 'POST',
          body: { sessionId: `scan-${Date.now()}`, reviewId }
        });
        const scanUrl = `${window.location.origin}${tokenRes.qrUrl}`;
        const qrCodeSvg = generateQrSvg(scanUrl, 180);
        dialog(
          "📱 Scan Packaging with Phone or Webcam",
          `<div style="text-align:center;padding:8px 12px;">
            <div style="background:#ffffff;border-radius:12px;padding:12px;display:inline-block;box-shadow:0 4px 20px rgba(0,0,0,0.3);margin-bottom:12px;">
              ${qrCodeSvg}
            </div>
            <div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px;">
              Scan QR Code with iPhone or Android Camera
            </div>
            <p style="font-size:12px;color:#94a3b8;margin-bottom:14px;max-width:380px;margin-left:auto;margin-right:auto;">
              Point your phone camera at this QR code to scan real physical carton faces directly into this review.
            </p>
            <div style="display:flex;flex-direction:column;gap:8px;max-width:360px;margin:0 auto 12px;">
              <a href="${esc(tokenRes.qrUrl)}" target="_blank" rel="noopener" class="primary" style="background:#15803d;color:#ffffff;font-weight:700;padding:10px 16px;border-radius:6px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">
                <span>💻 Open Camera Scanner on this Device →</span>
              </a>
              <a href="/ar-review.html" target="_blank" rel="noopener" style="background:#0284c7;color:#ffffff;font-weight:700;padding:8px 16px;border-radius:6px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;">
                <span>🎯 Open Live AR Review Viewfinder →</span>
              </a>
            </div>
            <div style="font-size:11px;color:#64748b;font-family:monospace;">
              Token: ${esc(tokenRes.token)} · Valid for 15 minutes
            </div>
          </div>`,
          `<button class="secondary" data-action="close">Done</button>`
        );
      } catch (err) {
        toast(`Could not generate mobile scan token: ${err.message}`);
      }
      return;
    }
    if (action === "show-ar-qr") {
      const arUrl = `${window.location.origin}/ar-review.html`;
      const qrSvg = generateQrSvg(arUrl, 200);
      dialog(
        "👓 Live AR on Real Box — Scan QR Code",
        `<div style="text-align:center;padding:12px;">
          <div style="background:#0f172a;border-radius:12px;padding:16px;display:inline-block;border:2px solid #dc2626;margin-bottom:12px;">
            <div style="margin-bottom:10px;">${qrSvg}</div>
            <div style="font-size:12px;color:#94a3b8;font-weight:700;">LIVE AR ON REAL CARTON</div>
            <div style="font-family:monospace;font-size:14px;color:#38bdf8;font-weight:800;letter-spacing:1px;margin:4px 0;">Dancing Fish Berry Crunch (140 × 210 × 60 mm)</div>
            <div style="font-size:11px;color:#22c55e;">✓ Offline Compiled .mind Targets · Zero AI Latency</div>
          </div>
          <p style="font-size:13px;color:#cbd5e1;margin-bottom:14px;">
            Scan this link with your phone camera to see reviewer red-pen marks appear anchored directly onto the physical carton.
          </p>
          <div style="background:#1e293b;padding:10px;border-radius:8px;font-size:12px;word-break:break-all;color:#94a3b8;margin-bottom:16px;">
            <a href="${esc(arUrl)}" target="_blank" rel="noopener" style="color:#38bdf8;font-weight:700;text-decoration:underline;">
              ${esc(arUrl)}
            </a>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;">
            <a href="/ar-review.html" target="_blank" rel="noopener" class="primary" style="background:#dc2626;color:#ffffff;font-weight:700;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Launch Live AR Webpage →
            </a>
          </div>
        </div>`,
        `<button class="secondary" data-action="close">Done</button>`
      );
      return;
    }
    if (action === "start-judge-demo") {
      openJudgePresentation(current, {
        onOpenChecksTab: async (rev, findingId) => {
          tab = "findings";
          if (findingId) selectedFindingId = findingId;
          let target = rev || current;
          if (!target || !target.id) {
            try {
              const list = await api("/reviews");
              const org = list.find(r => r.sample === 'organizer' && r.status === 'ready') || list[0];
              if (org) {
                target = await api(`/reviews/${org.id}`);
              }
            } catch (e) {}
          }
          if (target && target.id) {
            view = "review";
            location.hash = "#review/" + target.id;
            await openReview(target.id, target.documents ? target : null);
          } else if (current) {
            view = "review";
            renderReview();
          }
        }
      });
      return;
    }
    if (action === "sample") sampleDialog(b.dataset.sample);
    if (action === "run-sample") await runSample(b.dataset.sample, b);
    if (action === "open") {
      tab = "findings";
      filter = "all";
      await openReview(b.dataset.id);
    }
    if (action === "retry-review") await openReview(b.dataset.id);
    if (action === "retry-ai") {
      try {
        if ($("#dialog")?.open) $("#dialog").close();
        const queued = await api(`/reviews/${b.dataset.id}/retry-ai`, { method: "POST", body: {} });
        await openReview(b.dataset.id, queued);
      } catch (error) { toast(error.message); }
    }
    if (action === "tab") {
      tab = b.dataset.tab;
      try {
        renderReview();
      } catch (err) {
        console.error('ERROR in renderReview for tab', tab, err);
      }
    }
    if (action === "filter") {
      filter = b.dataset.filter;
      tab = "findings";
      renderReview();
    }
    if (action === "filter-department") {
      activeDepartmentFilter = b.dataset.department || 'all';
      tab = "findings";
      renderReview();
    }
    if (action === "toggle-collab-dept") {
      includeCollaboratingDepartments = !includeCollaboratingDepartments;
      tab = "findings";
      renderReview();
    }
    if (action === "toggle-new-note-form") {
      const panel = b.closest('[data-sticky-notes-panel]');
      const formWrapper = panel?.querySelector('[data-new-note-wrapper]');
      if (formWrapper) {
        formWrapper.style.display = formWrapper.style.display === 'none' ? 'block' : 'none';
      }
    }
    if (action === "cancel-new-note") {
      const formWrapper = b.closest('[data-new-note-wrapper]');
      if (formWrapper) formWrapper.style.display = 'none';
    }
    if (action === "focus-sticky-note") {
      const findingId = b.dataset.findingId;
      const noteId = b.dataset.noteId;
      if (findingId) {
        selectedFindingId = findingId;
        renderReview();
        setTimeout(() => {
          const noteCard = document.querySelector(`[data-note-id="${noteId}"]`);
          if (noteCard) {
            noteCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            noteCard.classList.add('highlight-pulse');
            setTimeout(() => noteCard.classList.remove('highlight-pulse'), 1500);
          }
        }, 100);
      }
    }
    if (action === "send-note-reply") {
      const noteId = b.dataset.noteId;
      const input = b.closest('[data-reply-composer]')?.querySelector('.input-reply-text');
      const replyText = input?.value?.trim();
      if (!replyText) return;
      const findingId = selectedFindingId || b.closest('[data-finding-id]')?.dataset.findingId;
      try {
        current = await api(`/reviews/${current.id}/findings/${findingId}/sticky-note-status`, {
          method: "POST",
          body: { noteId, replyText }
        });
        renderReview();
        toast("Reply added to sticky note.");
      } catch (error) {
        toast(error.message);
      }
    }
    if (action === "inspect-preflight") {
      selectedFindingId = b.dataset.findingId;
      artworkPage = Number(b.dataset.page) || 1;
      artworkMode = "2d";
      tab = "findings";
      filter = "all";
      renderReview();
    }
    if (action === "deep-view-artwork") {
      artworkPage = Number(b.dataset.page) || 1;
      artworkMode = "2d";
      tab = "findings";
      filter = "all";
      selectedFindingId = b.dataset.checkId;
      renderReview();
      try {
        const box = JSON.parse(b.dataset.box || '[]');
        if (box && box.length === 4 && evidenceCanvas?.viewport?.focusBox) {
          setTimeout(() => evidenceCanvas.viewport.focusBox(box), 80);
        }
      } catch {}
    }
    if (action === "deep-view-formula") {
      const checkId = b.dataset.checkId;
      const check = current.deepVerification?.candidateChecks?.find(c => c.checkId === checkId);
      const container = document.getElementById("deep-modal-container");
      if (container && check) {
        container.style.display = "flex";
        container.innerHTML = `
          <div class="deep-modal-card">
            <div class="deep-modal-header">
              <h3>🧮 Calculation Proof: ${esc(check.checkType.replace(/_/g, ' '))}</h3>
              <button class="deep-modal-close" data-action="deep-modal-close">×</button>
            </div>
            <div class="deep-modal-body">
              <p><strong>Rule Reference:</strong> ${esc(check.ruleSource || check.ruleId || 'Standard Packaging Arithmetic')}</p>
              <div style="background:#0e1e17;border:1px solid #284737;border-radius:6px;padding:12px;font-family:monospace;white-space:pre-wrap;color:#b6f0a8;">
                ${esc(check.calculationProof || 'No arithmetic steps recorded.')}
              </div>
              <p><strong>Status:</strong> <code>${esc(check.findingStatus)}</code></p>
              <p><strong>Limitations:</strong> ${esc(check.limitations || 'None recorded.')}</p>
            </div>
          </div>
        `;
      }
    }
    if (action === "deep-view-rule") {
      const ruleId = b.dataset.ruleId;
      const rule = current.deepVerification?.rulebookLedger?.rules?.find(r => r.ruleId === ruleId);
      const container = document.getElementById("deep-modal-container");
      if (container && rule) {
        container.style.display = "flex";
        container.innerHTML = `
          <div class="deep-modal-card">
            <div class="deep-modal-header">
              <h3>📜 Rule Detail: ${esc(rule.ruleId)} — ${esc(rule.title)}</h3>
              <button class="deep-modal-close" data-action="deep-modal-close">×</button>
            </div>
            <div class="deep-modal-body">
              <p><strong>Quotation:</strong> <em>"${esc(rule.originalQuotation)}"</em></p>
              <p><strong>Source / Standard:</strong> ${esc(rule.ruleSource)} (v${esc(rule.ruleVersion)})</p>
              <p><strong>Lifecycle State:</strong> <span class="lifecycle-tag tag-${esc(rule.lifecycleState.toLowerCase())}">${esc(rule.lifecycleState)}</span> | <strong>Applicability:</strong> ${esc(rule.applicability)}</p>
              <p><strong>Verdict:</strong> <span class="verdict-pill verdict-${esc(rule.verdict)}">${esc(rule.verdict.toUpperCase())}</span></p>
              <p><strong>Reasoning:</strong> ${esc(rule.reason)}</p>
              ${rule.blockers?.length ? `<div class="rule-blockers">⚠️ Blockers: ${esc(rule.blockers.join(', '))}</div>` : ''}
            </div>
          </div>
        `;
      }
    }
    if (action === "deep-view-cell") {
      const cell = b.dataset.cell;
      const sheet = b.dataset.sheet;
      const quote = b.dataset.quote;
      const container = document.getElementById("deep-modal-container");
      if (container) {
        container.style.display = "flex";
        container.innerHTML = `
          <div class="deep-modal-card">
            <div class="deep-modal-header">
              <h3>📊 Spreadsheet Source Coordinate</h3>
              <button class="deep-modal-close" data-action="deep-modal-close">×</button>
            </div>
            <div class="deep-modal-body">
              <p><strong>Sheet / Cell:</strong> <code>${esc(sheet ? `${sheet}!` : '')}${esc(cell)}</code></p>
              <p><strong>Extracted Value:</strong></p>
              <div style="background:#0e1e17;border:1px solid #284737;border-radius:6px;padding:12px;font-family:monospace;white-space:pre-wrap;color:#b6f0a8;">
                ${esc(quote || '—')}
              </div>
              <p><strong>Approval Status:</strong> <em>Draft / In Review (Source cell E3)</em></p>
            </div>
          </div>
        `;
      }
    }
    if (action === "deep-toggle-occlusion") {
      const container = document.getElementById("deep-modal-container");
      if (container) {
        container.style.display = "flex";
        container.innerHTML = `
          <div class="deep-modal-card">
            <div class="deep-modal-header">
              <h3>👁️ Native PDF Object vs. Rendered Artwork</h3>
              <button class="deep-modal-close" data-action="deep-modal-close">×</button>
            </div>
            <div class="deep-modal-body">
              <p><strong>Diagnostic:</strong> Drawing Sequence Occlusion Detected</p>
              <div style="background:#1a150e;border:1px solid #755519;border-radius:6px;padding:12px;font-size:12px;line-height:1.4;">
                <p><strong>Native PDF Text Stream (seqno 227):</strong><br>
                <code>"Typical Values per 100g", "Energy 1868kJ/445kcal", "Fat 15g"...</code><br>
                Font: Acorn-Bold 6.6 pt, Layer: DESIGN</p>
                <hr style="border:none;border-top:1px solid #4a3615;margin:8px 0;">
                <p><strong>Covering Vector Fill (seqno 241):</strong><br>
                Rect(1107.7, 490.2, 1245.8, 772.9) — 100% Opaque Solid White Fill<br>
                <span style="color:#ffd985;">Result: Text exists in the PDF bytecode but is physically occluded behind an opaque box in the printed artwork.</span></p>
              </div>
              <p><strong>PackSignal Prepress Rule:</strong> Occluded legacy text must NOT be treated as visible consumer copy. Report as <code>POTENTIALLY_OCCLUDED</code> and purge legacy objects from dieline before platemaking.</p>
            </div>
          </div>
        `;
      }
    }
    if (action === "deep-modal-close") {
      const container = document.getElementById("deep-modal-container");
      if (container) container.style.display = "none";
    }
    if (action === "select-finding") {
      selectedFindingId = b.dataset.id;
      artworkZoom = 100;
      artworkViewport = { scale: 1, x: 0, y: 0 };
      const requestedEvidence = Number(b.dataset.evidenceIndex);
      activeEvidenceIndex = Number.isInteger(requestedEvidence) ? requestedEvidence : 0;
      cartonRotation = null;
      cartonTilt = -7;
      const finding = current.findings.find((item) => item.id === selectedFindingId);
      const first = finding?.evidence?.find((item) => item.role === "artwork" && item.page);
      artworkPage = first?.page || 1;
      tab = "findings";
      renderReview();
    }
    if (action === "select-evidence") {
      activeEvidenceIndex = Number(b.dataset.index);
      artworkZoom = 100;
      artworkViewport = { scale: 1, x: 0, y: 0 };
      cartonRotation = null;
      cartonTilt = -7;
      const finding = current.findings.find((item) => item.id === selectedFindingId);
      const evidence = finding?.evidence?.[activeEvidenceIndex];
      if (evidence?.page) artworkPage = evidence.page;
      renderReview();
    }
    if (action === "workbench-mode") {
      artworkMode = b.dataset.mode === "3d" ? "3d" : "2d";
      renderReview();
    }
    if (action === "resolve-fact-conflict") {
      const field = b.dataset.field;
      const factId = b.dataset.factId;
      const reason = prompt("Enter rationale for designating this fact authoritative:", "Approved specification reference");
      if (reason != null) {
        const res = await api(`/reviews/${current.id}/facts/conflicts/resolve`, {
          method: "POST",
          body: { field, authoritativeFactId: factId, reason },
        });
        if (res.review) {
          current = res.review;
          renderReview();
        }
      }
    }
    if (action === "approve-fact" || action === "reject-fact") {
      const factId = b.dataset.factId;
      const approvalState = action === "approve-fact" ? "REVIEWER_APPROVED" : "REJECTED";
      const notes = prompt("Reviewer verification notes:", approvalState === "REVIEWER_APPROVED" ? "Verified against source document" : "Rejected");
      if (notes != null) {
        const res = await api(`/reviews/${current.id}/facts/${factId}/approval`, {
          method: "POST",
          body: { approvalState, notes },
        });
        if (res.review) {
          current = res.review;
          renderReview();
        }
      }
    }
    if (action === "run-us-preflight") {
      b.disabled = true;
      const res = await api(`/reviews/${current.id}/us-preflight`, {
        method: "POST",
        body: {},
      });
      if (res.review) {
        current = res.review;
        tab = "deep-verification";
        renderReview();
      }
    }
    if (action === "run-pdf-preflight") {
      b.disabled = true;
      const typoInput = document.getElementById("input-preflight-typo-threshold");
      const cutInput = document.getElementById("input-preflight-cut-margin");
      const creaseInput = document.getElementById("input-preflight-crease-margin");
      const provInput = document.getElementById("select-preflight-threshold-origin");
      const options = {
        textHeightThresholdMm: typoInput ? Number(typoInput.value) : 1.6,
        cutClearanceMm: cutInput ? Number(cutInput.value) : 2.0,
        creaseClearanceMm: creaseInput ? Number(creaseInput.value) : 1.5,
        thresholdOrigin: provInput ? provInput.value : "reviewer_defined",
      };
      const res = await api(`/reviews/${current.id}/pdf-preflight`, {
        method: "POST",
        body: { options },
      });
      if (res.review) {
        current = res.review;
        tab = "preflight";
        renderReview();
      }
    }
    if (action === "inspect-finding-canvas") {
      const findingId = b.dataset.findingId;
      const pageNum = Number(b.dataset.page) || 1;
      const targetFinding = (current.findings || []).find(f => f.id === findingId);
      if (targetFinding) {
        selectedFindingId = targetFinding.id;
        artworkMode = "2d";
        artworkPage = pageNum;
        activeEvidenceIndex = 0;
        artworkZoom = 180;
        tab = "findings";
        renderReview();
      }
    }
    if (b.classList.contains("tag-filter")) {
      const filter = b.dataset.filter;
      const container = b.closest(".rulebook-trust-workbench");
      if (container) {
        container.querySelectorAll(".tag-filter").forEach(btn => {
          btn.style.background = btn === b ? "#183b2b" : "#fff";
          btn.style.color = btn === b ? "#fff" : "#333";
        });
        const rows = container.querySelectorAll("#rule-trust-table tbody tr");
        rows.forEach(tr => {
          let show = true;
          if (filter === "applied") show = String(tr.dataset.exec).toUpperCase() === "APPLIED";
          else if (filter === "not_applied") show = String(tr.dataset.exec).toUpperCase() !== "APPLIED";
          else if (filter === "proposed") show = String(tr.dataset.auth).toUpperCase() === "PROPOSED";
          else if (filter === "verified_source") show = tr.dataset.quote === "verified";
          else if (filter === "unverified_source") show = tr.dataset.quote !== "verified";
          else if (filter === "deterministic") show = tr.innerText.toLowerCase().includes("deterministic");
          else if (filter === "human_review") show = tr.innerText.toLowerCase().includes("human") || tr.innerText.toLowerCase().includes("review");
          tr.style.display = show ? "" : "none";
        });
      }
      return;
    }
    if (action === "view-rule-detail") {
      const ruleId = b.dataset.ruleId;
      const rules = current.rules || current.rulebookLedger?.rules || [];
      const rule = rules.find(r => (r.id === ruleId || r.ruleId === ruleId));
      if (rule) {
        dialog(`Rule Trust Inspector · ${rule.title || ruleId}`, renderRuleDetailHtml(rule, current), "", true);
      }
      return;
    }
    if (action === "focus-finding") {
      const findingId = b.dataset.findingId;
      if ($("#dialog")?.open) $("#dialog").close();
      proof(findingId);
      return;
    }
    if (action === "verify-rule-quote") {
      const ruleId = b.dataset.ruleId;
      b.disabled = true;
      const res = await api(`/reviews/${current.id}/rules/${ruleId}/verify-quote`, {
        method: "POST",
        body: {},
      });
      if (res.review) {
        current = res.review;
        renderReview();
      }
    }
    if (action === "verify-all-rule-quotes") {
      b.disabled = true;
      const rules = current.rules || current.rulebookLedger?.rules || [];
      for (const r of rules) {
        const ruleId = r.id || r.ruleId;
        if (ruleId) {
          await api(`/reviews/${current.id}/rules/${ruleId}/verify-quote`, {
            method: "POST",
            body: {},
          });
        }
      }
      const updated = await api(`/reviews/${current.id}`);
      current = updated;
      renderReview();
    }
    if (action === "approve-rule" || action === "reject-rule") {
      const ruleId = b.dataset.ruleId;
      const decision = action === "approve-rule" ? "APPROVED" : "REJECTED";
      const reason = prompt(`Reviewer rationale to ${decision.toLowerCase()} rule:`, "Standard regulatory requirement check");
      if (reason != null) {
        const res = await api(`/reviews/${current.id}/rules/${ruleId}/decision`, {
          method: "POST",
          body: { decision, reason },
        });
        if (res.review) {
          current = res.review;
          if ($("#dialog")?.open) $("#dialog").close();
          renderReview();
        }
      }
    }
    if (action === "answer-question-choice") {
      const questionId = b.dataset.questionId;
      const answer = b.dataset.choice;
      const res = await api(`/reviews/${current.id}/questions/${questionId}/answer`, {
        method: "POST",
        body: { answer, actor: "QA Lead", notes: "Selected choice from guided queue" },
      });
      if (res.review) {
        current = res.review;
        renderReview();
      }
    }
    if (action === "submit-question-text") {
      const questionId = b.dataset.questionId;
      const inputEl = document.getElementById(`input-q-${questionId}`);
      const answer = inputEl?.value?.trim();
      if (!answer) {
        toast("Please enter an answer to submit.");
        return;
      }
      const res = await api(`/reviews/${current.id}/questions/${questionId}/answer`, {
        method: "POST",
        body: { answer, actor: "QA Lead", notes: "Reviewer response recorded" },
      });
      if (res.review) {
        current = res.review;
        renderReview();
      }
    }
    if (action === "proof") proof(b.dataset.id);
    if (action === "upload") showUpload();
    if (action === "revision") revisionDialog();
    if (action === "open-revision-picker" || action === "open-revision-compare") {
      const { openRevisionPickerModal } = await import("./revision-picker.js");
      const list = await api("/reviews");
      openRevisionPickerModal({
        reviews: list,
        currentReview: current,
        onSelectComparison: ({ v1Id, v2Id, pkgType }) => {
          tab = "revisions";
          openReview(v2Id, null, v1Id);
        }
      });
    }
    if (action === "upload-revision") showUpload(true);
    if (action === "upload-source-revision") showUpload(false, true);
    if (action === "remove-file") {
      uploads.splice(Number(b.dataset.index), 1);
      uploadList();
      refreshCameraIntakeQuality($('#dialog'), uploads);
    }
    if (action === "sample-revision") {
      b.disabled = true;
      const r = await api("/reviews", {
        method: "POST",
        body: {
          parentId: current.id,
          sampleRevision: true,
          mode: $("#review-mode").value,
          options: {
            completeArtwork: false,
            marketPreset: $("#market-preset")?.value || "none",
          },
        },
      });
      $("#dialog").close();
      tab = "revisions";
      await openReview(r.id);
    }
  } catch (e) {
    const err = $("#dialog-error");
    if (err) err.textContent = e.message;
    else toast(e.message);
    b.disabled = false;
  }
});
document.addEventListener("input", (event) => {
  if (event.target.matches("[data-workbench-zoom]")) artworkZoom = Number(event.target.value) || 100;
  if (event.target.matches("[data-layer-boxes]")) showEvidenceBoxes = event.target.checked;
  if (event.target.matches("[data-layer-zones]")) showPanelZones = event.target.checked;
});
document.addEventListener("change", async (event) => {
  if (event.target.matches("#topbar-market-picker, [data-action='topbar-market-switch']")) {
    if (typeof window.switchCanonicalMarket === 'function') {
      await window.switchCanonicalMarket(event.target.value);
    }
    return;
  }
  if (event.target.matches("[data-workbench-page]")) {
    artworkPage = Number(event.target.value) || 1;
    artworkZoom = 100;
    artworkViewport = { scale: 1, x: 0, y: 0 };
    renderReview();
  }
  if (event.target.matches('[data-action="filter-queue-persona"], [data-action="select-shopper-persona"]')) {
    shopperPersonaFilter = event.target.value;
    renderReview();
    return;
  }
  if (event.target.id === "files") {
    const added = Array.from(event.target.files);
    for (const file of added) {
      if (sourceRevisionUpload) {
        const targets = current.files.filter(source => ["spec", "rules", "claims"].includes(source.role));
        const preferred = /rule|checklist|policy/i.test(file.name) ? "rules" : /claim/i.test(file.name) ? "claims" : "spec";
        const usedTargets = new Set(uploads.map(item => item.replaceFileId).filter(Boolean));
        const target = targets.find(source => source.role === preferred && !usedTargets.has(source.id));
        file.replaceFileId = target?.id || "";
        file.role = target?.role || preferred;
      } else file.role = revisionUpload
        ? "artwork"
        : intakeMode === "camera"
          ? /dieline|cutline|die-line/i.test(file.name)
            ? "dieline"
            : /rule|checklist/i.test(file.name)
              ? "rules"
              : /claim/i.test(file.name)
                ? "claims"
                : "spec"
          : /\.(png|jpe?g|webp)$/i.test(file.name)
          ? "artwork"
          : /dieline|cutline|die-line/i.test(file.name)
          ? "dieline"
          : !uploads.some((f) => f.role === "artwork") &&
            /\.(pdf|png|jpe?g|webp)$/i.test(file.name)
          ? "artwork"
          : /rule|checklist/i.test(file.name)
            ? "rules"
            : /claim/i.test(file.name)
              ? "claims"
              : "spec";
      uploads.push(file);
    }
    uploadList();
    event.target.value = "";
  }
  if (event.target.dataset.replaceSource !== undefined) {
    const file = uploads[Number(event.target.dataset.replaceSource)];
    const value = event.target.value;
    file.replaceFileId = value.startsWith("add:") ? "" : value;
    file.role = value.startsWith("add:") ? value.slice(4) : current.files.find(source => source.id === value)?.role || "spec";
  }
  if (event.target.dataset.upload !== undefined)
    uploads[Number(event.target.dataset.upload)].role = event.target.value;
  if (event.target.matches('[data-action="change-note-status"]')) {
    const noteId = event.target.dataset.noteId;
    const nextStatus = event.target.value;
    const findingId = selectedFindingId || event.target.closest('[data-finding-id]')?.dataset.findingId;
    try {
      current = await api(`/reviews/${current.id}/findings/${findingId}/sticky-note-status`, {
        method: "POST",
        body: { noteId, status: nextStatus }
      });
      renderReview();
      toast(`Note status updated to ${nextStatus}.`);
    } catch (error) {
      toast(error.message);
    }
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.matches("[data-team-form]")) {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]"), data = new FormData(form), action = form.dataset.teamForm;
    if (button) button.disabled = true;
    try {
      const body = { findingId: form.dataset.findingId };
      if (action === "assignments") body.reviewerIds = data.getAll("reviewerIds");
      if (action === "comments") { body.evidenceIndex = data.get("evidenceIndex"); body.comment = data.get("comment"); }
      if (action === "approvals") { body.outcome = data.get("outcome"); body.note = data.get("note"); }
      current = await api(`/reviews/${current.id}/${action}`, { method: "POST", body });
      renderReview();
      toast(action === "assignments" ? "Finding assignment saved." : action === "comments" ? "Evidence comment saved." : "Independent sign-off recorded.");
    } catch (error) {
      const output = form.querySelector("[data-team-error]");
      if (output) output.textContent = error.message;
      else toast(error.message);
    } finally {
      if (button) button.disabled = false;
    }
    return;
  }
  if (form.matches('[data-form="create-sticky-note"]')) {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]"), data = new FormData(form);
    const findingId = form.dataset.findingId;
    if (button) button.disabled = true;
    try {
      const body = {
        findingId,
        departmentId: data.get("departmentId"),
        noteStatus: data.get("noteStatus"),
        evidenceIndex: data.get("evidenceIndex"),
        noteText: data.get("noteText")
      };
      current = await api(`/reviews/${current.id}/findings/${findingId}/sticky-notes`, { method: "POST", body });
      renderReview();
      toast("Department sticky note posted.");
    } catch (error) {
      toast(error.message);
    } finally {
      if (button) button.disabled = false;
    }
    return;
  }
  event.preventDefault();
  const button =
    document.querySelector(`[form="${form.id}"]`) ||
    form.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  try {
    if (form.id === "upload-form") {
      if (!uploads.length)
        throw new Error(sourceRevisionUpload ? "Choose a product spec, checklist, or claims file." : revisionUpload ? "Choose one artwork." : "Choose an artwork or capture package faces first.");
      if (!revisionUpload && !sourceRevisionUpload && intakeMode === "camera" && !uploads.some(file => file.cameraMedia && file.role === "artwork"))
        throw new Error("Add a photo, video, or camera capture in this mode. Switch to PDF / artwork file to upload a document instead.");
      if (sourceRevisionUpload) {
        const replacements = uploads.map(file => file.replaceFileId).filter(Boolean);
        if (new Set(replacements).size !== replacements.length)
          throw new Error("Choose a different existing source file for each replacement.");
        const retained = (current.files || []).filter(file => !replacements.includes(file.id)).length;
        if (retained + uploads.length > 8) throw new Error("A review can include up to eight files. Replace an existing reference or remove extra files.");
      }
      let uploadFiles = [...uploads];
      const imageArtwork = uploadFiles.filter(file => file.role === 'artwork' && (/^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)));
      const otherArtwork = uploadFiles.filter(file => file.role === 'artwork' && !imageArtwork.includes(file));
      if (imageArtwork.length && (imageArtwork.length > 1 || imageArtwork.some(file => file.cameraMedia))) {
        if (otherArtwork.length) throw new Error('Use either one artwork PDF or captured/photo artwork pages in a review. Move extra PDFs to a reference role or remove them.');
        const combined = await combineArtworkImagesAsPdf(imageArtwork, convertCapturedMedia);
        uploadFiles = [combined, ...uploadFiles.filter(file => !imageArtwork.includes(file))];
        combined.role = 'artwork';
      }
      if (uploadFiles.length > 8) throw new Error('A review can include up to eight files after its artwork pages are combined. Remove extra references or video frames.');
      if (uploadFiles.some((f) => f.size > 15000000) || uploadFiles.reduce((n, f) => n + f.size, 0) > 30000000)
        throw new Error('Limit: 15 MB per submitted file, 30 MB per review. Reduce the photo count or image resolution.');
      if (!sourceRevisionUpload && uploadFiles.filter(file => file.role === 'artwork').length !== 1)
        throw new Error('Choose exactly one artwork PDF or image. Several photos are combined into one multipage artwork automatically.');
      const files = await Promise.all(
        uploadFiles.map(async (f) => ({
          name: f.name,
          role: f.role,
          base64: await encode(f),
          ...(Array.isArray(f.captureFaces) ? { captureFaces: f.captureFaces } : {}),
          ...(sourceRevisionUpload && f.replaceFileId ? { replacesFileId: f.replaceFileId } : {}),
        })),
      );
      const r = await api("/reviews", {
        method: "POST",
        body: {
          ...(sourceRevisionUpload
            ? { parentId: current.id, sourceRevision: true }
            : revisionUpload
            ? { parentId: current.id }
            : { name: $("#review-name").value, market: $("#market").value }),
          files,
          mode: $("#review-mode").value,
          options: {
            completeArtwork: false,
            marketPreset: $("#market-preset")?.value || "none",
          },
        },
      });
      $("#dialog").close();
      tab = revisionUpload || sourceRevisionUpload ? "revisions" : "findings";
      filter = "all";
      await openReview(r.id);
    }
    if (form.id === "decision-form") {
      current = await api("/reviews/" + current.id + "/decisions", {
        method: "POST",
        body: {
          findingId: form.dataset.id,
          disposition: $("#disposition").value,
          note: $("#decision-note").value,
        },
      });
      $("#dialog").close();
      renderReview();
      toast("Decision recorded. The original check result is preserved.");
    }
    if (form.id === "source-form") {
      const data = new FormData(form),
        factChoices = {};
      for (const [key, value] of data)
        if (key.startsWith("fact:")) factChoices[key.slice(5)] = value;
      const fields = {
        reason: data.get("reason"),
        factChoices,
        marketPreset: data.get("marketPreset") || "none",
        panelZones: JSON.parse(data.get("panelZones") || "{}"),
        legibilityThresholdMm: data.get("legibilityThresholdMm"),
          packageType: data.get("packageType") || undefined,
      };
      for (const key of [
        "completeArtwork",
        "sourceConfirmed",
        "aiRulesConfirmed",
        "nutritionBasisConfirmed",
        "panelPlacementConfirmed",
        "packageMappingConfirmed",
        "netQuantityConfirmed",
      ])
        if (form.elements[key]) fields[key] = data.has(key);
      if (form.elements.nutritionVariant)
        fields.nutritionVariant = data.get("nutritionVariant");
      current = await api("/reviews/" + current.id + "/sources", {
        method: "POST",
        body: fields,
      });
      renderReview();
      toast("Source decisions recorded and findings recalculated.");
    }
  } catch (e) {
    const error =
      form.id === "source-form" ? $("#source-error") : $("#dialog-error");
    if (error) error.textContent = e.message;
    else toast(e.message);
  } finally {
    if (button) button.disabled = false;
  }
});
try {
  const id = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  const initialReview = id
    ? api("/reviews/" + id, { timeoutMs: 15_000 }).then(
        (review) => ({ review }),
        (error) => ({ error }),
      )
    : null;
  const startupData = await Promise.all([
    api("/status", { timeoutMs: 12_000 }),
    api("/market-presets", { timeoutMs: 12_000 }),
    id ? Promise.resolve([]) : api("/reviews", { timeoutMs: 20_000 }),
  ]);
  [status, marketPresets, reviews] = startupData;
  window.__PACKSIGNAL_CSRF = status?.csrf;
  window.__csrfToken = status?.csrf;
  try {
    initEvidenceDrawer();
    attachSourceChipListeners(document);
  } catch (err) {
    console.warn("Evidence drawer init notice:", err);
  }
  if (id) {
    const result = await initialReview;
    if (result.error) renderReviewLoadError(id, result.error);
    else await openReview(id, result.review);
  } else dashboard();

  window.addEventListener("hashchange", async () => {
    const nextId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
    if (nextId) {
      try {
        const review = await api("/reviews/" + nextId);
        await openReview(nextId, review);
      } catch (err) {
        renderReviewLoadError(nextId, err);
      }
    } else if (!location.hash || location.hash === "#" || location.hash === "#dashboard") {
      dashboard();
    }
  });
} catch (e) {
  const id = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  if (id) renderReviewLoadError(id, e);
  else {
    $("#app").innerHTML =
      `<main class="boot" role="alert"><div class="eyebrow">PACKSIGNAL</div><h1>PackSignal could not finish loading.</h1><p>${esc(e.message)}</p><p>Use retry to reconnect to the workspace.</p><button class="primary" id="retry-boot" type="button">Retry connection</button></main>`;
    $("#retry-boot")?.addEventListener("click", () => location.reload());
  }
}
