/**
 * PackSignal — Phase 6A: Evidence Confidence Glow
 * Visual halo / border encoding evidence authority (NOT defect severity),
 * distinct line styles (solid, dashed, dotted, striped), and interactive evidence inspection.
 *
 * (public/evidence-confidence-glow.js)
 */

export const CONFIDENCE_STYLES = Object.freeze({
  VERIFIED_SOURCE_EVIDENCE: {
    key: 'VERIFIED_SOURCE_EVIDENCE',
    label: 'Verified Source Evidence',
    borderStyle: 'solid',
    borderColor: '#10B981', // Emerald
    haloColor: 'rgba(16, 185, 129, 0.35)',
    icon: '✓',
    description: 'Directly verified from authentic PDF vector stream or certified lab formulation sheet.'
  },
  PARTIAL_EVIDENCE: {
    key: 'PARTIAL_EVIDENCE',
    label: 'Partial Evidence',
    borderStyle: 'dashed',
    borderColor: '#F59E0B', // Amber
    haloColor: 'rgba(245, 158, 11, 0.35)',
    icon: '◐',
    description: 'Supported by partial textual or geometric evidence; secondary confirmation recommended.'
  },
  AI_SUGGESTED: {
    key: 'AI_SUGGESTED',
    label: 'AI Suggested Finding',
    borderStyle: 'dotted',
    borderColor: '#8B5CF6', // Purple
    haloColor: 'rgba(139, 92, 246, 0.35)',
    icon: '✨',
    description: 'Inferred via language/vision model; human reviewer validation required.'
  },
  SOURCE_CONFLICT: {
    key: 'SOURCE_CONFLICT',
    label: 'Source Conflict',
    borderStyle: 'repeating-linear-gradient',
    borderColor: '#EF4444', // Red
    haloColor: 'rgba(239, 68, 68, 0.40)',
    icon: '⚠️',
    description: 'Contradiction detected between two verified source documents (e.g., artwork vs recipe).'
  },
  NOT_EVALUATED: {
    key: 'NOT_EVALUATED',
    label: 'Not Evaluated / Unverified',
    borderStyle: 'solid',
    borderColor: '#94A3B8', // Slate Gray
    haloColor: 'rgba(148, 163, 184, 0.20)',
    icon: '—',
    description: 'Element has not been audited against an approved rule pack.'
  }
});

/**
 * Renders interactive confidence glow elements over an artwork preview container.
 */
export class EvidenceConfidenceGlowManager {
  constructor(containerElement, onSelectFinding = null) {
    this.container = containerElement;
    this.onSelectFinding = onSelectFinding;
    this.activeFindings = [];
    this.isEnabled = false;
  }

  setEnabled(enabled) {
    this.isEnabled = Boolean(enabled);
    this.container.classList.toggle('confidence-glow-enabled', this.isEnabled);
    this.render();
  }

  setFindings(findings = []) {
    this.activeFindings = findings;
    if (this.isEnabled) {
      this.render();
    }
  }

  render() {
    // Remove old glow boxes
    const existing = this.container.querySelectorAll('.confidence-glow-box');
    existing.forEach((el) => el.remove());

    if (!this.isEnabled || this.activeFindings.length === 0) {
      return;
    }

    const bounds = this.container.getBoundingClientRect();
    const w = bounds.width;
    const h = bounds.height;

    for (const finding of this.activeFindings) {
      const geo = finding.artworkLocation || finding.boundingBox || finding.actualTextGeometry;
      if (!geo) continue;

      const confLevel = finding.evidenceConfidenceLevel || (
        finding.isSourceVerified ? 'VERIFIED_SOURCE_EVIDENCE' :
        finding.isConflict ? 'SOURCE_CONFLICT' :
        finding.isAiSuggested ? 'AI_SUGGESTED' : 'PARTIAL_EVIDENCE'
      );

      const styleDef = CONFIDENCE_STYLES[confLevel] || CONFIDENCE_STYLES.NOT_EVALUATED;

      const box = document.createElement('div');
      box.className = 'confidence-glow-box';
      box.dataset.findingId = finding.id || finding.findingId;
      box.dataset.confidenceLevel = confLevel;

      // Position box using normalized coordinates (0.0 to 1.0)
      box.style.left = `${(geo.x * 100).toFixed(2)}%`;
      box.style.top = `${(geo.y * 100).toFixed(2)}%`;
      box.style.width = `${(geo.width * 100).toFixed(2)}%`;
      box.style.height = `${(geo.height * 100).toFixed(2)}%`;

      // Apply distinct visual language
      box.style.borderColor = styleDef.borderColor;
      box.style.boxShadow = `0 0 10px ${styleDef.haloColor}`;

      if (confLevel === 'SOURCE_CONFLICT') {
        box.style.backgroundImage = `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.25) 4px, rgba(239, 68, 68, 0.25) 8px)`;
        box.style.borderStyle = 'solid';
      } else {
        box.style.borderStyle = styleDef.borderStyle;
      }

      // Add badge tag
      const tag = document.createElement('span');
      tag.className = 'confidence-tag';
      tag.textContent = `${styleDef.icon} ${styleDef.label}`;
      tag.style.backgroundColor = styleDef.borderColor;
      box.appendChild(tag);

      box.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.onSelectFinding === 'function') {
          this.onSelectFinding(finding, styleDef);
        }
      });

      this.container.appendChild(box);
    }
  }
}
