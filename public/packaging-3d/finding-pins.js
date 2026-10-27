/**
 * PackSignal 3D Packaging Studio — Finding Pins Projection & Evidence Linking
 * (public/packaging-3d/finding-pins.js)
 */

export const PIN_STATUS_COLORS = Object.freeze({
  issue: 0xdc2626,   // Red
  review: 0xd97706,  // Amber
  match: 0x16a34a,   // Green
  unable: 0x6b7280,  // Gray
});

export const PIN_STATUS_SHAPES = Object.freeze({
  issue: 'CONE',      // Alert
  review: 'DIAMOND',  // Uncertainty
  match: 'SPHERE',    // Verified
  unable: 'CYLINDER', // Question mark / neutral
});

export class PackagingFindingPinManager {
  constructor(THREE, { onSelectFinding = null } = {}) {
    this.THREE = THREE;
    this.onSelectFinding = onSelectFinding;
    this.pinGroup = new this.THREE.Group();
    this.pinGroup.name = 'packaging_finding_pins';
    this.activePins = [];
    this.activeDepartment = 'all';
  }

  /**
   * Projects review findings onto the 3D package model surfaces.
   */
  projectFindings({
    findings = [],
    mapPointFn = null,
    parentMesh = null,
    selectedFindingId = null,
    department = 'all',
  } = {}) {
    this.clear();
    this.activeDepartment = department;

    if (!this.THREE || !mapPointFn) return [];

    const locatedPins = [];

    for (const finding of findings) {
      if (!finding || !finding.id) continue;

      // Filter by department if active
      if (department !== 'all') {
        const findingDept = (finding.department || finding.reviewDomain || '').toLowerCase();
        if (findingDept && !findingDept.includes(department.toLowerCase())) {
          continue;
        }
      }

      // Check for actual located artwork bounding box
      const box = finding.box || finding.bbox || (finding.regions && finding.regions[0]?.box);
      if (!Array.isArray(box) || box.length < 4) {
        // Honest abstention: Never fabricate 3D pins for unlocated findings
        continue;
      }

      const [minX, minY, maxX, maxY] = box;
      const uCenter = (minX + maxX) / 2;
      const vCenter = (minY + maxY) / 2;

      const surfaceProj = mapPointFn(uCenter, vCenter);
      if (!surfaceProj || !surfaceProj.point) continue;

      const [px, py, pz] = surfaceProj.point;
      const [nx, ny, nz] = surfaceProj.normal || [0, 0, 1];

      const status = (finding.status || 'review').toLowerCase();
      const color = PIN_STATUS_COLORS[status] || PIN_STATUS_COLORS.review;

      // Build 3D pin marker geometry
      let geom;
      if (status === 'issue') {
        geom = new this.THREE.ConeGeometry(2.5, 6, 8);
        if (geom && typeof geom.rotateX === 'function') geom.rotateX(Math.PI / 2);
      } else if (status === 'match') {
        geom = new this.THREE.SphereGeometry(2.2, 12, 12);
      } else {
        geom = new this.THREE.OctahedronGeometry(2.5);
      }

      const mat = new this.THREE.MeshStandardMaterial({
        color,
        roughness: 0.2,
        metalness: 0.3,
        emissive: color,
        emissiveIntensity: finding.id === selectedFindingId ? 0.6 : 0.15,
      });

      const pinMesh = new this.THREE.Mesh(geom, mat);
      pinMesh.position.set(px, py, pz);

      // Orient pin along surface normal
      const normalVec = new this.THREE.Vector3(nx, ny, nz).normalize();
      pinMesh.quaternion.setFromUnitVectors(new this.THREE.Vector3(0, 0, 1), normalVec);

      pinMesh.userData = {
        findingId: finding.id,
        status,
        title: finding.title,
        surfacePoint: [px, py, pz],
        surfaceNormal: [nx, ny, nz],
        u: uCenter,
        v: vCenter,
        finding,
      };

      this.pinGroup.add(pinMesh);

      locatedPins.push({
        id: finding.id,
        mesh: pinMesh,
        status,
        point: [px, py, pz],
        normal: [nx, ny, nz],
        finding,
      });
    }

    this.activePins = locatedPins;
    return locatedPins;
  }

  setDepartmentFilter(department) {
    this.activeDepartment = department;
    for (const pin of this.activePins) {
      if (!pin.mesh) continue;
      if (department === 'all') {
        pin.mesh.visible = true;
      } else {
        const findingDept = (pin.finding.department || pin.finding.reviewDomain || '').toLowerCase();
        pin.mesh.visible = findingDept.includes(department.toLowerCase());
      }
    }
  }

  highlightFinding(findingId) {
    for (const pin of this.activePins) {
      if (!pin.mesh || !pin.mesh.material) continue;
      const isSelected = pin.id === findingId;
      pin.mesh.material.emissiveIntensity = isSelected ? 0.7 : 0.15;
      pin.mesh.scale.setScalar(isSelected ? 1.4 : 1.0);
    }
  }

  clear() {
    while (this.pinGroup.children.length > 0) {
      const child = this.pinGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.pinGroup.remove(child);
    }
    this.activePins = [];
  }

  dispose() {
    this.clear();
    if (this.pinGroup.parent) {
      this.pinGroup.parent.remove(this.pinGroup);
    }
  }
}
