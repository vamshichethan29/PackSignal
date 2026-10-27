/**
 * PackSignal Geometry & Prepress Revision Impact (lib/revision/geometry-impact.mjs)
 * Analyzes barcode relocation, typography point-size reductions, panel boundary shifts,
 * and 3D packaging geometry compatibility for swipe comparisons.
 */

/**
 * Checks physical packaging geometry compatibility for 3D swipe vs side-by-side fallback
 */
export function check3DGeometryCompatibility(reviewA = {}, reviewB = {}) {
  // Support both full review objects and direct geometry descriptors
  const typeA = reviewA.packageType || reviewA.options?.packageType || 'folding_carton';
  const typeB = reviewB.packageType || reviewB.options?.packageType || 'folding_carton';

  // Normalize canonical types ('carton' <-> 'folding_carton')
  const normType = t => (t === 'carton' ? 'folding_carton' : t);
  const nA = normType(typeA);
  const nB = normType(typeB);

  if (nA !== nB) {
    const reason = `Incompatible packaging formats (${typeA} vs ${typeB}). 3D swipe requires identical 3D geometries. Exact spatial registration unavailable.`;
    return {
      compatible: false,
      comparisonMode: 'SIDE_BY_SIDE_ONLY',
      spatialRegistrationAvailable: false,
      reason,
      message: reason,
      recommendedView: 'side-by-side',
    };
  }

  // Check dimensional tolerances
  const getDims = obj => {
    if (obj.widthMm !== undefined || obj.heightMm !== undefined || obj.depthMm !== undefined) {
      return { width: obj.widthMm || 0, height: obj.heightMm || 0, depth: obj.depthMm || 0 };
    }
    return obj.options?.cartonDimensions || { width: 100, height: 160, depth: 60 };
  };

  const dimA = getDims(reviewA);
  const dimB = getDims(reviewB);

  const diffW = Math.abs((dimA.width || 0) - (dimB.width || 0));
  const diffH = Math.abs((dimA.height || 0) - (dimB.height || 0));
  const diffD = Math.abs((dimA.depth || 0) - (dimB.depth || 0));

  if (diffW > 2.0 || diffH > 2.0 || diffD > 2.0) {
    const reason = `Carton structural dimensions differ by > 2mm (W: ${dimA.width} vs ${dimB.width}, H: ${dimA.height} vs ${dimB.height}, D: ${dimA.depth} vs ${dimB.depth} mm). Exact spatial registration unavailable. 3D swipe disabled.`;
    return {
      compatible: false,
      comparisonMode: 'SIDE_BY_SIDE_ONLY',
      spatialRegistrationAvailable: false,
      reason,
      message: reason,
      recommendedView: 'side-by-side',
    };
  }

  return {
    compatible: true,
    comparisonMode: 'SWIPE_3D',
    spatialRegistrationAvailable: true,
    reason: 'Identical package geometry confirmed. Real-time 3D swipe slider enabled.',
    message: 'Identical package geometry confirmed. Real-time 3D swipe slider enabled.',
    recommendedView: '3d-swipe',
  };
}

/**
 * Calculates synchronized camera state for dual 3D models
 */
export function calculateCameraSyncState(cameraState = {}) {
  const cloned = JSON.parse(JSON.stringify(cameraState));
  return {
    v1Camera: cloned,
    v2Camera: cloned,
    synchronized: true,
    aspect: cameraState.aspect || 1.0,
    fov: cameraState.fov || 45,
  };
}

/**
 * Registers artwork panels and maps UV coordinates between revisions
 */
export function registerArtworkPanels(layoutA = {}, layoutB = {}) {
  const panelsA = layoutA.panels || [];
  const panelsB = layoutB.panels || [];
  const matchedPanels = [];
  for (const pa of panelsA) {
    const pb = panelsB.find(p => p.id === pa.id || p.face === pa.face);
    if (pb) {
      matchedPanels.push({
        id: pa.id,
        face: pa.face || pb.face,
        panelA: pa,
        panelB: pb,
        uvAligned: true,
      });
    }
  }
  return {
    success: matchedPanels.length > 0,
    matchedPanels,
    unmatchedA: panelsA.filter(pa => !matchedPanels.some(m => m.id === pa.id)),
    unmatchedB: panelsB.filter(pb => !matchedPanels.some(m => m.id === pb.id)),
  };
}

/**
 * Detects barcode relocation between revisions and checks restricted packaging zones
 */
export function analyzeBarcodeRelocation(prevReview = {}, currReview = {}) {
  const prevCodes = (prevReview.documents?.find(d => d.role === 'artwork')?.pages || []).flatMap(p => p.codes || []);
  const currCodes = (currReview.documents?.find(d => d.role === 'artwork')?.pages || []).flatMap(p => p.codes || []);

  const results = [];

  for (const pCode of prevCodes) {
    const cCode = currCodes.find(c => c.value === pCode.value || c.type === pCode.type);
    if (!cCode) {
      results.push({
        barcode: pCode.value,
        type: pCode.type,
        change: 'REMOVED_BARCODE',
        isRegression: true,
        reason: `Barcode ${pCode.value} present in V1 was removed or unreadable in V2.`,
      });
      continue;
    }

    if (pCode.box && cCode.box) {
      const pCenter = [(pCode.box[0] + pCode.box[2]) / 2, (pCode.box[1] + pCode.box[3]) / 2];
      const cCenter = [(cCode.box[0] + cCode.box[2]) / 2, (cCode.box[1] + cCode.box[3]) / 2];

      const dxNorm = cCenter[0] - pCenter[0];
      const dyNorm = cCenter[1] - pCenter[1];
      const distNorm = Math.sqrt(dxNorm * dxNorm + dyNorm * dyNorm);

      const estimatedScaleMm = 150.0;
      const distMm = Math.round(distNorm * estimatedScaleMm * 10) / 10;

      const hasMoved = distNorm > 0.02; // Moved > 2% of page
      // Typical glue flap / fold crease margins
      const inGlueFlap = cCenter[0] > 0.88 || cCenter[0] < 0.12;

      results.push({
        barcode: pCode.value,
        type: pCode.type,
        change: hasMoved ? 'RELOCATED' : 'STABLE',
        hasMoved,
        displacementMm: distMm,
        displacementNorm: [dxNorm, dyNorm],
        previousBox: pCode.box,
        currentBox: cCode.box,
        inExclusionZone: inGlueFlap,
        isRegression: hasMoved && inGlueFlap,
        reason: hasMoved
          ? `Barcode moved ${distMm} mm${inGlueFlap ? ' into packaging glue flap exclusion zone!' : ' across panel'}`
          : 'Barcode placement remains stable.',
      });
    }
  }

  return results;
}

/**
 * Detects statutory copy font size reduction below required minimum (e.g. 6pt)
 */
export function analyzeFontSizeReduction(prevReview = {}, currReview = {}) {
  const prevTypography = prevReview.deepVerification?.preflightReport?.checks?.find(c => c.category === 'typography' || c.id?.includes('font'));
  const currTypography = currReview.deepVerification?.preflightReport?.checks?.find(c => c.category === 'typography' || c.id?.includes('font'));

  if (!prevTypography || !currTypography) return null;

  const prevPt = prevTypography.details?.fontSizePt || prevTypography.details?.measuredPt;
  const currPt = currTypography.details?.fontSizePt || currTypography.details?.measuredPt;
  const minRequiredPt = prevTypography.details?.minPt || 6.0;

  if (typeof prevPt === 'number' && typeof currPt === 'number') {
    const ptDelta = currPt - prevPt;
    const isReducedBelowMin = currPt < minRequiredPt && prevPt >= minRequiredPt;

    return {
      previousPt: prevPt,
      currentPt: currPt,
      ptDelta: Math.round(ptDelta * 10) / 10,
      minRequiredPt,
      isRegression: isReducedBelowMin,
      reason: isReducedBelowMin
        ? `Statutory copy font size was reduced from ${prevPt} pt to ${currPt} pt (violates required minimum ${minRequiredPt} pt).`
        : ptDelta < 0
        ? `Font size reduced by ${Math.abs(ptDelta)} pt (currently ${currPt} pt).`
        : 'Font size maintained or increased.',
    };
  }
  return null;
}
