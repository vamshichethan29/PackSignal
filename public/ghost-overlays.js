/**
 * PackSignal — Ghost Bounding Boxes & X-Ray Mode
 * public/ghost-overlays.js
 *
 * Renders rule-backed statutory placement regions (LEGAL_ALLOWED_REGION)
 * and dashed amber layout proposals (DESIGNER_SUGGESTED_POSITION) on flat 2D
 * packaging artwork, carton dielines, and synchronizes with 3D carton faces.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/**
 * Standard statutory placement rules for browser-side derivation.
 */
export const CLIENT_PLACEMENT_RULES = {
  'NET_QUANTITY': {
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
    smallPdpThresholdSqIn: 5.0,
    typeSizeGuidance: 'Min 1/8 in (9 pt) for PDP 25-100 sq in (21 CFR §101.7(h))',
  },
  'MANUFACTURER_ADDRESS': {
    ruleId: 'US-FDA-MFR-ADDR-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'MANUFACTURER_ADDRESS',
    declarationLabel: 'Name and Place of Business (Manufacturer/Packer/Distributor)',
    authority: 'FDA 21 CFR §101.5',
    sourceCitation: '21 CFR §101.2(b) & 21 CFR §101.5',
    sourceURL: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.5',
    // Allowed on either PDP or Information Panel
    allowedPanelRoles: ['principal_display_panel', 'information_panel'],
    preferredPanelRole: 'information_panel',
    regionConstraint: 'panel_lower_region',
    typeSizeGuidance: 'Min 1/16 in (4.5 pt) for information panel text (21 CFR §101.2(c))',
  },
  'NUTRITION_FACTS': {
    ruleId: 'US-FDA-NUTRITION-01',
    ruleVersion: '2026.1',
    jurisdiction: 'US',
    declarationType: 'NUTRITION_FACTS',
    declarationLabel: 'Nutrition Facts Label',
    authority: 'FDA 21 CFR §101.9',
    sourceCitation: '21 CFR §101.9(j)(13) & 21 CFR §101.2',
    allowedPanelRoles: ['information_panel', 'principal_display_panel'],
    preferredPanelRole: 'information_panel',
    regionConstraint: 'panel_upper_region',
    typeSizeGuidance: 'Standard vertical or tabular format conforming to 21 CFR §101.9',
  },
  'VEG_MARK': {
    ruleId: 'IN-FSSAI-VEG-01',
    ruleVersion: '2026.1',
    jurisdiction: 'IN',
    declarationType: 'VEG_MARK',
    declarationLabel: 'FSSAI Vegetarian / Non-Vegetarian Logo',
    authority: 'FSSAI Food Safety and Standards (Labelling and Display) Reg 2020',
    sourceCitation: 'FSSAI FSR §2.2.2(4)',
    allowedPanelRoles: ['principal_display_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    regionConstraint: 'panel_upper_region',
    typeSizeGuidance: 'Min 3mm green square with 1.5mm filled circle on white background',
  }
};

/**
 * Derives canonical ghost records from review findings and options.
 */
export function deriveGhostRegions(review, customPlacements = {}) {
  if (!review?.findings?.length) return [];

  const market = String(review.options?.marketPreset || review.market || 'us').toLowerCase();
  const isIndia = market.includes('in') || market.includes('india');
  const jurisdiction = isIndia ? 'IN' : 'US';

  const options = review.options || {};
  const confirmedRoles = options.panelRoles || {};
  const zones = options.panelZones || {};

  // Resolve panel roles
  const pdpFace = confirmedRoles.principal_display_panel || (zones.front ? 'front' : 'front');
  const infoFace = confirmedRoles.information_panel || (zones.back ? 'back' : zones.right ? 'right' : 'back');

  let panelAuthority = 'UNKNOWN';
  if (options.panelRolesConfirmed === true || options.packageMappingConfirmed === true) {
    panelAuthority = 'REVIEWER_CONFIRMED';
  } else if (review.documents?.some(d => d.role === 'dieline' && d.vectorGeometry?.format === 'DXF')) {
    panelAuthority = 'VERIFIED_FROM_SOURCE';
  } else if (zones.front || zones.back) {
    panelAuthority = 'SUGGESTED';
  }

  const artworkDoc = (review.documents || []).find(d => d.role === 'artwork') || {};
  const page = artworkDoc.pages?.[0] || { width: 612, height: 792, number: 1 };

  const records = [];

  for (const finding of review.findings) {
    const field = String(finding.rule?.field || finding.field || '').toLowerCase();
    const title = String(finding.title || '').toLowerCase();

    let declarationType = null;
    if (field === 'net_quantity' || /net\s*quantity|volume|weight|net\s*wt/i.test(title)) {
      declarationType = 'NET_QUANTITY';
    } else if (field === 'business_details' || field === 'manufacturer' || /manufacturer|distributor|address|packer|business/i.test(title)) {
      declarationType = 'MANUFACTURER_ADDRESS';
    } else if (field.startsWith('nutrition') && /panel|facts|missing/i.test(title)) {
      declarationType = 'NUTRITION_FACTS';
    } else if (isIndia && /veg|vegetarian|logo|mark/i.test(title)) {
      declarationType = 'VEG_MARK';
    }

    if (!declarationType) continue;

    const rule = CLIENT_PLACEMENT_RULES[declarationType];
    if (!rule) continue;

    // Check if declaration was satisfied in an allowed panel
    if (finding.status === 'match') continue;

    // Verification state classification
    const hasArtworkEvidence = (finding.evidence || []).some(
      e => e.role === 'artwork' && e.quote && !/not detected/i.test(e.quote)
    );

    let verificationState = 'VERIFIED_MISSING';
    if (finding.rule?.supported === false || finding.method === 'review_input_gap') {
      verificationState = 'SOURCE_MISSING';
    } else if (hasArtworkEvidence && finding.status === 'issue') {
      const text = `${finding.title} ${finding.explanation} ${finding.observed}`.toLowerCase();
      if (/panel|placement|location|wrong face|side panel/i.test(text)) {
        verificationState = 'FOUND_WRONG_PANEL';
      }
    } else if (panelAuthority === 'UNKNOWN' && (rule.requiredPanelRoles || []).includes('principal_display_panel')) {
      verificationState = 'PANEL_UNCONFIRMED';
    } else if (review.options?.completeArtwork === false || finding.status === 'unable') {
      verificationState = 'POSSIBLY_MISSING';
    }

    // Determine target panel
    const applicableRoles = rule.allowedPanelRoles;
    const applicablePanels = [];
    if (applicableRoles.includes('principal_display_panel')) {
      applicablePanels.push({ role: 'principal_display_panel', face: pdpFace });
    }
    if (applicableRoles.includes('information_panel')) {
      applicablePanels.push({ role: 'information_panel', face: infoFace });
    }
    if (applicablePanels.length === 0) {
      applicablePanels.push({ role: 'principal_display_panel', face: pdpFace });
    }

    const primaryPanel = (rule.preferredPanelRole === 'information_panel' && infoFace)
      ? { role: 'information_panel', face: infoFace }
      : applicablePanels[0];

    // Panel box in normalized coords [x0, y0, x1, y1]
    const panelBox = primaryPanel.face === 'front'
      ? (zones.front?.box || [0.45, 0.15, 0.85, 0.85])
      : (zones[primaryPanel.face]?.box || [0.05, 0.15, 0.40, 0.85]);

    const [px0, py0, px1, py1] = panelBox;
    const pWidth = Math.max(0.01, px1 - px0);
    const pHeight = Math.max(0.01, py1 - py0);

    // Compute legal allowed zone
    let legalBounds = [px0, py0, px1, py1];
    let legalDescription = '';

    if (declarationType === 'NET_QUANTITY') {
      // FDA 21 CFR §101.7: Bottom 30% of PDP
      // Exception: PDP <= 5 sq inches allows declaration anywhere on PDP
      const widthInches = pWidth * (page.width / 72);
      const heightInches = pHeight * (page.height / 72);
      const areaSqIn = widthInches * heightInches;

      if (areaSqIn <= (rule.smallPdpThresholdSqIn || 5.0)) {
        legalBounds = [px0, py0, px1, py1];
        legalDescription = `Any location on PDP permitted under small-PDP exception (21 CFR §101.7(f), PDP area: ${areaSqIn.toFixed(1)} sq in ≤ 5.0 sq in)`;
      } else {
        const top30 = py1 - pHeight * 0.30;
        legalBounds = [px0, top30, px1, py1];
        legalDescription = 'Bottom 30% of confirmed Principal Display Panel (21 CFR §101.7(f))';
      }
    } else if (declarationType === 'MANUFACTURER_ADDRESS') {
      // Lower portion of chosen panel (PDP or info panel)
      const top40 = py1 - pHeight * 0.40;
      legalBounds = [px0, top40, px1, py1];
      legalDescription = primaryPanel.role === 'information_panel'
        ? 'Lower region of Information Panel (21 CFR §101.2 & §101.5)'
        : 'Permitted region of Principal Display Panel (21 CFR §101.2(b))';
    } else {
      legalBounds = [px0, py0, px1, py1];
      legalDescription = `Permitted region of ${primaryPanel.role} under ${rule.authority}`;
    }

    const ghostId = `ghost-${declarationType.toLowerCase()}-${finding.id}`;

    // Suggested placement within legal bounds
    const [lx0, ly0, lx1, ly1] = legalBounds;
    const lWidth = Math.max(0.01, lx1 - lx0);
    const lHeight = Math.max(0.01, ly1 - ly0);

    let suggestedBounds = [
      lx0 + lWidth * 0.10,
      ly0 + lHeight * 0.40,
      lx0 + lWidth * 0.90,
      ly0 + lHeight * 0.85,
    ];

    let isCustom = false;
    if (customPlacements[ghostId] && Array.isArray(customPlacements[ghostId])) {
      suggestedBounds = customPlacements[ghostId];
      isCustom = true;
    }

    // Check collision / fit against legal bounds
    const isInsideLegal = suggestedBounds[0] >= lx0 - 0.01 &&
      suggestedBounds[1] >= ly0 - 0.01 &&
      suggestedBounds[2] <= lx1 + 0.01 &&
      suggestedBounds[3] <= ly1 + 0.01;

    // Build candidate panel choices
    const candidateRegions = applicablePanels.map(p => {
      const pBox = p.face === 'front'
        ? (zones.front?.box || [0.45, 0.15, 0.85, 0.85])
        : (zones[p.face]?.box || [0.05, 0.15, 0.40, 0.85]);
      return {
        panelRole: p.role,
        panelFace: p.face,
        description: p.role === 'principal_display_panel' ? 'Principal Display Panel (PDP)' : 'Information Panel (Back/Side)',
        bounds: pBox,
      };
    });

    records.push({
      ghostId,
      findingId: finding.id,
      checkId: finding.rule?.id || finding.id,
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      declarationType,
      declarationLabel: rule.declarationLabel,
      authorityCitation: rule.sourceCitation,
      authorityURL: rule.sourceURL,
      typeSizeGuidance: rule.typeSizeGuidance,
      jurisdiction,
      selectedPanel: primaryPanel.role,
      selectedFace: primaryPanel.face,
      panelAuthority,
      applicablePanels: applicablePanels.map(p => p.role),
      applicableFaces: applicablePanels.map(p => p.face),
      candidateRegions,
      legalRegion: {
        normalizedBounds: legalBounds,
        description: legalDescription,
        constraint: rule.regionConstraint,
      },
      suggestedPlacement: {
        normalizedBounds: suggestedBounds,
        isCustomReviewerPlacement: isCustom,
        disclaimer: 'Suggested layout proposal — not an exact statutory position.',
      },
      fitAnalysis: {
        status: isInsideLegal ? 'FIT_LIKELY' : 'POTENTIAL_OVERLAP',
        isInsideLegal,
        notes: isInsideLegal ? 'Within verified statutory permitted region.' : 'Warning: Proposal extends outside statutory legal bounds.',
      },
      verificationState,
      findingTitle: finding.title,
      findingStatus: finding.status,
      expectedText: finding.expected || null,
      observedText: finding.observed || null,
      explanation: finding.explanation || '',
      evidence: finding.evidence || [],
      pageNumber: page.number || 1,
    });
  }

  // For sample reviews, ensure Case B (Manufacturer Address with candidate panels) is demonstrated
  if (review.sample && !records.some(r => r.declarationType === 'MANUFACTURER_ADDRESS')) {
    const rule = CLIENT_PLACEMENT_RULES['MANUFACTURER_ADDRESS'];
    const pBox = zones.back?.box || [0.05, 0.15, 0.40, 0.85];
    const [px0, py0, px1, py1] = pBox;
    const pHeight = Math.max(0.01, py1 - py0);
    const top40 = py1 - pHeight * 0.40;
    const legalBounds = [px0, top40, px1, py1];
    const defaultSuggested = [0.05, 0.68, 0.32, 0.745];
    const custom = customPlacements['ghost-mfr-address-info'];
    const suggestedBounds = custom?.normalizedBounds || defaultSuggested;

    const candidateRegions = [
      {
        panelRole: 'information_panel',
        panelFace: infoFace || 'back',
        description: 'Information Panel (21 CFR §101.2 & §101.5)',
        bounds: pBox,
      },
      {
        panelRole: 'principal_display_panel',
        panelFace: pdpFace || 'front',
        description: 'Principal Display Panel (21 CFR §101.2(b))',
        bounds: zones.front?.box || [0.45, 0.15, 0.85, 0.85],
      }
    ];

    records.push({
      ghostId: 'ghost-mfr-address-info',
      findingId: 'finding-sample-mfr-address',
      checkId: 'US-FDA-MFR-01',
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      declarationType: 'MANUFACTURER_ADDRESS',
      declarationLabel: rule.declarationLabel,
      authorityCitation: rule.sourceCitation,
      authorityURL: rule.sourceURL,
      typeSizeGuidance: rule.typeSizeGuidance,
      jurisdiction: 'US',
      selectedPanel: 'information_panel',
      selectedFace: infoFace || 'back',
      panelAuthority,
      applicablePanels: ['information_panel', 'principal_display_panel'],
      applicableFaces: [infoFace || 'back', pdpFace || 'front'],
      candidateRegions,
      legalRegion: {
        normalizedBounds: legalBounds,
        description: 'Lower region of Information Panel or PDP (21 CFR §101.2 & §101.5)',
        constraint: rule.regionConstraint,
      },
      suggestedPlacement: {
        normalizedBounds: suggestedBounds,
        isCustomReviewerPlacement: Boolean(custom),
        disclaimer: 'Suggested layout proposal — not an exact statutory position.',
      },
      fitAnalysis: {
        status: 'FIT_LIKELY',
        isInsideLegal: true,
        notes: 'Statutory permitted placement on Information Panel (21 CFR §101.2).',
      },
      verificationState: 'VERIFIED_MISSING',
      findingTitle: 'Statutory Manufacturer / Distributor Address Placement',
      findingStatus: 'issue',
      expectedText: 'PackSignal Foods LLC, 100 Artisan Way, Portland OR 97201',
      observedText: 'Address declaration missing from Information Panel and PDP',
      explanation: 'Manufacturer, packer, or distributor business identity required under 21 CFR §101.5.',
      evidence: [],
      pageNumber: 1,
    });
  }

  return records;
}

/**
 * Renders the 2D Ghost Overlay HTML Layer for the artwork canvas.
 */
export function renderGhostOverlayLayer(review, pageNumber = 1, options = {}) {
  const customPlacements = options.customPlacements || {};
  const activeGhostId = options.activeGhostId || null;
  const isXRay = options.isXRay !== false;

  const ghosts = deriveGhostRegions(review, customPlacements).filter(g => g.pageNumber === pageNumber);

  if (!isXRay || ghosts.length === 0) {
    return '';
  }

  return `
    <div class="workbench-xray-layer workbench-ghost-overlay-layer" data-layer-id="ghost-regions" data-ghost-overlay-layer>
      ${ghosts.map(ghost => {
        const [lx0, ly0, lx1, ly1] = ghost.legalRegion.normalizedBounds;
        const [sx0, sy0, sx1, sy1] = ghost.suggestedPlacement.normalizedBounds;

        const legalStyle = `left:${(lx0 * 100).toFixed(2)}%;top:${(ly0 * 100).toFixed(2)}%;width:${((lx1 - lx0) * 100).toFixed(2)}%;height:${((ly1 - ly0) * 100).toFixed(2)}%;`;
        const suggestedStyle = `left:${(sx0 * 100).toFixed(2)}%;top:${(sy0 * 100).toFixed(2)}%;width:${((sx1 - sx0) * 100).toFixed(2)}%;height:${((sy1 - sy0) * 100).toFixed(2)}%;`;

        const isNetQty = ghost.declarationType === 'NET_QUANTITY';
        const isAddress = ghost.declarationType === 'MANUFACTURER_ADDRESS';
        const specificClass = isNetQty ? 'ghost-net-qty' : isAddress ? 'ghost-address' : 'ghost-generic';
        const isSelected = activeGhostId === ghost.ghostId;

        const badgeColor = isNetQty ? '#ef4444' : '#f59e0b';
        const badgeText = isNetQty ? 'GHOST: MISSING NET QTY (16.9 oz)' : isAddress ? 'GHOST: MISSING MFR ADDRESS' : `GHOST: ${ghost.declarationType}`;

        return `
          <!-- 1. STATUTORY LEGAL PERMITTED REGION -->
          <div class="workbench-legal-region ${isSelected ? 'selected' : ''}"
               data-ghost-id="${esc(ghost.ghostId)}"
               data-finding-id="${esc(ghost.findingId)}"
               style="${legalStyle}"
               title="Statutory Permitted Region: ${esc(ghost.legalRegion.description)} (${esc(ghost.authorityCitation)})">
            <span class="legal-region-watermark">PERMITTED REGION: ${esc(ghost.legalRegion.description)}</span>
          </div>

          <!-- 2. DESIGNER SUGGESTED PLACEMENT BOX (Dashed Amber) -->
          <div class="workbench-ghost-box ${specificClass} ${isSelected ? 'selected' : ''} ${ghost.fitAnalysis.isInsideLegal ? '' : 'overflow-warning'}"
               data-ghost-id="${esc(ghost.ghostId)}"
               data-finding-id="${esc(ghost.findingId)}"
               style="${suggestedStyle}"
               title="MISSING STATUTORY DECLARATION: ${esc(ghost.declarationLabel)} (${esc(ghost.authorityCitation)}) — Click to inspect or adjust">
            <span class="ghost-badge" style="background:${badgeColor};color:#fff;">
              ${badgeText}
            </span>
            <div class="ghost-sublabel">
              <span class="ghost-rule-pill">${esc(ghost.authorityCitation)}</span>
              ${ghost.suggestedPlacement.isCustomReviewerPlacement ? '<span class="ghost-custom-pill">Reviewer Adjusted</span>' : ''}
              ${!ghost.fitAnalysis.isInsideLegal ? '<span class="ghost-overflow-pill">⚠ Bounds Warning</span>' : ''}
            </div>
            <div class="ghost-resize-handle" title="Drag to adjust suggested placement preview">⤡</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Renders the Interactive Ghost Card Dialog.
 */
export function renderGhostDetailCard(ghostRecord, review) {
  if (!ghostRecord) return '';

  const {
    ghostId,
    findingId,
    declarationLabel,
    declarationType,
    authorityCitation,
    authorityURL,
    typeSizeGuidance,
    verificationState,
    selectedPanel,
    selectedFace,
    panelAuthority,
    applicablePanels,
    candidateRegions,
    legalRegion,
    suggestedPlacement,
    fitAnalysis,
    findingTitle,
    expectedText,
    observedText,
    explanation,
  } = ghostRecord;

  const isConfirmed = ghostRecord.reviewerConfirmation?.confirmed;
  const isIndia = ghostRecord.jurisdiction === 'IN';

  return `
    <div class="ghost-card-modal-content">
      <div class="ghost-card-header">
        <div class="ghost-card-pill ${verificationState.toLowerCase()}">
          ${esc(verificationState.replace(/_/g, ' '))}
        </div>
        <h3>${esc(declarationLabel)}</h3>
        <p class="ghost-card-subtitle">Visualizing Statutory Placement on ${esc(selectedPanel.replace(/_/g, ' ').toUpperCase())} (Face: ${esc(selectedFace)})</p>
      </div>

      <div class="ghost-card-grid">
        <!-- Artwork Status -->
        <div class="ghost-card-block">
          <small>CURRENT ARTWORK STATUS</small>
          <b>${esc(observedText || 'No matching statutory declaration found in inspected region')}</b>
          <p class="ghost-card-note">${esc(explanation || 'Automated inspection detected the omission of this required statutory element.')}</p>
        </div>

        <!-- Required Area -->
        <div class="ghost-card-block">
          <small>PERMITTED LEGAL REGION</small>
          <b>${esc(legalRegion.description)}</b>
          <p class="ghost-card-note">Panel Authority: <code>${esc(panelAuthority)}</code> · ${applicablePanels.length > 1 ? `Alternative allowed panels: ${applicablePanels.join(', ')}` : 'Exclusive required panel'}</p>
        </div>

        <!-- Rule Citation -->
        <div class="ghost-card-block">
          <small>STATUTORY GOVERNING RULE</small>
          <div class="ghost-rule-citation">
            <b>${esc(authorityCitation)}</b>
            ${authorityURL ? `<a href="${esc(authorityURL)}" target="_blank" rel="noopener noreferrer" class="ghost-rule-link">View Regulation ↗</a>` : ''}
          </div>
          <p class="ghost-card-note">${esc(typeSizeGuidance || 'Strict typography and clearance standards apply.')}</p>
        </div>

        <!-- Source Specification -->
        <div class="ghost-card-block">
          <small>APPROVED SPECIFICATION / VALUE</small>
          <b>${esc(expectedText || 'Specification reference missing; designer verification required.')}</b>
          <p class="ghost-card-note">Status: ${expectedText ? 'Approved Label Copy Available' : 'Source Copy Pending Confirmation'}</p>
        </div>
      </div>

      <!-- Multiple Panel Candidates (e.g. Address on PDP vs Info Panel) -->
      ${candidateRegions && candidateRegions.length > 1 ? `
        <div class="ghost-card-candidates">
          <h4>Alternative Permitted Labeling Panels:</h4>
          <div class="ghost-panel-options">
            ${candidateRegions.map(c => `
              <label class="ghost-panel-option ${selectedPanel === c.panelRole ? 'active' : ''}">
                <input type="radio" name="ghost-panel-role" value="${esc(c.panelRole)}" ${selectedPanel === c.panelRole ? 'checked' : ''}>
                <span><b>${esc(c.description)}</b> (Face: ${esc(c.panelFace)})</span>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Fit Analysis -->
      <div class="ghost-card-fit ${fitAnalysis.isInsideLegal ? 'fit-pass' : 'fit-warn'}">
        <span class="fit-icon">${fitAnalysis.isInsideLegal ? '✓' : '⚠'}</span>
        <div class="fit-details">
          <b>Suggested Placement Fit: ${esc(fitAnalysis.status)}</b>
          <small>${esc(fitAnalysis.notes)} Notice: Dashed box is an illustrative layout proposal; coordinates are not legally mandated.</small>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="ghost-card-actions">
        <button type="button" class="btn secondary" data-action="view-rule" data-rule="${esc(authorityCitation)}">
          📖 View Rule Citation
        </button>
        <button type="button" class="btn secondary" data-action="view-source" data-finding-id="${esc(findingId)}">
          📄 View Source Fact
        </button>
        <button type="button" class="btn secondary" data-action="confirm-panel" data-panel="${esc(selectedPanel)}" data-face="${esc(selectedFace)}">
          ☑ ${panelAuthority === 'REVIEWER_CONFIRMED' ? 'Panel Confirmed' : `Confirm ${selectedPanel === 'principal_display_panel' ? 'PDP' : 'Info Panel'}`}
        </button>
        <button type="button" class="btn secondary" data-action="ask-someone-ghost" data-finding-id="${esc(findingId)}">
          💬 Ask Someone
        </button>
        <button type="button" class="btn secondary" data-action="create-ticket-ghost" data-finding-id="${esc(findingId)}">
          🎫 Create Correction Ticket
        </button>
        <button type="button" class="btn primary" data-action="show-in-3d-ghost" data-face="${esc(selectedFace)}">
          🧊 Show in 3D Carton
        </button>
      </div>

      <!-- Placement Adjustment Controls -->
      <div class="ghost-adjustment-toolbar">
        <span class="adjust-label">Preview Placement:</span>
        <button type="button" class="btn-micro" data-action="reset-placement" data-ghost-id="${esc(ghostId)}" title="Reset to standard rule-derived default position">Reset</button>
        <button type="button" class="btn-micro" data-action="nudge-up" data-ghost-id="${esc(ghostId)}" title="Nudge layout proposal up">↑ Up</button>
        <button type="button" class="btn-micro" data-action="nudge-down" data-ghost-id="${esc(ghostId)}" title="Nudge layout proposal down">↓ Down</button>
        <button type="button" class="btn-micro" data-action="confirm-placement" data-ghost-id="${esc(ghostId)}" title="Confirm layout proposal instruction for correction ticket">Confirm Layout Proposal</button>
      </div>
    </div>
  `;
}

/**
 * Attaches event listeners for ghost overlay interactions on the artwork canvas.
 */
export function mountGhostOverlayHandlers(container, callbacks = {}) {
  if (!container) return;

  // Click on ghost box or legal region
  container.addEventListener('click', (event) => {
    const target = event.target.closest('.workbench-ghost-box, .workbench-legal-region');
    if (!target) return;

    event.stopPropagation();
    const ghostId = target.getAttribute('data-ghost-id');
    const findingId = target.getAttribute('data-finding-id');

    if (callbacks.onSelectGhost) {
      callbacks.onSelectGhost(ghostId, findingId);
    }
  });

  // Dragging / nudging ghost boxes
  let isDragging = false;
  let activeBox = null;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  container.addEventListener('mousedown', (event) => {
    const handle = event.target.closest('.ghost-resize-handle');
    if (!handle) return;

    activeBox = handle.closest('.workbench-ghost-box');
    if (!activeBox) return;

    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    origLeft = parseFloat(activeBox.style.left) || 0;
    origTop = parseFloat(activeBox.style.top) || 0;
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging || !activeBox) return;

    const frame = container.querySelector('.workbench-art-frame') || container;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dx = ((event.clientX - startX) / rect.width) * 100;
    const dy = ((event.clientY - startY) / rect.height) * 100;

    const newLeft = Math.max(0, Math.min(90, origLeft + dx));
    const newTop = Math.max(0, Math.min(90, origTop + dy));

    activeBox.style.left = `${newLeft.toFixed(2)}%`;
    activeBox.style.top = `${newTop.toFixed(2)}%`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging && activeBox) {
      isDragging = false;
      const ghostId = activeBox.getAttribute('data-ghost-id');
      const left = (parseFloat(activeBox.style.left) || 0) / 100;
      const top = (parseFloat(activeBox.style.top) || 0) / 100;
      const width = (parseFloat(activeBox.style.width) || 20) / 100;
      const height = (parseFloat(activeBox.style.height) || 10) / 100;

      if (callbacks.onAdjustPlacement) {
        callbacks.onAdjustPlacement(ghostId, [left, top, left + width, top + height]);
      }
      activeBox = null;
    }
  });
}
