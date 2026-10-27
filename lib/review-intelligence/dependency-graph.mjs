/**
 * PackSignal Canonical Dependency Graph Interface
 * (lib/review-intelligence/dependency-graph.mjs)
 *
 * Canonical representation:
 * SOURCE DOCUMENT -> SOURCE FACT -> APPLICABLE RULE -> CHECK EXECUTION -> ARTWORK EVIDENCE -> FINDING -> REVIEWER DECISION
 */

export {
  TraceabilityGraph,
  TraceabilityGraph as DependencyGraph
} from './graph.mjs';

export {
  GRAPH_SCHEMA_VERSION,
  NODE_TYPES,
  EDGE_TYPES,
  validateGraphNode,
  validateGraphEdge
} from './graph-schema.mjs';

export {
  buildReviewProvenanceGraph as buildDependencyGraph
} from './provenance.mjs';

export {
  analyzeChangeImpact
} from './impact-analyzer.mjs';
