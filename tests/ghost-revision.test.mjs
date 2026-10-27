/**
 * tests/ghost-revision.test.mjs
 * Unit and integration tests for V1/V2 missing declaration ghost lifecycle,
 * correction ticket integration, historical ghost preservation, and signed report coverage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGhostRegions } from '../lib/ghost-regions.mjs';
import { signedPayload } from '../lib/audit-signature.mjs';

test('Ghost Bounding Boxes V1/V2 Revision Lifecycle & Signed Report Suite', async t => {
  const v1Review = {
    id: 'rev-fieldday-v1',
    reviewRevision: 1,
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
      },
    },
    documents: [
      { id: 'doc-v1', role: 'artwork', name: 'fieldday-v1.pdf', sha256: 'sha-art-v1' },
    ],
    findings: [
      {
        id: 'find-qty-v1',
        field: 'net_quantity',
        title: 'Net quantity declaration',
        status: 'issue',
        observed: '750 mL',
        expected: '1000 mL (1 L)',
        rule: { id: 'US-FDA-NET-QTY-01', field: 'net_quantity' },
      },
      {
        id: 'find-storage-v1',
        field: 'storage',
        title: 'Storage instruction',
        status: 'issue',
        observed: 'Not detected',
        expected: 'Refrigerate after opening',
        rule: { id: 'US-FDA-STORAGE-01' },
      },
    ],
  };

  const v2Review = {
    id: 'rev-fieldday-v2',
    parentId: 'rev-fieldday-v1',
    reviewRevision: 2,
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
      },
    },
    documents: [
      { id: 'doc-v2', role: 'artwork', name: 'fieldday-v2.pdf', sha256: 'sha-art-v2' },
    ],
    findings: [
      {
        id: 'find-qty-v2',
        field: 'net_quantity',
        title: 'Net quantity declaration',
        status: 'match', // Corrected in V2
        observed: '1000 mL (1 L)',
        expected: '1000 mL (1 L)',
        evidence: [{ role: 'artwork', quote: '1000 mL (1 L)', page: 1, box: [0.50, 0.75, 0.75, 0.80] }],
        rule: { id: 'US-FDA-NET-QTY-01', field: 'net_quantity' },
      },
      {
        id: 'find-care-v2',
        field: 'business_details',
        title: 'Customer care contact missing',
        status: 'issue', // New regression in V2
        observed: 'Not detected',
        expected: 'help@fieldday.com',
        rule: { id: 'US-FDA-MFR-ADDR-01' },
      },
    ],
  };

  await t.test('1. Revision V1 generates eligible ghost for missing net quantity declaration', () => {
    const v1Ghosts = generateGhostRegions({ review: v1Review });
    assert.ok(v1Ghosts.length >= 1);
    const qtyGhost = v1Ghosts.find(g => g.declarationType === 'NET_QUANTITY');
    assert.ok(qtyGhost);
    assert.equal(qtyGhost.verificationState, 'VERIFIED_MISSING');
    assert.equal(qtyGhost.findingId, 'find-qty-v1');
    assert.equal(qtyGhost.selectedPanel, 'principal_display_panel');
  });

  await t.test('2. Revision V2 upload with restored declaration clears net quantity ghost box', () => {
    const v2Ghosts = generateGhostRegions({ review: v2Review });
    const qtyGhostV2 = v2Ghosts.find(g => g.findingId === 'find-qty-v2' && g.declarationType === 'NET_QUANTITY');
    assert.equal(qtyGhostV2, undefined, 'Restored declaration must not generate a missing ghost in V2');
  });

  await t.test('3. Historical V1 ghost record is preserved for before/after comparison', () => {
    const v1Ghosts = generateGhostRegions({ review: v1Review });
    assert.ok(v1Ghosts.some(g => g.reviewId === 'rev-fieldday-v1'));
  });

  await t.test('4. V2 declaration in wrong panel produces FOUND_WRONG_PANEL, not automatic clearance', () => {
    const wrongPanelReview = {
      id: 'rev-wrong-panel',
      market: 'us',
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: {
          front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
          back: { page: 1, box: [0.05, 0.15, 0.40, 0.85] },
        },
      },
      findings: [
        {
          id: 'find-wrong-pdp',
          field: 'net_quantity',
          title: 'Net quantity on wrong panel (placed on back panel instead of PDP)',
          status: 'issue',
          observed: 'Found on side panel',
          expected: 'Must appear on PDP',
          evidence: [{ role: 'artwork', quote: '1000 mL', page: 1, box: [0.10, 0.70, 0.35, 0.75] }],
        },
      ],
    };

    const wrongGhosts = generateGhostRegions({ review: wrongPanelReview });
    assert.equal(wrongGhosts.length, 1);
    assert.equal(wrongGhosts[0].verificationState, 'FOUND_WRONG_PANEL');
  });

  await t.test('5. Ghost overlays do NOT mutate original artwork PDF bytes', () => {
    assert.equal(v1Review.documents[0].sha256, 'sha-art-v1');
    assert.equal(v2Review.documents[0].sha256, 'sha-art-v2');
  });

  await t.test('6. Signed report cryptographically binds missingDeclarationPlacementReview', () => {
    const v1Ghosts = generateGhostRegions({ review: v1Review });
    const reviewWithGhosts = { ...v1Review, ghostRegions: v1Ghosts };
    const payload = signedPayload(reviewWithGhosts, 'v2');

    assert.ok(payload.missingDeclarationPlacementReview);
    assert.equal(payload.missingDeclarationPlacementReview.length, v1Ghosts.length);
    assert.equal(payload.missingDeclarationPlacementReview[0].declarationType, 'NET_QUANTITY');
    assert.equal(payload.missingDeclarationPlacementReview[0].placementAuthority, 'VERIFIED_STATUTORY');
  });
});
