import test from 'node:test';
import assert from 'node:assert/strict';
import { executePanelPlacementRule } from '../lib/geometry/placement.mjs';

test('1. Placement finding links to complete evidence audit trail', () => {
  const panel = {
    id: 'pan-front',
    face: 'front',
    polygon: [[0, 0], [100, 0], [100, 100], [0, 100]],
    boundingBox: [0, 0, 100, 100],
    verificationState: 'REVIEWER_CONFIRMED'
  };

  const rule = {
    id: 'rule-nutrition-front',
    checkType: 'FORBIDDEN_ON_PANEL',
    panel: 'front',
    literal_expected: 'Nutrition Facts',
    title: 'Nutrition Facts placement restriction',
    requirementSource: 'Brand Packaging Guideline v4.2'
  };

  const artworkTextSpans = [
    {
      text: 'Nutrition Facts Servings: 8',
      box: [20, 20, 80, 50],
      page: 1,
      documentId: 'doc-art-001'
    }
  ];

  const finding = executePanelPlacementRule({
    rule,
    panels: [panel],
    artworkTextSpans
  });

  assert.ok(finding);
  assert.equal(finding.category, 'GEOMETRY_PLACEMENT');
  assert.equal(finding.status, 'ISSUE');
  assert.equal(finding.ruleId, 'rule-nutrition-front');
  assert.equal(finding.panelId, 'pan-front');

  // Verify complete audit evidence
  assert.ok(finding.sourceEvidence);
  assert.equal(finding.sourceEvidence.ruleSource, 'Brand Packaging Guideline v4.2');
  assert.ok(finding.artworkEvidence);
  assert.equal(finding.artworkEvidence.documentId, 'doc-art-001');
  assert.equal(finding.artworkEvidence.page, 1);
  assert.deepEqual(finding.artworkEvidence.boundingBox, [20, 20, 80, 50]);
  assert.ok(finding.artworkEvidence.matchedText.includes('Nutrition Facts'));

  // Prepress screening limitation disclaimer
  assert.ok(finding.limitations);
  assert.ok(finding.limitations.some(lim => lim.includes('screening') || lim.includes('production') || lim.includes('certified')));
});

test('2. Finding preserves numerical clearance measurements', () => {
  const panel = {
    id: 'pan-back',
    face: 'back',
    polygon: [[0, 0], [100, 0], [100, 100], [0, 100]],
    boundingBox: [0, 0, 100, 100],
    verificationState: 'REVIEWER_CONFIRMED'
  };

  const rule = {
    id: 'rule-back-storage',
    checkType: 'REQUIRED_ON_PANEL',
    panel: 'back',
    literal_expected: 'Store in a cool dry place',
    title: 'Storage instruction placement'
  };

  // Text box overlaps outside panel at x=105
  const artworkTextSpans = [
    {
      text: 'Store in a cool dry place',
      box: [80, 40, 105, 60],
      page: 1
    }
  ];

  const finding = executePanelPlacementRule({
    rule,
    panels: [panel],
    artworkTextSpans
  });

  assert.ok(finding);
  assert.equal(finding.status, 'ISSUE');
  assert.ok(finding.measurements);
  assert.ok(finding.measurements.overflowDetected);
  assert.ok(finding.observation.includes('extends past panel perimeter'));
});
