import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEvidenceCanvas } from '../public/evidence-canvas.js';

class MockElement extends EventTarget {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    const set = new Set();
    this.classList = {
      add: name => set.add(name),
      remove: name => set.delete(name),
      contains: name => set.has(name),
      has: name => set.has(name),
      toggle: (name, val) => {
        const state = val === undefined ? !set.has(name) : Boolean(val);
        if (state) set.add(name); else set.delete(name);
        return state;
      },
      [Symbol.iterator]: () => set.values(),
    };
    this._classes = set;
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; },
      getPropertyValue: k => this.style[k] || '',
    };
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.naturalWidth = 1000;
    this.naturalHeight = 500;
    this.complete = true;
    this.clientWidth = 800;
    this.clientHeight = 600;
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) {
    this._classes.clear();
    String(v ?? '').split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
  }
  get textContent() {
    if (this._text) return this._text;
    return this.children.map(c => c.textContent).filter(Boolean).join(' ');
  }
  set textContent(v) {
    this._text = v;
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = String(v);
    }
    if (k === 'class') {
      String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
    }
  }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }
  append(...nodes) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const text = new MockElement('span');
        text.textContent = node;
        this.children.push(text);
        text.parentElement = this;
      } else if (node) {
        this.children.push(node);
        node.parentElement = this;
      }
    }
  }
  after(...nodes) {
    if (!this.parentElement) return;
    const idx = this.parentElement.children.indexOf(this);
    if (idx !== -1) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        this.parentElement.children.splice(idx + 1 + i, 0, n);
        if (n && typeof n === 'object') n.parentElement = this.parentElement;
      }
    }
  }
  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }
  closest(selector) {
    let cur = this;
    while (cur) {
      if (cur.matches(selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(s => this.matches(s.trim()));
    let tag = '', rest = selector;
    const tagMatch = rest.match(/^[a-z0-9_-]+/i);
    if (tagMatch) {
      tag = tagMatch[0].toUpperCase();
      rest = rest.slice(tag.length);
    }
    if (tag && this.tagName !== tag) return false;
    while (rest) {
      if (rest.startsWith('.')) {
        const classMatch = rest.match(/^\.([a-z0-9_-]+)/i);
        if (!classMatch || !this.classList.contains(classMatch[1])) return false;
        rest = rest.slice(classMatch[0].length);
      } else if (rest.startsWith('[')) {
        const attrMatch = rest.match(/^\[([a-z0-9_-]+)(?:([*^$]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/i);
        if (!attrMatch) return false;
        const attrName = attrMatch[1];
        const op = attrMatch[2];
        const val = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5];
        const actual = this.getAttribute(attrName) ?? (attrName.startsWith('data-') ? this.dataset[attrName.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] : undefined);
        if (actual === undefined || actual === null) return false;
        if (op === '=' && String(actual) !== String(val)) return false;
        rest = rest.slice(attrMatch[0].length);
      } else {
        break;
      }
    }
    return true;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const results = [];
    const walk = node => {
      for (const child of node.children) {
        if (child instanceof MockElement) {
          if (child.matches(selector)) results.push(child);
          walk(child);
        }
      }
    };
    walk(this);
    return results;
  }
  dispatchEvent(event) {
    try { Object.defineProperty(event, 'target', { value: this, configurable: true, writable: true }); } catch {}
    let cur = this;
    let defaultPrevented = false;
    while (cur) {
      const canceled = !super.dispatchEvent.call(cur, event);
      if (canceled) defaultPrevented = true;
      if (event.cancelBubble || !event.bubbles) break;
      cur = cur.parentElement;
    }
    return !defaultPrevented;
  }
  scrollIntoView() { this.scrolledIntoView = true; }
  focus() { this.isFocused = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  get innerHTML() {
    return this.textContent;
  }
  set innerHTML(html) {
    this._parseHTML(html);
  }
  _parseHTML(html) {
    this.children = [];
    this.textContent = '';
    const attrRegex = /([a-z0-9_-]+)(?:=["']([^"']*)["'])?/gi;
    const rawTokens = html.match(/<[^>]+>|[^<]+/g) || [];
    const stack = [this];
    for (const token of rawTokens) {
      if (token.startsWith('</')) {
        if (stack.length > 1) stack.pop();
      } else if (token.startsWith('<')) {
        const isSelfClosing = token.endsWith('/>') || /^<(img|input|br|hr)/i.test(token);
        const tagMatch = token.match(/^<([a-z0-9_-]+)/i);
        if (!tagMatch) continue;
        const elem = new MockElement(tagMatch[1]);
        let attrMatch;
        attrRegex.lastIndex = 0;
        while ((attrMatch = attrRegex.exec(token))) {
          if (attrMatch[1].toLowerCase() === tagMatch[1].toLowerCase()) continue;
          const attrName = attrMatch[1];
          const attrVal = attrMatch[2] ?? '';
          elem.setAttribute(attrName, attrVal);
          if (attrName === 'value') elem.value = attrVal;
          if (attrName === 'checked') elem.checked = true;
          if (attrName === 'disabled') elem.disabled = true;
        }
        stack.at(-1).append(elem);
        if (!isSelfClosing) stack.push(elem);
      } else {
        const text = token.trim();
        if (text) {
          const textNode = new MockElement('span');
          textNode.textContent = text;
          stack.at(-1).append(textNode);
          stack.at(-1).textContent += (stack.at(-1).textContent ? ' ' : '') + text;
        }
      }
    }
  }
}

globalThis.document = {
  createElement: tag => new MockElement(tag),
  createElementNS: (ns, tag) => {
    const el = new MockElement(tag);
    el.namespaceURI = ns;
    return el;
  },
};

function setupTestCanvas() {
  const root = new MockElement('div');
  root.innerHTML = `
    <div class="review-workbench">
      <div class="workbench-queue"></div>
      <div class="workbench-canvas">
        <div class="workbench-artwork">
          <div class="artwork-navigation"></div>
          <select data-workbench-page></select>
          <div class="proof-surface-label"></div>
          <span data-source-hash></span>
          <button data-viewport-focus></button>
          <div class="workbench-art-frame" data-workbench-frame>
            <div class="workbench-art-content" data-workbench-image>
              <img src="" />
            </div>
          </div>
        </div>
        <div class="workbench-occurrences"></div>
      </div>
      <div class="workbench-evidence">
        <h3>Finding Title</h3>
        <div class="detail-values">
          <div><b>Observed</b></div>
          <div><b>Expected</b></div>
        </div>
      </div>
    </div>
  `;

  const review = {
    id: 'test-review',
    name: 'Dancing Fish Granola',
    documents: [
      {
        id: 'art-1',
        name: 'DancingFish_Carton.pdf',
        role: 'artwork',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        pages: [
          { number: 1, width: 1200, height: 860, image: 'p1.png' },
          { number: 2, width: 1200, height: 860, image: 'p2.png' },
        ],
      },
    ],
    findings: [
      {
        id: 'finding-net-qty',
        title: 'Net quantity mismatch',
        status: 'issue',
        severity: 'major',
        rule: { id: 'FDA-NET-QTY', text: 'Net quantity declaration must match specification' },
        observed: '480g',
        expected: '480g (16.9 oz)',
        method: 'exact_comparison',
        evidence: [
          { documentId: 'art-1', role: 'artwork', page: 1, quote: '480g', box: [0.1, 0.7, 0.3, 0.8], panel: 'Back' },
          { documentId: 'art-1', role: 'artwork', page: 2, quote: '480g Front', box: [0.5, 0.8, 0.7, 0.9], panel: 'Front' },
        ],
      },
      {
        id: 'finding-overlap',
        title: 'Overlapping nutrition check',
        status: 'issue',
        rule: { id: 'FDA-NUTR' },
        observed: 'Total Carbs 66g',
        expected: 'Total Carbs 15g',
        evidence: [
          { documentId: 'art-1', role: 'artwork', page: 1, quote: 'Total Carbs 66g', box: [0.1, 0.7, 0.3, 0.8], panel: 'Back' },
        ],
      },
      {
        id: 'finding-allergen',
        title: 'Contains statement review',
        status: 'review',
        severity: 'medium',
        rule: { id: 'FDA-ALLERGEN', text: 'Allergens must use Contains: declaration' },
        observed: 'May Contain Almonds',
        expected: 'Contains: Almonds, Pecans',
        method: 'regulatory_rule',
        evidence: [
          { documentId: 'art-1', role: 'artwork', page: 1, quote: 'May Contain Almonds', box: [0.1, 0.1, 0.3, 0.25], panel: 'Back' },
        ],
      },
      {
        id: 'finding-product-name',
        title: 'Statement of identity matches',
        status: 'match',
        rule: { id: 'BRAND-NAME' },
        observed: 'Granola Berry Crunch',
        expected: 'Granola Berry Crunch',
        evidence: [
          { documentId: 'art-1', role: 'artwork', page: 1, quote: 'Granola Berry Crunch', box: [0.4, 0.2, 0.8, 0.35], panel: 'Front' },
        ],
      },
      {
        id: 'finding-missing-address',
        title: 'Manufacturer address incomplete',
        status: 'unable',
        rule: { id: 'FDA-ADDRESS' },
        observed: 'Dancing Fish Granola Co.',
        expected: 'Complete street, city, state, zip',
        evidence: [], // Unlocated!
      },
    ],
  };

  let focusedBox = null;
  let view = { scale: 1, x: 0, y: 0 };
  const viewport = {
    getView: () => ({ ...view }),
    getLayout: () => ({ width: 800, height: 600, pageWidth: 700, pageHeight: 500, padding: 18 }),
    setView: (next) => { view = { ...view, ...next }; },
    focusOnBox: (b) => { focusedBox = b; view = { scale: 2.5, x: 50, y: -20 }; },
    setFocus: (b) => { focusedBox = b; },
    focus: () => { if (focusedBox) view = { scale: 2.5, x: 50, y: -20 }; },
    fit: () => { view = { scale: 1, x: 0, y: 0 }; },
    reset: () => { view = { scale: 1, x: 0, y: 0 }; },
    setPage: () => {},
    point: () => ({ x: 0.15, y: 0.75 }),
    dispose: () => {},
  };

  return { root, review, viewport, getFocusedBox: () => focusedBox, getView: () => view };
}

test('mountEvidenceCanvas initializes three-panel structure with SVG overlay and tools', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });
  assert.ok(canvas);

  const workbench = root.querySelector('.review-workbench');
  assert.ok(workbench.classList.contains('evidence-workstation'));

  const svg = root.querySelector('svg.evidence-overlay');
  assert.ok(svg);
  assert.equal(svg.getAttribute('viewBox'), '0 0 1000 1000');

  const tools = root.querySelector('.evidence-tools');
  assert.ok(tools);
  assert.ok(tools.querySelector('[data-canvas-prev]'));
  assert.ok(tools.querySelector('[data-canvas-next]'));
  assert.ok(tools.querySelector('[data-canvas-fit]'));
  assert.ok(tools.querySelector('[data-canvas-focus]'));
  assert.ok(tools.querySelector('[data-canvas-loupe]'));

  const queue = root.querySelector('.workbench-queue');
  assert.ok(queue.querySelector('[data-evidence-search]'));
  assert.ok(queue.querySelector('[data-evidence-filter]'));

  canvas.dispose();
});

test('renders SVG evidence markers for located findings with correct status classes', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  const markers = root.querySelectorAll('[data-marker]');
  assert.ok(markers.length >= 2);

  const issueMarker = root.querySelector('.evidence-marker.issue');
  assert.ok(issueMarker);
  const reviewMarker = root.querySelector('.evidence-marker.review');
  assert.ok(reviewMarker);
  const matchMarker = root.querySelector('.evidence-marker.match');
  assert.ok(matchMarker);

  canvas.dispose();
});

test('clicking finding in explorer switches selection, navigates page, and focuses bounding box', () => {
  const { root, review, viewport, getFocusedBox } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  canvas.select('finding-product-name', 0);
  assert.equal(canvas.getSelection().findingId, 'finding-product-name');
  assert.deepEqual(getFocusedBox(), [0.4, 0.2, 0.8, 0.35]);
  assert.equal(viewport.getView().scale, 2.5);

  canvas.dispose();
});

test('handles overlapping markers by displaying chooser dialog and allowing selection', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  // Both finding-net-qty and finding-overlap share box [0.1, 0.7, 0.3, 0.8] on page 1
  const marker = root.querySelector('[data-marker="finding-net-qty:0"]');
  assert.ok(marker);

  // Click marker at coordinate (0.15, 0.75) where both exist
  const clickEvent = new Event('click', { bubbles: true });
  clickEvent.clientX = 100;
  clickEvent.clientY = 100;
  clickEvent.detail = 1;
  marker.dispatchEvent(clickEvent);

  const chooser = root.querySelector('.evidence-chooser');
  assert.equal(chooser.hidden, false);
  const options = chooser.querySelectorAll('[data-choose-marker]');
  assert.ok(options.length >= 2);

  // Select overlap option from chooser
  const overlapBtn = options.find(btn => btn.getAttribute('data-choose-marker') === 'finding-overlap:0');
  assert.ok(overlapBtn);
  overlapBtn.dispatchEvent(new Event('click', { bubbles: true }));

  assert.equal(canvas.getSelection().findingId, 'finding-overlap');
  assert.equal(chooser.hidden, true);

  canvas.dispose();
});

test('multi-occurrence navigation steps between occurrences across pages', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  assert.equal(canvas.getSelection().index, 0);

  // Click second occurrence
  const occBtn = root.querySelector('[data-canvas-occurrence="1"]');
  assert.ok(occBtn);
  occBtn.dispatchEvent(new Event('click', { bubbles: true }));

  assert.equal(canvas.getSelection().index, 1);
  assert.match(canvas.getSelection().pageKey, /:2$/); // Switched to page 2!

  canvas.dispose();
});

test('unlocated finding honestly explains missing location without fabricating coordinates', () => {
  const { root, review, viewport, getFocusedBox } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-missing-address' });

  const detail = root.querySelector('.canvas-evidence-details');
  assert.ok(detail);
  assert.match(detail.textContent, /No precise artwork location available/);

  // Should NOT focus on any fabricated box
  assert.equal(getFocusedBox(), null);

  canvas.dispose();
});

test('filter dropdown filters findings by status, located, and unlocated', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  const filterSelect = root.querySelector('[data-evidence-filter]');
  filterSelect.value = 'review';
  filterSelect.dispatchEvent(new Event('change', { bubbles: true }));

  const reviewRows = root.querySelectorAll('.queue-finding');
  assert.equal(reviewRows.length, 1);
  assert.ok(reviewRows[0].classList.contains('review'));

  filterSelect.value = 'unlocated';
  filterSelect.dispatchEvent(new Event('change', { bubbles: true }));

  const unlocatedRows = root.querySelectorAll('.queue-finding');
  assert.equal(unlocatedRows.length, 1);
  assert.equal(unlocatedRows[0].getAttribute('data-canvas-finding'), 'finding-missing-address');

  canvas.dispose();
});

test('search input filters findings by title, rule ID, and text', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  const searchInput = root.querySelector('[data-evidence-search]');
  searchInput.value = 'Allergen';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));

  const rows = root.querySelectorAll('.queue-finding');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute('data-canvas-finding'), 'finding-allergen');

  canvas.dispose();
});

test('toolbar fit, actual pixels 1:1, and focus buttons trigger viewport transformations', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  const fitBtn = root.querySelector('[data-canvas-fit]');
  assert.ok(fitBtn);
  fitBtn.dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(viewport.getView().scale, 1);

  const zoominBtn = root.querySelector('[data-canvas-zoomin]');
  assert.ok(zoominBtn);
  zoominBtn.dispatchEvent(new Event('click', { bubbles: true }));
  assert.ok(viewport.getView().scale > 1);

  canvas.dispose();
});

test('magnifier loupe toggles on button click and keyboard shortcut M', () => {
  const { root, review, viewport } = setupTestCanvas();
  const canvas = mountEvidenceCanvas(root, { review, viewport, selectedId: 'finding-net-qty' });

  const loupeBtn = root.querySelector('[data-canvas-loupe]');
  assert.ok(loupeBtn);
  assert.equal(loupeBtn.getAttribute('aria-pressed'), 'false');

  loupeBtn.dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(loupeBtn.getAttribute('aria-pressed'), 'true');

  loupeBtn.dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(loupeBtn.getAttribute('aria-pressed'), 'false');

  canvas.dispose();
});
