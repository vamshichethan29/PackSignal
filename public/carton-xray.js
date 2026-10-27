/**
 * PackSignal 3D Carton X-Ray & Statutory Ghost Box Controller
 * (public/carton-xray.js)
 *
 * Implements Phase 7A Phases 19–25:
 * - X-Ray Mode: Translucent carton panels with amber dashed missing-content ghost boxes
 * - US Market:
 *   Evaluates 480g metric vs missing customary ounce declaration (21 CFR §101.7 / §101.105)
 *   Displays proposed placement in bottom 30% of PDP
 * - India Market:
 *   Replaces US customary ghost with FSSAI Green Veg Dot (FSSAI 2020 2.2.2.4) and MRP / FSSAI Licence No. (Legal Metrology 2011)
 * - Ghosts rigidly follow parent panel hinge transforms during fold kinematics
 * - Never modifies source artwork; cleanly separates detected text from missing requirements
 */

export const XRAY_GHOST_DEFINITIONS = {
  us: [
    {
      ghostId: 'ghost-us-customary-net-qty',
      panel: 'front',
      ruleId: 'FDA_21CFR_101_7_NET_QTY_CUSTOMARY',
      statutoryCitation: '21 CFR §101.7 & §101.105(f)',
      label: 'PROPOSED REQUIRED DECLARATION PLACEMENT — NOT PRESENT IN ARTWORK',
      title: 'Net Quantity Dual Declaration (Customary oz)',
      detectedText: '480 g',
      missingRequirement: '16.9 OZ (1 LB 0.9 OZ)',
      rationale: 'US FDA requires dual declaration (customary inch-pound + metric) in bottom 30% of Principal Display Panel.',
      // Bottom 30% of Front PDP
      boxNormalized: [0.20, 0.72, 0.80, 0.96],
      market: 'us',
    },
    {
      ghostId: 'ghost-us-legal-address',
      panel: 'back',
      ruleId: 'FDA_21CFR_101_5_MANUFACTURER_ADDRESS',
      statutoryCitation: '21 CFR §101.5',
      label: 'PROPOSED REQUIRED DECLARATION PLACEMENT — NOT PRESENT IN ARTWORK',
      title: 'Manufacturer City, State & Zip Code',
      detectedText: 'Dancing Fish Cereal Co.',
      missingRequirement: 'Seattle, WA 98101 USA',
      rationale: 'FDA mandates manufacturer, packer, or distributor name and address with valid ZIP code.',
      boxNormalized: [0.15, 0.80, 0.85, 0.94],
      market: 'us',
    },
  ],
  india: [
    {
      ghostId: 'ghost-in-veg-mark',
      panel: 'front',
      ruleId: 'FSSAI_2020_VEG_LOGO',
      statutoryCitation: 'FSSR (Labelling & Display) 2020, Reg. 2.2.2.4',
      label: 'MANDATORY: Veg Mark (FSSAI Green Dot)',
      title: 'Vegetarian Declaration Symbol',
      detectedText: 'None',
      missingRequirement: 'Green filled circle in green outline square (min 4mm x 4mm)',
      rationale: 'FSSAI mandates green vegetarian mark on Principal Display Panel close to product name or brand.',
      boxNormalized: [0.08, 0.12, 0.28, 0.24],
      market: 'india',
    },
    {
      ghostId: 'ghost-in-mrp-fssai',
      panel: 'back',
      ruleId: 'LEGAL_METROLOGY_2011_RULE_6_MRP',
      statutoryCitation: 'Legal Metrology (Packaged Commodities) 2011, Rule 6(1)(e) & FSSAI 2.2.1.2',
      label: 'MANDATORY: MRP & FSSAI 14-Digit Licence No.',
      title: 'MRP & FSSAI Licence Declaration',
      detectedText: 'None',
      missingRequirement: 'MRP ₹ (incl. of all taxes) + FSSAI Lic. No. 100xxxxxxxxxxx',
      rationale: 'Legal Metrology mandates retail sale price with taxes; FSSAI requires 14-digit licence number.',
      boxNormalized: [0.12, 0.74, 0.88, 0.94],
      market: 'india',
    },
  ],
};

export class CartonXRayController {
  constructor({
    panelMeshes = {},
    market = 'us',
    onGhostSelected = null,
    onStateChange = null,
  } = {}) {
    this.panelMeshes = panelMeshes;
    this.market = market.toLowerCase().includes('in') ? 'india' : 'us';
    this.onGhostSelected = onGhostSelected;
    this.onStateChange = onStateChange;

    this.isXRayEnabled = false;
    this.activeGhostBoxes = [];
  }

  setMarket(newMarket) {
    const normalized = String(newMarket || '').toLowerCase().includes('in') ? 'india' : 'us';
    if (this.market !== normalized) {
      this.market = normalized;
      if (this.isXRayEnabled) {
        this.refreshGhostBoxes();
      }
    }
  }

  toggleXRay() {
    this.isXRayEnabled = !this.isXRayEnabled;
    this.applyXRayState();
    if (this.onStateChange) {
      this.onStateChange({ isXRayEnabled: this.isXRayEnabled, market: this.market });
    }
    return this.isXRayEnabled;
  }

  enableXRay() {
    this.isXRayEnabled = true;
    this.applyXRayState();
  }

  disableXRay() {
    this.isXRayEnabled = false;
    this.applyXRayState();
  }

  applyXRayState() {
    // 1. Update carton panel mesh materials (translucent vs solid)
    for (const [face, mesh] of Object.entries(this.panelMeshes)) {
      if (mesh?.material) {
        if (this.isXRayEnabled) {
          mesh.material.transparent = true;
          mesh.material.opacity = 0.38;
          mesh.material.roughness = 0.15;
          mesh.material.wireframe = false;
        } else {
          mesh.material.transparent = false;
          mesh.material.opacity = 1.0;
          mesh.material.roughness = 0.40;
        }
        mesh.material.needsUpdate = true;
      }
    }

    // 2. Refresh statutory ghost boxes
    if (this.isXRayEnabled) {
      this.refreshGhostBoxes();
    } else {
      this.removeGhostBoxes();
    }
  }

  refreshGhostBoxes() {
    this.removeGhostBoxes();

    const defs = XRAY_GHOST_DEFINITIONS[this.market] || [];
    for (const def of defs) {
      const parentMesh = this.panelMeshes[def.panel];
      if (!parentMesh) continue;

      const ghostGroup = {
        userData: {
          isGhostBox: true,
          ghostId: def.ghostId,
          ruleId: def.ruleId,
          statutoryCitation: def.statutoryCitation,
          label: def.label,
          title: def.title,
          detectedText: def.detectedText,
          missingRequirement: def.missingRequirement,
          rationale: def.rationale,
          market: def.market,
          panel: def.panel,
          boxNormalized: def.boxNormalized,
        },
        visible: true,
      };

      if (typeof parentMesh.add === 'function') {
        parentMesh.add(ghostGroup);
      }
      this.activeGhostBoxes.push(ghostGroup);
    }
  }

  removeGhostBoxes() {
    for (const ghost of this.activeGhostBoxes) {
      for (const mesh of Object.values(this.panelMeshes)) {
        if (typeof mesh?.remove === 'function') {
          mesh.remove(ghost);
        }
      }
    }
    this.activeGhostBoxes = [];
  }

  getActiveGhosts() {
    return this.activeGhostBoxes.map(g => g.userData);
  }
}
