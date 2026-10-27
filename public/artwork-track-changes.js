/**
 * @file public/artwork-track-changes.js
 * 
 * PackSignal Phase 5A — Visual Track Changes Drawer
 * Allows senior reviewers to compare:
 * 1. SOURCE VS ARTWORK
 * 2. ARTWORK V1 VS ARTWORK V2
 * 
 * Across Ingredients, Allergens, and Claims with familiar red strike-through,
 * green underline, and amber paired comparisons.
 */

let activeCategory = 'ingredients'; // 'ingredients' | 'allergens' | 'claims'
let activeDiffMode = 'SOURCE_VS_ARTWORK'; // 'SOURCE_VS_ARTWORK' | 'ARTWORK_V1_V2'
let trackChangesOpen = false;

export function mountTrackChangesPanel(container = document.body, review) {
  const existing = document.getElementById('artwork-track-changes-drawer') || document.getElementById('track-changes-drawer');
  if (existing) existing.remove();

  const drawer = document.createElement('div');
  drawer.id = 'artwork-track-changes-drawer';
  drawer.className = `artwork-track-changes-drawer track-changes-drawer ${trackChangesOpen ? 'open' : ''}`;

  renderTrackChangesContent(drawer, review);
  container.appendChild(drawer);
  attachTrackChangesEvents(drawer, review);
}

export function toggleTrackChanges(open = null) {
  trackChangesOpen = open !== null ? open : !trackChangesOpen;
  const drawer = document.getElementById('artwork-track-changes-drawer') || document.getElementById('track-changes-drawer');
  if (drawer) {
    drawer.classList.toggle('open', trackChangesOpen);
  }
}

function renderTrackChangesContent(drawer, review) {
  drawer.innerHTML = `
    <div class="tc-header">
      <div class="tc-title">
        <span>📝</span>
        <h3>Artwork Track Changes</h3>
      </div>
      <button type="button" class="tc-close-btn" id="btn-close-tc" data-tc-action="close">&times;</button>
    </div>

    <!-- Mode Toggle: Source vs Artwork or V1 vs V2 -->
    <div class="tc-mode-toggle">
      <button type="button" class="tc-mode-btn ${activeDiffMode === 'SOURCE_VS_ARTWORK' ? 'active' : ''}" data-tc-mode="SOURCE_VS_ARTWORK">
        Source vs Artwork
      </button>
      <button type="button" class="tc-mode-btn ${activeDiffMode === 'ARTWORK_V1_V2' ? 'active' : ''}" data-tc-mode="ARTWORK_V1_V2">
        Artwork V1 vs V2
      </button>
    </div>

    <!-- Category Tabs -->
    <div class="tc-category-tabs">
      <button type="button" class="tc-category-pill tc-cat-btn ${activeCategory === 'ingredients' ? 'active' : ''}" data-category="ingredients" data-tc-cat="ingredients">
        🥗 Ingredients
      </button>
      <button type="button" class="tc-category-pill tc-cat-btn ${activeCategory === 'allergens' ? 'active' : ''}" data-category="allergens" data-tc-cat="allergens">
        🥜 Allergens
      </button>
      <button type="button" class="tc-category-pill tc-cat-btn ${activeCategory === 'claims' ? 'active' : ''}" data-category="claims" data-tc-cat="claims">
        ✨ Marketing Claims
      </button>
    </div>

    <!-- Main Diff View Area -->
    <div class="tc-diff-body" id="tc-diff-body">
      ${renderCategoryDiff(activeCategory, activeDiffMode, review)}
    </div>
  `;
}

function renderCategoryDiff(cat, mode, review) {
  if (cat === 'ingredients') {
    return `
      <div class="tc-diff-card">
        <div class="tc-section-head">
          <b>Ingredient Sequence Diff</b>
          <span class="tc-badge warning">1 Modification · 1 Addition</span>
        </div>
        <div class="tc-prose-block">
          <p>
            Rolled Oats, Crisp Rice, 
            <span class="tc-del">Honey (9%)</span>
            <span class="tc-ins">Honey (1%)</span>, 
            Dried Berries, Canola Oil, 
            <span class="tc-ins">+ Natural Flavor</span>, 
            Salt.
          </p>
        </div>
        <div class="tc-findings-summary">
          <div class="tc-diff-item mod">
            <span class="icon">~</span>
            <span>Modified: <b>Honey (9%)</b> in spec → <b>Honey (1%)</b> in artwork</span>
            <button type="button" class="tc-jump-btn" data-jump-finding="DF-02">Show on Artwork</button>
          </div>
          <div class="tc-diff-item add">
            <span class="icon">+</span>
            <span>Added: <b>Natural Flavor</b> detected on artwork without spec authorization</span>
            <button type="button" class="tc-jump-btn" data-jump-finding="DF-03">Show on Artwork</button>
          </div>
        </div>
      </div>
    `;
  } else if (cat === 'allergens') {
    return `
      <div class="tc-diff-card">
        <div class="tc-section-head">
          <b>Allergen Declaration Comparison</b>
          <span class="tc-badge issue">Specific Species Required</span>
        </div>
        <div class="tc-prose-block">
          <p>
            <b>Source Spec:</b> "Contains: Almonds, Pecans. May contain: Milk, Soy."<br/>
            <b>Artwork Copy:</b> "Contains: <span class="tc-mod">Tree Nuts (Almonds)</span>. May contain: Milk."
          </p>
        </div>
        <div class="tc-findings-summary">
          <div class="tc-diff-item rem">
            <span class="icon">-</span>
            <span>Missing Species: <b>Pecans</b> declared in spec but absent from artwork statement</span>
            <button type="button" class="tc-jump-btn" data-jump-finding="DF-04">Show on Artwork</button>
          </div>
          <div class="tc-diff-item mod">
            <span class="icon">~</span>
            <span>Advisory Difference: <b>Soy</b> absent from printed 'May contain' advisory</span>
          </div>
        </div>
      </div>
    `;
  } else {
    // Claims
    return `
      <div class="tc-diff-card">
        <div class="tc-section-head">
          <b>Marketing &amp; Certification Claims</b>
          <span class="tc-badge issue">1 Unsubstantiated Claim</span>
        </div>
        <div class="tc-findings-summary">
          <div class="tc-diff-item add">
            <span class="icon">+</span>
            <span>Added on Artwork: <b>"Certified Vegan"</b> (Unsubstantiated — Honey present in formulation)</span>
            <button type="button" class="tc-jump-btn" data-jump-finding="DF-05">Show on Artwork</button>
          </div>
          <div class="tc-diff-item match">
            <span class="icon">✓</span>
            <span>Unchanged: <b>"Good Source of Fiber"</b> matches nutritional specification</span>
          </div>
        </div>
      </div>
    `;
  }
}

function attachTrackChangesEvents(drawer, review) {
  drawer.querySelectorAll('#btn-close-tc, [data-tc-action="close"]').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleTrackChanges(false);
    });
  });

  drawer.querySelectorAll('[data-tc-mode]').forEach(b => {
    b.addEventListener('click', () => {
      drawer.querySelectorAll('[data-tc-mode]').forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
      activeDiffMode = b.getAttribute('data-tc-mode');
      const body = drawer.querySelector('#tc-diff-body');
      if (body) body.innerHTML = renderCategoryDiff(activeCategory, activeDiffMode, review);
    });
  });

  drawer.querySelectorAll('[data-tc-cat], [data-category]').forEach(b => {
    b.addEventListener('click', () => {
      drawer.querySelectorAll('[data-tc-cat], [data-category]').forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
      activeCategory = b.getAttribute('data-category') || b.getAttribute('data-tc-cat');
      const body = drawer.querySelector('#tc-diff-body');
      if (body) body.innerHTML = renderCategoryDiff(activeCategory, activeDiffMode, review);
    });
  });

  drawer.addEventListener('click', (e) => {
    const jumpBtn = e.target.closest('[data-jump-finding]');
    if (jumpBtn) {
      const fId = jumpBtn.getAttribute('data-jump-finding');
      const pin = document.querySelector(`.dieline-finding-pin[data-finding-id="${fId}"]`);
      if (pin) {
        pin.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pin.click();
      } else {
        alert(`Jump to finding ${fId} on artwork.`);
      }
    }
  });
}
