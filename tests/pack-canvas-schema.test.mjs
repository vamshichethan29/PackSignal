/**
 * @file pack-canvas-schema.test.mjs
 * 
 * Unit tests for Pack Canvas canonical schema and record validation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  createLayoutRecord, 
  validateLayoutRecord, 
  LAYOUT_STATUSES,
  SCALE_AUTHORITIES,
  ASSET_LOCK_STATUSES,
  CONTENT_TYPES
} from '../lib/pack-canvas/layout-schema.mjs';

test('Pack Canvas Schema: Canonical schema enums and constants', () => {
  assert.ok(LAYOUT_STATUSES.includes('FEASIBLE'));
  assert.ok(LAYOUT_STATUSES.includes('OVERFLOW'));
  assert.ok(SCALE_AUTHORITIES.includes('STRUCTURAL_CAD_SPEC'));
  assert.ok(SCALE_AUTHORITIES.includes('PHYSICAL_SCALE_UNCONFIRMED'));
  assert.ok(ASSET_LOCK_STATUSES.includes('KEEP_LOCKED'));
  assert.ok(CONTENT_TYPES.includes('INGREDIENT_LIST'));
  assert.ok(CONTENT_TYPES.includes('NUTRITION_FACTS'));
});

test('Pack Canvas Schema: createLayoutRecord generates valid canonical record', () => {
  const record = createLayoutRecord({
    reviewId: 'REV-BERRY-CRUNCH-2026',
    briefId: 'BRIEF-DF-BERRY-US-2026',
    documentId: 'DOC-BERRY-CRUNCH-CARTON-2026',
    documentSha256: '9f83a2185c7d8124b104928f8f2b7ec937b2d5d8e7c10b48a1b2496a847e65f1',
    market: 'US',
    packageType: 'Folding Carton',
    physicalScaleAuthority: 'STRUCTURAL_CAD_SPEC',
    panels: [{ id: 'panel-front', name: 'Front Panel', widthMm: 142.88, heightMm: 160.16 }],
    lockedZones: [{ id: 'lock-logo', name: 'Brand Logo', panelId: 'panel-front', widthMm: 120, heightMm: 28 }],
    contentBlocks: [{ id: 'block-identity', name: 'Statement of Identity', panelId: 'panel-front', widthMm: 130, heightMm: 10, text: 'BERRY CRUNCH' }]
  });

  assert.ok(record.layoutId.startsWith('LAY-'));
  assert.equal(record.reviewId, 'REV-BERRY-CRUNCH-2026');
  assert.equal(record.physicalScaleAuthority, 'STRUCTURAL_CAD_SPEC');
  assert.equal(record.market, 'US');
  assert.equal(record.panels.length, 1);
  assert.equal(record.lockedZones.length, 1);
  assert.equal(record.contentBlocks.length, 1);

  const validation = validateLayoutRecord(record);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test('Pack Canvas Schema: validateLayoutRecord rejects invalid or missing identifiers', () => {
  const invalidRecord = {
    layoutId: null,
    reviewId: '',
    documentSha256: ''
  };

  const validation = validateLayoutRecord(invalidRecord);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes('layoutId')));
  assert.ok(validation.errors.some(e => e.includes('documentSha256')));
});
