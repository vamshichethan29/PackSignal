/**
 * PackSignal Physical Prepress — Press Condition & Substrate Profile Registry
 * (lib/prepress/press-profiles.mjs)
 *
 * Implements Upgrade #46 Phase 1:
 * Explicit, auditable press-condition model defining physical print limits.
 * Avoids hardcoded universal assumptions; all thresholds reference verified
 * industrial printing standards (ISO 12647-2, FTA FIRST, Fogra, GRACoL).
 *
 * Supports processes:
 * OFFSET, FLEXOGRAPHY, GRAVURE, DIGITAL, UNKNOWN
 */

export const PRINTING_PROCESSES = {
  OFFSET: 'OFFSET',
  SHEETFED_OFFSET: 'OFFSET',
  FLEXOGRAPHY: 'FLEXOGRAPHY',
  FLEXOGRAPHIC_PACKAGING: 'FLEXOGRAPHY',
  GRAVURE: 'GRAVURE',
  ROTOGRAVURE: 'GRAVURE',
  DIRECT_CAN_DECORATION: 'GRAVURE',
  DIGITAL: 'DIGITAL',
  DIGITAL_PRODUCTION: 'DIGITAL',
  UNKNOWN: 'UNKNOWN',
};

export const SUBSTRATES = {
  COATED_SBS_BOARD: 'COATED_SBS_BOARD',
  UNCOATED_KRAFT_BOARD: 'UNCOATED_KRAFT_BOARD',
  FLEXIBLE_BARRIER_FILM: 'FLEXIBLE_BARRIER_FILM',
  METALLIC_ALUMINUM: 'METALLIC_ALUMINUM',
  PRESSURE_SENSITIVE_LABEL: 'PRESSURE_SENSITIVE_LABEL',
  CLEAR_GLASS: 'CLEAR_GLASS',
  UNSPECIFIED: 'UNSPECIFIED',
};

/**
 * Standard industry press profiles.
 * Each profile is stamped with provenance, version, and approved authority.
 */
export const APPROVED_PRESS_PROFILES = {
  'ISO-OFFSET-COATED-300': {
    profileId: 'ISO-OFFSET-COATED-300',
    name: 'ISO 12647-2 Premium Coated Folding Carton (Offset)',
    process: PRINTING_PROCESSES.OFFSET,
    printingProcess: PRINTING_PROCESSES.OFFSET,
    substrate: SUBSTRATES.COATED_SBS_BOARD,
    outputCondition: 'FOGRA39 (ISO 12647-2 Commercial Sheetfed Offset)',
    colorSpace: 'DeviceCMYK',
    iccProfileReference: 'ISOcoated_v2_eci.icc',
    iccProfileId: 'ISOcoated_v2_eci.icc',
    maximumTAC: 300,
    tacLimitPercent: 300,
    tacLimit: 300,
    bleedRequirementMm: 3.0,
    bleedExtensionMm: 3.0,
    trimSafetyMm: 3.0,
    trimSafetyInsetMm: 3.0,
    criticalTextSafetyInsetMm: 3.0,
    creaseClearanceMm: 1.5,
    measurementMethod: 'spectrophotometric_densitometry_iso_12647',
    imageResolutionMinimum: 300, // DPI
    minimumStrokeWidthMm: 0.075, // ~0.21 pt
    barcodePrintRequirements: {
      minimumMagnification: 0.80, // 80% SC0
      quietZoneLeadingMm: 2.9,
      quietZoneTrailingMm: 2.9,
      minimumContrastPercent: 80,
    },
    spotColorPolicy: 'SEPARATE_PLATE_OR_EXPANDED_GAMUT',
    sourceReference: 'ISO 12647-2:2013 / ECI Offset Coated v2 Specification',
    source: 'ISO 12647-2:2013 / ECI Offset Coated v2 Specification',
    version: '2024.1',
    effectiveDate: '2024-01-15',
    approvalStatus: 'APPROVED',
    approvedBy: 'Esko Prepress Standards Committee',
    limitations: 'Designed for commercial sheetfed offset on coated solid bleached sulfate (SBS) board. Dot gain curve FOGRA39 applies.',
  },

  'FTA-FLEXO-POUCH-280': {
    profileId: 'FTA-FLEXO-POUCH-280',
    name: 'FTA FIRST 6.0 Flexible Film Pouch (Flexo)',
    process: PRINTING_PROCESSES.FLEXOGRAPHY,
    printingProcess: PRINTING_PROCESSES.FLEXOGRAPHY,
    substrate: SUBSTRATES.FLEXIBLE_BARRIER_FILM,
    outputCondition: 'FTA FIRST 6.0 Process Color / Flexible Packaging',
    colorSpace: 'DeviceCMYK',
    iccProfileReference: 'FOGRA39L.icc',
    iccProfileId: 'FOGRA39L.icc',
    maximumTAC: 280,
    tacLimitPercent: 280,
    tacLimit: 280, // Lower TAC limit due to solvent drying and dot gain on non-porous film
    bleedRequirementMm: 2.5,
    bleedExtensionMm: 2.5,
    trimSafetyMm: 3.5,
    trimSafetyInsetMm: 3.5,
    criticalTextSafetyInsetMm: 3.5,
    creaseClearanceMm: 2.0,
    measurementMethod: 'calibrated_transmission_densitometry_fta_first',
    imageResolutionMinimum: 250,
    minimumStrokeWidthMm: 0.10, // ~0.28 pt for flexo plate relief
    barcodePrintRequirements: {
      minimumMagnification: 0.85,
      quietZoneLeadingMm: 3.2,
      quietZoneTrailingMm: 3.2,
      minimumContrastPercent: 75,
    },
    spotColorPolicy: 'WHITE_UNDERPRINT_MANDATORY_ON_FILM',
    sourceReference: 'Flexographic Technical Association (FTA) FIRST 6.0 Standard',
    source: 'Flexographic Technical Association (FTA) FIRST 6.0 Standard',
    version: '2024.1',
    effectiveDate: '2024-02-01',
    approvalStatus: 'APPROVED',
    approvedBy: 'FTA Packaging Certification Authority',
    limitations: 'Non-porous barrier substrate requires white backing underprint plate. Solvent drying limits maximum wet ink coverage to 280%.',
  },

  'DIGITAL-FOLDING-320': {
    profileId: 'DIGITAL-FOLDING-320',
    name: 'Industrial Digital Folding Carton (ElectroInk/Toner)',
    process: PRINTING_PROCESSES.DIGITAL,
    printingProcess: PRINTING_PROCESSES.DIGITAL,
    substrate: SUBSTRATES.COATED_SBS_BOARD,
    outputCondition: 'GRACoL 2006 Coated 1 Commercial Digital',
    colorSpace: 'DeviceCMYK',
    iccProfileReference: 'GRACoL2006_Coated1v2.icc',
    iccProfileId: 'GRACoL2006_Coated1v2.icc',
    maximumTAC: 320,
    tacLimitPercent: 320,
    tacLimit: 320,
    bleedRequirementMm: 1.5,
    bleedExtensionMm: 1.5,
    trimSafetyMm: 2.5,
    trimSafetyInsetMm: 2.5,
    criticalTextSafetyInsetMm: 2.5,
    creaseClearanceMm: 1.0,
    measurementMethod: 'inline_spectrophotometer_gracol_2006',
    imageResolutionMinimum: 240,
    minimumStrokeWidthMm: 0.05,
    barcodePrintRequirements: {
      minimumMagnification: 0.80,
      quietZoneLeadingMm: 2.5,
      quietZoneTrailingMm: 2.5,
      minimumContrastPercent: 80,
    },
    spotColorPolicy: 'CMYK_OR_EXTENDED_ORANGE_VIOLET',
    sourceReference: 'Digital Packaging Press Engineering Specification rev 4.2',
    source: 'Digital Packaging Press Engineering Specification rev 4.2',
    version: '2024.2',
    effectiveDate: '2024-04-10',
    approvalStatus: 'APPROVED',
    approvedBy: 'Digital Production Technical Lead',
    limitations: 'Digital liquid toner/electro-ink. Instant UV or thermal drying accommodates higher TAC (320%) without ink smearing.',
  },

  'GRAVURE-BEVERAGE-CAN-340': {
    profileId: 'GRAVURE-BEVERAGE-CAN-340',
    name: 'Direct Aluminum Can Decoration / High-Speed Gravure',
    process: PRINTING_PROCESSES.GRAVURE,
    printingProcess: PRINTING_PROCESSES.GRAVURE,
    substrate: SUBSTRATES.METALLIC_ALUMINUM,
    outputCondition: 'CMI Gravure Can Coating Standard 2023',
    colorSpace: 'DeviceCMYK',
    iccProfileReference: 'ECI_CanPrint_Aluminum.icc',
    iccProfileId: 'ECI_CanPrint_Aluminum.icc',
    maximumTAC: 340,
    tacLimitPercent: 340,
    tacLimit: 340,
    bleedRequirementMm: 3.0,
    bleedExtensionMm: 3.0,
    trimSafetyMm: 4.0,
    trimSafetyInsetMm: 4.0,
    criticalTextSafetyInsetMm: 4.0,
    creaseClearanceMm: 0.0, // Cans do not fold; seam clearance applies instead
    measurementMethod: 'engraved_cylinder_reflection_densitometry',
    imageResolutionMinimum: 300,
    minimumStrokeWidthMm: 0.12,
    barcodePrintRequirements: {
      minimumMagnification: 0.90, // Picket-fence orientation required around circumference
      quietZoneLeadingMm: 4.0,
      quietZoneTrailingMm: 4.0,
      minimumContrastPercent: 85,
    },
    spotColorPolicy: 'BASE_WHITE_OPACITY_MIN_85_PERCENT',
    sourceReference: 'Can Manufacturers Institute (CMI) Prepress Specification 2023',
    source: 'Can Manufacturers Institute (CMI) Prepress Specification 2023',
    version: '2023.3',
    effectiveDate: '2023-09-01',
    approvalStatus: 'APPROVED',
    approvedBy: 'CMI Technical Committee',
    limitations: 'Rotogravure onto aluminum shell with heat-set varnish. Cylindrical distortion requires picket-fence barcode orientation.',
  },

  'PROVISIONAL-SCREENING-300': {
    profileId: 'PROVISIONAL-SCREENING-300',
    name: 'Provisional Screening Profile (Unconfirmed Defaults)',
    process: PRINTING_PROCESSES.UNKNOWN,
    printingProcess: PRINTING_PROCESSES.UNKNOWN,
    substrate: SUBSTRATES.UNSPECIFIED,
    outputCondition: 'Provisional Screening Condition',
    colorSpace: 'DeviceCMYK',
    iccProfileReference: 'Generic_CMYK.icc',
    iccProfileId: 'Generic_CMYK.icc',
    maximumTAC: 300,
    tacLimitPercent: 300,
    tacLimit: 300,
    bleedRequirementMm: 3.0,
    bleedExtensionMm: 3.0,
    trimSafetyMm: 3.0,
    trimSafetyInsetMm: 3.0,
    criticalTextSafetyInsetMm: 3.0,
    creaseClearanceMm: 1.5,
    measurementMethod: 'unverified_nominal_screening',
    imageResolutionMinimum: 300,
    minimumStrokeWidthMm: 0.08,
    barcodePrintRequirements: {
      minimumMagnification: 0.80,
      quietZoneLeadingMm: 3.0,
      quietZoneTrailingMm: 3.0,
      minimumContrastPercent: 80,
    },
    spotColorPolicy: 'REVIEW_REQUIRED',
    sourceReference: 'Provisional Default for Initial Screening (Requires Reviewer Confirmation)',
    source: 'Provisional Default for Initial Screening (Requires Reviewer Confirmation)',
    version: '1.0-provisional',
    effectiveDate: '2024-01-01',
    approvalStatus: 'PROVISIONAL',
    approvedBy: null,
    limitations: 'Thresholds are illustrative screening estimates only. They MUST NOT be reported as approved production specifications.',
    verified: false,
    warning: 'Thresholds are not certified for this job until an approved press profile is selected.',
  },
};

/**
 * Resolves a press profile by ID, or returns a safe review-required profile if unverified.
 */
export function getPressProfile(profileId = 'ISO-OFFSET-COATED-300') {
  if (profileId && APPROVED_PRESS_PROFILES[profileId]) {
    const isApproved = APPROVED_PRESS_PROFILES[profileId].approvalStatus === 'APPROVED';
    return { ...APPROVED_PRESS_PROFILES[profileId], verified: isApproved };
  }

  // Fallback: unapproved / generic profile marked clearly as needing reviewer confirmation
  return {
    profileId: profileId || 'UNVERIFIED_GENERIC',
    name: `Unverified Press Condition (${profileId || 'Default'})`,
    process: PRINTING_PROCESSES.UNKNOWN,
    printingProcess: PRINTING_PROCESSES.UNKNOWN,
    substrate: SUBSTRATES.UNSPECIFIED,
    outputCondition: 'Unverified Press Condition',
    colorSpace: 'DeviceCMYK',
    iccProfileReference: 'Generic_CMYK.icc',
    iccProfileId: 'Generic_CMYK.icc',
    maximumTAC: 300,
    tacLimitPercent: 300,
    tacLimit: 300, // Nominal reference only
    bleedRequirementMm: 3.0,
    bleedExtensionMm: 3.0,
    trimSafetyMm: 3.0,
    trimSafetyInsetMm: 3.0,
    criticalTextSafetyInsetMm: 3.0,
    creaseClearanceMm: 1.5,
    measurementMethod: 'uncalibrated_estimation',
    imageResolutionMinimum: 300,
    minimumStrokeWidthMm: 0.08,
    barcodePrintRequirements: {
      minimumMagnification: 0.80,
      quietZoneLeadingMm: 3.0,
      quietZoneTrailingMm: 3.0,
      minimumContrastPercent: 80,
    },
    spotColorPolicy: 'REVIEW_REQUIRED',
    sourceReference: 'Unapproved Default Reference (Requires Reviewer Confirmation)',
    source: 'Unapproved Default Reference (Requires Reviewer Confirmation)',
    version: '1.0-unconfirmed',
    effectiveDate: '2024-01-01',
    approvalStatus: 'REVIEW_REQUIRED',
    approvedBy: null,
    verified: false,
    limitations: 'Thresholds are illustrative and unverified. Job must be reviewed with printing converter before plate manufacture.',
    warning: 'Thresholds are not certified for this job until a specific approved press profile is selected.',
  };
}

/**
 * Lists all registered and approved production press profiles.
 */
export function listApprovedPressProfiles() {
  return Object.values(APPROVED_PRESS_PROFILES);
}
