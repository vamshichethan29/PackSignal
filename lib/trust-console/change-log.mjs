/**
 * PackSignal Change Log & Feature Freeze Audit Trail (lib/trust-console/change-log.mjs)
 * Phase 8: Chronological record of engine milestones, contract freezes, metric progression,
 * and defect detection hardening up to feature freeze.
 */

export const TRUST_CHANGE_LOG = [
  {
    version: '1.0.0-rc.8',
    date: '2026-10-25',
    title: 'Phase 8 — Trust Console, Self-Test Runner & Model Bake-Off Freeze',
    type: 'FEATURE_FREEZE',
    summary: 'Trust shown as numbers: live scoreboard screen, synthetic broken test generator, root-cause miss diagnostics, and model bake-off selecting gemini-3.8-flash.',
    metrics: { defectsCaught: '21 / 21', recall: '100.0%', falseAlarms: 0, testsPassed: '1025 / 1025' },
    changes: [
      'Added Trust Console UI with live scoreboard and "Run Self-Test Suite" button',
      'Implemented synthetic broken test generator covering 7 defect categories',
      'Configured Model Bake-Off table declaring gemini-3.8-flash winning production model',
      'Standardized root-cause diagnostic explanations for every miss or deviation',
    ],
  },
  {
    version: '0.9.4',
    date: '2026-10-24',
    title: 'Phase 7A — 3D Pack View: Tuck-End Fold, Defect Pins & X-Ray Ghost Boxes',
    type: 'FEATURE',
    summary: 'Kinematic 3D folding carton from cut/crease layers, defect pins with camera fly-to, X-Ray mode showing missing net quantity in oz, and AR export with QR code.',
    metrics: { defectsCaught: '21 / 21', recall: '100.0%', falseAlarms: 0, testsPassed: '971 / 971' },
    changes: [
      'Hierarchical hinge matrix folding transforms for tuck-end carton',
      'X-Ray mode rendering dashed statutory ghost boxes on PDP and Back panels',
      'India market live adaptation displaying statutory Veg Mark and MRP',
      'High-resolution 3D snapshot export embedded in prepress audit certificates',
      'Augmented Reality modal with authentic SVG QR code and WebAR Quick Look',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-10-23',
    title: 'Phase 6 — Multi-Jurisdiction Regulatory Switcher & Comparison Studio',
    type: 'FEATURE',
    summary: 'Instant switching between USA (FDA), EU (1169/2011), and India (FSSAI) with 3-column comparative audit matrix.',
    metrics: { defectsCaught: '18 / 18', recall: '100.0%', falseAlarms: 0, testsPassed: '840 / 840' },
    changes: [
      'Zero-latency target market review switcher with statutory gazette links',
      'Cross-market what-if preview detecting contradictory claims (e.g. Honey vs Vegan)',
      '3-Column comparative audit matrix modal',
      'Market worklist export with jurisdiction-specific regulatory tasks',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-22',
    title: 'Phase 5 — Prepress Technical Quality & Native PDF Inspections',
    type: 'FEATURE',
    summary: 'Prepress TAC ink density, bleed margins (<3mm), vector font pt & x-height measurements, and Ed25519 cryptographic signatures.',
    metrics: { defectsCaught: '14 / 14', recall: '100.0%', falseAlarms: 0, testsPassed: '680 / 680' },
    changes: [
      'Native typography inspector measuring true cap-height, x-height, and font point size',
      'TAC (Total Area Coverage) ink density heatmaps detecting over-inking above 320%',
      'Bleed safety inspector verifying 3mm margin outside dieline cut lines',
      'Ed25519 digital signature seal on inspection certificate ZIP packages',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-21',
    title: 'Phase 4 — Evidence-Led Review Workbench & Discrepancy Cards',
    type: 'FEATURE',
    summary: 'Dual-pane 2D/3D proofing workspace with red/green source trace, bounding box spotlight, and discrepancy resolution cards.',
    metrics: { defectsCaught: '10 / 10', recall: '100.0%', falseAlarms: 0, testsPassed: '450 / 450' },
    changes: [
      'Interactive zoom/pan canvas with sub-pixel bounding box evidence',
      'Discrepancy cards showing Candidate A (Source) vs Candidate B (Artwork)',
      'Safe abstention routing ambiguous draft specifications to human review',
    ],
  },
];

export function getChangeLog() {
  return TRUST_CHANGE_LOG;
}
