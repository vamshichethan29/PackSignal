/**
 * PackSignal Finding Correspondence Engine (lib/revision/finding-matcher.mjs)
 * Deterministic multi-factor correspondence between findings across revisions,
 * even when extraction order, finding IDs, or coordinates shift.
 */

import { createHash } from 'node:crypto';

function sha256(str) {
  return createHash('sha256').update(String(str || '')).digest('hex');
}

/**
 * Computes a stable check signature for a finding
 */
export function computeFindingSignature(finding = {}) {
  const parts = [
    finding.rule?.id || finding.id?.split('-')[0] || '',
    finding.rule?.field || '',
    finding.expected || '',
    finding.evidence?.[0]?.quote || '',
    finding.evidence?.[0]?.page || 1,
    finding.evidence?.[0]?.face || '',
  ];
  return sha256(parts.join('::'));
}

/**
 * Correlates findings between Revision A (previous) and Revision B (current)
 * using a hierarchical, deterministic fallback matching pipeline.
 */
export function correlateFindings(prevFindings = [], currFindings = [], options = {}) {
  const correlated = [];
  const usedCurrIds = new Set();

  for (const prevF of prevFindings) {
    let match = null;
    let matchBasis = null;
    let confidence = 0.0;

    // 1. Exact finding ID match
    const exactIdMatch = currFindings.find(f => f.id === prevF.id && !usedCurrIds.has(f.id));
    if (exactIdMatch) {
      match = exactIdMatch;
      matchBasis = 'EXACT_ID';
      confidence = 1.0;
    }

    // 2. Stable rule ID & product field match
    if (!match && prevF.rule?.id) {
      const ruleMatch = currFindings.find(f => 
        !usedCurrIds.has(f.id) &&
        f.rule?.id === prevF.rule.id &&
        (!prevF.rule.field || f.rule?.field === prevF.rule.field)
      );
      if (ruleMatch) {
        match = ruleMatch;
        matchBasis = 'RULE_ID_AND_FIELD';
        confidence = 0.95;
      }
    }

    // 3. Stable check signature match
    if (!match) {
      const prevSig = computeFindingSignature(prevF);
      const sigMatch = currFindings.find(f => !usedCurrIds.has(f.id) && computeFindingSignature(f) === prevSig);
      if (sigMatch) {
        match = sigMatch;
        matchBasis = 'CHECK_SIGNATURE';
        confidence = 0.92;
      }
    }

    // 4. Product field & expected value match
    if (!match && prevF.rule?.field && prevF.expected && prevF.expected !== 'Missing reference value') {
      const fieldValMatch = currFindings.find(f =>
        !usedCurrIds.has(f.id) &&
        f.rule?.field === prevF.rule.field &&
        f.expected === prevF.expected
      );
      if (fieldValMatch) {
        match = fieldValMatch;
        matchBasis = 'FIELD_AND_EXPECTED_VALUE';
        confidence = 0.88;
      }
    }

    // 5. Source quotation match
    if (!match && prevF.evidence?.[0]?.quote) {
      const q = prevF.evidence[0].quote.trim().toLowerCase();
      if (q.length > 5) {
        const quoteMatch = currFindings.find(f =>
          !usedCurrIds.has(f.id) &&
          f.evidence?.some(e => e.quote && e.quote.trim().toLowerCase() === q)
        );
        if (quoteMatch) {
          match = quoteMatch;
          matchBasis = 'SOURCE_QUOTE_MATCH';
          confidence = 0.85;
        }
      }
    }

    // 6. Artwork bounding box overlap on same page and panel (IoU >= 0.5)
    if (!match && prevF.evidence?.[0]?.box && prevF.evidence[0]?.page) {
      const pBox = prevF.evidence[0].box;
      const pPage = prevF.evidence[0].page;
      const geoMatch = currFindings.find(f => {
        if (usedCurrIds.has(f.id)) return false;
        const cEv = f.evidence?.[0];
        if (!cEv || cEv.page !== pPage || !cEv.box) return false;
        const iou = calculateIoU(pBox, cEv.box);
        return iou >= 0.5;
      });
      if (geoMatch) {
        match = geoMatch;
        matchBasis = 'GEOMETRIC_LOCATION_OVERLAP';
        confidence = 0.75;
      }
    }

    if (match) {
      usedCurrIds.add(match.id);
      correlated.push({
        previousFinding: prevF,
        currentFinding: match,
        matchBasis,
        confidence,
        previousStatus: prevF.status,
        currentStatus: match.status,
      });
    } else {
      correlated.push({
        previousFinding: prevF,
        currentFinding: null,
        matchBasis: 'NOT_IN_CURRENT_REVISION',
        confidence: 0.0,
        previousStatus: prevF.status,
        currentStatus: null,
      });
    }
  }

  // Findings in Revision B that had no counterpart in Revision A
  for (const currF of currFindings) {
    if (!usedCurrIds.has(currF.id)) {
      correlated.push({
        previousFinding: null,
        currentFinding: currF,
        matchBasis: 'NEWLY_DISCOVERED',
        confidence: 0.0,
        previousStatus: null,
        currentStatus: currF.status,
      });
    }
  }

  return correlated;
}

function calculateIoU(boxA, boxB) {
  const x0 = Math.max(boxA[0], boxB[0]);
  const y0 = Math.max(boxA[1], boxB[1]);
  const x1 = Math.min(boxA[2], boxB[2]);
  const y1 = Math.min(boxA[3], boxB[3]);

  const interArea = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
  const areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);
  const unionArea = areaA + areaB - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}
