import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskSession } from '../lib/evidence-desk.mjs';

describe('Phase 4 — Fact Sheet Workflow', () => {
  it('renders verified canonical fields from official Esko sources', () => {
    const session = getDeskSession('fact-sheet-test-session');
    const facts = session.facts;

    const prodName = facts.find(f => f.field === 'product_name');
    assert.ok(prodName);
    assert.equal(prodName.state, 'PROVEN');
    assert.equal(prodName.value, 'Dancing Fish Berry Crunch Granola');
    assert.ok(prodName.sources.length >= 2);

    const netQty = facts.find(f => f.field === 'net_quantity');
    assert.ok(netQty);
    assert.equal(netQty.state, 'PROVEN');
    assert.equal(netQty.value, '480 g (16.9 oz)');

    const barcode = facts.find(f => f.field === 'barcode' || f.field === 'barcode_upc');
    assert.ok(barcode);
    assert.equal(barcode.state, 'PROVEN');
    assert.ok(barcode.value.includes('1 20000 00003 6'));
  });

  it('correctly tags conflicted facts with conflict reason and source references', () => {
    const session = getDeskSession('fact-sheet-test-session');
    const honeyFact = facts(session).find(f => f.field === 'honey_percentage');

    assert.ok(honeyFact);
    assert.equal(honeyFact.state, 'CONFLICT');
    assert.equal(honeyFact.conflictId, 'CONFLICT-HONEY-CONTENT');
    assert.ok(honeyFact.conflictReason.includes('9%'));
    assert.ok(honeyFact.sources.some(s => s.quote.includes('9%')));
    assert.ok(honeyFact.sources.some(s => s.quote.includes('1%')));
  });

  it('correctly tags AI suggested facts from unconfirmed notes and vision marks', () => {
    const session = getDeskSession('fact-sheet-test-session');
    const aiFacts = facts(session).filter(f => f.state === 'AI_SUGGESTED');

    assert.ok(aiFacts.length >= 2);
    const calFact = aiFacts.find(f => f.field === 'calories');
    assert.ok(calFact);
    assert.equal(calFact.state, 'AI_SUGGESTED');
  });

  function facts(s) {
    return s.facts;
  }
});
