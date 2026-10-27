/**
 * PackSignal Packaging Geometry — Artwork-to-Dieline Registration
 * (lib/geometry/registration.mjs)
 *
 * Implements Step 11: Artwork-to-dieline alignment and coordinate registration.
 * Ensures that artwork and dieline coordinate spaces are strictly aligned and verified
 * before running panel-specific placement or clearance checks.
 */

import { REGISTRATION_STATES } from './model.mjs';
import { IDENTITY_MATRIX, invertMatrix, multiplyMatrices, transformPoint } from './coordinates.mjs';

/**
 * Validates registration between an artwork document and a dieline document.
 * If artwork and dieline are distinct documents and have not been registered,
 * returns REGISTRATION_REQUIRED.
 */
export function evaluateRegistration({
  artworkDocument,
  dielineDocument,
  confirmedRegistration = null,
  options = {}
}) {
  const artworkId = artworkDocument?.id || '';
  const dielineId = dielineDocument?.id || '';
  const artworkHash = artworkDocument?.sha256 || '';
  const dielineHash = dielineDocument?.sha256 || '';

  // Case 1: Artwork and Dieline are the same document (e.g. multi-layer or multi-page PDF dieline)
  if (artworkId && dielineId && artworkId === dielineId) {
    return {
      status: REGISTRATION_STATES.REGISTERED_SAME_SPACE,
      artworkDocumentId: artworkId,
      dielineDocumentId: dielineId,
      artworkHash,
      dielineHash,
      transformationMatrix: IDENTITY_MATRIX,
      inverseMatrix: IDENTITY_MATRIX,
      registrationMethod: 'SAME_DOCUMENT_SPACE',
      registrationResidual: 0.0,
      verified: true,
      reason: 'Artwork and dieline share the same document coordinate space.'
    };
  }

  // Case 2: Reviewer has explicitly confirmed registration transform
  if (confirmedRegistration) {
    // Validate that the confirmation is for the exact same file hashes
    const hashMatches = (!confirmedRegistration.artworkHash || confirmedRegistration.artworkHash === artworkHash) &&
                        (!confirmedRegistration.dielineHash || confirmedRegistration.dielineHash === dielineHash);

    if (hashMatches && Array.isArray(confirmedRegistration.transformationMatrix) && confirmedRegistration.transformationMatrix.length === 6) {
      const inv = invertMatrix(confirmedRegistration.transformationMatrix) || IDENTITY_MATRIX;
      return {
        status: REGISTRATION_STATES.REVIEWER_CONFIRMED,
        artworkDocumentId: artworkId,
        dielineDocumentId: dielineId,
        artworkHash,
        dielineHash,
        transformationMatrix: confirmedRegistration.transformationMatrix,
        inverseMatrix: inv,
        registrationMethod: confirmedRegistration.registrationMethod || 'REVIEWER_CONFIRMED',
        registrationResidual: Number(confirmedRegistration.registrationResidual || 0),
        reviewerIdentity: confirmedRegistration.reviewerIdentity || 'Reviewer',
        confirmedAt: confirmedRegistration.confirmedAt || new Date().toISOString(),
        verified: true,
        reason: 'Artwork-to-dieline alignment was confirmed by reviewer.'
      };
    }
  }

  // Case 3: If no dieline document exists or format is illustrative only
  if (!dielineDocument) {
    return {
      status: REGISTRATION_STATES.UNREGISTERED,
      artworkDocumentId: artworkId,
      dielineDocumentId: '',
      artworkHash,
      dielineHash: '',
      transformationMatrix: IDENTITY_MATRIX,
      inverseMatrix: IDENTITY_MATRIX,
      registrationMethod: 'NONE',
      registrationResidual: null,
      verified: false,
      reason: 'No structural dieline document supplied.'
    };
  }

  // Case 4: DXF or external dieline requiring alignment
  // If automatic landmark alignment is possible and enabled via options:
  if (options.allowNormalizedAutoAlignment && artworkDocument?.pages?.[0] && dielineDocument?.pages?.[0]) {
    // Both normalized to [0, 1] relative to their respective bounding box / page bounds
    return {
      status: REGISTRATION_STATES.REGISTERED_TRANSFORM,
      artworkDocumentId: artworkId,
      dielineDocumentId: dielineId,
      artworkHash,
      dielineHash,
      transformationMatrix: IDENTITY_MATRIX,
      inverseMatrix: IDENTITY_MATRIX,
      registrationMethod: 'NORMALIZED_PAGE_ALIGNMENT',
      registrationResidual: 0.0,
      verified: false, // Candidate only, not yet reviewer-confirmed!
      candidateOnly: true,
      reason: 'Normalized bounding box alignment candidate; requires reviewer confirmation.'
    };
  }

  // Default: Registration is required before definitive checks can run
  return {
    status: REGISTRATION_STATES.REGISTRATION_REQUIRED,
    artworkDocumentId: artworkId,
    dielineDocumentId: dielineId,
    artworkHash,
    dielineHash,
    transformationMatrix: IDENTITY_MATRIX,
    inverseMatrix: IDENTITY_MATRIX,
    registrationMethod: 'UNALIGNED',
    registrationResidual: null,
    verified: false,
    reason: 'Artwork and dieline are in separate documents and their geometric alignment has not been confirmed.'
  };
}

/**
 * Computes a 2D affine transformation matrix from 3 corresponding point pairs:
 * artworkPoints: [[x1, y1], [x2, y2], [x3, y3]]
 * dielinePoints: [[u1, v1], [u2, v2], [u3, v3]]
 */
export function computeAffineRegistration(artworkPoints, dielinePoints) {
  if (!Array.isArray(artworkPoints) || !Array.isArray(dielinePoints) ||
      artworkPoints.length < 3 || dielinePoints.length < 3) {
    return { ok: false, reason: 'At least 3 non-collinear registration point pairs are required.' };
  }

  // Solve linear system for 6 affine parameters [a, b, c, d, tx, ty]
  const [p1, p2, p3] = artworkPoints;
  const [q1, q2, q3] = dielinePoints;

  const det = p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]);
  if (Math.abs(det) < 1e-9) {
    return { ok: false, reason: 'Registration landmark points are collinear or degenerate.' };
  }

  const a = (q1[0] * (p2[1] - p3[1]) + q2[0] * (p3[1] - p1[1]) + q3[0] * (p1[1] - p2[1])) / det;
  const c = (q1[0] * (p3[0] - p2[0]) + q2[0] * (p1[0] - p3[0]) + q3[0] * (p2[0] - p1[0])) / det;
  const tx = (q1[0] * (p2[0] * p3[1] - p3[0] * p2[1]) +
              q2[0] * (p3[0] * p1[1] - p1[0] * p3[1]) +
              q3[0] * (p1[0] * p2[1] - p2[0] * p1[1])) / det;

  const b = (q1[1] * (p2[1] - p3[1]) + q2[1] * (p3[1] - p1[1]) + q3[1] * (p1[1] - p2[1])) / det;
  const d = (q1[1] * (p3[0] - p2[0]) + q2[1] * (p1[0] - p3[0]) + q3[1] * (p2[0] - p1[0])) / det;
  const ty = (q1[1] * (p2[0] * p3[1] - p3[0] * p2[1]) +
              q2[1] * (p3[0] * p1[1] - p1[0] * p3[1]) +
              q3[1] * (p1[0] * p2[1] - p2[0] * p1[1])) / det;

  const matrix = [a, b, c, d, tx, ty];

  // Calculate residual fitting error
  let totalResidual = 0;
  for (let i = 0; i < artworkPoints.length; i++) {
    const projected = transformPoint(artworkPoints[i], matrix);
    const target = dielinePoints[i];
    totalResidual += Math.hypot(projected[0] - target[0], projected[1] - target[1]);
  }
  const meanResidual = totalResidual / artworkPoints.length;

  return {
    ok: true,
    transformationMatrix: matrix,
    registrationResidual: meanResidual,
    residual: meanResidual,
    matrix: matrix,
    pointPairCount: artworkPoints.length
  };
}

export const solveAffineTransformFromPoints = computeAffineRegistration;
export const applyAffineTransform = transformPoint;
