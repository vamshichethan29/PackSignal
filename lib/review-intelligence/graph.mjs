/**
 * PackSignal Review Intelligence — Traceability Graph Engine
 * (lib/review-intelligence/graph.mjs)
 *
 * Implements Step 1, 8, 9:
 * Graph data structure, topological traversal, and full review chain drill-down.
 */

import {
  GRAPH_SCHEMA_VERSION,
  NODE_TYPES,
  EDGE_TYPES,
  validateGraphNode,
  validateGraphEdge
} from './graph-schema.mjs';

export class TraceabilityGraph {
  constructor(reviewId = '', revisionId = '') {
    this.schemaVersion = GRAPH_SCHEMA_VERSION;
    this.reviewId = reviewId;
    this.revisionId = revisionId || reviewId;
    this.nodes = new Map();
    this.outgoing = new Map(); // fromId -> [edges]
    this.incoming = new Map(); // toId -> [edges]
    this.metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  addNode(node) {
    validateGraphNode(node);
    const existing = this.nodes.get(node.nodeId);
    if (existing) {
      // Merge updates while preserving identity
      this.nodes.set(node.nodeId, {
        ...existing,
        ...node,
        version: (existing.version || 1) + 1,
        updatedAt: new Date().toISOString()
      });
    } else {
      this.nodes.set(node.nodeId, {
        version: 1,
        createdAt: new Date().toISOString(),
        ...node
      });
    }
    if (!this.outgoing.has(node.nodeId)) this.outgoing.set(node.nodeId, []);
    if (!this.incoming.has(node.nodeId)) this.incoming.set(node.nodeId, []);
    return this.nodes.get(node.nodeId);
  }

  addEdge(edge) {
    validateGraphEdge(edge);
    if (!this.nodes.has(edge.from)) {
      throw new Error(`Edge source node "${edge.from}" does not exist in graph.`);
    }
    if (!this.nodes.has(edge.to)) {
      throw new Error(`Edge target node "${edge.to}" does not exist in graph.`);
    }

    const outList = this.outgoing.get(edge.from) || [];
    const inList = this.incoming.get(edge.to) || [];

    // Avoid duplicate edges
    const exists = outList.some(e => e.edgeId === edge.edgeId || (e.to === edge.to && e.relationship === edge.relationship));
    if (!exists) {
      const fullEdge = {
        createdAt: new Date().toISOString(),
        ...edge
      };
      outList.push(fullEdge);
      inList.push(fullEdge);
      this.outgoing.set(edge.from, outList);
      this.incoming.set(edge.to, inList);
    }
    return edge;
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  getOutgoingEdges(nodeId, relationshipFilter = null) {
    const list = this.outgoing.get(nodeId) || [];
    if (!relationshipFilter) return list;
    return list.filter(e => e.relationship === relationshipFilter);
  }

  getIncomingEdges(nodeId, relationshipFilter = null) {
    const list = this.incoming.get(nodeId) || [];
    if (!relationshipFilter) return list;
    return list.filter(e => e.relationship === relationshipFilter);
  }

  /**
   * Traverses upstream (dependencies that this node requires/derived from).
   */
  getUpstreamNodes(nodeId, maxDepth = 10, visited = new Set()) {
    if (visited.has(nodeId) || maxDepth <= 0) return [];
    visited.add(nodeId);

    const upstream = [];
    const inEdges = this.incoming.get(nodeId) || [];

    for (const edge of inEdges) {
      const parentNode = this.nodes.get(edge.from);
      if (parentNode && !upstream.some(u => u.nodeId === parentNode.nodeId)) {
        upstream.push(parentNode);
        const further = this.getUpstreamNodes(parentNode.nodeId, maxDepth - 1, visited);
        for (const f of further) {
          if (!upstream.some(u => u.nodeId === f.nodeId)) upstream.push(f);
        }
      }
    }

    return upstream;
  }

  /**
   * Traverses downstream (nodes affected by or produced from this node).
   */
  getDownstreamNodes(nodeId, maxDepth = 10, visited = new Set()) {
    if (visited.has(nodeId) || maxDepth <= 0) return [];
    visited.add(nodeId);

    const downstream = [];
    const outEdges = this.outgoing.get(nodeId) || [];

    for (const edge of outEdges) {
      const childNode = this.nodes.get(edge.to);
      if (childNode && !downstream.some(d => d.nodeId === childNode.nodeId)) {
        downstream.push(childNode);
        const further = this.getDownstreamNodes(childNode.nodeId, maxDepth - 1, visited);
        for (const f of further) {
          if (!downstream.some(d => d.nodeId === f.nodeId)) downstream.push(f);
        }
      }
    }

    return downstream;
  }

  /**
   * Returns complete provenance chain for a specific finding:
   * SOURCE DOCUMENT -> SOURCE FACT -> RULE -> CHECK EXECUTION -> ARTWORK EVIDENCE -> FINDING -> REVIEWER DECISION -> CORRECTION TICKET
   */
  getFindingTraceabilityChain(findingId) {
    const findingNodeId = findingId.startsWith('finding:') ? findingId : `finding:${findingId}`;
    const findingNode = this.getNode(findingNodeId);

    if (!findingNode) {
      return {
        found: false,
        findingId,
        message: `Finding "${findingId}" was not found in the traceability graph.`
      };
    }

    // 1. Check execution producing this finding
    const execEdges = this.getIncomingEdges(findingNodeId, EDGE_TYPES.PRODUCED_FINDING);
    const execNode = execEdges.length > 0 ? this.getNode(execEdges[0].from) : null;

    // 2. Rule governing this check execution
    let ruleNode = null;
    let factNodes = [];
    let sourceDocNodes = [];

    if (execNode) {
      const ruleEdges = this.getIncomingEdges(execNode.nodeId, EDGE_TYPES.REQUIRES_RULE);
      ruleNode = ruleEdges.length > 0 ? this.getNode(ruleEdges[0].from) : null;
    } else {
      // Fallback: finding might be linked directly to a rule
      const directRuleEdges = this.getIncomingEdges(findingNodeId, EDGE_TYPES.SUPPORTED_BY);
      ruleNode = directRuleEdges.length > 0 ? this.getNode(directRuleEdges[0].from) : null;
    }

    // 3. Facts and source documents required by rule or execution
    const factSearchNodes = [execNode, ruleNode].filter(Boolean);
    for (const node of factSearchNodes) {
      const factEdges = this.getIncomingEdges(node.nodeId, EDGE_TYPES.REQUIRES_FACT);
      for (const edge of factEdges) {
        const fact = this.getNode(edge.from);
        if (fact && !factNodes.some(f => f.nodeId === fact.nodeId)) {
          factNodes.push(fact);
        }
      }
    }

    for (const fact of factNodes) {
      const docEdges = this.getIncomingEdges(fact.nodeId, EDGE_TYPES.EXTRACTED_FROM);
      for (const edge of docEdges) {
        const doc = this.getNode(edge.from);
        if (doc && !sourceDocNodes.some(d => d.nodeId === doc.nodeId)) {
          sourceDocNodes.push(doc);
        }
      }
    }

    // 4. Artwork evidence and artwork document
    const artworkEvidenceNodes = [];
    const evidenceEdges = this.getOutgoingEdges(findingNodeId, EDGE_TYPES.SUPPORTED_BY);
    for (const edge of evidenceEdges) {
      const ev = this.getNode(edge.to);
      if (ev && ev.nodeType === NODE_TYPES.ARTWORK_EVIDENCE) {
        artworkEvidenceNodes.push(ev);
      }
    }

    let artworkDocNode = null;
    for (const ev of artworkEvidenceNodes) {
      const docEdges = this.getOutgoingEdges(ev.nodeId, EDGE_TYPES.LOCATED_IN);
      if (docEdges.length > 0) {
        artworkDocNode = this.getNode(docEdges[0].to);
        if (artworkDocNode) break;
      }
    }

    // 5. Reviewer decision
    const decisionEdges = this.getOutgoingEdges(findingNodeId, EDGE_TYPES.REVIEWED_BY);
    const decisionNode = decisionEdges.length > 0 ? this.getNode(decisionEdges[0].to) : null;

    // 6. Correction tickets
    const ticketNodes = [];
    const ticketEdges = this.getOutgoingEdges(findingNodeId, EDGE_TYPES.GENERATED_TICKET);
    for (const edge of ticketEdges) {
      const ticket = this.getNode(edge.to);
      if (ticket) ticketNodes.push(ticket);
    }

    const hasCompleteExecutionProvenance = Boolean(execNode && execNode.metadata?.executionStatus);

    return {
      found: true,
      findingId: findingNode.entityId || findingId,
      finding: findingNode,
      checkExecution: execNode,
      rule: ruleNode,
      facts: factNodes,
      sourceDocuments: sourceDocNodes,
      artworkEvidence: artworkEvidenceNodes,
      artworkDocument: artworkDocNode,
      decision: decisionNode,
      tickets: ticketNodes,
      provenanceCompleteness: {
        hasSourceDocument: sourceDocNodes.length > 0,
        hasSourceFact: factNodes.length > 0,
        hasRule: ruleNode !== null,
        hasExecution: hasCompleteExecutionProvenance,
        hasArtworkEvidence: artworkEvidenceNodes.length > 0,
        hasDecision: decisionNode !== null,
        missingProvenanceNote: hasCompleteExecutionProvenance
          ? null
          : 'Full historical execution provenance unavailable.'
      }
    };
  }

  getStats() {
    const nodeCounts = {};
    for (const node of this.nodes.values()) {
      nodeCounts[node.nodeType] = (nodeCounts[node.nodeType] || 0) + 1;
    }

    const edgeCounts = {};
    for (const edgeList of this.outgoing.values()) {
      for (const edge of edgeList) {
        edgeCounts[edge.relationship] = (edgeCounts[edge.relationship] || 0) + 1;
      }
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: Object.values(edgeCounts).reduce((a, b) => a + b, 0),
      nodeCounts,
      edgeCounts
    };
  }

  toJSON() {
    return {
      schemaVersion: this.schemaVersion,
      reviewId: this.reviewId,
      revisionId: this.revisionId,
      metadata: this.metadata,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.outgoing.values()).flat()
    };
  }

  static fromJSON(data = {}) {
    const graph = new TraceabilityGraph(data.reviewId, data.revisionId);
    graph.schemaVersion = data.schemaVersion || GRAPH_SCHEMA_VERSION;
    graph.metadata = data.metadata || graph.metadata;

    if (Array.isArray(data.nodes)) {
      for (const node of data.nodes) {
        graph.addNode(node);
      }
    }

    if (Array.isArray(data.edges)) {
      for (const edge of data.edges) {
        try {
          graph.addEdge(edge);
        } catch {
          /* ignore orphaned edges during migration */
        }
      }
    }

    return graph;
  }
}
