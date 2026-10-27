/**
 * PackSignal US Regulatory Preflight — Check US-002: Manufacturer / Business Address
 * Legal Basis: 21 CFR 101.5
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsBusinessAddressCheck } from '../../lib/regulatory/us/business-address.mjs';

test('US-002: Complete valid business info with street, city, state, and ZIP matches', () => {
  const res = executeUsBusinessAddressCheck({
    artworkText: 'Manufactured for Pacific Health Brands, 450 Market St, Suite 200, San Francisco, CA 94105',
    approvedBusinessName: 'Pacific Health Brands',
  });
  assert.equal(res.checkId, 'US-002');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /satisfy 21 CFR 101.5/i);
});

test('US-002: Permitted relationship qualifiers recognized (Distributed by, Manufactured for, etc.)', () => {
  const qualifiers = [
    'Distributed by Sun Foods LLC, 100 Sunrise Blvd, Austin, TX 78701',
    'Manufactured for Green Organics Inc., 22 River Rd, Portland, OR 97201',
    'Packed for Valley Harvest Co., 88 Orchard Lane, Yakima, WA 98901',
  ];
  for (const text of qualifiers) {
    const res = executeUsBusinessAddressCheck({ artworkText: text });
    assert.equal(res.findingStatus, 'match');
  }
});

test('US-002: Missing required city, state, or ZIP code on confirmed artwork flags statutory ISSUE', () => {
  const res = executeUsBusinessAddressCheck({
    artworkText: 'Distributed by Organic Foods Co., San Francisco',
    approvedBusinessName: 'Organic Foods Co.',
    coverageConfirmed: true,
  });
  assert.equal(res.checkId, 'US-002');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Statutory Violation under 21 CFR 101.5/i);
});

test('US-002: Missing street address routes to REVIEW under 21 CFR 101.5(d) directory exception', () => {
  const res = executeUsBusinessAddressCheck({
    artworkText: 'Distributed by Organic Foods Co., Boulder, CO 80301',
    approvedBusinessName: 'Organic Foods Co.',
  });
  assert.equal(res.checkId, 'US-002');
  assert.equal(res.findingStatus, 'review');
  assert.match(res.explanation, /Street address exception review.*21 CFR 101.5\(d\)/i);
});

test('US-002: Business name mismatch against approved source specification flags ISSUE', () => {
  const res = executeUsBusinessAddressCheck({
    artworkText: 'Distributed by Generic Food Corp, 123 Main St, Denver, CO 80202',
    approvedBusinessName: 'Artisan Valley Granola LLC',
  });
  assert.equal(res.checkId, 'US-002');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Manufacturer discrepancy under 21 CFR 101.5/i);
});

test('US-002: Unconfirmed artwork text without business details returns UNABLE', () => {
  const res = executeUsBusinessAddressCheck({
    artworkText: 'Just some front-panel brand copy with no address block',
    coverageConfirmed: false,
  });
  assert.equal(res.checkId, 'US-002');
  assert.equal(res.findingStatus, 'unable');
  assert.match(res.explanation, /Extraction coverage is unconfirmed/i);
});
