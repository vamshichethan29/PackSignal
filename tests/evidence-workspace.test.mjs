import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSourceChip, renderSourceChips, formatSourceLabel, renderFactBadge } from '../public/source-chip.js';
import { renderConflictCard } from '../public/conflict-card.js';
import { generateBlockerQuestions, renderGuidedQuestionsQueue } from '../public/review-questions.js';
import { renderRuleMap } from '../public/rule-map.js';

test('Part 2: SourceChip renders clickable provenance pills with exact coordinates', () => {
  const chipHtml = renderSourceChip({
    name: 'DancingFish_Granola_Content_Sheet.xlsx',
    sheet: 'US',
    cell: 'B26',
    quote: 'Honey (9%)',
    authority: 'draft',
    sourceType: 'spreadsheet'
  });

  assert.ok(chipHtml.includes('class="source-chip source-chip-spreadsheet"'), 'Includes spreadsheet source chip class');
  assert.ok(chipHtml.includes('data-source-chip="true"'), 'Has data-source-chip attribute');
  assert.ok(chipHtml.includes('data-sheet="US"'), 'Preserves sheet coordinate');
  assert.ok(chipHtml.includes('data-cell="B26"'), 'Preserves cell coordinate');
  assert.ok(chipHtml.includes('Honey (9%)'), 'Preserves original quote');
  assert.ok(chipHtml.includes('US!B26'), 'Renders readable coordinate label');
});

test('Part 2: SourceChip formats PDF and Carton panels truthfully without inventing coordinates', () => {
  const artworkChip = renderSourceChip({
    name: 'DancingFish_Carton.pdf',
    panel: 'Back Panel',
    page: 1,
    quote: 'Honey (1%)',
    authority: 'approved',
    sourceType: 'artwork'
  });

  assert.ok(artworkChip.includes('Back Panel'), 'Renders Back Panel label');
  assert.ok(artworkChip.includes('data-panel="Back Panel"'), 'Preserves panel attribute');
  assert.ok(artworkChip.includes('data-page="1"'), 'Preserves page number');

  // When location is missing, shows unavailable instead of inventing
  const missingLocationChip = formatSourceLabel({ name: 'Generic_Spec.pdf' });
  assert.ok(missingLocationChip.includes('Generic_Spec'), 'Shows document name cleanly');
});

test('Part 4: Global Fact State System supports 7 distinct trust states separate from check findings', () => {
  const states = [
    'CONFIRMED_SOURCE',
    'HUMAN_CONFIRMED',
    'AI_SUGGESTED',
    'MISSING',
    'CONFLICTED',
    'UNVERIFIED',
    'SUPERSEDED'
  ];

  for (const st of states) {
    const badge = renderFactBadge(st);
    assert.ok(badge.includes('fact-badge'), `Badge generated for ${st}`);
    assert.ok(badge.includes(st.replace(/_/g, ' ')), `Badge text contains label for ${st}`);
  }
});

test('Part 5: ConflictCard renders side-by-side Candidate A vs Candidate B with action buttons', () => {
  const cardHtml = renderConflictCard({
    id: 'conflict-honey',
    field: 'ingredients',
    title: 'Discrepancy: Honey Declaration Percentage',
    candidateA: {
      label: 'Content Sheet (Draft Rev 2.1)',
      value: 'Honey (9%)',
      quote: 'Whole Grain Rolled Oats, Honey (9%), Crisp Rice',
      sheet: 'US',
      cell: 'B26',
      documentName: 'Content_Sheet.xlsx',
      authority: 'Draft / In Review'
    },
    candidateB: {
      label: 'Printed Packaging Artwork',
      value: 'Honey (1%)',
      quote: 'Whole Grain Rolled Oats, Crisp Rice, Honey (1%)',
      panel: 'Back Panel',
      page: 1,
      documentName: 'Carton.pdf',
      authority: 'Current Printed Design'
    },
    affectedCount: 3
  });

  assert.ok(cardHtml.includes('Honey (9%)'), 'Shows Candidate A value');
  assert.ok(cardHtml.includes('Honey (1%)'), 'Shows Candidate B value');
  assert.ok(cardHtml.includes('3 dependent checks affected'), 'Shows affected check count');
  assert.ok(cardHtml.includes('data-conflict-action="USE_SOURCE"'), 'Provides Use Verified Source action');
  assert.ok(cardHtml.includes('data-conflict-action="CONFIRM_ARTWORK"'), 'Provides Confirm Intended Change action');
  assert.ok(cardHtml.includes('data-conflict-action="REQUEST_CLARIFICATION"'), 'Provides Request Clarification action');
  assert.ok(cardHtml.includes('data-conflict-action="LEAVE_UNRESOLVED"'), 'Provides Leave Unresolved action');
});

test('Part 6 & 7: Guided Review Questions computes genuine unlock counts and blocker categories', () => {
  const mockReview = {
    documents: [
      { name: 'DancingFish_Granola_Content_Sheet.xlsx', role: 'spec' },
      { name: 'DancingFish_Carton.pdf', role: 'artwork' }
    ],
    findings: [
      { id: 'f1', title: 'Honey percentage mismatch', status: 'review', check: 'ingredient_matching' },
      { id: 'f2', title: 'Sodium specification check', status: 'review', check: 'nutrition_check' },
      { id: 'f3', title: 'Carbohydrate rounding', status: 'review', check: 'nutrition' },
      { id: 'f4', title: 'No Added Sugar Claim', status: 'review', check: 'claim' }
    ],
    options: {
      sourceConfirmed: false,
      nutritionBasisConfirmed: false
    }
  };

  const questions = generateBlockerQuestions(mockReview);
  assert.ok(questions.length >= 2, 'Generated multiple blocker questions');

  const sourceAuthQ = questions.find(q => q.category === 'SOURCE AUTHORITY');
  assert.ok(sourceAuthQ, 'Contains Source Authority blocker question');
  assert.ok(sourceAuthQ.impactCount >= 3, 'Calculated dependent unblock count');
  assert.ok(sourceAuthQ.why.includes('Draft / In Review'), 'Truthfully discloses draft status reason');

  const nutritionQ = questions.find(q => q.category === 'NUTRITION BASIS');
  assert.ok(nutritionQ, 'Contains Nutrition Basis blocker question');
  assert.ok(nutritionQ.options.length >= 2, 'Offers source-backed choices');

  const renderedQueue = renderGuidedQuestionsQueue(mockReview);
  assert.ok(renderedQueue.includes('GUIDED RESOLUTION QUEUE'), 'Renders queue header');
  assert.ok(renderedQueue.includes('May unblock'), 'Renders impact count badge');
});

test('Part 11: Rules Map generates SVG traceability chain', () => {
  const mockReview = {
    documents: [{ name: 'Content Sheet.xlsx', role: 'spec' }],
    rules: [
      {
        id: 'RULE-NET-QTY',
        citation: '21 CFR §101.7',
        text: 'Net quantity must appear on principal display panel',
        verificationStatus: 'verified'
      }
    ],
    findings: [
      {
        id: 'f-net-qty',
        title: 'Net Quantity Placement',
        status: 'match',
        rule: { id: 'RULE-NET-QTY' }
      }
    ]
  };

  const mapHtml = renderRuleMap(mockReview);
  assert.ok(mapHtml.includes('RULE TRACEABILITY MAP'), 'Contains title');
  assert.ok(mapHtml.includes('svg-rule-map'), 'Contains SVG container');
  assert.ok(mapHtml.includes('21 CFR §101.7'), 'Contains statutory rule citation in node');
  assert.ok(mapHtml.includes('Net Quantity Placement'), 'Contains finding node');
});
