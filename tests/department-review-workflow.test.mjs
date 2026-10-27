import test from 'node:test';
import assert from 'node:assert/strict';
import { addStickyNote, updateStickyNoteStatus, addStickyNoteReply } from '../lib/team-review.mjs';
import { filterFindingsByDepartment, calculateDepartmentCounts } from '../public/department-filters.js';
import { suggestDepartment, generateClarificationMessage } from '../public/clarification-message.js';
import { createHtmlReport } from '../lib/html-report.mjs';
import { sealReview, verifyReviewSeal } from '../lib/audit-signature.mjs';

function createMockReview() {
  return {
    id: 'rev-dept-workflow-01',
    packName: 'Golden Fields Cereal Carton',
    version: 1,
    revision: { version: 1, label: 'Revision 1 Initial Proof' },
    findings: [
      {
        id: 'f-legal-allergen',
        title: 'Undeclared Soy Lecithin in bold format',
        status: 'issue',
        primaryDepartment: 'legal',
        collaboratingDepartments: ['rd'],
        evidence: [
          { role: 'artwork', page: 1, box: [0.1, 0.2, 0.3, 0.4] }
        ]
      },
      {
        id: 'f-rd-sugar',
        title: 'Total Sugars claim exceeds recipe calculation',
        status: 'issue',
        primaryDepartment: 'rd',
        collaboratingDepartments: []
      },
      {
        id: 'f-brand-logo',
        title: 'Primary logo font does not meet brand guideline v4',
        status: 'review',
        primaryDepartment: 'brand'
      },
      {
        id: 'f-prepress-ink',
        title: 'Total Area Coverage exceeds 300% press limit',
        status: 'issue',
        primaryDepartment: 'prepress'
      }
    ],
    team: {
      createdBy: 'usr-lead-1',
      reviewers: [
        { id: 'usr-lead-1', displayName: 'Elena Vance', role: 'legal_lead' },
        { id: 'usr-rd-1', displayName: 'Gordon Freeman', role: 'food_scientist' },
        { id: 'usr-brand-1', displayName: 'Alyx Vance', role: 'brand_director' }
      ],
      assignments: {
        'f-legal-allergen': { reviewerIds: ['usr-lead-1'] },
        'f-rd-sugar': { reviewerIds: ['usr-rd-1'] },
        'f-brand-logo': { reviewerIds: ['usr-brand-1'] }
      },
      stickyNotes: [],
      comments: [],
      approvals: [],
      decisions: {},
      audit: []
    }
  };
}

test('1. Sticky notes survive revision creation without loss of data or author attribution', () => {
  const previous = createMockReview();
  const actor = { id: 'usr-rd-1', displayName: 'Gordon Freeman', role: 'food_scientist' };

  const note = addStickyNote(
    previous,
    previous.findings[1],
    actor,
    {
      departmentId: 'rd',
      noteText: 'Please verify 12g sugars against Certificate of Analysis batch 409.',
      noteStatus: 'ACTION_REQUESTED'
    }
  );

  addStickyNoteReply(
    previous,
    note.id,
    'COA uploaded in SharePoint folder for review.',
    { id: 'usr-lead-1', displayName: 'Elena Vance', role: 'legal_lead' }
  );

  // Simulate server.mjs revision snapshot logic
  const nextRevision = {
    id: 'rev-dept-workflow-02',
    packName: previous.packName,
    version: 2,
    revision: { version: 2, label: 'Revision 2 Revised Proof' },
    findings: structuredClone(previous.findings),
    team: {
      createdBy: previous.team.createdBy,
      reviewers: structuredClone(previous.team.reviewers),
      assignments: structuredClone(previous.team.assignments),
      stickyNotes: structuredClone(previous.team?.stickyNotes || []),
      comments: structuredClone(previous.team?.comments || []),
      approvals: structuredClone(previous.team?.approvals || []),
      decisions: structuredClone(previous.team?.decisions || {}),
      audit: structuredClone(previous.team?.audit || [])
    }
  };

  assert.equal(nextRevision.team.stickyNotes.length, 1);
  const preservedNote = nextRevision.team.stickyNotes[0];
  assert.equal(preservedNote.id, note.id);
  assert.equal(preservedNote.authorDisplayName, 'Gordon Freeman');
  assert.equal(preservedNote.departmentId, 'rd');
  assert.equal(preservedNote.replies.length, 1);
  assert.equal(preservedNote.replies[0].authorDisplayName, 'Elena Vance');
  assert.equal(preservedNote.replies[0].text, 'COA uploaded in SharePoint folder for review.');
});

test('2. HTML report export renders Department Review Summary and department note records', async () => {
  const review = createMockReview();
  const actorRD = { id: 'usr-rd-1', displayName: 'Gordon Freeman', role: 'food_scientist' };
  const actorLegal = { id: 'usr-lead-1', displayName: 'Elena Vance', role: 'legal_lead' };

  addStickyNote(
    review,
    review.findings[1],
    actorRD,
    {
      departmentId: 'rd',
      noteText: 'Formula discrepancy: Sugar content is 14g on spec.',
      noteStatus: 'OPEN'
    }
  );

  const closedNote = addStickyNote(
    review,
    review.findings[0],
    actorLegal,
    {
      departmentId: 'legal',
      noteText: 'Resolved: Soy Lecithin allergy advisory added to panel 2.',
      noteStatus: 'OPEN'
    }
  );

  updateStickyNoteStatus(review, closedNote.id, 'CLOSED', actorLegal);

  const html = await createHtmlReport(review, null);

  // Check section header
  assert.ok(html.includes('Department Review Summary'), 'Report must include Department Review Summary section');
  assert.ok(html.includes('Legal &amp; Regulatory') || html.includes('Legal & Regulatory'), 'Report includes Legal & Regulatory department');
  assert.ok(html.includes('R&amp;D &amp; Food Science') || html.includes('R&D & Food Science'), 'Report includes R&D department');
  assert.ok(html.includes('Brand &amp; Marketing') || html.includes('Brand & Marketing'), 'Report includes Brand department');
  assert.ok(html.includes('Prepress &amp; Print') || html.includes('Prepress & Print'), 'Report includes Prepress department');

  // Check note entries rendered
  assert.ok(html.includes('Formula discrepancy: Sugar content is 14g on spec'), 'Report contains R&D note text');
  assert.ok(html.includes('Resolved: Soy Lecithin allergy advisory added'), 'Report contains Legal note text');
  assert.ok(html.includes('Elena Vance'), 'Report contains Legal reviewer attribution');
  assert.ok(html.includes('Gordon Freeman'), 'Report contains R&D reviewer attribution');
});

test('3. Ask Someone clarifies and suggests the responsible primary department automatically', () => {
  const review = createMockReview();

  // Legal finding
  const legalFinding = review.findings.find(f => f.primaryDepartment === 'legal');
  const legalDept = suggestDepartment(legalFinding);
  assert.equal(legalDept, 'Regulatory / Legal', 'Legal finding automatically routes to Regulatory / Legal');
  const legalMsg = generateClarificationMessage({ finding: legalFinding, review, department: legalDept, platform: 'slack' });
  assert.equal(typeof legalMsg, 'string');
  assert.ok(legalMsg.includes('Packaging Clarification') && legalMsg.includes(legalFinding.title));

  // R&D finding
  const rdFinding = review.findings.find(f => f.primaryDepartment === 'rd');
  const rdDept = suggestDepartment(rdFinding);
  assert.equal(rdDept, 'R&D / Product Development', 'R&D finding automatically routes to R&D / Product Development');
  const rdMsg = generateClarificationMessage({ finding: rdFinding, review, department: rdDept, platform: 'slack' });
  assert.equal(typeof rdMsg, 'string');
  assert.ok(rdMsg.includes('Packaging Clarification') && rdMsg.includes(rdFinding.title));

  // Prepress finding
  const prepressFinding = review.findings.find(f => f.primaryDepartment === 'prepress');
  const prepressDept = suggestDepartment(prepressFinding);
  assert.equal(prepressDept, 'Prepress / Production', 'Prepress finding automatically routes to Prepress / Production');
  const prepressMsg = generateClarificationMessage({ finding: prepressFinding, review, department: prepressDept, platform: 'slack' });
  assert.equal(typeof prepressMsg, 'string');
  assert.ok(prepressMsg.includes('Packaging Clarification') && prepressMsg.includes(prepressFinding.title));
});

test('4. Keyboard Quick Triage respects active department filter queue', () => {
  const review = createMockReview();

  // Filter queue for Legal only
  const legalQueue = filterFindingsByDepartment(review.findings, 'legal', false);
  assert.equal(legalQueue.length, 1);
  assert.equal(legalQueue[0].id, 'f-legal-allergen');

  // Next finding in Legal queue wraps or stops at end
  let currentIndex = 0;
  const nextIndex = (currentIndex + 1) % legalQueue.length;
  assert.equal(legalQueue[nextIndex].id, 'f-legal-allergen', 'Single item queue remains within filtered department');

  // Filter queue for R&D
  const rdQueue = filterFindingsByDepartment(review.findings, 'rd', false);
  assert.equal(rdQueue.length, 1);
  assert.equal(rdQueue[0].id, 'f-rd-sugar');

  // When collaborating departments enabled:
  // f-legal-allergen has collaboratingDepartments: ['rd']
  const rdWithCollab = filterFindingsByDepartment(review.findings, 'rd', true);
  assert.equal(rdWithCollab.length, 2);
  assert.ok(rdWithCollab.some(f => f.id === 'f-rd-sugar'));
  assert.ok(rdWithCollab.some(f => f.id === 'f-legal-allergen'));
});

test('5. Cryptographic seal remains verifiable and resilient with department review entries', async () => {
  const review = createMockReview();
  const actor = { id: 'usr-lead-1', displayName: 'Elena Vance', role: 'legal_lead' };

  addStickyNote(
    review,
    review.findings[0],
    actor,
    {
      departmentId: 'legal',
      noteText: 'Verified allergen statement conformity under FALCPA.'
    }
  );

  // Seal review
  const seal = await sealReview(review, './data');
  assert.ok(seal.signature, 'Review produces cryptographic seal');
  review.signature = seal;

  // Verify seal
  const verification = await verifyReviewSeal(review, './data');
  assert.equal(verification.valid, true, 'Cryptographic digest verified successfully');
});
