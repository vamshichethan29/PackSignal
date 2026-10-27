/**
 * PackSignal Review Intelligence — Canonical Graph Schema
 * (lib/review-intelligence/graph-schema.mjs)
 *
 * Implements Step 1 & Step 2 of Phase 5:
 * Canonical versioned graph model and node/edge type taxonomy.
 */

export const GRAPH_SCHEMA_VERSION = 'packsignal-review-graph/v1';

export const NODE_TYPES = {
  SOURCE_DOCUMENT: 'SOURCE_DOCUMENT',
  SOURCE_FACT: 'SOURCE_FACT',
  RULE: 'RULE',
  CHECK_EXECUTION: 'CHECK_EXECUTION',
  ARTWORK_DOCUMENT: 'ARTWORK_DOCUMENT',
  ARTWORK_EVIDENCE: 'ARTWORK_EVIDENCE',
  FINDING: 'FINDING',
  REVIEWER_DECISION: 'REVIEWER_DECISION',
  CORRECTION_TICKET: 'CORRECTION_TICKET',
  REVISION: 'REVISION',
  QUESTION: 'QUESTION'
};

export const EDGE_TYPES = {
  EXTRACTED_FROM: 'EXTRACTED_FROM',
  SUPPORTED_BY: 'SUPPORTED_BY',
  DERIVED_FROM: 'DERIVED_FROM',
  REQUIRES_FACT: 'REQUIRES_FACT',
  REQUIRES_RULE: 'REQUIRES_RULE',
  APPLIED_TO: 'APPLIED_TO',
  PRODUCED_FINDING: 'PRODUCED_FINDING',
  LOCATED_IN: 'LOCATED_IN',
  REVIEWED_BY: 'REVIEWED_BY',
  GENERATED_TICKET: 'GENERATED_TICKET',
  ADDRESSED_IN_REVISION: 'ADDRESSED_IN_REVISION',
  RECHECKED_BY: 'RECHECKED_BY',
  SUPERSEDES: 'SUPERSEDES',
  INVALIDATED_BY: 'INVALIDATED_BY'
};

export const DEPENDENCY_TYPES = {
  REQUIRED: 'required',
  CONDITIONAL: 'conditional',
  CORROBORATIVE: 'corroborative',
  AUDIT: 'audit'
};

export const REVISION_CLASSIFICATIONS = {
  VERIFIED_RESOLVED: 'VERIFIED_RESOLVED',
  NEW_ISSUE: 'NEW_ISSUE',
  VERIFIED_REGRESSION: 'VERIFIED_REGRESSION',
  UNCHANGED_ISSUE: 'UNCHANGED_ISSUE',
  UNCHANGED_MATCH: 'UNCHANGED_MATCH',
  STATUS_CHANGED: 'STATUS_CHANGED',
  NO_LONGER_SUPPORTED: 'NO_LONGER_SUPPORTED',
  SOURCE_BASIS_CHANGED: 'SOURCE_BASIS_CHANGED',
  RULE_CHANGED: 'RULE_CHANGED',
  NEW_RULE_APPLIED: 'NEW_RULE_APPLIED',
  RULE_NO_LONGER_APPLICABLE: 'RULE_NO_LONGER_APPLICABLE',
  NEEDS_REVALIDATION: 'NEEDS_REVALIDATION',
  NOT_RECHECKED: 'NOT_RECHECKED',
  NOT_COMPARABLE: 'NOT_COMPARABLE'
};

export const TICKET_STATUSES = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  READY_FOR_RECHECK: 'READY_FOR_RECHECK',
  VERIFIED_RESOLVED: 'VERIFIED_RESOLVED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  CLOSED_WITH_EXCEPTION: 'CLOSED_WITH_EXCEPTION',
  SUPERSEDED: 'SUPERSEDED'
};

export const TICKET_SEVERITIES = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor'
};

/**
 * Validates a graph node structure.
 */
export function validateGraphNode(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('Graph node must be a non-null object.');
  }
  if (!node.nodeId || typeof node.nodeId !== 'string') {
    throw new Error('Graph node must have a string nodeId.');
  }
  if (!node.nodeType || !NODE_TYPES[node.nodeType]) {
    throw new Error(`Graph node has invalid nodeType: ${node.nodeType}`);
  }
  return true;
}

/**
 * Validates a graph edge structure.
 */
export function validateGraphEdge(edge) {
  if (!edge || typeof edge !== 'object') {
    throw new Error('Graph edge must be a non-null object.');
  }
  if (!edge.edgeId || typeof edge.edgeId !== 'string') {
    throw new Error('Graph edge must have a string edgeId.');
  }
  if (!edge.from || typeof edge.from !== 'string') {
    throw new Error('Graph edge must specify a valid "from" nodeId.');
  }
  if (!edge.to || typeof edge.to !== 'string') {
    throw new Error('Graph edge must specify a valid "to" nodeId.');
  }
  if (!edge.relationship || !EDGE_TYPES[edge.relationship]) {
    throw new Error(`Graph edge has invalid relationship: ${edge.relationship}`);
  }
  return true;
}
