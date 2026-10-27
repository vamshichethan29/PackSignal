import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoSourcePiece, formatPhotoSourceChip } from '../lib/scan/photo-source-piece.mjs';

test('1. Creates photo source piece with strict geometry and hash provenance', () => {
  const piece = createPhotoSourcePiece({
    sessionId: 'sess-88',
    faceId: 'back',
    semanticField: 'ingredients',
    text: 'Whole Grain Rolled Oats, Cane Sugar, Honey, Almonds',
    rawPixelPolygon: [[45, 55], [445, 50], [455, 620], [40, 610]],
    rectifiedPixelPolygon: [[0, 0], [400, 0], [400, 560], [0, 560]],
    verificationState: 'CONFIRMED',
  });

  assert.equal(piece.sourceType, 'PHOTO_CAPTURE');
  assert.equal(piece.faceId, 'back');
  assert.equal(piece.semanticField, 'ingredients');
  assert.equal(piece.verificationState, 'CONFIRMED');
  assert.ok(piece.sourceDocumentSha256);
  assert.equal(piece.geometryAuthority, 'CAMERA_CAPTURED_HOMOGRAPHY');

  // Strict anti-fabrication assertions
  assert.equal(piece.pdfPage, null);
  assert.equal(piece.sheetName, null);
  assert.equal(piece.cellRange, null);
});

test('2. Photo source chip formats human-readable label and links real crop', () => {
  const piece = createPhotoSourcePiece({
    sessionId: 'sess-88',
    faceId: 'back',
    semanticField: 'ingredients',
    text: 'Ingredients: Almonds',
    verificationState: 'CONFIRMED',
  });

  const chip = formatPhotoSourceChip(piece);
  assert.equal(chip.label, 'PHOTO · BACK · INGREDIENTS');
  assert.equal(chip.chipClass, 'chip-confirmed');
  assert.ok(chip.sourceCropRef);
  assert.equal(chip.sourceCropRef.face, 'back');
});
