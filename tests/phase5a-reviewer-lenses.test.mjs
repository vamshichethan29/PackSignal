/**
 * @file tests/phase5a-reviewer-lenses.test.mjs
 * 
 * Comprehensive tests for Phase 5A — Reviewer Lenses:
 * - Shared finding-location layer (panel + position in mm).
 * - Pins on the flat dieline that link to exact sources.
 * - Red-pen markup with self-drawing vector strokes and Clean / Marked toggle.
 * - Sticky notes color-coded by owner (Legal / R&D / Brand).
 * - Track changes for ingredients, allergens, and claims.
 * - A3 wall poster export (strictly one printable page).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIELINE_GEOMETRY,
  CARTON_REVIEWER_FINDINGS,
  TRACK_CHANGES_ITEMS,
  getReviewerLensesData,
  generateA3WallPosterHtml
} from '../lib/reviewer-lenses.mjs';

describe('Phase 5A — Reviewer Lenses (Red Pen, Sticky Notes, Track Changes & A3 Poster)', () => {

  test('Dieline geometry defines all 6 carton panels with accurate mm and pt dimensions', () => {
    assert.ok(DIELINE_GEOMETRY.panels.length === 6, 'Carton dieline must define 6 panels');
    const panelNames = DIELINE_GEOMETRY.panels.map(p => p.name);
    assert.ok(panelNames.includes('Back panel'));
    assert.ok(panelNames.includes('Right panel'));
    assert.ok(panelNames.includes('Front panel (Principal Display Panel)'));
    assert.ok(panelNames.includes('Left panel'));
    assert.ok(panelNames.includes('Top flap'));
    assert.ok(panelNames.includes('Bottom flap'));

    for (const panel of DIELINE_GEOMETRY.panels) {
      assert.ok(panel.widthMm > 0, `Panel ${panel.name} must have positive widthMm`);
      assert.ok(panel.heightMm > 0, `Panel ${panel.name} must have positive heightMm`);
      assert.ok(panel.bboxPt.length === 4, `Panel ${panel.name} must have bounding box [x0, y0, x1, y1]`);
    }
  });

  test('Every open finding on Esko carton has a panel + exact position in mm', () => {
    assert.ok(CARTON_REVIEWER_FINDINGS.length >= 8, 'Must have at least 8 senior reviewer findings mapped');

    for (const finding of CARTON_REVIEWER_FINDINGS) {
      assert.ok(finding.id, 'Finding must have an id');
      assert.ok(finding.panel, 'Finding must specify panel name');
      assert.ok(finding.positionMm && typeof finding.positionMm.x === 'number' && typeof finding.positionMm.y === 'number',
        `Finding ${finding.id} must specify positionMm with x and y`);
      assert.ok(finding.dielineMm && typeof finding.dielineMm.x === 'number', 'Must specify overall dielineMm');
      assert.ok(Array.isArray(finding.sources) && finding.sources.length > 0,
        `Finding ${finding.id} must carry at least one verified source link`);
      
      // Check that the source location can open the file at the right spot
      const src = finding.sources[0];
      assert.ok(src.file, 'Source must identify file');
      assert.ok(src.location, 'Source must specify exact location spot (panel, paragraph, cell, line)');
      assert.ok(src.quote, 'Source must contain verbatim quote');
    }
  });

  test('Specific findings match Esko sample anomalies with correct panel coordinates', () => {
    // 1. "NO ADDED SUGAR" on Front Panel
    const sugarClaim = CARTON_REVIEWER_FINDINGS.find(f => f.id === 'finding-claim-sugar');
    assert.ok(sugarClaim);
    assert.strictEqual(sugarClaim.panel, 'Front panel (Principal Display Panel)');
    assert.strictEqual(sugarClaim.owner, 'Legal');
    assert.ok(sugarClaim.positionMm.y < 50.0, 'No Added Sugar is near the top of front panel');

    // 2. Honey Ratio Mismatch on Back Panel
    const honeyRatio = CARTON_REVIEWER_FINDINGS.find(f => f.id === 'finding-honey-ratio');
    assert.ok(honeyRatio);
    assert.strictEqual(honeyRatio.panel, 'Back panel');
    assert.strictEqual(honeyRatio.owner, 'R&D');

    // 3. Tree Nuts Warning on Back Panel
    const allergenWarning = CARTON_REVIEWER_FINDINGS.find(f => f.id === 'finding-allergen-warning');
    assert.ok(allergenWarning);
    assert.strictEqual(allergenWarning.panel, 'Back panel');
    assert.strictEqual(allergenWarning.owner, 'Legal');
    assert.match(allergenWarning.stickyNote.note, /FALCPA/i);

    // 4. Nutrition Math Checks on Left Panel
    const servingMath = CARTON_REVIEWER_FINDINGS.find(f => f.id === 'finding-serving-math');
    const calorieMath = CARTON_REVIEWER_FINDINGS.find(f => f.id === 'finding-calorie-math');
    const carbMismatch = CARTON_REVIEWER_FINDINGS.find(f => f.id === 'finding-carb-mismatch');
    assert.ok(servingMath && calorieMath && carbMismatch);
    assert.strictEqual(servingMath.panel, 'Left panel');
    assert.strictEqual(calorieMath.panel, 'Left panel');
    assert.strictEqual(carbMismatch.panel, 'Left panel');
  });

  test('Red-pen markup defines vector SVG paths with self-drawing strokes', () => {
    for (const finding of CARTON_REVIEWER_FINDINGS) {
      assert.ok(finding.redPen, `Finding ${finding.id} must define redPen object`);
      assert.ok(finding.redPen.svgPath, `Finding ${finding.id} must contain SVG path data`);
      assert.ok(finding.redPen.calloutText, `Finding ${finding.id} must contain handwritten callout text`);
      assert.ok(finding.redPen.strokeLength > 0, `Finding ${finding.id} must specify strokeLength for self-drawing animation`);
    }
  });

  test('Sticky notes are color-coded by owner (Legal / R&D / Brand)', () => {
    const data = getReviewerLensesData();
    assert.ok(data.stickyNotes.length >= 8);
    
    const owners = new Set(data.stickyNotes.map(n => n.owner));
    assert.ok(owners.has('Legal'), 'Must include Legal sticky notes');
    assert.ok(owners.has('R&D'), 'Must include R&D sticky notes');
    assert.ok(owners.has('Brand'), 'Must include Brand sticky notes');

    for (const note of data.stickyNotes) {
      assert.ok(note.ownerName, 'Note must display reviewer name and role');
      assert.ok(note.badge, 'Note must feature a category badge');
      assert.ok(note.note, 'Note must feature comment copy');
      assert.ok(note.actionRequired, 'Note must state required action');
    }
  });

  test('Track changes provides visual diff segments for ingredients, allergens, and claims', () => {
    assert.strictEqual(TRACK_CHANGES_ITEMS.length, 3, 'Must have track changes for ingredients, allergens, and claims');

    // Ingredients Diff
    const ingDiff = TRACK_CHANGES_ITEMS.find(t => t.id === 'track-ingredients');
    assert.ok(ingDiff);
    assert.ok(ingDiff.diffSegments.some(s => s.type === 'deleted' && s.text.includes('walnuts')));
    assert.ok(ingDiff.diffSegments.some(s => s.type === 'deleted' && s.text.includes('1%')));
    assert.ok(ingDiff.diffSegments.some(s => s.type === 'inserted' && s.text.includes('9%')));

    // Allergens Diff
    const allDiff = TRACK_CHANGES_ITEMS.find(t => t.id === 'track-allergens');
    assert.ok(allDiff);
    assert.ok(allDiff.diffSegments.some(s => s.type === 'deleted' && s.text.includes('tree nuts')));
    assert.ok(allDiff.diffSegments.some(s => s.type === 'inserted' && s.text.includes('Walnuts, Pecans')));

    // Claims Diff
    const claimDiff = TRACK_CHANGES_ITEMS.find(t => t.id === 'track-claims');
    assert.ok(claimDiff);
    assert.ok(claimDiff.diffSegments.some(s => s.type === 'deleted' && s.text.includes('NO ADDED SUGAR')));
  });

  test('A3 wall poster export generates strictly one printable landscape page', () => {
    const html = generateA3WallPosterHtml();
    assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce valid HTML document');
    assert.ok(html.includes('size: A3 landscape;'), 'Must specify A3 landscape page size');
    assert.ok(html.includes('PACKSIGNAL SENIOR REVIEWER MARKUP POSTER'), 'Must contain poster title');
    assert.ok(html.includes('poster-dieline-frame'), 'Must render flat dieline frame');
    assert.ok(html.includes('poster-redpen-svg'), 'Must render red-pen SVG overlay');
    assert.ok(html.includes('poster-sticky-card'), 'Must render sticky notes tray');
    assert.ok(html.includes('poster-track-item'), 'Must render track changes diff table');
    assert.ok(html.includes('PAGE 1 OF 1'), 'Must indicate single-page format');
    assert.ok(html.includes('Legal Sign-off:'), 'Must include prepress sign-off blocks');
  });

});
