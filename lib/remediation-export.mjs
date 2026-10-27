/**
 * PackSignal Remediation Export Engine
 * Generates designer-ready handoff files for Adobe Illustrator, Esko ArtPro+, and Prepress workflows.
 */

export function formatRemediationPlainText(proposal, review = {}) {
  const artworkDoc = review.documents?.find(d => d.role === 'artwork') || { name: 'Artwork' };
  const findingId = proposal.findingId || 'N/A';
  const page = proposal.designerTicket?.page || 1;
  const panel = proposal.designerTicket?.panel || 'Main Panel';

  return `=======================================================
PACKSIGNAL DESIGNER CORRECTION HANDOFF
Adobe Illustrator / Esko ArtPro+ Copy Slip
=======================================================
Finding ID:      ${findingId}
Artwork File:    ${artworkDoc.name}
Page / Panel:    Page ${page} [${panel}]
Mode:            ${proposal.mode || 'Proposed Copy'}
Reviewer Status: ${proposal.status || 'PENDING_REVIEW'}

-------------------------------------------------------
PROPOSED COPY FOR DESIGNER PASTE:
-------------------------------------------------------
${proposal.proposedText || proposal.designerTicket?.prepressInstruction || '[No text changes]'}

-------------------------------------------------------
ORIGINAL ARTWORK COPY (FOR REFERENCE):
-------------------------------------------------------
${proposal.originalText || '[N/A]'}

-------------------------------------------------------
SOURCE EVIDENCE & RULE ANCHOR:
-------------------------------------------------------
${(proposal.sourceEvidence || []).map(e => `• Source: ${e.documentName || e.documentId} | Quote: "${e.quote || ''}"`).join('\n') || 'None recorded'}
${(proposal.ruleEvidence || []).map(r => `• Rule: ${r.title || r.id} | Jurisdiction: ${r.jurisdiction || 'N/A'}`).join('\n') || ''}

-------------------------------------------------------
PREPRESS / STUDIO INSTRUCTIONS:
-------------------------------------------------------
${proposal.designerTicket?.prepressInstruction || '1. Locate the text frame in Adobe Illustrator / ArtPro+ on the specified panel.\n2. Replace the highlighted copy with the proposed copy above.\n3. Verify line wraps, hyphenation, and minimum required point size.\n4. Export revised PDF and upload as V2 to PackSignal for reverification.'}

NOTICE:
This copy is a proposed fix for packaging design handoff. It is not legally certified until verified through authorized regulatory sign-off.
`;
}

export function formatRemediationJson(proposal, review = {}) {
  const artworkDoc = review.documents?.find(d => d.role === 'artwork') || { name: 'Artwork' };
  return JSON.stringify(
    {
      schemaVersion: 'packsignal-remediation-v1',
      proposalId: proposal.proposalId,
      findingId: proposal.findingId,
      artworkFile: artworkDoc.name,
      page: proposal.designerTicket?.page || 1,
      panel: proposal.designerTicket?.panel || 'Main Panel',
      originalText: proposal.originalText,
      proposedText: proposal.proposedText,
      mode: proposal.mode,
      category: proposal.category,
      status: proposal.status,
      reviewerStatus: proposal.reviewerDecision || 'PENDING_REVIEW',
      reviewerIdentity: proposal.reviewerIdentity || null,
      changes: proposal.changes || [],
      sourceEvidence: proposal.sourceEvidence || [],
      ruleEvidence: proposal.ruleEvidence || [],
      designerTicket: proposal.designerTicket || null,
      notes: proposal.comments || [],
      exportedAt: new Date().toISOString(),
      legalDisclaimer: 'Proposed copy only. Requires human verification before print production.',
    },
    null,
    2
  );
}

export function formatRemediationCsv(proposals = [], review = {}) {
  const artworkDoc = review.documents?.find(d => d.role === 'artwork') || { name: 'Artwork' };
  const headers = [
    'Finding ID',
    'Artwork File',
    'Page',
    'Panel',
    'Mode',
    'Status',
    'Original Copy',
    'Proposed Copy',
    'Source Doc',
    'Rule ID',
    'Prepress Instruction',
  ];

  const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

  const rows = proposals.map(p => [
    escapeCsv(p.findingId),
    escapeCsv(artworkDoc.name),
    escapeCsv(p.designerTicket?.page || 1),
    escapeCsv(p.designerTicket?.panel || 'Main Panel'),
    escapeCsv(p.mode),
    escapeCsv(p.status),
    escapeCsv(p.originalText),
    escapeCsv(p.proposedText),
    escapeCsv(p.sourceEvidence?.[0]?.documentName || p.sourceEvidence?.[0]?.documentId || ''),
    escapeCsv(p.ruleEvidence?.[0]?.id || p.ruleEvidence?.[0]?.title || ''),
    escapeCsv(p.designerTicket?.prepressInstruction || 'Paste proposed copy into text frame'),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
