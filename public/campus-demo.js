/**
 * PackSignal — Campus Demo Scene Controller & Presentation Mode (public/campus-demo.js)
 * Phase 26–28 & 33: 10 Guided Rehearsal Scenes, Presenter Keyboard Shortcuts,
 * and One-Click Safe Demo Reset.
 */

export const CAMPUS_SCENES = [
  {
    sceneId: 'spot-mistakes',
    index: 1,
    label: 'Spot the Mistakes Opener',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['artwork-viewer', 'interactive-timer', 'findings-pins'],
    targetTab: 'campus-extras',
    campusSubtab: 'spot-mistakes',
    expectedTimeWindow: '0:00–1:00',
    expectedFindingIds: ['f-net-qty', 'f-serving-basis', 'f-storage-negation', 'f-sugar-claim'],
    allowedInteractions: ['timer-start', 'reveal-findings', 'card-click'],
    fallbackScene: 'evidence-desk',
    resetBehavior: 'Purge transient trial marks and reload baseline carton.',
  },
  {
    sceneId: 'evidence-desk',
    index: 2,
    label: 'Evidence Desk (PDF & Excel Split)',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['pdf-viewer', 'spreadsheet-viewer', 'bounding-box-sync'],
    targetTab: 'evidence-desk',
    expectedTimeWindow: '1:00–2:00',
    expectedFindingIds: ['f-net-qty', 'f-conflict-c14'],
    allowedInteractions: ['coordinate-highlight', 'cell-select', 'source-toggle'],
    fallbackScene: 'fact-sheet',
    resetBehavior: 'Clear active coordinate selection.',
  },
  {
    sceneId: 'fact-sheet',
    index: 3,
    label: 'Fact Sheet & Reviewer Questions',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['canonical-facts', 'discrepancy-triage', 'audit-signing'],
    targetTab: 'fact-sheet',
    expectedTimeWindow: '2:00–3:00',
    expectedFindingIds: ['f-serving-basis'],
    allowedInteractions: ['answer-question', 'save-decision'],
    fallbackScene: 'requirements',
    resetBehavior: 'Reset transient reviewer decision to pending state.',
  },
  {
    sceneId: 'requirements',
    index: 4,
    label: 'Requirements Map & Jurisdictions',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['rule-graph', 'fssai-rules', 'fda-rules'],
    targetTab: 'requirements',
    expectedTimeWindow: '3:00–3:30',
    allowedInteractions: ['jurisdiction-toggle', 'node-inspect'],
    fallbackScene: 'reviewer-lenses',
    resetBehavior: 'Restore US FDA default jurisdiction.',
  },
  {
    sceneId: 'red-pen',
    index: 5,
    label: 'Reviewer Red Pen & A3 Markup',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['svg-annotations', 'department-sticky-notes', 'clean-marked-toggle'],
    targetTab: 'reviewer-lenses',
    expectedTimeWindow: '3:30–4:00',
    allowedInteractions: ['toggle-marked', 'open-sticky-note', 'filter-department'],
    fallbackScene: 'pack-canvas',
    resetBehavior: 'Set view to clean artwork with visible pin toggles.',
  },
  {
    sceneId: 'pack-canvas',
    index: 6,
    label: 'Pack Canvas & Live Overlap Shield',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['live-reflow', 'overlap-shield', 'dieline-margins'],
    targetTab: 'pack-canvas',
    expectedTimeWindow: '4:00–5:00',
    allowedInteractions: ['simulate-overflow', 'apply-canvas-fix'],
    fallbackScene: 'regulatory-time-machine',
    resetBehavior: 'Restore canonical copy length without simulated overflow.',
  },
  {
    sceneId: 'india-switch',
    index: 7,
    label: 'India Market Switch & Hindi UI',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['india-rules', 'hindi-devanagari', 'veg-mark-check'],
    targetTab: 'regulatory-time-machine',
    expectedTimeWindow: '5:00–6:00',
    allowedInteractions: ['toggle-market-in', 'toggle-language-hi'],
    fallbackScene: 'campus-extras',
    resetBehavior: 'Return to English UI with default jurisdiction selection.',
  },
  {
    sceneId: 'second-product',
    index: 8,
    label: 'Second Product: Amrit Organic Chai',
    reviewId: 'campus-product-2',
    requiredFixture: 'campus-product-2',
    requiredFeatures: ['bilingual-chai', 'devanagari-numerals', 'fssai-licence-check'],
    targetTab: 'campus-extras',
    campusSubtab: 'india-pack',
    expectedTimeWindow: '6:00–7:00',
    allowedInteractions: ['evaluate-chai', 'inspect-bilingual-mismatch'],
    fallbackScene: 'cad-carton',
    resetBehavior: 'Purge transient chai review checks.',
  },
  {
    sceneId: '3d-ar',
    index: 9,
    label: '3D Pack View / AR On Your Table',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['three-js-carton', 'fold-animation', 'finding-pins-3d', 'ar-qr'],
    targetTab: 'cad-carton',
    expectedTimeWindow: '7:00–8:15',
    allowedInteractions: ['fold-slider', 'camera-fly-to', 'open-ar-modal'],
    fallbackScene: 'trust-console',
    resetBehavior: 'Reset fold slider to 100% folded with default front perspective.',
  },
  {
    sceneId: 'brief-trust',
    index: 10,
    label: 'Approved Brief, A3 Poster & Trust',
    reviewId: 'default',
    requiredFixture: 'organizer',
    requiredFeatures: ['evidence-audited-brief', 'trust-scoreboard', 'export-pdf'],
    targetTab: 'trust-console',
    expectedTimeWindow: '8:15–10:00',
    allowedInteractions: ['open-brief-modal', 'run-selftest', 'inspect-bake-off'],
    fallbackScene: 'spot-mistakes',
    resetBehavior: 'Clear active modal overlays and keep benchmark metrics pristine.',
  },
];

let currentSceneIndex = 0;
let isDemoRunning = false;
let currentLanguage = 'en';

export function getCampusScenes() {
  return CAMPUS_SCENES;
}

export function getCurrentScene() {
  return CAMPUS_SCENES[currentSceneIndex] || CAMPUS_SCENES[0];
}

export async function goToCampusScene(sceneIndexOrId) {
  let targetIdx = 0;
  if (typeof sceneIndexOrId === 'number') {
    targetIdx = Math.max(0, Math.min(sceneIndexOrId, CAMPUS_SCENES.length - 1));
  } else if (typeof sceneIndexOrId === 'string') {
    const found = CAMPUS_SCENES.findIndex(s => s.sceneId === sceneIndexOrId);
    if (found !== -1) targetIdx = found;
  }
  currentSceneIndex = targetIdx;
  const scene = CAMPUS_SCENES[currentSceneIndex];

  // Update UI Presentation Bar
  updateCampusDemoBarUI(scene);

  // Navigate to target tab in PackSignal
  if (scene.targetTab) {
    const tabBtn = document.querySelector(`[data-action="tab"][data-tab="${scene.targetTab}"]`);
    if (tabBtn) {
      tabBtn.click();
    }
  }

  // Handle nested campus subtabs
  if (scene.campusSubtab) {
    setTimeout(() => {
      const subtabBtn = document.querySelector(`[data-campus-tab="${scene.campusSubtab}"]`);
      if (subtabBtn) subtabBtn.click();
    }, 100);
  }

  return scene;
}

export async function nextCampusScene() {
  const nextIdx = (currentSceneIndex + 1) % CAMPUS_SCENES.length;
  return goToCampusScene(nextIdx);
}

export async function prevCampusScene() {
  const prevIdx = (currentSceneIndex - 1 + CAMPUS_SCENES.length) % CAMPUS_SCENES.length;
  return goToCampusScene(prevIdx);
}

/**
 * One-Click Safe Demo Reset (Phase 28–30)
 * Purges only transient session caches and scratch runs in < 50ms.
 * Never deletes production reviews or source files.
 */
export async function resetCampusDemoStateUI() {
  try {
    const response = await fetch('/api/campus/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now() }),
    });
    const result = await response.json();
    
    // Return to initial Scene 1 (Spot the Mistakes)
    await goToCampusScene(0);

    // Show temporary confirmation
    const notice = document.createElement('div');
    notice.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#15803d;color:#fff;padding:10px 20px;border-radius:8px;font-weight:700;font-size:13px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    notice.textContent = '✅ Campus Demo Pristine Reset Complete (< 50ms)';
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 2500);

    return result;
  } catch (err) {
    console.error('Reset error:', err);
    return { ok: false, error: err.message };
  }
}

export async function toggleCampusLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'hi' : 'en';
  try {
    const res = await fetch(`/api/campus/locale/${currentLanguage}`);
    const localeData = await res.json();
    
    // Announce language change toast
    const notice = document.createElement('div');
    notice.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#1e40af;color:#fff;padding:8px 18px;border-radius:8px;font-weight:700;font-size:13px;z-index:99999;';
    notice.textContent = currentLanguage === 'hi' ? '🇮🇳 भाषा: हिन्दी (Devanagari UI Active)' : '🇺🇸 Language: English (US Default)';
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 2000);

    // Update demo bar lang indicator
    const langBtn = document.querySelector('[data-campus-action="toggle-lang"]');
    if (langBtn) langBtn.textContent = currentLanguage === 'hi' ? '🇮🇳 HI' : '🇺🇸 EN';

    return localeData;
  } catch (e) {
    console.warn('Language switch fallback:', e);
  }
}

export function updateCampusDemoBarUI(scene) {
  const metaEl = document.querySelector('[data-campus-scene-meta]');
  if (metaEl) {
    metaEl.innerHTML = `
      <div class="campus-scene-title">
        <span>[${scene.index}/${CAMPUS_SCENES.length}]</span>
        <strong>${scene.label}</strong>
      </div>
      <div class="campus-scene-timing">⏱ ${scene.expectedTimeWindow} · Tab: ${scene.targetTab}</div>
    `;
  }
}

export function mountCampusDemoBar(container = document.body) {
  if (document.querySelector('.campus-demo-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'campus-demo-bar';
  bar.setAttribute('data-campus-demo-bar', '');
  bar.innerHTML = `
    <div class="campus-demo-badge">🎓 CAMPUS</div>
    <div class="campus-scene-meta" data-campus-scene-meta>
      <div class="campus-scene-title">[1/10] Spot the Mistakes Opener</div>
      <div class="campus-scene-timing">⏱ 0:00–1:00 · Tab: campus-extras</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center;">
      <button type="button" class="campus-demo-btn" data-campus-action="prev" title="Previous Scene (←)">◀ Prev</button>
      <button type="button" class="campus-demo-btn campus-demo-btn-primary" data-campus-action="next" title="Next Scene (Space / →)">Next ▶</button>
      <button type="button" class="campus-demo-btn" data-campus-action="toggle-lang" title="Toggle Language (L)">🇺🇸 EN</button>
      <button type="button" class="campus-demo-btn campus-demo-btn-danger" data-campus-action="reset" title="Safe Reset (R)">🔄 Reset</button>
    </div>
  `;

  container.appendChild(bar);

  // Wire action events
  bar.querySelector('[data-campus-action="prev"]').addEventListener('click', prevCampusScene);
  bar.querySelector('[data-campus-action="next"]').addEventListener('click', nextCampusScene);
  bar.querySelector('[data-campus-action="reset"]').addEventListener('click', resetCampusDemoStateUI);
  bar.querySelector('[data-campus-action="toggle-lang"]').addEventListener('click', toggleCampusLanguage);

  // Presenter Keyboard Shortcuts (Phase 33)
  window.addEventListener('keydown', (e) => {
    // Avoid capturing inputs while typing in form fields
    if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

    if (e.code === 'Space' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextCampusScene();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevCampusScene();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetCampusDemoStateUI();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      toggleCampusLanguage();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      const revealBtn = document.querySelector('[data-auto-reveal-packsignal], [data-reveal-findings]');
      if (revealBtn) revealBtn.click();
    }
  });

  return bar;
}
