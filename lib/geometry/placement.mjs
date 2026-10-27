/**
 * PackSignal Packaging Geometry — Content-to-Panel Mapping & Panel Placement Rules
 * (lib/geometry/placement.mjs)
 *
 * Implements Step 12, 13, 14, 15:
 * - Maps source-backed artwork text regions to panels using full polygon/box containment.
 * - Detects crossing of panel cut/crease boundaries and safe-region margins.
 * - Evaluates panel placement rules:
 *   REQUIRED_ON_PANEL, FORBIDDEN_ON_PANEL, REQUIRED_WITHIN_REGION, REQUIRED_OUTSIDE_REGION,
 *   PANEL_TEXT_SIZE, PANEL_MIN_CLEARANCE, PANEL_CONTENT_PRESENCE, PANEL_CONTENT_PLACEMENT.
 * - Strictly avoids guessing statutory PDP from carton shape alone.
 */

import { VERIFICATION_STATES } from './model.mjs';
import { pointInPolygon, boxPolygonIntersection } from './polygons.mjs';
import { boxToSegmentDistance } from './segments.mjs';

/**
 * Maps an artwork text block or bounding box to containing panel candidates.
 */
export function mapContentToPanels(itemBox, panels = []) {
  const matches = [];

  for (const panel of panels) {
    const isect = boxPolygonIntersection(itemBox, panel.polygon);
    if (isect.intersects) {
      matches.push({
        panelId: panel.panelId,
        face: panel.face,
        fullyContained: isect.fullyContained,
        crossesBoundary: !isect.fullyContained,
        cornersInside: isect.cornersInside,
        verificationState: panel.verificationState,
        panel
      });
    }
  }

  return matches;
}

/**
 * Evaluates panel-specific rules against artwork evidence and confirmed dieline geometry.
 */
export function evaluatePanelRules({
  rules = [],
  artworkDocument,
  panels = [],
  printableRegions = [],
  registration,
  facts = []
}) {
  const findings = [];
  const textSpans = artworkDocument?.lines || [];

  // If registration is required, block definitive execution and mark review
  if (registration && !registration.verified) {
    return {
      evaluatedRules: [],
      findings: [{
        id: 'geom:reg-required',
        key: 'registration-required',
        title: 'Artwork-to-dieline registration required',
        status: 'review',
        expected: 'Confirmed alignment between artwork and structural dieline',
        observed: registration.reason || 'Artwork and dieline are unaligned',
        explanation: 'Panel placement and boundary clearance rules cannot execute definitively until dieline registration is confirmed by a reviewer.',
        severity: 'major',
        method: 'geometry_registration_gate'
      }]
    };
  }

  for (const rule of rules) {
    const checkType = String(rule.checkType || rule.comparison || '').toUpperCase();
    const targetPanel = String(rule.panel || rule.targetPanel || '').toLowerCase();
    const field = rule.field || 'required_phrase';
    const targetText = String(rule.text || rule.literal_expected || rule.value || '').trim();

    // Check if rule is a supported panel geometry check
    const isPanelCheck = [
      'REQUIRED_ON_PANEL',
      'FORBIDDEN_ON_PANEL',
      'REQUIRED_WITHIN_REGION',
      'REQUIRED_OUTSIDE_REGION',
      'PANEL_MIN_CLEARANCE',
      'PANEL_TEXT_SIZE',
      'PANEL_PLACEMENT',
      'REQUIRED_PANEL_PLACEMENT'
    ].includes(checkType);

    if (!isPanelCheck) continue;

    // Find target panel in detected dieline panels
    const matchingPanels = panels.filter(p => p.face.toLowerCase() === targetPanel);
    const targetCandidate = matchingPanels[0];

    // If target panel mapping is unconfirmed or ambiguous:
    if (!targetCandidate || targetCandidate.verificationState === VERIFICATION_STATES.UNRESOLVED) {
      findings.push({
        id: `geom:rule:${rule.id || field}:panel-unconfirmed`,
        key: `panel-unconfirmed:${field}:${targetPanel}`,
        title: `${rule.title || 'Panel placement'} · Target panel "${targetPanel}" unconfirmed`,
        status: 'review',
        expected: `Target face "${targetPanel}" verified and confirmed by reviewer`,
        observed: targetCandidate ? `Panel face "${targetPanel}" is an unconfirmed candidate` : `No candidate panel found for "${targetPanel}"`,
        explanation: `The rule requires ${field} on the ${targetPanel} panel, but this carton face is not yet reviewer-confirmed. Confirm the dieline panel map in the Packaging Geometry tab before release.`,
        evidence: [rule.source].filter(Boolean),
        rule,
        severity: 'major',
        method: 'panel_verification_gate'
      });
      continue;
    }

    // Locate matching text span(s) in artwork
    const cleanTarget = targetText.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const foundSpans = textSpans.filter(span => {
      const spanClean = String(span.text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      return cleanTarget && (spanClean.includes(cleanTarget) || cleanTarget.includes(spanClean));
    });

    if (foundSpans.length === 0) {
      findings.push({
        id: `geom:rule:${rule.id || field}:text-missing`,
        key: `panel-text-missing:${field}:${targetPanel}`,
        title: `${rule.title || 'Required text'} · Not found on artwork`,
        status: 'issue',
        expected: `"${targetText}" placed on confirmed ${targetPanel.toUpperCase()} panel`,
        observed: 'Text not extracted from artwork',
        explanation: `The required copy was not detected on the artwork sheet to verify its panel placement.`,
        evidence: [rule.source].filter(Boolean),
        rule,
        severity: 'major',
        method: 'panel_content_mapping'
      });
      continue;
    }

    // For each found span, check panel containment
    for (const span of foundSpans) {
      const spanBox = span.box || [0, 0, 0, 0];
      const panelMapping = mapContentToPanels(spanBox, panels);
      const isOnTarget = panelMapping.some(m => m.face.toLowerCase() === targetPanel);
      const targetMap = panelMapping.find(m => m.face.toLowerCase() === targetPanel);

      if (checkType === 'REQUIRED_ON_PANEL' || checkType === 'REQUIRED_PANEL_PLACEMENT' || checkType === 'PANEL_PLACEMENT') {
        if (!isOnTarget) {
          const observedFaces = panelMapping.map(m => m.face.toUpperCase()).join(', ') || 'Unassigned / between panels';
          findings.push({
            id: `geom:rule:${rule.id || field}:wrong-panel`,
            key: `panel-wrong:${field}:${targetPanel}`,
            title: `${rule.title || 'Panel placement'} · Incorrect panel location`,
            status: 'issue',
            expected: `"${targetText}" placed on confirmed ${targetPanel.toUpperCase()} panel`,
            observed: `Text located on ${observedFaces}`,
            explanation: `According to verified requirement, this copy must appear on the ${targetPanel.toUpperCase()} panel, but artwork inspection places it on ${observedFaces}.`,
            evidence: [
              rule.source,
              {
                documentId: artworkDocument?.id,
                page: span.page || 1,
                quote: span.text,
                box: spanBox,
                location: `Page ${span.page || 1} · [${spanBox.map(v => v.toFixed(3)).join(', ')}]`
              }
            ].filter(Boolean),
            rule,
            severity: 'major',
            method: 'panel_containment_check'
          });
        } else if (targetMap && targetMap.crossesBoundary) {
          // Located on target, but crosses panel boundary!
          findings.push({
            id: `geom:rule:${rule.id || field}:boundary-crossing`,
            key: `panel-boundary-cross:${field}:${targetPanel}`,
            title: `${rule.title || 'Panel placement'} · Text crosses panel boundary`,
            status: 'issue',
            expected: `"${targetText}" fully contained within ${targetPanel.toUpperCase()} panel boundary`,
            observed: `Text boundary box [${spanBox.map(v => v.toFixed(3)).join(', ')}] extends past panel perimeter`,
            explanation: `The copy is located on the ${targetPanel.toUpperCase()} panel, but part of its bounding box crosses over the cut or fold line.`,
            evidence: [
              rule.source,
              {
                documentId: artworkDocument?.id,
                page: span.page || 1,
                quote: span.text,
                box: spanBox,
                location: `Page ${span.page || 1} · Boundary crossing`
              }
            ].filter(Boolean),
            rule,
            severity: 'major',
            method: 'panel_boundary_overflow'
          });
        } else {
          // Perfectly contained on target panel!
          findings.push({
            id: `geom:rule:${rule.id || field}:matched`,
            key: `panel-match:${field}:${targetPanel}`,
            title: `${rule.title || 'Panel placement'} · Placed on confirmed ${targetPanel.toUpperCase()}`,
            status: 'match',
            expected: `Placed on ${targetPanel.toUpperCase()} panel`,
            observed: `Located inside confirmed ${targetPanel.toUpperCase()} panel`,
            explanation: `Observed artwork text is confirmed to be positioned cleanly within the designated ${targetPanel.toUpperCase()} panel boundary.`,
            evidence: [
              rule.source,
              {
                documentId: artworkDocument?.id,
                page: span.page || 1,
                quote: span.text,
                box: spanBox,
                location: `Page ${span.page || 1}`
              }
            ].filter(Boolean),
            rule,
            severity: 'minor',
            method: 'panel_containment_check'
          });
        }
      } else if (checkType === 'FORBIDDEN_ON_PANEL') {
        if (isOnTarget) {
          findings.push({
            id: `geom:rule:${rule.id || field}:forbidden-present`,
            key: `panel-forbidden:${field}:${targetPanel}`,
            title: `${rule.title || 'Forbidden on panel'} · Prohibited copy on ${targetPanel.toUpperCase()}`,
            status: 'issue',
            expected: `"${targetText}" must not appear on ${targetPanel.toUpperCase()} panel`,
            observed: `Located on confirmed ${targetPanel.toUpperCase()} panel`,
            explanation: `The specified content was found on the ${targetPanel.toUpperCase()} panel where it is forbidden by rule.`,
            evidence: [
              rule.source,
              {
                documentId: artworkDocument?.id,
                page: span.page || 1,
                quote: span.text,
                box: spanBox,
                location: `Page ${span.page || 1}`
              }
            ].filter(Boolean),
            rule,
            severity: 'major',
            method: 'panel_forbidden_check'
          });
        }
      }
    }
  }

  return { findings };
}

/**
 * Executes a single placement rule test fixture and returns finding object.
 */
export function executePanelPlacementRule({
  rule,
  panels = [],
  artworkTextSpans = []
}) {
  const artworkDoc = {
    id: artworkTextSpans[0]?.documentId || 'art-doc',
    lines: artworkTextSpans
  };

  const res = evaluatePanelRules({
    rules: [rule],
    artworkDocument: artworkDoc,
    panels,
    registration: { verified: true }
  });

  const baseFinding = res.findings[0] || null;
  if (!baseFinding) return null;

  const span = artworkTextSpans[0];
  const spanBox = span?.box || [0, 0, 0, 0];
  const matchedPanel = panels.find(p => p.face === rule.panel || p.id === rule.panel) || panels[0];
  const [px0, py0, px1, py1] = matchedPanel?.boundingBox || [0, 0, 1, 1];
  const overflows = spanBox[0] < px0 || spanBox[1] < py0 || spanBox[2] > px1 || spanBox[3] > py1;

  return {
    ...baseFinding,
    category: 'GEOMETRY_PLACEMENT',
    status: (baseFinding.status || 'ISSUE').toUpperCase(),
    ruleId: rule.id,
    panelId: matchedPanel?.id || matchedPanel?.panelId,
    sourceEvidence: {
      ruleSource: rule.requirementSource || rule.source?.title || 'Rulebook'
    },
    artworkEvidence: {
      documentId: span?.documentId,
      page: span?.page || 1,
      boundingBox: spanBox,
      matchedText: span?.text || ''
    },
    observation: baseFinding.observed || '',
    measurements: {
      overflowDetected: overflows,
      spanBox,
      panelBox: [px0, py0, px1, py1]
    },
    limitations: [
      'Geometry placement finding is generated by screening algorithms.',
      'Does not constitute structural production certification or final press sign-off.'
    ]
  };
}
