/**
 * @file tests/finding-locations.test.mjs
 * 
 * Unit tests for Phase 5A: Shared Finding Location Model & Physical Coordinates
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFindingLocation,
  buildReviewFindingLocations,
  LOCATION_STATUSES,
  PANEL_ROLES
} from '../lib/artwork/finding-locations.mjs';

describe('Phase 5A — Shared Finding Location Model', () => {

  const sampleReview = {
    id: 'rev-dancing-fish-001',
    revision: 'v1.0',
    artworkHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    documents: [
      {
        id: 'doc-carton-art',
        role: 'artwork',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        pages: [
          {
            number: 1,
            width: 800,
            height: 600,
            widthMm: 282.22,
            heightMm: 211.67,
            trimBox: [0, 0, 800, 600]
          }
        ]
      }
    ],
    options: {
      panelZones: {
        front: { page: 1, box: [0.35, 0.1, 0.65, 0.9] },
        back: { page: 1, box: [0.05, 0.1, 0.35, 0.9] },
        right: { page: 1, box: [0.65, 0.1, 0.95, 0.9] }
      }
    },
    findings: [
      {
        id: 'DF-01',
        title: 'Net Quantity Dual Declaration',
        status: 'issue',
        explanation: 'Net quantity declaration lacks metric equivalent in specified panel quadrant.',
        observed: '16.9 oz',
        expected: '480 g (16.9 oz)',
        page: 1,
        evidence: [
          {
            role: 'artwork',
            page: 1,
            box: [0.40, 0.75, 0.60, 0.85],
            quote: 'NET WT 16.9 OZ'
          }
        ]
      },
      {
        id: 'DF-02',
        title: 'Honey Formulation Percentage',
        status: 'review',
        explanation: 'Artwork specifies Honey (1%) while specification calls for Honey (9%).',
        observed: 'Honey (1%)',
        expected: 'Honey (9%)',
        page: 1,
        evidence: [
          {
            role: 'artwork',
            page: 1,
            box: [0.10, 0.30, 0.30, 0.40],
            quote: 'Honey (1%)'
          }
        ]
      },
      {
        id: 'DF-03',
        title: 'Missing FSSAI License Number',
        status: 'unable',
        explanation: 'Mandatory license mark not detected in extracted content.',
        observed: 'Not detected in extracted content',
        expected: 'FSSAI License 14-digit number',
        evidence: [] // Unlocated finding
      }
    ]
  };

  it('1. Derives canonical location for locatable finding with exact normalized box', () => {
    const finding = sampleReview.findings[0];
    const loc = getFindingLocation(finding, sampleReview);

    assert.ok(loc);
    assert.equal(loc.findingId, 'DF-01');
    assert.equal(loc.page, 1);
    assert.deepEqual(loc.normalizedBox, [0.40, 0.75, 0.60, 0.85]);
    assert.equal(loc.locationStatus, LOCATION_STATUSES.EXACT_SOURCE_LOCATION);
    assert.equal(loc.panelRole, PANEL_ROLES.FRONT);
  });

  it('2. Calculates physical millimeter positions when verified page metrics exist (1 pt = 25.4/72 mm)', () => {
    const finding = sampleReview.findings[0];
    const loc = getFindingLocation(finding, sampleReview);

    assert.ok(loc.physicalPositionMm);
    assert.equal(loc.physicalPositionMm.unit, 'mm');
    assert.equal(loc.physicalPositionMm.pageWidthMm, 282.22);
    assert.equal(loc.physicalPositionMm.pageHeightMm, 211.67);
    assert.ok(loc.physicalPositionMm.widthMm > 0);
    assert.ok(loc.physicalPositionMm.heightMm > 0);
    assert.equal(loc.physicalScaleAuthority, 'VERIFIED_PAGE_METRICS');
  });

  it('3. Sets physicalPositionMm to null when physical scale is unconfirmed (never invents measurements)', () => {
    const reviewWithoutScale = {
      ...sampleReview,
      documents: [
        {
          id: 'doc-unknown-scale',
          role: 'artwork',
          pages: [
            { number: 1 } // No width, height, widthMm, or trimBox
          ]
        }
      ]
    };

    const finding = sampleReview.findings[0];
    const loc = getFindingLocation(finding, reviewWithoutScale);

    assert.equal(loc.physicalPositionMm, null);
    assert.equal(loc.physicalScaleAuthority, 'UNCONFIRMED_SCALE');
    assert.ok(loc.physicalScaleNotice.includes('confirmed artwork scale'));
  });

  it('4. Classifies missing element without box as UNLOCATED without fabricating coordinates', () => {
    const missingFinding = sampleReview.findings[2];
    const loc = getFindingLocation(missingFinding, sampleReview);

    assert.ok(loc);
    assert.equal(loc.findingId, 'DF-03');
    assert.equal(loc.normalizedBox, null);
    assert.equal(loc.locationStatus, LOCATION_STATUSES.UNLOCATED);
    assert.equal(loc.physicalPositionMm, null);
  });

  it('5. Transparently separates locatable findings from unlocated findings across review', () => {
    const result = buildReviewFindingLocations(sampleReview);

    assert.equal(result.metrics.totalFindings, 3);
    assert.equal(result.metrics.locatableCount, 2);
    assert.equal(result.metrics.unlocatedCount, 1);
    assert.equal(result.locatableFindings.length, 2);
    assert.equal(result.unlocatedFindings.length, 1);
    assert.equal(result.unlocatedFindings[0].finding.id, 'DF-03');
  });

});
