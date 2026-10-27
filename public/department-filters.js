/**
 * PackSignal — Department Filters & Multi-Stakeholder UI
 * public/department-filters.js
 *
 * Provides one-click departmental filtering, real-time count badges,
 * collaborator-inclusive toggles, and reviewer department override controls.
 */

export const DEPT_CONFIGS = {
  all: {
    id: 'all',
    displayName: 'All Departments',
    shortLabel: 'All',
    color: '#0F172A',
    icon: '🌐'
  },
  legal: {
    id: 'legal',
    displayName: 'Legal & Regulatory',
    shortLabel: 'Legal',
    color: '#DC4545',
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#F87171',
    icon: '⚖️'
  },
  rd: {
    id: 'rd',
    displayName: 'R&D & Formulation',
    shortLabel: 'R&D',
    color: '#3986E5',
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#60A5FA',
    icon: '🧪'
  },
  brand: {
    id: 'brand',
    displayName: 'Brand & Marketing',
    shortLabel: 'Brand',
    color: '#9B59D0',
    bg: '#F3E8FF',
    text: '#6B21A8',
    border: '#C084FC',
    icon: '🎨'
  },
  prepress: {
    id: 'prepress',
    displayName: 'Prepress & Print',
    shortLabel: 'Prepress',
    color: '#249767',
    bg: '#DCFCE7',
    text: '#166534',
    border: '#4ADE80',
    icon: '🖨️'
  },
  unassigned: {
    id: 'unassigned',
    displayName: 'Unassigned',
    shortLabel: 'Unassigned',
    color: '#64748B',
    bg: '#F1F5F9',
    text: '#334155',
    border: '#CBD5E1',
    icon: '❓'
  }
};

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Filter findings by active department and collaborator setting.
 *
 * @param {Array} findings - List of findings
 * @param {string} activeDept - 'all' | 'legal' | 'rd' | 'brand' | 'prepress' | 'unassigned'
 * @param {boolean} includeCollaborators - Whether to include findings where activeDept is a collaborator
 * @returns {Array} Filtered findings array
 */
export function filterFindingsByDepartment(findings = [], activeDept = 'all', includeCollaborators = false) {
  if (!activeDept || activeDept === 'all') {
    return findings;
  }

  const target = String(activeDept).toLowerCase();
  return findings.filter(f => {
    const primary = String(f.primaryDepartment || 'unassigned').toLowerCase();
    if (primary === target) return true;

    if (includeCollaborators && Array.isArray(f.collaboratingDepartments)) {
      return f.collaboratingDepartments.some(c => String(c).toLowerCase() === target);
    }

    return false;
  });
}

/**
 * Calculate department counts given the findings and whether collaborating teams are included.
 */
export function calculateDepartmentCounts(findings = [], includeCollaborators = false) {
  const counts = {
    all: findings.length,
    legal: 0,
    rd: 0,
    brand: 0,
    prepress: 0,
    unassigned: 0
  };

  const statusBreakdown = {
    all: { issue: 0, review: 0, match: 0, unable: 0, total: findings.length },
    legal: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    rd: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    brand: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    prepress: { issue: 0, review: 0, match: 0, unable: 0, total: 0 },
    unassigned: { issue: 0, review: 0, match: 0, unable: 0, total: 0 }
  };

  for (const f of findings) {
    const primary = String(f.primaryDepartment || 'unassigned').toLowerCase();
    const st = f.status || 'review';

    // Global tally
    if (statusBreakdown.all[st] !== undefined) statusBreakdown.all[st]++;

    // Involved departments for this finding
    const involved = new Set([primary]);
    if (includeCollaborators && Array.isArray(f.collaboratingDepartments)) {
      for (const c of f.collaboratingDepartments) {
        involved.add(String(c).toLowerCase());
      }
    }

    for (const d of involved) {
      if (counts[d] !== undefined) counts[d]++;
      if (statusBreakdown[d] && statusBreakdown[d][st] !== undefined) {
        statusBreakdown[d][st]++;
        statusBreakdown[d].total++;
      }
    }
  }

  return { counts, statusBreakdown };
}

/**
 * Render the compact department filter bar markup.
 */
export function renderDepartmentFilterBar(review, activeDept = 'all', includeCollaborators = false) {
  const findings = review?.findings || [];
  const { counts } = calculateDepartmentCounts(findings, includeCollaborators);

  const depts = ['all', 'legal', 'rd', 'brand', 'prepress', 'unassigned'];

  return `
    <div class="department-filter-container" data-dept-filter-bar role="region" aria-label="Filter findings by department">
      <div class="dept-filter-header">
        <span class="dept-filter-title">
          <span class="dept-filter-icon" aria-hidden="true">🏢</span>
          FINDINGS BY TEAM
        </span>
        <label class="dept-collab-toggle" title="Include findings where department is a collaborator">
          <input type="checkbox" data-action="toggle-collab-dept" ${includeCollaborators ? 'checked' : ''}>
          <span>Include Collaborating Teams</span>
        </label>
      </div>

      <div class="dept-filter-buttons" role="group" aria-label="Department filters">
        ${depts.map(id => {
          const cfg = DEPT_CONFIGS[id];
          const count = counts[id] || 0;
          const isActive = activeDept === id;
          return `
            <button type="button"
                    class="dept-filter-btn ${id} ${isActive ? 'active' : ''}"
                    data-action="filter-department"
                    data-department="${id}"
                    data-dept="${id}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                    style="--dept-color: ${cfg.color}">
              <span class="dept-btn-icon" aria-hidden="true">${cfg.icon}</span>
              <span class="dept-btn-label">${esc(cfg.shortLabel)}</span>
              <span class="dept-btn-count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Render the high-level departmental summary scorecard with status breakdown.
 */
export function renderDepartmentSummaryCard(review) {
  const findings = review?.findings || [];
  const { statusBreakdown } = calculateDepartmentCounts(findings, false);

  const depts = ['legal', 'rd', 'brand', 'prepress'];

  return `
    <div class="department-summary-grid" data-dept-summary role="region" aria-label="Department summary scorecard">
      ${depts.map(id => {
        const cfg = DEPT_CONFIGS[id];
        const s = statusBreakdown[id] || { issue: 0, review: 0, match: 0, unable: 0, total: 0 };
        return `
          <div class="dept-summary-card ${id}" style="--dept-accent: ${cfg.color};">
            <div class="dept-card-top">
              <span class="dept-card-title">${cfg.icon} ${esc(cfg.displayName)}</span>
              <b class="dept-card-total">${s.total} Findings</b>
            </div>
            <div class="dept-card-metrics">
              <span class="metric-pill issue" title="${s.issue} issues"><b>! ${s.issue}</b> Issues</span>
              <span class="metric-pill review" title="${s.review} need review"><b>? ${s.review}</b> Review</span>
              <span class="metric-pill match" title="${s.match} matches"><b>✓ ${s.match}</b> Matches</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render a department badge/chip for a finding card.
 */
export function renderDepartmentBadge(finding, options = {}) {
  const primaryId = String(finding?.primaryDepartment || 'unassigned').toLowerCase();
  const cfg = DEPT_CONFIGS[primaryId] || DEPT_CONFIGS.unassigned;
  const collabs = Array.isArray(finding?.collaboratingDepartments)
    ? finding.collaboratingDepartments.filter(c => c !== primaryId && c !== 'unassigned')
    : [];

  const allowChange = options.canChange === true;

  return `
    <div class="finding-department-chip-row" data-finding-id="${esc(finding.id)}">
      <span class="dept-chip primary" style="background:${cfg.bg}; color:${cfg.text}; border-color:${cfg.border};" title="Primary responsible department: ${esc(cfg.displayName)}">
        <span aria-hidden="true">${cfg.icon}</span>
        <b>${esc(cfg.shortLabel.toUpperCase())}</b>
      </span>
      ${collabs.map(cid => {
        const ccfg = DEPT_CONFIGS[cid] || DEPT_CONFIGS.unassigned;
        return `
          <span class="dept-chip collab" style="background:${ccfg.bg}; color:${ccfg.text}; border-color:${ccfg.border};" title="Collaborating department: ${esc(ccfg.displayName)}">
            <span aria-hidden="true">${ccfg.icon}</span>
            <span>+ ${esc(ccfg.shortLabel)}</span>
          </span>
        `;
      }).join('')}
      ${allowChange ? `
        <button type="button" class="btn-change-department" data-action="open-change-department" data-finding-id="${esc(finding.id)}" title="Re-route department for this finding">
          ✎ Re-route
        </button>
      ` : ''}
    </div>
  `;
}
