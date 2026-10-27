import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPT_CONFIGS,
  filterFindingsByDepartment,
  calculateDepartmentCounts,
  renderDepartmentFilterBar,
  renderDepartmentSummaryCard,
  renderDepartmentBadge
} from '../public/department-filters.js';
import {
  DEPARTMENTS,
  DEPARTMENT_LIST,
  getDepartment,
  normalizeDepartmentId,
  isValidDepartment
} from '../lib/finding-departments.mjs';

test('1. All four primary departments are properly defined with correct colors', () => {
  assert.equal(DEPT_CONFIGS.legal.color, '#DC4545');
  assert.equal(DEPT_CONFIGS.rd.color, '#3986E5');
  assert.equal(DEPT_CONFIGS.brand.color, '#9B59D0');
  assert.equal(DEPT_CONFIGS.prepress.color, '#249767');
  assert.equal(DEPT_CONFIGS.unassigned.color, '#64748B');

  assert.equal(DEPARTMENTS.LEGAL_REGULATORY.color, '#DC4545');
  assert.equal(DEPARTMENTS.RD_FORMULATION.color, '#3986E5');
  assert.equal(DEPARTMENTS.BRAND_MARKETING.color, '#9B59D0');
  assert.equal(DEPARTMENTS.PREPRESS_PRINT.color, '#249767');
});

test('2. Department lookup and normalization works for ID and key', () => {
  assert.equal(getDepartment('legal').id, 'legal');
  assert.equal(getDepartment('LEGAL_REGULATORY').id, 'legal');
  assert.equal(getDepartment('RD_FORMULATION').id, 'rd');
  assert.equal(normalizeDepartmentId('brand'), 'brand');
  assert.equal(normalizeDepartmentId('unknown'), 'unassigned');
  assert.equal(isValidDepartment('prepress'), true);
  assert.equal(isValidDepartment('invalid_dept'), false);
});

test('3. calculateDepartmentCounts accurately tallies findings by primary department', () => {
  const findings = [
    { id: 'f-1', primaryDepartment: 'legal', status: 'issue' },
    { id: 'f-2', primaryDepartment: 'legal', status: 'review' },
    { id: 'f-3', primaryDepartment: 'rd', status: 'match' },
    { id: 'f-4', primaryDepartment: 'brand', status: 'issue' },
    { id: 'f-5', primaryDepartment: 'prepress', status: 'unable' },
    { id: 'f-6', primaryDepartment: 'unassigned', status: 'review' }
  ];

  const { counts, statusBreakdown } = calculateDepartmentCounts(findings, false);

  assert.equal(counts.all, 6);
  assert.equal(counts.legal, 2);
  assert.equal(counts.rd, 1);
  assert.equal(counts.brand, 1);
  assert.equal(counts.prepress, 1);
  assert.equal(counts.unassigned, 1);

  assert.equal(statusBreakdown.legal.issue, 1);
  assert.equal(statusBreakdown.legal.review, 1);
  assert.equal(statusBreakdown.rd.match, 1);
  assert.equal(statusBreakdown.prepress.unable, 1);
});

test('4. Collaborating departments are included when includeCollaborators is enabled without duplicates', () => {
  const findings = [
    { id: 'f-1', primaryDepartment: 'legal', collaboratingDepartments: ['rd'], status: 'issue' },
    { id: 'f-2', primaryDepartment: 'brand', collaboratingDepartments: ['legal'], status: 'review' }
  ];

  // Primary only
  const legalPrimary = filterFindingsByDepartment(findings, 'legal', false);
  assert.equal(legalPrimary.length, 1);
  assert.equal(legalPrimary[0].id, 'f-1');

  // Including collaborators
  const legalWithCollabs = filterFindingsByDepartment(findings, 'legal', true);
  assert.equal(legalWithCollabs.length, 2);
  assert.deepEqual(legalWithCollabs.map(f => f.id), ['f-1', 'f-2']);

  // Check R&D has f-1 via collab
  const rdWithCollabs = filterFindingsByDepartment(findings, 'rd', true);
  assert.equal(rdWithCollabs.length, 1);
  assert.equal(rdWithCollabs[0].id, 'f-1');

  // Deduplication check: finding where legal is both primary and accidentally in collab list
  const findingWithDup = [
    { id: 'f-dup', primaryDepartment: 'legal', collaboratingDepartments: ['legal', 'rd'] }
  ];
  const deduplicated = filterFindingsByDepartment(findingWithDup, 'legal', true);
  assert.equal(deduplicated.length, 1);
});

test('5. Department filter composes with status filters cleanly', () => {
  const findings = [
    { id: 'f-1', primaryDepartment: 'legal', status: 'issue' },
    { id: 'f-2', primaryDepartment: 'legal', status: 'match' },
    { id: 'f-3', primaryDepartment: 'rd', status: 'issue' },
    { id: 'f-4', primaryDepartment: 'rd', status: 'review' }
  ];

  // Step 1: Filter by Legal
  const legalOnly = filterFindingsByDepartment(findings, 'legal', false);
  assert.equal(legalOnly.length, 2);

  // Step 2: Compose with status filter 'issue'
  const legalIssues = legalOnly.filter(f => f.status === 'issue');
  assert.equal(legalIssues.length, 1);
  assert.equal(legalIssues[0].id, 'f-1');

  // Verify original verdicts never changed
  assert.equal(findings[0].status, 'issue');
  assert.equal(findings[1].status, 'match');
  assert.equal(findings[2].status, 'issue');
  assert.equal(findings[3].status, 'review');
});

test('6. Filter bar renders accessible HTML with actual counts and aria attributes', () => {
  const review = {
    findings: [
      { id: 'f-1', primaryDepartment: 'legal' },
      { id: 'f-2', primaryDepartment: 'rd' }
    ]
  };

  const html = renderDepartmentFilterBar(review, 'legal', false);
  assert.ok(html.includes('data-dept-filter-bar'), 'Includes filter bar data attribute');
  assert.ok(html.includes('data-department="legal"'), 'Includes legal button');
  assert.ok(html.includes('aria-pressed="true"'), 'Legal button is pressed');
  assert.ok(html.includes('data-department="rd"'), 'Includes rd button');
  assert.ok(html.includes('data-action="toggle-collab-dept"'), 'Includes collaboration toggle');
});

test('7. Summary scorecard renders all 4 main departments with status metrics', () => {
  const review = {
    findings: [
      { id: 'f-1', primaryDepartment: 'legal', status: 'issue' },
      { id: 'f-2', primaryDepartment: 'legal', status: 'match' },
      { id: 'f-3', primaryDepartment: 'prepress', status: 'issue' }
    ]
  };

  const html = renderDepartmentSummaryCard(review);
  assert.ok(html.includes('Legal &amp; Regulatory'), 'Includes Legal title');
  assert.ok(html.includes('Prepress &amp; Print'), 'Includes Prepress title');
  assert.ok(html.includes('2 Findings'), 'Legal has 2 findings');
  assert.ok(html.includes('1 Findings'), 'Prepress has 1 finding');
});

test('8. Department badge renders primary and collaborating chips with re-route action', () => {
  const finding = {
    id: 'f-100',
    primaryDepartment: 'legal',
    collaboratingDepartments: ['rd', 'brand']
  };

  const htmlWithChange = renderDepartmentBadge(finding, { canChange: true });
  assert.ok(htmlWithChange.includes('LEGAL'), 'Displays primary badge');
  assert.ok(htmlWithChange.includes('+ R&amp;D'), 'Displays R&D collab badge');
  assert.ok(htmlWithChange.includes('+ Brand'), 'Displays Brand collab badge');
  assert.ok(htmlWithChange.includes('btn-change-department'), 'Includes re-route button when authorized');

  const htmlWithoutChange = renderDepartmentBadge(finding, { canChange: false });
  assert.ok(!htmlWithoutChange.includes('btn-change-department'), 'Hides re-route button when unauthorized');
});
