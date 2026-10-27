import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openTypographyInspector } from '../public/font-inspector.js';

describe('Native PDF Typography Visual Inspector UI Tests', () => {
  beforeEach(() => {
    // Setup mock minimal DOM environment
    globalThis.document = {
      _elements: new Map(),
      getElementById(id) {
        return this._elements.get(id) || null;
      },
      createElement(tag) {
        const el = {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          style: {},
          innerHTML: '',
          _listeners: {},
          children: [],
          querySelector(sel) {
            if (sel.startsWith('#')) {
              const targetId = sel.slice(1);
              const findById = (node) => {
                if (node.id === targetId) return node;
                for (const c of node.children) {
                  const res = findById(c);
                  if (res) return res;
                }
                return null;
              };
              return findById(this);
            }
            return null;
          },
          addEventListener(event, fn) {
            this._listeners[event] = fn;
          },
          dispatchEvent(evt) {
            const fn = this._listeners[evt.type];
            if (fn) fn(evt);
          },
        };
        return el;
      },
      body: {
        children: [],
        appendChild(child) {
          this.children.push(child);
          if (child.id) document._elements.set(child.id, child);
          return child;
        },
      },
    };
  });

  it('1. openTypographyInspector mounts dialog with Side-by-Side proof and statutory fields', () => {
    const mockFinding = {
      id: 'typo-net-qty-01',
      title: 'Net quantity letter height below statutory minimum',
      observed: 'Net Wt 12 oz (340g)',
      quote: 'Net Wt 12 oz (340g)',
      fontName: 'Helvetica-Bold',
      fontSubtype: 'TrueType (Subset)',
      embeddedFontStatus: 'SUBSET',
      nominalFontSizePt: 6.0,
      measuredGlyphHeightMm: 1.25,
      measuredLowercaseOHeightMm: 1.25,
      requiredHeightMm: 1.5875,
      differenceMm: -0.338,
      pdpAreaSqIn: 20.0,
      ruleCitation: '21 CFR 101.105(h)',
      measurementMethod: 'ORIGINAL_NATIVE_GLYPH_OUTLINE',
      status: 'issue',
    };

    openTypographyInspector(mockFinding);

    const modal = document.getElementById('typography-inspector-modal');
    assert.ok(modal, 'Modal mounted in DOM');
    assert.equal(modal.style.display, 'flex');

    const html = modal.innerHTML;
    // Header
    assert.ok(html.includes('NATIVE PDF TYPOGRAPHY INSPECTOR'));
    // Selected Text
    assert.ok(html.includes('Net Wt 12 oz (340g)'));
    // Font Resource
    assert.ok(html.includes('Helvetica-Bold'));
    assert.ok(html.includes('6.0 pt'));
    // Physical Glyph Measurement
    assert.ok(html.includes('1.250 mm'));
    // Side by side proof
    assert.ok(html.includes('SIDE-BY-SIDE STATUTORY FONT PROOF'));
    assert.ok(html.includes('NOMINAL FONT SIZE'));
    assert.ok(html.includes('ACTUAL PRINTED LOWERCASE HEIGHT'));
    assert.ok(html.includes('Point size is the nominal font size. FDA checks the relevant printed letter height.'));
    // Action Buttons
    assert.ok(html.includes('btn-typo-highlight'));
    assert.ok(html.includes('btn-typo-calc'));
    assert.ok(html.includes('btn-typo-regulation'));
    assert.ok(html.includes('btn-typo-ask-prepress'));
  });

  it('2. Compliant finding displays green PASS styling', () => {
    const mockPassingFinding = {
      id: 'typo-net-qty-pass',
      observed: 'NET WT 500g',
      fontName: 'DIN-Next',
      nominalFontSizePt: 12.0,
      measuredGlyphHeightMm: 3.45,
      requiredHeightMm: 3.175,
      differenceMm: +0.275,
      pdpAreaSqIn: 22.0,
      ruleCitation: '21 CFR 101.105(h)',
      status: 'match',
    };

    openTypographyInspector(mockPassingFinding);

    const modal = document.getElementById('typography-inspector-modal');
    assert.ok(modal.innerHTML.includes('MATCH') || modal.innerHTML.includes('COMPLIANT'));
  });
});
