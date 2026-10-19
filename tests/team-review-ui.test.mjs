import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { teamReviewView } from '../public/team-review.js';

const review = {
  team: {
    createdBy: 'owner',
    assignments: { finding: { reviewerIds: ['reviewer1'] } },
    comments: [{ findingId: 'finding', authorId: 'reviewer1', authorName: '<reviewer>', comment: '<unsafe>', at: '2026-10-19T00:00:00.000Z', evidence: { role: 'artwork', name: 'label.pdf', location: 'Page 1', quote: '<750 g>' } }],
    approvals: [{ findingId: 'finding', reviewerId: 'reviewer1', reviewerName: '<reviewer>', outcome: 'approved', note: 'Checked source.', at: '2026-10-19T00:00:00.000Z' }],
  },
  teamAccess: { canAssign: true },
};
const finding = { id: 'finding', title: 'Quantity', evidence: [{ role: 'artwork', name: 'label.pdf', location: 'Page 1', quote: '750 g' }] };
const appStatus = { team: { enabled: true, currentUser: { id: 'owner', displayName: 'Owner', role: 'admin' }, members: [{ id: 'reviewer1', displayName: 'Reviewer One', role: 'reviewer' }] } };

test('team review UI includes assignment, evidence comment, and independent sign-off controls', () => {
  const html = teamReviewView(review, finding, appStatus);
  assert.match(html, /data-team-form="assignments"/);
  assert.match(html, /data-team-form="comments"/);
  assert.match(html, /data-team-form="approvals"/);
  assert.match(html, /Reviewer One/);
  assert.match(html, /&lt;750 g&gt;/, 'Evidence quotes must be safely escaped before rendering.');
  assert.doesNotMatch(html, /<blockquote><750 g><\/blockquote>/);
  assert.match(html, /&lt;unsafe&gt;/);
  assert.match(html, /not legal or print-release approval/);
});

test('unconfigured workspaces use calm team-review copy without access warnings', () => {
  const html = teamReviewView(review, finding, { team: { enabled: false }, security: { hosted: true, authenticated: false } });
  assert.match(html, /Named reviewer accounts enable individual assignments/);
  assert.doesNotMatch(html, /currently off|shared demo credentials|hosted login gate|Do not upload confidential/);
});

test('hosted access details are kept in Settings instead of the home dashboard', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dashboard = app.slice(app.indexOf('function dashboard()'), app.indexOf('function rememberReviewSummary'));
  const settings = app.slice(app.indexOf('async function settings()'), app.indexOf('function settingsReviewDiagnostics()'));
  assert.doesNotMatch(dashboard, /securityNotice|workspace is open|confidential packaging files/);
  assert.match(settings, /workspaceAccessSettings\(\)/);
  assert.match(app, /This hosted workspace is open to anyone with its link/);
  assert.match(app, /Use public or fictional packaging files until access is protected/);
});

test('the team review module is registered as a served application asset', async () => {
  const routes = await readFile(new URL('../lib/public-files.mjs', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(routes, /\['\/team-review\.js','team-review\.js'\]/);
  assert.match(app, /from "\.\/team-review\.js"/);
});
