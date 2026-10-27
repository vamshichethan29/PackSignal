/**
 * @file lib/brief/brief-checklist.mjs
 * 
 * Phase 5 — Requirements Checklist Export Engine
 * Generates actionable preflight checklists in JSON, CSV, and printable HTML formats.
 */

export function generateChecklist(brief, session = {}) {
  const items = [];
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));

  for (const sent of brief.sentences || []) {
    if (sent.kind === 'SECTION_HEADING') continue;

    const referencedFacts = (sent.factIds || []).map(id => factsById.get(id)).filter(Boolean);
    const isProven = referencedFacts.length > 0
      ? referencedFacts.every(f => f.state === 'PROVEN')
      : sent.kind === 'PROCESS_INSTRUCTION' || sent.kind === 'APPROVED_DESIGN_DECISION';

    const status = isProven ? 'PASS' : 'FAIL';
    const section = brief.sections.find(s => s.id === sent.sectionId);

    items.push({
      id: `CHK-${sent.sentenceId}`,
      sentenceId: sent.sentenceId,
      section: section?.title || sent.sectionId,
      statement: sent.text,
      kind: sent.kind,
      status,
      priority: sent.kind === 'FACTUAL_CLAIM' ? 'CRITICAL' : 'STANDARD',
      owner: sent.sectionId.includes('regulatory') ? 'Regulatory Affairs' : (sent.sectionId.includes('production') ? 'Prepress Production' : 'Brand Quality Lead'),
      evidenceReference: referencedFacts.map(f => `${f.id} (${f.label})`).join(', ') || 'Process Directive',
      facts: referencedFacts.map(f => ({
        id: f.id,
        label: f.label,
        value: f.value,
        state: f.state,
        primarySource: f.sources?.[0] ? `${f.sources[0].file} [${f.sources[0].location}]` : 'Direct Reviewer Input'
      }))
    });
  }

  const passedChecks = items.filter(i => i.status === 'PASS').length;
  const failedChecks = items.filter(i => i.status === 'FAIL').length;

  return {
    checklistId: `chk-${brief.briefId}`,
    briefId: brief.briefId,
    briefVersion: brief.briefVersion,
    generatedAt: new Date().toISOString(),
    market: brief.market,
    approvalStatus: brief.status,
    totalChecks: items.length,
    passedChecks,
    failedChecks,
    complianceScore: items.length > 0 ? Math.round((passedChecks / items.length) * 100) : 0,
    items
  };
}

/**
 * Serializes checklist to CSV format.
 */
export function generateChecklistCsv(checklist) {
  const headers = ['Checklist ID', 'Sentence ID', 'Section', 'Statement', 'Status', 'Priority', 'Owner', 'Evidence Reference'];
  const rows = [headers.join(',')];

  for (const item of checklist.items) {
    const row = [
      escapeCsv(item.id),
      escapeCsv(item.sentenceId),
      escapeCsv(item.section),
      escapeCsv(item.statement),
      escapeCsv(item.status),
      escapeCsv(item.priority),
      escapeCsv(item.owner),
      escapeCsv(item.evidenceReference)
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function escapeCsv(val = '') {
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}
