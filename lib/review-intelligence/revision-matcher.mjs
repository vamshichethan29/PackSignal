/**
 * PackSignal Review Intelligence — Semantic Revision Matcher
 * (lib/review-intelligence/revision-matcher.mjs)
 *
 * Re-exports semantic finding matching, page matching, and classification
 * from the revision intelligence core.
 */

export {
  correlateFindings,
  matchArtworkPages,
  analyzeRevisionIntelligence,
  REVISION_CHANGE_TYPES,
  REVISION_CASES
} from '../revision-intelligence.mjs';
