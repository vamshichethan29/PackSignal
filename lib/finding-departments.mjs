/**
 * PackSignal — Canonical Department Model
 * lib/finding-departments.mjs
 *
 * Defines the stable enterprise department registry for multi-stakeholder
 * packaging artwork verification.
 */

export const DEPARTMENTS = Object.freeze({
  LEGAL_REGULATORY: Object.freeze({
    id: 'legal',
    key: 'LEGAL_REGULATORY',
    displayName: 'Legal & Regulatory',
    shortLabel: 'Legal',
    color: '#DC4545', // High-contrast Red
    badgeBg: '#FEE2E2',
    badgeText: '#991B1B',
    badgeBorder: '#F87171',
    noteBg: '#FEF2F2',
    icon: '⚖️',
    description: 'Statutory requirements, allergen disclosures, legal name, net quantity, regulatory claims, and mandatory health statements.',
    defaultFindingTypes: ['allergen_statement', 'net_quantity', 'regulatory_claim', 'mandatory_statement', 'statutory_declaration']
  }),

  RD_FORMULATION: Object.freeze({
    id: 'rd',
    key: 'RD_FORMULATION',
    displayName: 'R&D & Formulation',
    shortLabel: 'R&D',
    color: '#3986E5', // High-contrast Blue
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
    badgeBorder: '#60A5FA',
    noteBg: '#EFF6FF',
    icon: '🧪',
    description: 'Recipe ingredients, component percentages, nutritional calculations, macronutrient math, serving size, and batch formulation.',
    defaultFindingTypes: ['ingredients', 'ingredient_percentage', 'nutrition', 'macronutrient_math', 'serving_size', 'recipe_spec']
  }),

  BRAND_MARKETING: Object.freeze({
    id: 'brand',
    key: 'BRAND_MARKETING',
    displayName: 'Brand & Marketing',
    shortLabel: 'Brand',
    color: '#9B59D0', // High-contrast Purple
    badgeBg: '#F3E8FF',
    badgeText: '#6B21A8',
    badgeBorder: '#C084FC',
    noteBg: '#FAF5FF',
    icon: '🎨',
    description: 'Brand identity, marketing romance copy, packaging slogans, product claims, variant naming, and creative presentation.',
    defaultFindingTypes: ['brand', 'product_name', 'variant', 'romance_copy', 'marketing_claim', 'brand_asset']
  }),

  PREPRESS_PRINT: Object.freeze({
    id: 'prepress',
    key: 'PREPRESS_PRINT',
    displayName: 'Prepress & Print',
    shortLabel: 'Prepress',
    color: '#249767', // High-contrast Green
    badgeBg: '#DCFCE7',
    badgeText: '#166534',
    badgeBorder: '#4ADE80',
    noteBg: '#F0FDF4',
    icon: '🖨️',
    description: 'PDF structure, typography size/legibility, color separations, bleed, quiet zones, barcode printability, and ink coverage.',
    defaultFindingTypes: ['typography', 'font_size', 'bleed', 'trim', 'barcode_quality', 'color_separation', 'text_occlusion']
  }),

  UNASSIGNED: Object.freeze({
    id: 'unassigned',
    key: 'UNASSIGNED',
    displayName: 'Unassigned',
    shortLabel: 'Unassigned',
    color: '#64748B', // Neutral slate gray
    badgeBg: '#F1F5F9',
    badgeText: '#334155',
    badgeBorder: '#94A3B8',
    noteBg: '#F8FAFC',
    icon: '❓',
    description: 'Findings not yet routed to a specific department or requiring reviewer triage.',
    defaultFindingTypes: []
  })
});

export const DEPARTMENT_LIST = Object.freeze([
  DEPARTMENTS.LEGAL_REGULATORY,
  DEPARTMENTS.RD_FORMULATION,
  DEPARTMENTS.BRAND_MARKETING,
  DEPARTMENTS.PREPRESS_PRINT,
  DEPARTMENTS.UNASSIGNED
]);

export const ACTIVE_DEPARTMENTS = Object.freeze([
  DEPARTMENTS.LEGAL_REGULATORY,
  DEPARTMENTS.RD_FORMULATION,
  DEPARTMENTS.BRAND_MARKETING,
  DEPARTMENTS.PREPRESS_PRINT
]);

const DEPT_BY_ID = new Map(DEPARTMENT_LIST.map(d => [d.id, d]));
const DEPT_BY_KEY = new Map(DEPARTMENT_LIST.map(d => [d.key, d]));

/**
 * Retrieve department record by id ('legal', 'rd', 'brand', 'prepress', 'unassigned')
 * or uppercase key ('LEGAL_REGULATORY', etc.).
 */
export function getDepartment(identifier) {
  if (!identifier) return DEPARTMENTS.UNASSIGNED;
  const clean = String(identifier).trim().toLowerCase();
  if (DEPT_BY_ID.has(clean)) return DEPT_BY_ID.get(clean);
  const upper = clean.toUpperCase();
  if (DEPT_BY_KEY.has(upper)) return DEPT_BY_KEY.get(upper);
  return DEPARTMENTS.UNASSIGNED;
}

/**
 * Normalize department identifier to canonical lowercase id ('legal', 'rd', 'brand', 'prepress', 'unassigned').
 */
export function normalizeDepartmentId(identifier) {
  return getDepartment(identifier).id;
}

/**
 * Validates whether an identifier belongs to one of the 5 canonical departments.
 */
export function isValidDepartment(identifier) {
  if (!identifier) return false;
  const clean = String(identifier).trim().toLowerCase();
  return DEPT_BY_ID.has(clean) || DEPT_BY_KEY.has(clean.toUpperCase());
}

export { classifyFinding, classifyFinding as classifyFindingDepartment } from './finding-department-classifier.mjs';

