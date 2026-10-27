/**
 * Tests for lib/regulatory/applicability.mjs
 * Evaluates product profiles, exemptions, and statutory effective dates.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductProfile,
  evaluateRuleApplicability,
} from '../../lib/regulatory/applicability.mjs';

test('1. Product profile extracts package dimensions, allergens, and net quantity', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Organic Dark Chocolate 100g (3.5 oz). Contains milk, soy. May contain peanuts. 2000 kcal diet.',
        pages: [{ number: 1, text: 'Sample' }],
      },
    ],
    facts: [
      { field: 'net_quantity', value: '100g' },
      { field: 'allergens', value: 'Milk, Soy' },
    ],
  };

  const profile = buildProductProfile(review, '2026-10-23');
  assert.equal(profile.isFood, true);
  assert.equal(profile.effectiveDate, '2026-10-23');
  assert.ok(profile.knownAllergens.includes('milk'));
});

test('2. Small package exemption: US FDA surface area < 12 sq inches', () => {
  const smallProfile = {
    isFood: true,
    effectiveDate: '2026-10-23',
    packageAreaSqInches: 10,
    exemptions: ['small_package'],
  };

  const rule = {
    id: 'FDA-21CFR-101.9-PANEL',
    jurisdiction: 'us',
    effectiveDate: '2016-07-26',
    exceptions: ['small_package_surface_under_12_sq_in'],
  };

  const app = evaluateRuleApplicability(rule, smallProfile);
  assert.equal(app.applicability, 'not_applicable');
  assert.equal(app.exempt, true);
  assert.match(app.reason, /small package.*exemption/i);
});

test('3. Effective date handling: FSSAI First Amendment 2026 commencing July 1, 2027', () => {
  const rule = {
    id: 'FSSAI-2026-FOPNL',
    jurisdiction: 'india',
    effectiveDate: '2027-07-01',
    legalStatus: 'enacted_not_yet_applicable',
  };

  // Evaluated in October 2026: MUST be future_requirement, NOT an active violation!
  const oct2026Profile = {
    isFood: true,
    effectiveDate: '2026-10-23',
  };
  const appOct2026 = evaluateRuleApplicability(rule, oct2026Profile);
  assert.equal(appOct2026.applicability, 'future_requirement');
  assert.equal(appOct2026.applicable, false);
  assert.match(appOct2026.reason, /commencement date is 2027-07-01/i);

  // Evaluated in July 2027: NOW it is applicable!
  const jul2027Profile = {
    isFood: true,
    effectiveDate: '2027-07-01',
  };
  const appJul2027 = evaluateRuleApplicability(rule, jul2027Profile);
  assert.equal(appJul2027.applicability, 'applicable');
  assert.equal(appJul2027.applicable, true);
});
