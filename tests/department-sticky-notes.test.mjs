import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addStickyNote,
  updateStickyNoteStatus,
  addStickyNoteReply,
  findStickyNotesForFinding
} from '../lib/team-review.mjs';
import {
  DEPT_CONFIGS,
  NOTE_STATUSES,
  renderFindingStickyNotes,
  renderArtworkStickyNoteMarkers
} from '../public/department-sticky-notes.js';

function createMockReview() {
  return {
    id: 'rev-test-101',
    findings: [
      {
        id: 'f-legal-allergen',
        title: 'Undeclared Milk Allergen In Bold',
        status: 'issue',
        primaryDepartment: 'legal',
        collaboratingDepartments: ['rd'],
        evidence: [
          {
            page: 1,
            box: [100, 150, 300, 210]
          }
        ]
      },
      {
        id: 'f-rd-formulation',
        title: 'Ingredient percentage total does not sum to 100%',
        status: 'issue',
        primaryDepartment: 'rd',
        collaboratingDepartments: []
      },
      {
        id: 'f-brand-logo',
        title: 'Brand Logo clearspace violation',
        status: 'review',
        primaryDepartment: 'brand'
      },
      {
        id: 'f-prepress-bleed',
        title: 'Trim edge distance under minimum 3mm',
        status: 'issue',
        primaryDepartment: 'prepress'
      }
    ],
    team: {
      createdBy: 'usr-admin-1',
      reviewers: [
        { id: 'usr-legal-1', displayName: 'Rachel Zane', role: 'legal_lead' },
        { id: 'usr-rd-1', displayName: 'Dr. Bruce Banner', role: 'food_scientist' },
        { id: 'usr-brand-1', displayName: 'Don Draper', role: 'brand_director' },
        { id: 'usr-viewer-1', displayName: 'Guest Observer', role: 'viewer' }
      ],
      assignments: {
        'f-legal-allergen': { reviewerIds: ['usr-legal-1', 'usr-rd-1'] },
        'f-rd-formulation': { reviewerIds: ['usr-rd-1'] },
        'f-brand-logo': { reviewerIds: ['usr-brand-1'] }
      },
      stickyNotes: [],
      comments: [],
      approvals: [],
      audit: []
    }
  };
}

test('1. Department color definitions match exact brand specifications', () => {
  assert.equal(DEPT_CONFIGS.legal.color, '#DC4545', 'Legal must be #DC4545 (Red)');
  assert.equal(DEPT_CONFIGS.rd.color, '#3986E5', 'R&D must be #3986E5 (Blue)');
  assert.equal(DEPT_CONFIGS.brand.color, '#9B59D0', 'Brand must be #9B59D0 (Purple)');
  assert.equal(DEPT_CONFIGS.prepress.color, '#249767', 'Prepress must be #249767 (Green)');
  assert.equal(DEPT_CONFIGS.unassigned.color, '#64748B', 'Unassigned must be #64748B (Slate)');
});

test('2. Add sticky note attached to a finding with evidence linkage and author identity', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-rd-formulation');
  const actor = { id: 'usr-rd-1', displayName: 'Dr. Bruce Banner', role: 'food_scientist' };

  const note = addStickyNote(
    review,
    finding,
    actor,
    {
      departmentId: 'rd',
      noteText: 'Formulation recipe shows 98.4% total. Missing 1.6% excipient.',
      artworkLocation: [50, 80, 170, 120],
      noteStatus: 'ACTION_REQUESTED'
    }
  );

  assert.ok(note.id, 'Generated note has an id');
  assert.equal(note.findingId, 'f-rd-formulation');
  assert.equal(note.departmentId, 'rd');
  assert.equal(note.authorId, 'usr-rd-1');
  assert.equal(note.authorDisplayName, 'Dr. Bruce Banner');
  assert.equal(note.status, 'ACTION_REQUESTED');
  assert.deepEqual(note.artworkLocation, [50, 80, 170, 120]);
  assert.ok(note.createdAt);
  assert.ok(Array.isArray(note.replies));

  // Verify stored in review
  assert.equal(review.team.stickyNotes.length, 1);
  assert.equal(review.team.stickyNotes[0].id, note.id);
});

test('3. Sticky notes without bounding box work smoothly at finding level', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-legal-allergen');
  const actor = { id: 'usr-legal-1', displayName: 'Rachel Zane', role: 'legal_lead' };

  const note = addStickyNote(
    review,
    finding,
    actor,
    {
      departmentId: 'legal',
      noteText: 'General regulatory comment without specific artwork coordinates'
    }
  );

  assert.equal(note.findingId, 'f-legal-allergen');
  assert.equal(note.artworkLocation, null);
  assert.equal(note.status, 'OPEN');
});

test('4. Threaded replies persist with author identity, timestamp, and review reference', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-legal-allergen');
  const actorLegal = { id: 'usr-legal-1', displayName: 'Rachel Zane', role: 'legal_lead' };
  const actorRD = { id: 'usr-rd-1', displayName: 'Dr. Bruce Banner', role: 'food_scientist' };

  const note = addStickyNote(
    review,
    finding,
    actorLegal,
    {
      departmentId: 'legal',
      noteText: 'Is this milk allergen claim compliant with 21 CFR 101.4?'
    }
  );

  const reply = addStickyNoteReply(
    review,
    note.id,
    'Confirmed with QA: Milk derivative is sodium caseinate.',
    actorRD
  );

  assert.ok(reply.id);
  assert.equal(reply.authorId, 'usr-rd-1');
  assert.equal(reply.authorDisplayName, 'Dr. Bruce Banner');
  assert.ok(reply.createdAt);

  const updatedNotes = findStickyNotesForFinding(review, 'f-legal-allergen');
  assert.equal(updatedNotes[0].replies.length, 1);
  assert.equal(updatedNotes[0].replies[0].id, reply.id);
  assert.equal(updatedNotes[0].replies[0].text, 'Confirmed with QA: Milk derivative is sodium caseinate.');
});

test('5. Note status changes track workflow transitions and record resolution metadata', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-brand-logo');
  const actor = { id: 'usr-brand-1', displayName: 'Don Draper', role: 'brand_director' };

  const note = addStickyNote(
    review,
    finding,
    actor,
    {
      departmentId: 'brand',
      noteText: 'Logo spacing needs 5mm buffer'
    }
  );

  // Transition to AWAITING_RESPONSE
  const updated1 = updateStickyNoteStatus(review, note.id, 'AWAITING_RESPONSE', actor);
  assert.equal(updated1.status, 'AWAITING_RESPONSE');
  assert.equal(updated1.resolvedBy, null);

  // Transition to CLOSED
  const updated2 = updateStickyNoteStatus(review, note.id, 'CLOSED', actor);
  assert.equal(updated2.status, 'CLOSED');
  assert.equal(updated2.resolvedBy, 'Don Draper');
  assert.ok(updated2.resolvedAt);
});

test('6. CRITICAL RULE: Closing a sticky note NEVER modifies finding status (Engine Immutability)', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-rd-formulation');
  assert.equal(finding.status, 'issue', 'Finding starts with status issue');

  const actor = { id: 'usr-rd-1', displayName: 'Dr. Bruce Banner', role: 'food_scientist' };
  const note = addStickyNote(
    review,
    finding,
    actor,
    {
      departmentId: 'rd',
      noteText: 'Need batch correction'
    }
  );

  // Close the sticky note thread
  updateStickyNoteStatus(review, note.id, 'CLOSED', actor);

  assert.equal(finding.status, 'issue', 'Finding verdict MUST stay issue even when sticky note is closed');
});

test('7. Unauthorized reviewer (unassigned user) cannot add sticky note', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-rd-formulation');
  const unauthorizedActor = { id: 'usr-stranger', displayName: 'Stranger', role: 'viewer' };

  assert.throws(() => {
    addStickyNote(
      review,
      finding,
      unauthorizedActor,
      {
        departmentId: 'rd',
        noteText: 'Stranger trying to annotate'
      }
    );
  }, /permission|denied|unauthorized/i);
});

test('8. Missing text or too short sticky note throws validation error', () => {
  const review = createMockReview();
  const finding = review.findings.find(f => f.id === 'f-rd-formulation');
  const actor = { id: 'usr-rd-1', displayName: 'Dr. Bruce Banner', role: 'food_scientist' };

  assert.throws(() => {
    addStickyNote(
      review,
      finding,
      actor,
      {
        departmentId: 'rd',
        noteText: '' // Empty text
      }
    );
  }, /Sticky note must contain 2–2,000 characters/i);
});

test('9. HTML and script injection in note text and replies are safely escaped', () => {
  const finding = { id: 'f-sec', title: 'Security test' };
  const mockReview = {
    team: {
      stickyNotes: [
        {
          id: 'sn-sec-1',
          findingId: 'f-sec',
          departmentId: 'legal',
          authorDisplayName: 'Sec Tester',
          createdAt: new Date().toISOString(),
          noteText: '<script>alert("pwned")</script><b>Bold Regulatory Claim</b>',
          noteStatus: 'OPEN',
          replies: [
            {
              id: 'snr-sec-1',
              authorDisplayName: 'Attacker <img src=x onerror=alert(1)>',
              at: new Date().toISOString(),
              text: '<iframe src="evil.com"></iframe>',
              departmentId: 'rd'
            }
          ]
        }
      ]
    }
  };

  const html = renderFindingStickyNotes(finding, mockReview);

  assert.ok(!html.includes('<script>'), 'Script tag must not be injected as raw HTML');
  assert.ok(!html.includes('<iframe'), 'Iframe tag must not be injected as raw HTML');
  assert.ok(html.includes('&lt;script&gt;'), 'Script tag is escaped as &lt;script&gt;');
  assert.ok(html.includes('&lt;iframe'), 'Iframe is escaped as &lt;iframe');
});

test('10. 2D artwork sticky note markers compute centered coordinates and respect page filtering', () => {
  const notes = [
    {
      id: 'sn-box-p1',
      findingId: 'f-p1',
      departmentId: 'legal',
      boundingBox: { x: 100, y: 200, width: 50, height: 30 },
      page: 1,
      text: 'Page 1 Legal note'
    },
    {
      id: 'sn-box-p2',
      findingId: 'f-p2',
      departmentId: 'prepress',
      boundingBox: { x: 300, y: 400, width: 80, height: 40 },
      page: 2,
      text: 'Page 2 Prepress note'
    },
    {
      id: 'sn-no-box',
      findingId: 'f-p1',
      departmentId: 'rd',
      text: 'No bounding box note'
    }
  ];

  // For Page 1:
  const p1Html = renderArtworkStickyNoteMarkers(notes, 'f-p1', 1);
  assert.ok(p1Html.includes('data-sticky-note-id="sn-box-p1"'), 'Page 1 contains sn-box-p1 marker');
  assert.ok(!p1Html.includes('sn-box-p2'), 'Page 1 must not contain Page 2 marker');
  assert.ok(!p1Html.includes('sn-no-box'), 'Note without bounding box must not produce 2D canvas marker');

  // Verify centered position (x: 100 + 50/2 = 125, y: 200 + 30/2 = 215)
  assert.ok(p1Html.includes('left: 125px'), 'Marker X position is centered at cx=125px');
  assert.ok(p1Html.includes('top: 215px'), 'Marker Y position is centered at cy=215px');
  assert.ok(p1Html.includes('--dept-color: #DC4545;') || p1Html.includes('--marker-color: #DC4545;'), 'Marker uses Legal accent color #DC4545');
});
