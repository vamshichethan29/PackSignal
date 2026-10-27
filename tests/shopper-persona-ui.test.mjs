import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderShopperPersonaToolbar,
  renderShopperPerspectiveBanner,
  renderConsumerConsequenceCard,
  renderShopperHighlightsOverlay,
  computePersonaMetrics
} from '../public/shopper-personas.js';
import {
  getPersonaArtworkHighlights,
  getPersona3DPins
} from '../lib/shopper-personas.mjs';

test('Shopper Personas — UI Components & Coordinates (Upgrade #42)', async (t) => {
  await t.test('1. renderShopperPersonaToolbar renders select with all 4 options', () => {
    const html = renderShopperPersonaToolbar('vegan');
    assert.ok(html.includes('data-action="select-shopper-persona"'));
    assert.ok(html.includes('value="all"'));
    assert.ok(html.includes('value="nut-allergy"'));
    assert.ok(html.includes('value="vegan" selected'));
    assert.ok(html.includes('value="sugar-watcher"'));
  });

  await t.test('2. renderShopperPerspectiveBanner renders summary counts and clear lens button', () => {
    const mockReview = {
      findings: [
        { id: 'DF-02', status: 'match', title: 'Almonds allergen', rule: { field: 'allergen' } },
        { id: 'DF-03', status: 'review', title: 'May contain tree nuts', rule: { field: 'precautionary_allergen' } }
      ]
    };

    const bannerHtml = renderShopperPerspectiveBanner(mockReview, 'nut-allergy');
    assert.ok(bannerHtml.includes('NUT ALLERGY SHOPPER'));
    assert.ok(bannerHtml.includes('Relevant Checks: <b>2</b>'));
    assert.ok(bannerHtml.includes('Needs Review: <b style="color:#f59e0b;">1</b>'));
    assert.ok(bannerHtml.includes('data-action="reset-shopper-persona"'));

    // Returns empty when 'all'
    assert.equal(renderShopperPerspectiveBanner(mockReview, 'all'), '');
  });

  await t.test('3. renderConsumerConsequenceCard displays "WHY THIS MATTERS" sections', () => {
    const finding = {
      id: 'DF-05',
      title: 'Dietary Suitability / Vegan Claim vs Honey',
      observed: 'Suitable for Vegans',
      expected: 'Recipe Honey (1% / 9%)',
      status: 'issue'
    };

    const cardHtml = renderConsumerConsequenceCard(finding, {}, 'vegan');
    assert.ok(cardHtml.includes('VEGAN CONSUMER PERSPECTIVE'));
    assert.ok(cardHtml.includes('WHAT THE SHOPPER SEES'));
    assert.ok(cardHtml.includes('WHAT SOURCE DATA SAYS'));
    assert.ok(cardHtml.includes('WHY THIS MATTERS TO CONSUMERS'));
    assert.ok(cardHtml.includes('UNRESOLVED UNCERTAINTY'));
    assert.ok(cardHtml.includes('TEAM VERIFICATION ACTION'));
    assert.ok(cardHtml.includes('data-action="explore-decision-ripple"'));
    assert.ok(cardHtml.includes('data-action="ask-someone-persona"'));
    assert.ok(cardHtml.includes('data-action="sticky-note-persona"'));
  });

  await t.test('4. renderShopperHighlightsOverlay renders tagged 2D overlay boxes', () => {
    const nutOverlay = renderShopperHighlightsOverlay({}, 1, 'nut-allergy');
    assert.ok(nutOverlay.includes('shopper-highlights-layer'));
    assert.ok(nutOverlay.includes('ALMONDS (INTENTIONAL)'));
    assert.ok(nutOverlay.includes('PECANS (INTENTIONAL)'));
    assert.ok(nutOverlay.includes('WALNUTS (INTENTIONAL)'));
    assert.ok(nutOverlay.includes('MAY CONTAIN (ADVISORY)'));

    const veganOverlay = renderShopperHighlightsOverlay({}, 1, 'vegan');
    assert.ok(veganOverlay.includes('SUITABLE FOR VEGANS (CLAIM)'));
    assert.ok(veganOverlay.includes('HONEY (ANIMAL PRODUCT)'));
    assert.ok(veganOverlay.includes('CHOLESTEROL 45MG (ANOMALY)'));

    const sugarOverlay = renderShopperHighlightsOverlay({}, 1, 'sugar-watcher');
    assert.ok(sugarOverlay.includes('NO ADDED SUGAR (CLAIM)'));
    assert.ok(sugarOverlay.includes('0G ADDED SUGARS (ROUNDED)'));
    assert.ok(sugarOverlay.includes('COCONUT SUGAR (ADDED SUGAR)'));
    assert.ok(sugarOverlay.includes('CANE SUGAR (IN GINGER)'));
  });

  await t.test('5. getPersonaArtworkHighlights returns structured coordinates', () => {
    const highlights = getPersonaArtworkHighlights({}, 1, 'nut-allergy');
    assert.equal(highlights.length, 4);
    for (const hl of highlights) {
      assert.ok(Array.isArray(hl.box) && hl.box.length === 4);
      assert.ok(hl.box[0] >= 0 && hl.box[2] <= 1);
      assert.ok(hl.box[1] >= 0 && hl.box[3] <= 1);
      assert.ok(hl.box[2] > hl.box[0], 'Width is positive');
      assert.ok(hl.box[3] > hl.box[1], 'Height is positive');
    }
  });

  await t.test('6. getPersona3DPins maps pins to confirmed package faces without inventing fake pins', () => {
    const reviewWithEvidence = {
      findings: [
        {
          id: 'DF-05',
          title: 'Vegan Claim vs Honey',
          status: 'issue',
          evidence: [
            {
              role: 'artwork',
              page: 1,
              box: [0.5, 0.4, 0.6, 0.45]
            }
          ]
        },
        {
          id: 'DF-99',
          title: 'Unlocated Finding Without Box',
          status: 'review',
          evidence: [
            { role: 'spec', name: 'Document.pdf' }
          ]
        }
      ]
    };

    const pins = getPersona3DPins(reviewWithEvidence, 'vegan');
    assert.equal(pins.length, 1, 'Only finding with confirmed artwork box is pinned');
    assert.equal(pins[0].findingId, 'DF-05');
    assert.equal(pins[0].page, 1);
    assert.ok(pins[0].faceName != null, 'Face name determined');
  });
});
