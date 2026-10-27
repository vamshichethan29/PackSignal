import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderGhostOverlayLayer,
  renderGhostDetailCard,
  deriveGhostRegions,
} from '../public/ghost-overlays.js';

import {
  classifyFinding,
} from '../lib/finding-department-classifier.mjs';

import {
  generateClarificationMessage,
  classifyClarificationCase,
} from '../lib/clarification-message.mjs';

test('Ghost Artwork UI, 2D/3D Synchronization & Department Workflow Suite', async (t) => {

  const sampleReview = {
    id: 'rev-ui-demo',
    market: 'us',
    sample: 'dancing-fish',
    options: {
      productVariant: 'Dancing Fish Berry Crunch 480g',
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
        back: { page: 1, box: [0.05, 0.15, 0.40, 0.85] }
      }
    },
    documents: [
      {
        role: 'artwork',
        id: 'art-01',
        name: 'DancingFish_Packaging_V1.pdf',
        pages: [{ number: 1, width: 612, height: 792 }]
      }
    ],
    findings: [
      {
        id: 'finding-net-qty',
        field: 'net_quantity',
        title: 'Net Quantity of Contents (Missing US Customary Unit)',
        status: 'issue',
        observed: 'Not detected in inspected artwork',
        expected: '16.9 oz (480 g)',
        rule: { id: 'US-FDA-NET-QTY-01', field: 'net_quantity', citation: '21 CFR §101.7 & §101.105' },
        evidence: []
      },
      {
        id: 'finding-mfr-addr',
        field: 'business_details',
        title: 'Missing Manufacturer Address',
        status: 'issue',
        observed: 'Not detected in inspected artwork',
        expected: 'Dancing Fish Brands LLC, Seattle WA 98101',
        rule: { id: 'US-FDA-MFR-ADDR-01', field: 'business_details', citation: '21 CFR §101.2 & §101.5' },
        evidence: []
      }
    ]
  };

  await t.test('1. renderGhostOverlayLayer generates dashed amber SVG/HTML layer markup', () => {
    const html = renderGhostOverlayLayer(sampleReview, 1);
    assert.ok(html.includes('workbench-ghost-overlay-layer'));
    assert.ok(html.includes('workbench-legal-region'));
    assert.ok(html.includes('workbench-ghost-box'));
    assert.ok(html.includes('ghost-net-qty'));
    assert.ok(html.includes('PERMITTED REGION:'));
    assert.ok(html.includes('GHOST: MISSING NET QTY (16.9 oz)'));
  });

  await t.test('2. Ghost overlay is distinct from actual detected text boxes and TAC heatmaps', () => {
    const html = renderGhostOverlayLayer(sampleReview, 1);
    // Must use ghost-specific classes and not mix with actual evidence box styles
    assert.ok(!html.includes('evidence-box-matched'));
    assert.ok(!html.includes('tac-heatmap-canvas'));
    assert.ok(!html.includes('barcode-symbology-box'));
    assert.match(html, /workbench-ghost-box/);
    assert.match(html, /workbench-legal-region/);
  });

  await t.test('3. renderGhostDetailCard renders comprehensive legal card dialog', () => {
    const ghosts = deriveGhostRegions(sampleReview);
    const netGhost = ghosts.find(g => g.declarationType === 'NET_QUANTITY');
    assert.ok(netGhost);

    const card = renderGhostDetailCard(netGhost, sampleReview);
    assert.ok(card.includes('ghost-card-modal-content'));
    assert.ok(card.includes('PERMITTED LEGAL REGION'));
    assert.ok(card.includes('STATUTORY GOVERNING RULE'));
    assert.ok(card.includes('21 CFR §101.7'));
    assert.ok(card.includes('Suggested Placement Fit:'));

    // Action buttons must be present
    assert.ok(card.includes('data-action="view-rule"'));
    assert.ok(card.includes('data-action="ask-someone-ghost"'));
    assert.ok(card.includes('data-action="create-ticket-ghost"'));
    assert.ok(card.includes('data-action="show-in-3d-ghost"'));
  });

  await t.test('4. Address ghost detail card exposes multiple alternative permitted labeling panels', () => {
    const ghosts = deriveGhostRegions(sampleReview);
    const addrGhost = ghosts.find(g => g.declarationType === 'MANUFACTURER_ADDRESS');
    assert.ok(addrGhost);

    const card = renderGhostDetailCard(addrGhost, sampleReview);
    assert.ok(card.includes('Alternative Permitted Labeling Panels:'));
    assert.ok(card.includes('Information Panel'));
    assert.ok(card.includes('Principal Display Panel'));
  });

  await t.test('5. Department classification routes missing declaration to Legal with Prepress/Brand collaborating', () => {
    const netFinding = sampleReview.findings[0];
    const classification = classifyFinding(netFinding, sampleReview);
    
    assert.equal(classification.primaryDepartment, 'legal');
    assert.ok(classification.collaboratingDepartments.includes('prepress'));
    assert.equal(classification.classificationRuleId, 'legal_regulatory_rule');
  });

  await t.test('6. Ask Someone generates source-backed legal clarification with actual product and rule citation', () => {
    const netFinding = sampleReview.findings[0];
    const msg = generateClarificationMessage({
      finding: netFinding,
      product: 'Dancing Fish Berry Crunch 480g',
      platform: 'slack',
      reviewerContext: { market: 'US' },
    });

    assert.ok(msg.includes('Hi Legal Team,'));
    assert.ok(msg.includes('PackSignal could not verify the required'));
    assert.ok(msg.includes('Dancing Fish Berry Crunch 480g'));
    assert.ok(msg.includes('US'));
    assert.ok(msg.includes('21 CFR §101.7 & §101.105'));
    assert.ok(msg.includes('finding-net-qty'));
    assert.ok(msg.includes('Could you confirm the approved wording and placement before the next revision?'));
  });

  await t.test('7. Ask Someone supports Teams, Plain, and Email formats cleanly', () => {
    const netFinding = sampleReview.findings[0];

    const teamsMsg = generateClarificationMessage({
      finding: netFinding,
      product: 'Dancing Fish Berry Crunch 480g',
      platform: 'teams',
      reviewerContext: { market: 'US' },
    });
    assert.ok(teamsMsg.includes('**Product:** Dancing Fish Berry Crunch 480g'));

    const emailMsg = generateClarificationMessage({
      finding: netFinding,
      product: 'Dancing Fish Berry Crunch 480g',
      platform: 'email',
      reviewerContext: { market: 'US' },
    });
    assert.ok(emailMsg.includes('Subject: Statutory Labeling Clarification — Dancing Fish Berry Crunch 480g'));
    assert.ok(emailMsg.includes('To: Regulatory / Legal'));
  });
});
