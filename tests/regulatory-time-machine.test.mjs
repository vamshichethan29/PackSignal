/**
 * @file regulatory-time-machine.test.mjs
 * 
 * PackSignal — Full Time Machine Integration Tests
 * Tests review options persistence, report generation with regulatory snapshot,
 * and decision invalidation selectivity.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTimeMachine } from '../lib/time-machine.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';
import { evaluateRulesAtDate } from '../lib/regulatory/temporal-rules.mjs';

test('1. evaluateTimeMachine returns structured timeline markers and snapshot', () => {
  const tm = evaluateTimeMachine({
    market: 'IN',
    launchDate: '2027-07-01',
    productCategory: 'food'
  });

  assert.equal(tm.market, 'IN');
  assert.equal(tm.launchDate, '2027-07-01');
  assert.equal(tm.isJuly2027OrLater, true);
  assert.ok(tm.snapshotId.startsWith('reg-snap-'));
  assert.ok(tm.timelineMarkers.length >= 3);
  assert.ok(tm.temporalEvaluation);
  assert.ok(tm.temporalEvaluation.categorized.confirmedFutureRequirements.length >= 1);
});

test('2. HTML Report includes Regulatory Time Machine section and disclaimer', async () => {
  const mockReview = {
    id: 'test-review-time-machine',
    name: 'Dancing Fish Granola 480g',
    market: 'india',
    options: {
      marketPreset: 'india',
      launchDate: '2027-07-01',
      productCategory: 'food'
    },
    findings: [],
    documents: [],
    counts: { issue: 0, review: 1, unable: 0, match: 5 }
  };

  const html = await createHtmlReport(mockReview, '/tmp');

  assert.ok(html.includes('Regulatory Time Machine — Date-Aware Packaging Intelligence'), 'Report must contain Time Machine section');
  assert.ok(html.includes('2027-07-01'), 'Must state planned launch date');
  assert.ok(html.includes('reg-snap-'), 'Must display regulatory audit snapshot ID');
  assert.ok(html.includes('This review evaluates supported requirements from the identified rule-data snapshot'), 'Must include statutory disclaimer');
  assert.ok(html.includes('FSSAI 2026 First Amendment'), 'Must list July 2027 newly applicable amendment');
});

test('3. Selective decision staleness: decisions for unchanged rules remain fresh', () => {
  const prevDate = '2026-10-25';
  const newDate = '2027-07-01';

  const evalPrev = evaluateRulesAtDate({ launchDate: prevDate, market: 'india', productCategory: 'food' });
  const evalNew = evaluateRulesAtDate({ launchDate: newDate, market: 'india', productCategory: 'food' });

  const activePrevIds = new Set(evalPrev.categorized.applicableNow.map(r => r.ruleId || r.id));
  const activeNewIds = new Set(evalNew.categorized.applicableNow.map(r => r.ruleId || r.id));

  // Name on PDP was active in both 2026 and 2027
  assert.equal(activePrevIds.has('FSSAI-LDR-2020-NAME-PDP'), true);
  assert.equal(activeNewIds.has('FSSAI-LDR-2020-NAME-PDP'), true);

  // Bold RDA amendment was NOT active in 2026, became active on 2027-07-01
  assert.equal(activePrevIds.has('FSSAI-LDR-2026-AMEND-BOLD-RDA'), false);
  assert.equal(activeNewIds.has('FSSAI-LDR-2026-AMEND-BOLD-RDA'), true);
});
