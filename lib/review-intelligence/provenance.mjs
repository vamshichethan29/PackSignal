/**
 * PackSignal Review Intelligence — Provenance Graph Builder
 * (lib/review-intelligence/provenance.mjs)
 *
 * Implements Step 3 to Step 7:
 * Connects SOURCE_DOCUMENT -> SOURCE_FACT -> RULE -> CHECK_EXECUTION -> ARTWORK_EVIDENCE -> FINDING -> REVIEWER_DECISION.
 */

import { TraceabilityGraph } from './graph.mjs';
import { NODE_TYPES, EDGE_TYPES, DEPENDENCY_TYPES } from './graph-schema.mjs';
import { createHash } from 'node:crypto';

function hashId(str) {
  return createHash('sha256').update(String(str)).digest('hex').slice(0, 16);
}

/**
 * Builds a complete canonical TraceabilityGraph from an active or persisted review.
 */
export function buildTraceabilityGraph(review = {}) {
  const reviewId = review.id || 'review-unspecified';
  const revisionId = review.revisionId || review.id || 'rev-0';
  const graph = new TraceabilityGraph(reviewId, revisionId);

  const docs = review.documents || [];
  const artworkDoc = docs.find(d => d.role === 'artwork');
  const sourceDocs = docs.filter(d => ['spec', 'rules', 'claims', 'dieline'].includes(d.role));

  // 1. Add Artwork Document Node
  if (artworkDoc) {
    graph.addNode({
      nodeId: `art:${artworkDoc.id}`,
      nodeType: NODE_TYPES.ARTWORK_DOCUMENT,
      reviewId,
      revisionId,
      entityId: artworkDoc.id,
      sourceHash: artworkDoc.sha256 || '',
      status: 'active',
      metadata: {
        name: artworkDoc.name,
        pagesCount: artworkDoc.pages?.length || 0,
        pages: (artworkDoc.pages || []).map(p => ({
          number: p.number,
          method: p.method,
          unit: p.unit
        }))
      }
    });
  }

  // 2. Add Source Document Nodes
  const sourceDocNodeMap = new Map();
  for (const sDoc of sourceDocs) {
    const sNodeId = `doc:${sDoc.id}`;
    sourceDocNodeMap.set(sDoc.id, sNodeId);
    graph.addNode({
      nodeId: sNodeId,
      nodeType: NODE_TYPES.SOURCE_DOCUMENT,
      reviewId,
      revisionId,
      entityId: sDoc.id,
      sourceHash: sDoc.sha256 || '',
      status: sDoc.data?.status || 'active',
      metadata: {
        name: sDoc.name,
        role: sDoc.role,
        isDraft: /draft\s*(?:\/|or)?\s*(?:in\s*review)?|unconfirmed/i.test(sDoc.data?.status || sDoc.text || ''),
        approvalStatus: sDoc.data?.approvalStatus || (sDoc.data?.status ? 'specified' : 'unverified')
      }
    });
  }

  // 3. Add Source Fact Nodes
  const factNodeMap = new Map(); // field or factId -> nodeId
  const facts = review.facts || [];
  for (const fact of facts) {
    const factKey = fact.id || `${fact.field}:${fact.documentId}:${fact.value}`;
    const factNodeId = `fact:${hashId(factKey)}`;
    factNodeMap.set(fact.field, factNodeId);
    if (fact.id) factNodeMap.set(fact.id, factNodeId);

    const isSelected = review.options?.factChoices?.[fact.field] === fact.id;

    graph.addNode({
      nodeId: factNodeId,
      nodeType: NODE_TYPES.SOURCE_FACT,
      reviewId,
      revisionId,
      entityId: fact.id || factKey,
      sourceHash: fact.evidence?.documentHash || '',
      status: isSelected ? 'selected' : (fact.aiProposed ? 'ai_proposed' : 'extracted'),
      metadata: {
        field: fact.field,
        label: fact.label || fact.field,
        value: fact.value,
        quote: fact.evidence?.quote || fact.value,
        location: fact.evidence?.location || '',
        sheet: fact.context?.sheet || null,
        cell: fact.context?.cell || null,
        row: fact.context?.row || null,
        productVariant: fact.context?.productVariant || null,
        aiProposed: Boolean(fact.aiProposed)
      }
    });

    // Link fact to its source document
    const docNodeId = sourceDocNodeMap.get(fact.documentId);
    if (docNodeId) {
      graph.addEdge({
        edgeId: `edge:${factNodeId}->EXTRACTED_FROM->${docNodeId}`,
        from: factNodeId,
        to: docNodeId,
        relationship: EDGE_TYPES.EXTRACTED_FROM,
        dependencyType: DEPENDENCY_TYPES.REQUIRED,
        provenance: {
          extractionMethod: fact.aiProposed ? 'ai_transcription' : 'structured_extraction',
          location: fact.evidence?.location || ''
        }
      });
    }
  }

  // 4. Add Rule Nodes & Check Executions
  const rules = review.rules || [];
  const ruleNodeMap = new Map();
  const execNodeMap = new Map();

  for (const rule of rules) {
    const rId = rule.id || hashId(rule.title + (rule.text || ''));
    const ruleNodeId = `rule:${rId}`;
    ruleNodeMap.set(rId, ruleNodeId);
    if (rule.field) ruleNodeMap.set(rule.field, ruleNodeId);

    graph.addNode({
      nodeId: ruleNodeId,
      nodeType: NODE_TYPES.RULE,
      reviewId,
      revisionId,
      entityId: rId,
      sourceHash: rule.source?.documentHash || '',
      status: rule.applicable === false ? 'not_applicable' : 'active',
      metadata: {
        title: rule.title || rule.text,
        text: rule.text || rule.title,
        comparison: rule.comparison,
        field: rule.field,
        literal_expected: rule.literal_expected,
        aiProposed: Boolean(rule.aiProposed),
        requirementSource: rule.requirementSource || rule.source?.name || 'Supplied Source'
      }
    });

    // Link rule to required source facts
    if (rule.field && factNodeMap.has(rule.field)) {
      const factNodeId = factNodeMap.get(rule.field);
      graph.addEdge({
        edgeId: `edge:${ruleNodeId}->REQUIRES_FACT->${factNodeId}`,
        from: ruleNodeId,
        to: factNodeId,
        relationship: EDGE_TYPES.REQUIRES_FACT,
        dependencyType: DEPENDENCY_TYPES.REQUIRED,
        provenance: { field: rule.field }
      });
    }

    // Link rule to rules document if extracted from one
    if (rule.source?.documentId && sourceDocNodeMap.has(rule.source.documentId)) {
      const docNodeId = sourceDocNodeMap.get(rule.source.documentId);
      graph.addEdge({
        edgeId: `edge:${ruleNodeId}->EXTRACTED_FROM->${docNodeId}`,
        from: ruleNodeId,
        to: docNodeId,
        relationship: EDGE_TYPES.EXTRACTED_FROM,
        dependencyType: DEPENDENCY_TYPES.REQUIRED,
        provenance: { location: rule.source?.location || '' }
      });
    }

    // Distinguishable CHECK_EXECUTION node
    const execNodeId = `exec:${rId}`;
    execNodeMap.set(rId, execNodeId);
    if (rule.field) execNodeMap.set(rule.field, execNodeId);

    graph.addNode({
      nodeId: execNodeId,
      nodeType: NODE_TYPES.CHECK_EXECUTION,
      reviewId,
      revisionId,
      entityId: `check:${rId}`,
      sourceHash: artworkDoc?.sha256 || '',
      status: 'completed',
      metadata: {
        evaluatorId: `evaluator:${rule.comparison || 'exact_comparison'}`,
        evaluatorVersion: '2.0.0',
        executionStatus: 'executed',
        startedAt: review.createdAt || new Date().toISOString(),
        completedAt: review.updatedAt || new Date().toISOString(),
        dependencyFingerprint: review.options?.confirmationFingerprints?.[rId] || null
      }
    });

    // Link execution to rule
    graph.addEdge({
      edgeId: `edge:${execNodeId}->REQUIRES_RULE->${ruleNodeId}`,
      from: execNodeId,
      to: ruleNodeId,
      relationship: EDGE_TYPES.REQUIRES_RULE,
      dependencyType: DEPENDENCY_TYPES.REQUIRED
    });

    // Link execution to artwork document
    if (artworkDoc) {
      graph.addEdge({
        edgeId: `edge:${execNodeId}->APPLIED_TO->art:${artworkDoc.id}`,
        from: execNodeId,
        to: `art:${artworkDoc.id}`,
        relationship: EDGE_TYPES.APPLIED_TO,
        dependencyType: DEPENDENCY_TYPES.REQUIRED
      });
    }
  }

  // 5. Add Findings, Artwork Evidence, and Reviewer Decisions
  const findings = review.findings || [];
  const decisions = review.decisions || {};
  const teamApprovals = review.team?.approvals || [];
  const tickets = review.correctionTickets || [];

  for (const finding of findings) {
    const fNodeId = `finding:${finding.id}`;

    graph.addNode({
      nodeId: fNodeId,
      nodeType: NODE_TYPES.FINDING,
      reviewId,
      revisionId,
      entityId: finding.id,
      sourceHash: artworkDoc?.sha256 || '',
      status: finding.status,
      metadata: {
        key: finding.key,
        title: finding.title,
        severity: finding.severity || 'major',
        status: finding.status,
        expected: finding.expected,
        observed: finding.observed,
        explanation: finding.explanation,
        method: finding.method || 'exact_comparison'
      }
    });

    // Connect Check Execution -> Finding
    let linkedExecNodeId = null;
    if (finding.rule?.id && execNodeMap.has(finding.rule.id)) {
      linkedExecNodeId = execNodeMap.get(finding.rule.id);
    } else if (finding.field && execNodeMap.has(finding.field)) {
      linkedExecNodeId = execNodeMap.get(finding.field);
    } else {
      // Create synthetic check execution for uncompiled or screening findings
      linkedExecNodeId = `exec:${finding.id}`;
      graph.addNode({
        nodeId: linkedExecNodeId,
        nodeType: NODE_TYPES.CHECK_EXECUTION,
        reviewId,
        revisionId,
        entityId: `check:${finding.id}`,
        sourceHash: artworkDoc?.sha256 || '',
        status: 'completed',
        metadata: {
          evaluatorId: `evaluator:${finding.method || 'exact_comparison'}`,
          evaluatorVersion: '2.0.0',
          executionStatus: 'executed',
          startedAt: review.createdAt || new Date().toISOString(),
          completedAt: review.updatedAt || new Date().toISOString()
        }
      });
      if (artworkDoc) {
        graph.addEdge({
          edgeId: `edge:${linkedExecNodeId}->APPLIED_TO->art:${artworkDoc.id}`,
          from: linkedExecNodeId,
          to: `art:${artworkDoc.id}`,
          relationship: EDGE_TYPES.APPLIED_TO,
          dependencyType: DEPENDENCY_TYPES.REQUIRED
        });
      }
    }

    if (linkedExecNodeId) {
      graph.addEdge({
        edgeId: `edge:${linkedExecNodeId}->PRODUCED_FINDING->${fNodeId}`,
        from: linkedExecNodeId,
        to: fNodeId,
        relationship: EDGE_TYPES.PRODUCED_FINDING,
        dependencyType: DEPENDENCY_TYPES.REQUIRED
      });
    }

    // Connect Artwork Evidence
    const evidenceList = finding.evidence || [];
    let evidenceIdx = 0;
    for (const ev of evidenceList) {
      if (!ev) continue;
      evidenceIdx++;
      const isArtworkEv = ev.documentId === artworkDoc?.id || (!ev.documentId && (ev.box || ev.page));
      if (!isArtworkEv) continue;

      const evNodeId = `evidence:${finding.id}:${evidenceIdx}`;
      graph.addNode({
        nodeId: evNodeId,
        nodeType: NODE_TYPES.ARTWORK_EVIDENCE,
        reviewId,
        revisionId,
        entityId: `${finding.id}-ev-${evidenceIdx}`,
        sourceHash: artworkDoc?.sha256 || '',
        status: 'verified',
        metadata: {
          page: ev.page || 1,
          boundingBox: ev.box || null,
          hasLocation: Array.isArray(ev.box) && ev.box.length === 4,
          quote: ev.quote || '',
          location: ev.location || (ev.page ? `Page ${ev.page}` : 'EVIDENCE_LOCATION_UNAVAILABLE'),
          panelId: ev.panelId || null
        }
      });

      // Finding -> Artwork Evidence
      graph.addEdge({
        edgeId: `edge:${fNodeId}->SUPPORTED_BY->${evNodeId}`,
        from: fNodeId,
        to: evNodeId,
        relationship: EDGE_TYPES.SUPPORTED_BY,
        dependencyType: DEPENDENCY_TYPES.CORROBORATIVE
      });

      // Artwork Evidence -> Artwork Document
      if (artworkDoc) {
        graph.addEdge({
          edgeId: `edge:${evNodeId}->LOCATED_IN->art:${artworkDoc.id}`,
          from: evNodeId,
          to: `art:${artworkDoc.id}`,
          relationship: EDGE_TYPES.LOCATED_IN,
          dependencyType: DEPENDENCY_TYPES.REQUIRED
        });
      }
    }

    // Connect Reviewer Decision
    const decision = decisions[finding.id];
    const teamApproval = teamApprovals.find(a => a.findingId === finding.id);
    const activeDecision = decision || teamApproval;

    if (activeDecision) {
      const decNodeId = `decision:${finding.id}`;
      graph.addNode({
        nodeId: decNodeId,
        nodeType: NODE_TYPES.REVIEWER_DECISION,
        reviewId,
        revisionId,
        entityId: `dec:${finding.id}`,
        sourceHash: activeDecision.dependencyHash || '',
        status: activeDecision.stale ? 'stale' : 'active',
        metadata: {
          disposition: activeDecision.disposition || activeDecision.decision || 'approved_for_handoff',
          reviewerIdentity: activeDecision.reviewer || activeDecision.user || 'Reviewer',
          note: activeDecision.note || activeDecision.comment || '',
          timestamp: activeDecision.timestamp || activeDecision.createdAt || new Date().toISOString(),
          stale: Boolean(activeDecision.stale),
          revalidationRequired: Boolean(activeDecision.stale)
        }
      });

      // Finding -> Reviewer Decision
      graph.addEdge({
        edgeId: `edge:${fNodeId}->REVIEWED_BY->${decNodeId}`,
        from: fNodeId,
        to: decNodeId,
        relationship: EDGE_TYPES.REVIEWED_BY,
        dependencyType: DEPENDENCY_TYPES.AUDIT
      });
    }

    // Connect Correction Tickets
    const matchingTickets = tickets.filter(t => t.findingId === finding.id);
    for (const ticket of matchingTickets) {
      const tNodeId = `ticket:${ticket.ticketId}`;
      graph.addNode({
        nodeId: tNodeId,
        nodeType: NODE_TYPES.CORRECTION_TICKET,
        reviewId,
        revisionId,
        entityId: ticket.ticketId,
        sourceHash: ticket.sourceDocumentHash || '',
        status: ticket.ticketStatus || 'OPEN',
        metadata: {
          title: ticket.title,
          severity: ticket.severity,
          suggestedAction: ticket.suggestedAction,
          assignedDesigner: ticket.assignedDesigner,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt
        }
      });

      graph.addEdge({
        edgeId: `edge:${fNodeId}->GENERATED_TICKET->${tNodeId}`,
        from: fNodeId,
        to: tNodeId,
        relationship: EDGE_TYPES.GENERATED_TICKET,
        dependencyType: DEPENDENCY_TYPES.AUDIT
      });
    }
  }

  return graph;
}
