import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';
import {
  evaluateNetQuantity,
  evaluateManufacturerAddress
} from '../lib/claims/added-sugar-screen.mjs';

test('DF-14: Net quantity placement and dual-unit metrology requirements are evaluated', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const netQty = suite.checks.find(c => c.canonicalId === 'DF-14');
  assert.ok(netQty);
  assert.equal(netQty.status, 'issue');
  assert.equal(netQty.sourceCell, 'B35');
  assert.equal(netQty.artworkPanel, 'Back');
  assert.equal(netQty.observedValue, '480g on Back panel only');
  assert.match(netQty.expectedValue, /16\.9 OZ/i);
  assert.match(netQty.expectedValue, /Front PDP/i);
  assert.match(netQty.calculationProof, /15 U\.S\.C\. 1453/);

  // Pure evaluator
  const evalRes = evaluateNetQuantity('480g', 'Back');
  assert.equal(evalRes.status, 'issue');
  assert.equal(evalRes.findingStatus, 'NET_QUANTITY_FORMAT_DEFECT');
  assert.equal(evalRes.customaryMissing, true);
  assert.equal(evalRes.pdpMissing, true);
});

test('DF-15: Manufacturer business address inspects city, state, ZIP and accounts for street address exception', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const makerCheck = suite.checks.find(c => c.canonicalId === 'DF-15');
  assert.ok(makerCheck);
  assert.equal(makerCheck.status, 'issue');
  assert.equal(makerCheck.observedValue, 'PRODUCED BY DANCING FISH GRANOLA CO.');
  assert.match(makerCheck.limitations, /Street address can be omitted if listed in public directory/i);
  assert.match(makerCheck.limitations, /city, state, and ZIP are mandatory/i);

  // Pure evaluator
  const evalRes = evaluateManufacturerAddress('PRODUCED BY DANCING FISH GRANOLA CO.');
  assert.equal(evalRes.status, 'issue');
  assert.equal(evalRes.findingStatus, 'MANUFACTURER_ADDRESS_INCOMPLETE');
  assert.equal(evalRes.hasCity, false);
  assert.equal(evalRes.hasState, false);
  assert.equal(evalRes.hasZip, false);
});
