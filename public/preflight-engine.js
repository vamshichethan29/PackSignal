/**
 * Client-side Preflight Engine Utilities and Category Summaries.
 */
export function summarizePreflight(findings = []) {
  const categories = {
    barcode: { label: 'Barcode Quality', checks: 0, issues: 0, reviews: 0, matches: 0, findings: [] },
    bleed_trim: { label: 'Bleed & Trim', checks: 0, issues: 0, reviews: 0, matches: 0, findings: [] },
    typography: { label: 'Typography', checks: 0, issues: 0, reviews: 0, matches: 0, findings: [] },
    color_separation: { label: 'Color Separations', checks: 0, issues: 0, reviews: 0, matches: 0, findings: [] },
    safe_area: { label: 'Dieline / Safe Areas', checks: 0, issues: 0, reviews: 0, matches: 0, findings: [] },
    unable: { label: 'Unable to Verify', checks: 0, issues: 0, reviews: 0, matches: 0, findings: [] },
  };

  for (const f of findings) {
    if (f.method !== 'preflight_engine' && !f.id?.startsWith('preflight:')) continue;
    let cat = f.category;
    if (f.status === 'unable') cat = 'unable';
    else if (!categories[cat]) cat = 'typography';

    categories[cat].checks++;
    if (f.status === 'issue') categories[cat].issues++;
    else if (f.status === 'review') categories[cat].reviews++;
    else if (f.status === 'match') categories[cat].matches++;
    categories[cat].findings.push(f);
  }

  return categories;
}
