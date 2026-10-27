import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEPARTMENTS,
  suggestDepartment,
  generateClarificationMessage
} from '../lib/clarification-message.mjs';

test('1. Ask Someone modal structure contains required header, controls, and editor', () => {
  const finding = {
    id: 'f-honey-mismatch',
    title: 'Honey ingredient percentage discrepancy',
    status: 'review',
    observed: 'Honey (1.5%)',
    expected: 'Honey (2%)',
    rule: { field: 'ingredients' },
  };

  const autoDept = suggestDepartment(finding);
  assert.equal(autoDept, 'R&D / Product Development');

  const message = generateClarificationMessage({
    finding,
    product: 'Berry Crunch Granola',
    department: autoDept,
    platform: 'slack',
  });

  assert.ok(message.includes('Berry Crunch Granola'));
  assert.ok(message.includes('f-honey-mismatch'));
});

test('2. Platform switching produces distinct format conventions', () => {
  const finding = {
    id: 'f-claim-organic',
    title: 'Unsubstantiated 100% Organic claim',
    status: 'issue',
    observed: '100% Organic',
    expected: 'Organic (95% certified)',
    rule: { field: 'claims' },
  };

  // Slack format: single asterisks
  const slackMsg = generateClarificationMessage({
    finding,
    product: 'Granola Bar',
    platform: 'slack',
  });
  assert.ok(slackMsg.includes('*Issue:*'));

  // Teams format: double asterisks
  const teamsMsg = generateClarificationMessage({
    finding,
    product: 'Granola Bar',
    platform: 'teams',
  });
  assert.ok(teamsMsg.includes('**Issue:**'));

  // Email format: Subject and To lines
  const emailMsg = generateClarificationMessage({
    finding,
    product: 'Granola Bar',
    platform: 'email',
  });
  assert.ok(emailMsg.includes('Subject: Packaging Clarification'));
  assert.ok(emailMsg.includes('To:'));
});

test('3. Copy message preserves user edits without altering finding state', () => {
  const finding = {
    id: 'f-copy-test',
    title: 'Storage statement difference',
    status: 'review',
    observed: 'Refrigerate after opening',
    expected: 'Keep refrigerated',
  };

  const originalMsg = generateClarificationMessage({ finding, platform: 'plain' });
  const editedMsg = originalMsg + '\n\nPriority: High. Please verify by EOD.';

  assert.ok(editedMsg.includes('Priority: High'));
  assert.equal(finding.status, 'review', 'Generating or copying must not alter finding status');
});

test('4. Security: File system paths and script tags are sanitized from messages', () => {
  const finding = {
    id: 'f-security-1',
    title: 'Label warning check',
    observed: 'Contains peanuts <script>alert(1)</script>',
    expected: 'May contain tree nuts',
    evidence: [
      { role: 'spec', name: '/Users/admin/SecretProjects/ConfidentialSpec.xlsx', location: 'Row 4' },
      { role: 'artwork', name: '/var/data/artwork_v1.pdf', quote: 'Peanuts' },
    ],
  };

  const message = generateClarificationMessage({ finding, platform: 'plain' });

  // Assert local filesystem paths are stripped down to basename
  assert.ok(!message.includes('/Users/admin/SecretProjects/'));
  assert.ok(!message.includes('/var/data/'));
  assert.ok(message.includes('ConfidentialSpec.xlsx'));
  assert.ok(message.includes('artwork_v1.pdf'));
});
