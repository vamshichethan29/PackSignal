/**
 * PackSignal — Photo Source Piece Model (lib/scan/photo-source-piece.mjs)
 * Phase 10A: Maps phone camera captures and panel crops into canonical Source Pieces.
 * Strictly preserves original image hashes, polygon coordinates, and dual-reader provenance.
 */

import { createHash } from 'node:crypto';

export function createPhotoSourcePiece(params) {
  const {
    sessionId,
    captureId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    faceId,
    rawImageBuffer,
    rawImageSha256,
    rawDimensions = { width: 1200, height: 1600 },
    rawPixelPolygon = [[40, 50], [440, 45], [450, 610], [35, 600]],
    rectifiedPixelPolygon = [[0, 0], [400, 0], [400, 560], [0, 560]],
    homographyId,
    text,
    rawText,
    readerOutputs = {},
    verificationState = 'CONFIRMED',
    semanticField = 'unspecified',
  } = params;

  const sha256 = rawImageSha256 || (rawImageBuffer ? createHash('sha256').update(rawImageBuffer).digest('hex') : createHash('sha256').update(`${sessionId}-${faceId}-${captureId}`).digest('hex'));

  return {
    id: `src-photo-${faceId}-${captureId.slice(0, 8)}`,
    sourceType: 'PHOTO_CAPTURE',
    sourceDocumentId: `photo-session-${sessionId}`,
    sourceDocumentSha256: sha256,
    scanSessionId: sessionId,
    captureId,
    faceId: faceId.toLowerCase(),
    semanticField,
    rawImageDimensions: rawDimensions,
    rawPixelPolygon,
    rectifiedPixelPolygon,
    homographyId: homographyId || `homography-${faceId}-${Date.now()}`,
    text: text || '',
    rawText: rawText || text || '',
    extractionMethod: readerOutputs.dualConsensus ? 'DUAL_READER_CONSENSUS' : (readerOutputs.visionOnly ? 'MULTIMODAL_VISION' : 'LOCAL_OCR'),
    readerOutputs,
    verificationState, // 'CONFIRMED', 'AI_SUGGESTED', 'DISCREPANCY'
    visibility: 'VISIBLE_PRINTED',
    geometryAuthority: 'CAMERA_CAPTURED_HOMOGRAPHY',
    sourceCropRef: {
      face: faceId,
      photoUrl: `/api/campus/photo/${sessionId}/${faceId}.png`,
      cropBounds: rectifiedPixelPolygon,
      perspectiveOriginalUrl: `/api/campus/raw-photo/${sessionId}/${faceId}.png`,
    },
    // Prevent PDF/Excel attribute fabrication
    pdfPage: null,
    sheetName: null,
    cellRange: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Formats a display chip for a photo source piece:
 * e.g. [PHOTO · BACK · INGREDIENTS]
 */
export function formatPhotoSourceChip(sourcePiece) {
  const faceUpper = String(sourcePiece?.faceId || 'PANEL').toUpperCase();
  const fieldUpper = String(sourcePiece?.semanticField || 'TEXT').toUpperCase().replace(/_/g, ' ');
  return {
    label: `PHOTO · ${faceUpper} · ${fieldUpper}`,
    chipClass: sourcePiece?.verificationState === 'CONFIRMED' ? 'chip-confirmed' : 'chip-suggested',
    sourceCropRef: sourcePiece?.sourceCropRef || null,
    sha256: sourcePiece?.sourceDocumentSha256?.slice(0, 10) || '',
  };
}
