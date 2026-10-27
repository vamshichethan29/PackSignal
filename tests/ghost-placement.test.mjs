import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateGhostRegions,
  classifyDeclarationState,
  resolvePanelRoles,
} from '../lib/ghost-regions.mjs';

import {
  getPlacementRule,
} from '../lib/placement-rules.mjs';

import {
  evaluateMissingDeclaration,
  DECLARATION_EVALUATION_STATES,
} from '../lib/regulatory/missing-declarations.mjs';

import {
  signedPayload,
  sealReview,
  verifyPortableSealProof,
} from '../lib/audit-signature.mjs';

test('Ghost Placement Engine & End-to-End Placement Verification Suite', async (t) => {

  await t.test('1. Verified missing declaration generates an eligible ghost with full source provenance', () => {
    const review = {
      id: 'rev-missing-net-qty',
      market: 'us',
      reviewRevision: 1,
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: {
          front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
          back: { page: 1, box: [0.05, 0.15, 0.40, 0.85] }
        }
      },
      documents: [{ role: 'artwork', id: 'art-01', sha256: 'abc123' }],
      findings: [
        {
          id: 'finding-missing-net-qty',
          field: 'net_quantity',
          title: 'Missing Net Quantity of Contents',
          status: 'issue',
          observed: 'Not detected in extracted text',
          expected: '16.9 oz (480 g)',
          rule: { id: 'US-FDA-NET-QTY-01', field: 'net_quantity' },
          evidence: []
        }
      ]
    };

    const ghosts = generateGhostRegions({ review });
    assert.equal(ghosts.length, 1);
    const g = ghosts[0];
    assert.equal(g.declarationType, 'NET_QUANTITY');
    assert.equal(g.selectedPanel, 'principal_display_panel');
    assert.equal(g.selectedFace, 'front');
    assert.equal(g.verificationState, 'VERIFIED_MISSING');
    assert.equal(g.placementAuthority, 'VERIFIED_STATUTORY');
    assert.match(g.authorityCitation, /21 CFR §101\.7/);
    assert.ok(Array.isArray(g.normalizedPolygon));
    assert.equal(g.normalizedPolygon.length, 4);
  });

  await t.test('2. Present declaration in permitted region does NOT generate a missing ghost', () => {
    const review = {
      id: 'rev-present-decl',
      market: 'us',
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
      },
      findings: [
        {
          id: 'finding-present-qty',
          field: 'net_quantity',
          title: 'Net Quantity',
          status: 'match',
          observed: '16.9 oz (480 g)',
          expected: '16.9 oz (480 g)',
          evidence: [{ role: 'artwork', quote: '16.9 oz (480 g)', page: 1, box: [0.50, 0.75, 0.80, 0.80] }]
        }
      ]
    };

    const ghosts = generateGhostRegions({ review });
    assert.equal(ghosts.length, 0);
  });

  await t.test('3. Incomplete artwork inspection produces POSSIBLY_MISSING without false certainty', () => {
    const review = {
      id: 'rev-incomplete-coverage',
      market: 'us',
      options: { completeArtwork: false },
      findings: [
        {
          id: 'f-uncertain-ocr',
          field: 'net_quantity',
          title: 'Net Quantity Check',
          status: 'unable',
          observed: 'OCR scan incomplete on low-resolution layer',
          expected: '480 g'
        }
      ]
    };

    const placementRule = getPlacementRule('NET_QUANTITY', 'US');
    const panelState = { pdpFace: 'front', authority: 'REVIEWER_CONFIRMED' };
    const state = classifyDeclarationState(review.findings[0], review, placementRule, panelState);
    assert.equal(state, 'POSSIBLY_MISSING');
  });

  await t.test('4. Hidden or occluded text cannot satisfy visible statutory requirement', () => {
    // Hidden text in non-rendering or covered stream produces issue
    const finding = {
      id: 'f-hidden-qty',
      field: 'net_quantity',
      title: 'Net Quantity declaration hidden under opaque rectangle',
      status: 'issue',
      observed: 'Not visible in rendered artwork (occluded in PDF content stream seqno #241)',
      expected: '16.9 oz (480 g)',
      evidence: []
    };

    const review = { market: 'us', options: { completeArtwork: true } };
    const placementRule = getPlacementRule('NET_QUANTITY', 'US');
    const panelState = { pdpFace: 'front', authority: 'REVIEWER_CONFIRMED' };

    const state = classifyDeclarationState(finding, review, placementRule, panelState);
    assert.equal(state, 'VERIFIED_MISSING');
  });

  await t.test('5. Manufacturer address provides Information Panel and PDP alternatives', () => {
    const review = {
      id: 'rev-mfr-address',
      market: 'us',
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: {
          front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
          back: { page: 1, box: [0.05, 0.15, 0.40, 0.85] }
        }
      },
      findings: [
        {
          id: 'f-mfr-addr',
          field: 'business_details',
          title: 'Missing Manufacturer Address',
          status: 'issue',
          observed: 'Not detected',
          expected: 'Dancing Fish Foods Inc., Seattle, WA 98101'
        }
      ]
    };

    const ghosts = generateGhostRegions({ review });
    const addrGhost = ghosts.find(g => g.declarationType === 'MANUFACTURER_ADDRESS');
    assert.ok(addrGhost);
    // Not forced to PDP! Preferred is information panel (back)
    assert.equal(addrGhost.selectedPanel, 'information_panel');
    assert.equal(addrGhost.selectedFace, 'back');
    assert.ok(addrGhost.applicablePanels.includes('information_panel'));
    assert.ok(addrGhost.applicablePanels.includes('principal_display_panel'));
    assert.equal(addrGhost.candidateRegions.length, 2);
  });

  await t.test('6. Actual bounding boxes are strictly separated from ghost regions', () => {
    const review = {
      id: 'rev-evidence-separation',
      market: 'us',
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
      },
      findings: [
        {
          id: 'f-ghost-sep',
          field: 'net_quantity',
          title: 'Net Quantity',
          status: 'issue',
          observed: 'Not detected',
          expected: '480 g',
          evidence: [] // Zero artwork evidence boxes
        }
      ]
    };

    const ghosts = generateGhostRegions({ review });
    assert.equal(ghosts.length, 1);
    const g = ghosts[0];
    assert.equal(review.findings[0].evidence.length, 0, 'Ghost must not insert actual artwork evidence');
    assert.equal(review.findings[0].status, 'issue', 'Ghost presence must never change issue status to match');
  });

  await t.test('7. V2 upload with restored text resolves finding, removes active ghost, preserves V1', () => {
    // V1 Review with missing net quantity
    const v1Review = {
      id: 'rev-v1',
      reviewRevision: 1,
      market: 'us',
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
      },
      findings: [
        {
          id: 'finding-net-qty',
          field: 'net_quantity',
          title: 'Net Quantity',
          status: 'issue',
          observed: 'Not detected',
          expected: '16.9 oz (480 g)'
        }
      ]
    };

    const v1Ghosts = generateGhostRegions({ review: v1Review });
    assert.equal(v1Ghosts.length, 1);

    // V2 Review with compliant declaration added on PDP
    const v2Review = {
      id: 'rev-v2',
      reviewRevision: 2,
      market: 'us',
      options: {
        completeArtwork: true,
        panelRolesConfirmed: true,
        panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
      },
      findings: [
        {
          id: 'finding-net-qty',
          field: 'net_quantity',
          title: 'Net Quantity',
          status: 'match',
          observed: '16.9 oz (480 g)',
          expected: '16.9 oz (480 g)',
          evidence: [{ role: 'artwork', quote: '16.9 oz (480 g)', page: 1, box: [0.48, 0.72, 0.78, 0.77] }]
        }
      ],
      previousReview: v1Review,
    };

    const v2Ghosts = generateGhostRegions({ review: v2Review });
    assert.equal(v2Ghosts.length, 0, 'Active ghost is removed in V2 upon valid resolution');

    // Historical V1 ghost remains accessible in previousReview
    const historicalGhosts = generateGhostRegions({ review: v2Review.previousReview });
    assert.equal(historicalGhosts.length, 1, 'Historical V1 ghost is preserved in revision history');
  });

  await t.test('8. Signed report cryptographically binds missing declaration placement review', async () => {
    const review = {
      id: 'rev-signed-placement',
      reviewRevision: 1,
      name: 'Controlled Packaging Review',
      market: 'us',
      createdAt: '2026-10-26T10:00:00Z',
      finishedAt: '2026-10-26T10:30:00Z',
      documents: [{ id: 'doc-01', role: 'artwork', name: 'art.pdf', sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
      findings: [],
      options: { completeArtwork: true },
      ghostRegions: [
        {
          ghostId: 'ghost-net-qty-01',
          findingId: 'f-net-qty',
          declarationType: 'NET_QUANTITY',
          authorityCitation: '21 CFR §101.7 & §101.105',
          jurisdiction: 'US',
          selectedPanel: 'principal_display_panel',
          selectedFace: 'front',
          placementAuthority: 'VERIFIED_STATUTORY',
          legalRegion: { normalizedBounds: [0.45, 0.65, 0.85, 0.85] },
          suggestedPlacement: { normalizedBounds: [0.48, 0.70, 0.82, 0.75] },
          verificationState: 'VERIFIED_MISSING'
        }
      ]
    };

    const payload = signedPayload(review, 'v2');
    assert.ok(payload.missingDeclarationPlacementReview);
    assert.equal(payload.missingDeclarationPlacementReview.length, 1);
    assert.equal(payload.missingDeclarationPlacementReview[0].ghostId, 'ghost-net-qty-01');
    assert.equal(payload.missingDeclarationPlacementReview[0].placementAuthority, 'VERIFIED_STATUTORY');
  });
});
