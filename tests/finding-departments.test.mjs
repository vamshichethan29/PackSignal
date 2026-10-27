import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEPARTMENTS,
  DEPARTMENT_LIST,
  getDepartment,
  normalizeDepartmentId,
  isValidDepartment,
  classifyFindingDepartment
} from '../lib/finding-departments.mjs';

test('1. Department registry contains all 4 enterprise departments + unassigned', () => {
  assert.equal(DEPARTMENT_LIST.length, 5);
  const ids = DEPARTMENT_LIST.map(d => d.id);
  assert.ok(ids.includes('legal'));
  assert.ok(ids.includes('rd'));
  assert.ok(ids.includes('brand'));
  assert.ok(ids.includes('prepress'));
  assert.ok(ids.includes('unassigned'));
});

test('2. Department colors match the required enterprise palette', () => {
  assert.equal(DEPARTMENTS.LEGAL_REGULATORY.color, '#DC4545');
  assert.equal(DEPARTMENTS.RD_FORMULATION.color, '#3986E5');
  assert.equal(DEPARTMENTS.BRAND_MARKETING.color, '#9B59D0');
  assert.equal(DEPARTMENTS.PREPRESS_PRINT.color, '#249767');
  assert.equal(DEPARTMENTS.UNASSIGNED.color, '#64748B');
});

test('3. Ingredients and recipe specs classify as R&D', () => {
  const finding = {
    id: 'f-ing-1',
    rule: { field: 'ingredients' },
    title: 'Oat concentration discrepancy',
    explanation: 'Declared percentage is 10% vs specification 12%',
    status: 'issue'
  };

  const dept = classifyFindingDepartment(finding);
  assert.equal(dept.primaryDepartment, 'rd');
  assert.equal(finding.status, 'issue', 'Classification must never alter engine verdict');
});

test('4. Nutrition and Atwater calculations classify as R&D', () => {
  const finding = {
    id: 'f-nutr-1',
    category: 'nutrition',
    title: 'Calorie count does not match 4-4-9 Atwater estimate',
    status: 'review'
  };

  const dept = classifyFindingDepartment(finding);
  assert.equal(dept.primaryDepartment, 'rd');
  assert.equal(finding.status, 'review');
});

test('5. Statutory label declarations and regulatory claims classify as Legal & Regulatory', () => {
  const finding = {
    id: 'f-legal-1',
    category: 'claims',
    title: 'Organic USDA certification seal placement requirement',
    status: 'issue'
  };

  const dept = classifyFindingDepartment(finding);
  assert.equal(dept.primaryDepartment, 'legal');
});

test('6. Preflight, bleed, barcode, and typography classify as Prepress & Print', () => {
  const bleedFinding = {
    id: 'f-prep-1',
    category: 'prepress',
    title: 'Bleed margin shortfall on trim edge',
    status: 'issue'
  };

  const typoFinding = {
    id: 'f-prep-2',
    category: 'typography',
    title: 'Statutory net quantity type size below minimum',
    status: 'issue'
  };

  assert.equal(classifyFindingDepartment(bleedFinding).primaryDepartment, 'prepress');
  assert.equal(classifyFindingDepartment(typoFinding).primaryDepartment, 'prepress');
  assert.ok(classifyFindingDepartment(typoFinding).collaboratingDepartments.includes('legal'));
});

test('7. Cross-functional findings assign collaborating departments without duplicates', () => {
  const netQtyFinding = {
    id: 'f-net-qty',
    title: 'Net Quantity type size shortfall',
    category: 'typography',
    field: 'net_quantity',
    collaboratingDepartments: ['legal']
  };

  const res = classifyFindingDepartment(netQtyFinding);
  assert.equal(res.primaryDepartment, 'prepress');
  assert.ok(res.collaboratingDepartments.includes('legal'));
  // Ensure no duplicate IDs in collaborating departments
  const uniqueCollabs = new Set(res.collaboratingDepartments);
  assert.equal(uniqueCollabs.size, res.collaboratingDepartments.length);
});

test('8. Reviewer department override is respected and preserved', () => {
  const finding = {
    id: 'f-override',
    rule: { field: 'ingredients' },
    primaryDepartment: 'brand',
    reviewerDepartmentOverride: true,
    status: 'review'
  };

  const res = classifyFindingDepartment(finding);
  assert.equal(res.primaryDepartment, 'brand');
});
