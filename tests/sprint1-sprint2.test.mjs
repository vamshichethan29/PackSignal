/**
 * @file sprint1-sprint2.test.mjs
 * 
 * Verifies Sprint 1 (Reviewer & Shopper Experience) & Sprint 2 (Prepress & Ghost Bounding Boxes):
 * 1. Shopper Personas Filter: Dropdown on Checks screen (All, Nut Allergy, Vegan, Sugar Watcher, Low Vision).
 * 2. Vegan vs. Honey 1-Tap Ripple: Quick decision buttons on the Honey/Vegan conflict card & finding checks.
 * 3. Shelf-Distance Slider: Interactive distance slider on the Artwork viewer (0.5m – 3.0m).
 * 4. Prepress Print HUD: Exposing TAC ink density (280% / ≤300%) & bleed status (3.0mm Safe).
 * 5. Dashed Ghost Boxes: Highlighting missing Net Qty & Address on the PDP.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderReviewChecksWorkspace } from '../public/review-checks.js';
import { renderConflictCard } from '../public/conflict-card.js';
import { artworkMap } from '../public/artwork-ui.js';

const root = process.cwd();

test('1. Shopper Personas Filter renders dropdown and filters checks by persona', () => {
  const mockReview = {
    findings: [
      {
        id: 'f-allergen',
        title: 'Tree Nut Allergen Advisory Mismatch',
        category: 'Allergens',
        status: 'issue',
        observed: 'May contain peanuts, tree nuts',
        expected: 'Contains: Almonds, Coconut',
        whyItMatters: 'Mandatory allergen statement under FALCPA/FASTER Act',
      },
      {
        id: 'f-vegan',
        title: 'Vegan Claim Conflict with Honey Sweetener',
        category: 'Claims',
        status: 'issue',
        observed: '100% Certified Vegan with Wildflower Honey',
        expected: 'Honey is an animal-derived product',
        whyItMatters: 'Vegan certification standard prohibits animal byproducts',
      },
      {
        id: 'f-sugar',
        title: 'Sugar Content & Daily Values Discrepancy',
        category: 'Nutrition',
        status: 'issue',
        observed: 'Total Sugars 12g (Includes 8g Added Sugars)',
        expected: 'Formula specifies 14g total sugars',
        whyItMatters: 'Added sugar declaration required per 21 CFR 101.9',
      },
      {
        id: 'f-typo',
        title: 'Net Quantity Font Point Size Below Statutory Height',
        category: 'Typography',
        status: 'review',
        observed: 'Font height 2.4 mm (6.8 pt)',
        expected: 'Minimum 3.2 mm (1/8 inch) for PDP > 25 sq in',
        whyItMatters: '21 CFR 101.7 prominence requirements',
      },
    ],
  };

  // Test rendering all
  const htmlAll = renderReviewChecksWorkspace(mockReview, 'all', 'all');
  assert.ok(htmlAll.includes('data-action="filter-shopper-persona"'), 'Must render persona dropdown');
  assert.ok(htmlAll.includes('Nut Allergy'), 'Dropdown contains Nut Allergy option');
  assert.ok(htmlAll.includes('Vegan'), 'Dropdown contains Vegan option');
  assert.ok(htmlAll.includes('Sugar Watcher'), 'Dropdown contains Sugar Watcher option');
  assert.ok(htmlAll.includes('Low Vision'), 'Dropdown contains Low Vision option');

  // Test nut-allergy persona filter
  const htmlNut = renderReviewChecksWorkspace(mockReview, 'all', 'nut-allergy');
  assert.ok(htmlNut.includes('Tree Nut Allergen Advisory'), 'Nut allergy shows allergen finding');
  assert.ok(!htmlNut.includes('Sugar Content & Daily Values'), 'Nut allergy excludes unrelated sugar finding');

  // Test vegan persona filter
  const htmlVegan = renderReviewChecksWorkspace(mockReview, 'all', 'vegan');
  assert.ok(htmlVegan.includes('Vegan Claim Conflict with Honey'), 'Vegan persona shows honey/vegan finding');
  assert.ok(!htmlVegan.includes('Font Point Size Below Statutory'), 'Vegan persona excludes font height finding');

  // Test sugar-watcher persona filter
  const htmlSugar = renderReviewChecksWorkspace(mockReview, 'all', 'sugar-watcher');
  assert.ok(htmlSugar.includes('Sugar Content'), 'Sugar watcher shows sugar finding');
  assert.ok(!htmlSugar.includes('Tree Nut Allergen Advisory'), 'Sugar watcher excludes allergen finding');

  // Test low-vision persona filter
  const htmlLowVision = renderReviewChecksWorkspace(mockReview, 'all', 'low-vision');
  assert.ok(htmlLowVision.includes('Net Quantity Font Point Size'), 'Low vision shows typography finding');
});

test('2. Vegan vs. Honey 1-Tap Ripple buttons render on Honey/Vegan conflict card and check cards', () => {
  // Test conflict card
  const honeyVeganConflict = {
    id: 'conflict-honey-vegan',
    title: 'Sweetener Specification vs. Vegan Claim Conflict',
    type: 'SPECIFICATION_FORMULATION_CONFLICT',
    candidateA: {
      label: 'Ingredient Spec',
      value: 'Organic Wildflower Honey (12%)',
      authority: 'Approved Recipe',
    },
    candidateB: {
      label: 'Artwork Front Claim',
      value: 'Certified Vegan Logo & Wordmark',
      authority: 'Printed Artwork',
    },
  };

  const conflictHtml = renderConflictCard(honeyVeganConflict);
  assert.ok(conflictHtml.includes('Vegan vs. Honey 1-Tap Ripple'), 'Conflict card must have 1-Tap Ripple section');
  assert.ok(conflictHtml.includes('RIPPLE_KEEP_HONEY'), 'Contains Keep Honey (Drop Vegan Claim) button');
  assert.ok(conflictHtml.includes('RIPPLE_KEEP_VEGAN'), 'Contains Keep Vegan (Substitute Agave/Maple) button');

  // Test check card in review-checks workspace
  const mockReview = {
    findings: [
      {
        id: 'f-honey-vegan',
        title: 'Honey Sweetener Conflict with Certified Vegan Claim',
        status: 'issue',
        observed: 'Certified Vegan claim on PDP',
        expected: 'Formula contains Honey',
        whyItMatters: 'Honey is animal-derived, invalidating Certified Vegan claims.',
      },
    ],
  };

  const checkHtml = renderReviewChecksWorkspace(mockReview, 'all', 'all');
  assert.ok(checkHtml.includes('ripple-keep-honey'), 'Check card contains ripple-keep-honey action');
  assert.ok(checkHtml.includes('ripple-keep-vegan'), 'Check card contains ripple-keep-vegan action');
  assert.ok(checkHtml.includes('Keep Honey (Drop Vegan Claim)'), 'Action label for dropping vegan claim');
  assert.ok(checkHtml.includes('Keep Vegan (Substitute Agave/Maple)'), 'Action label for formula substitution');
});

test('3. Prepress Print HUD exposes TAC ink density and bleed status', () => {
  const artworkUiSrc = readFileSync(join(root, 'public', 'artwork-ui.js'), 'utf8');
  assert.ok(artworkUiSrc.includes('hud-tac-bleed'), 'Prepress HUD contains TAC and Bleed element');
  assert.ok(artworkUiSrc.includes('TAC: 280% (Pass ≤300%)'), 'Exposes ISO 12647-2 TAC 280% density check');
  assert.ok(artworkUiSrc.includes('Bleed: 3.0mm Safe'), 'Exposes 3.0mm bleed safety zone check');
});

test('4. Shelf-Distance Slider renders in Artwork viewer with 0.5m – 3.0m range and reactive blur logic', () => {
  const artworkUiSrc = readFileSync(join(root, 'public', 'artwork-ui.js'), 'utf8');
  assert.ok(artworkUiSrc.includes('data-shelf-distance-slider'), 'Renders shelf distance slider');
  assert.ok(artworkUiSrc.includes('data-shelf-distance-value'), 'Renders distance value indicator');
  assert.ok(artworkUiSrc.includes('min="0.5"'), 'Minimum distance 0.5m');
  assert.ok(artworkUiSrc.includes('max="3.0"'), 'Maximum distance 3.0m');
  assert.ok(artworkUiSrc.includes('blur('), 'Applies optical blur filter based on distance');
});

test('5. Dashed Ghost Boxes highlight missing Net Qty and Address on PDP with statutory tooltips', () => {
  const artworkUiSrc = readFileSync(join(root, 'public', 'artwork-ui.js'), 'utf8');
  assert.ok(artworkUiSrc.includes('ghost-net-qty'), 'Renders dashed ghost box for missing Net Quantity');
  assert.ok(artworkUiSrc.includes('ghost-address'), 'Renders dashed ghost box for missing Manufacturer Address');
  assert.ok(artworkUiSrc.includes('GHOST: MISSING NET QTY (16.9 oz)'), 'Labels Net Quantity ghost box');
  assert.ok(artworkUiSrc.includes('GHOST: MISSING MFR ADDRESS'), 'Labels Manufacturer Address ghost box');
  assert.ok(artworkUiSrc.includes('21 CFR §101.7'), 'Cites FDA 21 CFR §101.7 on Net Quantity ghost box');
  assert.ok(artworkUiSrc.includes('21 CFR §101.5'), 'Cites FDA 21 CFR §101.5 on Address ghost box');
  assert.ok(artworkUiSrc.includes('data-layer-ghosts'), 'Provides Ghost box layer toggle checkbox');
});
