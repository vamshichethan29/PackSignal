/**
 * PackSignal — Statutory Placement Rules & Regulatory Zone Constraints
 * lib/placement-rules.mjs
 *
 * Defines versioned placement constraints derived from statutory authorities
 * (e.g. FDA 21 CFR Part 101, FSSAI regulations) with explicit exception handling.
 */

export const PLACEMENT_RULES = {
  // 1. US FDA Net Quantity Declaration (21 CFR §101.7 & 21 CFR §101.105)
  'US_NET_QUANTITY': {
    ruleId: 'US-FDA-NET-QTY-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'NET_QUANTITY',
    declarationLabel: 'Net Quantity of Contents (Dual US Customary & Metric)',
    authority: 'FDA 21 CFR §101.7',
    sourceCitation: '21 CFR §101.7(f) & 21 CFR §101.105',
    sourceURL: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.7',
    allowedPanelRoles: ['principal_display_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    regionConstraint: 'bottom_30_percent',
    exceptions: [
      {
        id: 'SMALL_PDP_EXCEPTION',
        citation: '21 CFR §101.7(f)',
        description: 'Where the principal display panel is 5 square inches or less, the declaration may appear anywhere on the PDP rather than bottom 30%.',
        condition: (panelGeometry) => (panelGeometry?.areaSqInches || 999) <= 5.0,
        alternateConstraint: 'anywhere_on_panel',
      },
    ],
    typeSizeTiers: [
      { maxAreaSqIn: 5, minHeightPt: 4.5, label: '1/16 in (4.5 pt)' },
      { maxAreaSqIn: 25, minHeightPt: 9.0, label: '1/8 in (9 pt)' },
      { maxAreaSqIn: 100, minHeightPt: 13.5, label: '3/16 in (13.5 pt)' },
      { maxAreaSqIn: 400, minHeightPt: 18.0, label: '1/4 in (18 pt)' },
      { maxAreaSqIn: Infinity, minHeightPt: 36.0, label: '1/2 in (36 pt)' },
    ],
    unitsRequired: ['us_customary', 'metric'],
  },

  // 2. US FDA Name and Place of Business (21 CFR §101.2 & 21 CFR §101.5)
  'US_MANUFACTURER_ADDRESS': {
    ruleId: 'US-FDA-MFR-ADDR-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'MANUFACTURER_ADDRESS',
    declarationLabel: 'Name and Place of Business (Manufacturer/Packer/Distributor)',
    authority: 'FDA 21 CFR §101.5',
    sourceCitation: '21 CFR §101.2(b) & 21 CFR §101.5',
    sourceURL: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.5',
    // May appear on either the PDP or the Information Panel
    allowedPanelRoles: ['principal_display_panel', 'information_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    regionConstraint: 'panel_lower_region',
    exceptions: [
      {
        id: 'STREET_ADDRESS_DIRECTORY_EXCEPTION',
        citation: '21 CFR §101.5(d)',
        description: 'The street address may be omitted if it is shown in a current city directory or telephone directory.',
      },
    ],
    typeSizeTiers: [
      { minHeightPt: 4.5, label: '1/16 in (4.5 pt) minimum prominent type' },
    ],
  },

  // 3. US FDA Nutrition Facts Panel (21 CFR §101.9)
  'US_NUTRITION_FACTS': {
    ruleId: 'US-FDA-NUTR-PANEL-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'NUTRITION_FACTS',
    declarationLabel: 'Nutrition Facts Panel',
    authority: 'FDA 21 CFR §101.9',
    sourceCitation: '21 CFR §101.9(j)(13) & 21 CFR §101.2',
    allowedPanelRoles: ['information_panel', 'principal_display_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    regionConstraint: 'contiguous_vertical_block',
    exceptions: [
      {
        id: 'LINEAR_DISPLAY_EXCEPTION',
        citation: '21 CFR §101.9(j)(13)(ii)(A)',
        description: 'Packages with 40 or fewer square inches available may use tabular or linear display.',
      },
    ],
  },

  // 4. India FSSAI Vegetarian / Non-Vegetarian Mark (FSS Regulations 2020)
  'IN_VEG_MARK': {
    ruleId: 'IN-FSSAI-VEG-01',
    ruleVersion: '2026.1',
    jurisdiction: 'IN',
    declarationType: 'VEG_MARK',
    declarationLabel: 'FSSAI Green Vegetarian Logo Mark',
    authority: 'FSS (Packaging and Labelling) Regulations §2.2.2',
    sourceCitation: 'FSSAI Packaging Regulations 2020 Reg 2.2.2',
    allowedPanelRoles: ['principal_display_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    regionConstraint: 'top_corner_region',
    preferredCorner: 'top_left',
  },
  'IN_VEG_LOGO': {
    ruleId: 'IN-FSSAI-VEG-01',
    ruleVersion: '2026.1',
    jurisdiction: 'IN',
    declarationType: 'VEG_MARK',
    declarationLabel: 'FSSAI Green Vegetarian Logo Mark',
    authority: 'FSS (Packaging and Labelling) Regulations §2.2.2',
    sourceCitation: 'FSSAI Packaging Regulations 2020 Reg 2.2.2',
    allowedPanelRoles: ['principal_display_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    regionConstraint: 'top_corner_region',
    preferredCorner: 'top_left',
  },

  // 5. India FSSAI MRP & License Declaration
  'IN_MRP_AND_LICENSE': {
    ruleId: 'IN-FSSAI-MRP-01',
    ruleVersion: '2026.1',
    jurisdiction: 'IN',
    declarationType: 'MRP_AND_LICENSE',
    declarationLabel: 'FSSAI 14-Digit Licence No. & Maximum Retail Price (MRP)',
    authority: 'FSS (Labelling and Display) Regulations 2020',
    sourceCitation: 'FSSAI Reg 2020 & Legal Metrology Act',
    allowedPanelRoles: ['information_panel', 'back_panel', 'side_panel'],
    requiredPanelRoles: ['information_panel'],
    regionConstraint: 'panel_lower_region',
  },
  'IN_MRP_LICENSE': {
    ruleId: 'IN-FSSAI-MRP-01',
    ruleVersion: '2026.1',
    jurisdiction: 'IN',
    declarationType: 'MRP_AND_LICENSE',
    declarationLabel: 'FSSAI 14-Digit Licence No. & Maximum Retail Price (MRP)',
    authority: 'FSS (Labelling and Display) Regulations 2020',
    sourceCitation: 'FSSAI Reg 2020 & Legal Metrology Act',
    allowedPanelRoles: ['information_panel', 'back_panel', 'side_panel'],
    requiredPanelRoles: ['information_panel'],
    regionConstraint: 'panel_lower_region',
  },

  // 6. Storage Instructions Mandate
  'US_STORAGE_INSTRUCTIONS': {
    ruleId: 'US-STORAGE-INSTR-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'STORAGE_INSTRUCTIONS',
    declarationLabel: 'Storage & Thermal Handling Instructions',
    authority: 'FDA 21 CFR §101 / Approved Quality Spec',
    sourceCitation: 'Product Storage Directive',
    allowedPanelRoles: ['information_panel', 'back_panel', 'principal_display_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    regionConstraint: 'panel_lower_region',
  },

  // 7. Bilingual Pair Requirement
  'US_BILINGUAL_PAIR': {
    ruleId: 'US-CA-BILINGUAL-01',
    ruleVersion: '2026.1',
    jurisdiction: 'CA',
    declarationType: 'BILINGUAL_PAIR',
    declarationLabel: 'Parallel Bilingual Language Declaration',
    authority: 'Consumer Packaging and Labelling Act §6 / FDR §B.01.012',
    sourceCitation: 'CPLA §6 & FDR §B.01.012',
    allowedPanelRoles: ['principal_display_panel', 'information_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    preferredPanelRole: 'principal_display_panel',
    regionConstraint: 'anywhere_on_panel',
  },
  // 8. Allergen Statement
  'US_ALLERGEN_STATEMENT': {
    ruleId: 'US-FDA-ALLERGEN-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'ALLERGEN_STATEMENT',
    declarationLabel: 'Major Food Allergen Statement (FALCPA / FASTER Act)',
    authority: 'FALCPA / FASTER Act (21 U.S.C. 343(w))',
    sourceCitation: '21 U.S.C. 343(w) & 21 CFR §101.2',
    allowedPanelRoles: ['information_panel', 'principal_display_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    regionConstraint: 'panel_lower_region',
    exceptions: [
      {
        id: 'INGREDIENT_COMMON_NAME_EXCEPTION',
        citation: '21 U.S.C. 343(w)(1)(A)',
        description: 'Separate "Contains" statement not required if all major allergens are declared by their common name directly in the ingredient list.',
      },
    ],
  },
  'CA_MULTILINGUAL_REQUIREMENT': {
    ruleId: 'CA-FDR-BILINGUAL-01',
    ruleVersion: '2026.1',
    jurisdiction: 'CA',
    declarationType: 'MULTILINGUAL_REQUIREMENT',
    declarationLabel: 'Bilingual Language Declaration (French / English)',
    authority: 'Health Canada FDR §B.01.012',
    sourceCitation: 'FDR §B.01.012 & CPLA §6',
    allowedPanelRoles: ['principal_display_panel', 'information_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    preferredPanelRole: 'principal_display_panel',
    regionConstraint: 'anywhere_on_panel',
  },
};

export {
  PLACEMENT_AUTHORITIES,
  LEGAL_STATUSES,
  REGION_TYPES,
  MAPPING_STATUSES,
  STATUTORY_PLACEMENT_REGISTRY,
  lookupPlacementRule,
  getAllPlacementRules,
} from './regulatory/placement-rules.mjs';

/**
 * Returns matching placement rule for a given declaration type and jurisdiction.
 */
export function getPlacementRule(declarationType, jurisdiction = 'US') {
  const normJur = String(jurisdiction || 'US').toUpperCase();
  const jurKey = normJur === 'IN' || normJur === 'INDIA' ? 'IN' : normJur === 'CA' || normJur === 'CANADA' ? 'CA' : 'US';
  const targetKey = `${jurKey}_${declarationType}`;

  if (PLACEMENT_RULES[targetKey]) {
    return PLACEMENT_RULES[targetKey];
  }

  // Fallback to US if jurisdiction specific not found
  const usKey = `US_${declarationType}`;
  return PLACEMENT_RULES[usKey] || null;
}
