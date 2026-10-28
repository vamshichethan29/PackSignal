/**
 * PackSignal 3D Evidence Pins & Overlay System
 * Renders status-colored defect pins and evidence region overlays
 * attached to 3D carton faces. Automatically transforms during folding.
 */

import { mapArtworkPointToPanel } from './fold-engine.js';

export const PIN_COLORS = {
  issue: 0xd84030,   // Red
  review: 0xd48816,  // Amber
  match: 0x2e7d32,   // Green
  unable: 0x757575,  // Gray
};

export class EvidencePinSystem {
  constructor(THREE) {
    this.THREE = THREE;
    this.pins = [];
    this.overlays = [];
    this.selectedFindingId = null;
    this.hoveredPin = null;

    // Shared geometries and materials
    this.pinGeometry = new this.THREE.CylinderGeometry(1.6, 1.6, 0.4, 24);
    this.pinGeometry.rotateX(Math.PI / 2); // Align disc with Z-normal

    this.ringGeometry = new this.THREE.RingGeometry(1.7, 2.2, 24);
    this.highlightRingGeometry = new this.THREE.RingGeometry(2.3, 3.0, 24);

    this.whiteMaterial = new this.THREE.MeshBasicMaterial({ color: 0xffffff });
    this.highlightMaterial = new this.THREE.MeshBasicMaterial({ color: 0xf0c14b, side: this.THREE.DoubleSide });

    this.statusMaterials = {
      issue: new this.THREE.MeshStandardMaterial({ color: PIN_COLORS.issue, roughness: 0.3, metalness: 0.1 }),
      review: new this.THREE.MeshStandardMaterial({ color: PIN_COLORS.review, roughness: 0.3, metalness: 0.1 }),
      match: new this.THREE.MeshStandardMaterial({ color: PIN_COLORS.match, roughness: 0.3, metalness: 0.1 }),
      unable: new this.THREE.MeshStandardMaterial({ color: PIN_COLORS.unable, roughness: 0.3, metalness: 0.1 }),
    };
  }

  /**
   * Builds pins and evidence overlays for all located findings across carton panels.
   *
   * @param {Object} options
   * @param {Object} options.review
   * @param {Object} options.panelMeshes - Map of faceName -> THREE.Mesh
   * @param {Object} options.panelZones - Map of faceName -> { page, box }
   * @param {Object} options.tree - Fold tree containing panel dimensions
   * @param {string} [options.selectedFindingId]
   */
  buildPins({ review, panelMeshes, panelZones, tree, selectedFindingId = null }) {
    this.clear();
    this.selectedFindingId = selectedFindingId;

    if (!review?.findings?.length || !panelMeshes) return [];

    const locatedPins = [];

    for (const finding of review.findings) {
      const artworkEvidence = (finding.evidence || []).filter(
        item => item.role === 'artwork' && Number.isInteger(item.page) && Array.isArray(item.box)
      );

      for (const [evidenceIndex, item] of artworkEvidence.entries()) {
        const [x0, y0, x1, y1] = item.box;
        const centerX = (x0 + x1) / 2;
        const centerY = (y0 + y1) / 2;

        // Find which panel contains this evidence (best overlap area with fallback margin)
        let matchedFace = null;
        let matchedZone = null;
        let maxOverlap = 0;

        for (const [faceName, zone] of Object.entries(panelZones || {})) {
          if (zone?.page === item.page && Array.isArray(zone.box)) {
            const [zx0, zy0, zx1, zy1] = zone.box;
            const ox0 = Math.max(x0, zx0);
            const oy0 = Math.max(y0, zy0);
            const ox1 = Math.min(x1, zx1);
            const oy1 = Math.min(y1, zy1);
            if (ox1 > ox0 && oy1 > oy0) {
              const overlapArea = (ox1 - ox0) * (oy1 - oy0);
              if (overlapArea > maxOverlap) {
                maxOverlap = overlapArea;
                matchedFace = faceName;
                matchedZone = zone;
              }
            }
          }
        }

        if (!matchedFace) {
          for (const [faceName, zone] of Object.entries(panelZones || {})) {
            if (zone?.page === item.page && Array.isArray(zone.box)) {
              const [zx0, zy0, zx1, zy1] = zone.box;
              const margin = 0.04;
              if (centerX >= zx0 - margin && centerX <= zx1 + margin &&
                  centerY >= zy0 - margin && centerY <= zy1 + margin) {
                matchedFace = faceName;
                matchedZone = zone;
                break;
              }
            }
          }
        }

        if (!matchedFace || !panelMeshes[matchedFace]) continue;

        const panelMesh = panelMeshes[matchedFace];
        const panelDims = tree?.panels?.[matchedFace] || {
          width: panelMesh.geometry.parameters?.width || 50,
          height: panelMesh.geometry.parameters?.height || 100,
        };

        const mapped = mapArtworkPointToPanel([centerX, centerY], matchedZone, panelDims, 0.4);
        if (!mapped || !mapped.inside) continue;

        const status = finding.status || 'review';
        const isSelectedFinding = finding.id === this.selectedFindingId;
        const statusColor = PIN_COLORS[status] || PIN_COLORS.review;

        // Evidence bounding box dimensions on panel surface
        const zoneW = Math.max(1e-4, matchedZone.box[2] - matchedZone.box[0]);
        const zoneH = Math.max(1e-4, matchedZone.box[3] - matchedZone.box[1]);
        const overlayW = Math.max(2.5, ((x1 - x0) / zoneW) * panelDims.width);
        const overlayH = Math.max(2.5, ((y1 - y0) / zoneH) * panelDims.height);
        const hw = overlayW / 2;
        const hh = overlayH / 2;

        // 3D BOUNDARY BOX OBJECT
        const boundaryGroup = new this.THREE.Group();
        boundaryGroup.position.set(mapped.localPoint[0], mapped.localPoint[1], isSelectedFinding ? 0.25 : 0.12);

        // 1. Tinted Fill Surface
        const fillGeom = new this.THREE.PlaneGeometry(overlayW, overlayH);
        const fillMat = new this.THREE.MeshBasicMaterial({
          color: isSelectedFinding ? 0xf59e0b : statusColor,
          transparent: true,
          opacity: isSelectedFinding ? 0.35 : 0.10,
          side: this.THREE.DoubleSide,
          depthWrite: false,
        });
        const fillMesh = new this.THREE.Mesh(fillGeom, fillMat);
        boundaryGroup.add(fillMesh);

        // 2. High-contrast Perimeter Border Wireframe Line
        const framePts = [
          new this.THREE.Vector3(-hw, -hh, 0.05),
          new this.THREE.Vector3(hw, -hh, 0.05),
          new this.THREE.Vector3(hw, hh, 0.05),
          new this.THREE.Vector3(-hw, hh, 0.05),
          new this.THREE.Vector3(-hw, -hh, 0.05),
        ];
        const frameGeom = new this.THREE.BufferGeometry().setFromPoints(framePts);
        const frameMat = new this.THREE.LineBasicMaterial({
          color: isSelectedFinding ? 0xf59e0b : statusColor,
          linewidth: isSelectedFinding ? 3 : 1.5,
          transparent: true,
          opacity: isSelectedFinding ? 1.0 : 0.40,
          depthTest: false,
        });
        const frameLine = new this.THREE.Line(frameGeom, frameMat);
        boundaryGroup.add(frameLine);

        // 3. Four Corner L-Brackets for Sharp Inspection Focus
        const cLen = Math.min(Math.min(overlayW, overlayH) * 0.35, 3.5);
        const cornerPts = [
          new this.THREE.Vector3(-hw, hh - cLen, 0.08), new this.THREE.Vector3(-hw, hh, 0.08),
          new this.THREE.Vector3(-hw, hh, 0.08), new this.THREE.Vector3(-hw + cLen, hh, 0.08),
          new this.THREE.Vector3(hw - cLen, hh, 0.08), new this.THREE.Vector3(hw, hh, 0.08),
          new this.THREE.Vector3(hw, hh, 0.08), new this.THREE.Vector3(hw, hh - cLen, 0.08),
          new this.THREE.Vector3(hw, -hh + cLen, 0.08), new this.THREE.Vector3(hw, -hh, 0.08),
          new this.THREE.Vector3(hw, -hh, 0.08), new this.THREE.Vector3(hw - cLen, -hh, 0.08),
          new this.THREE.Vector3(-hw + cLen, -hh, 0.08), new this.THREE.Vector3(-hw, -hh, 0.08),
          new this.THREE.Vector3(-hw, -hh, 0.08), new this.THREE.Vector3(-hw, -hh + cLen, 0.08),
        ];
        const cornerGeom = new this.THREE.BufferGeometry().setFromPoints(cornerPts);
        const cornerMat = new this.THREE.LineBasicMaterial({
          color: 0xffffff,
          linewidth: 2.5,
          transparent: true,
          opacity: isSelectedFinding ? 1.0 : 0.0,
          depthTest: false,
        });
        const cornerLines = new this.THREE.LineSegments(cornerGeom, cornerMat);
        boundaryGroup.add(cornerLines);

        panelMesh.add(boundaryGroup);

        // Pin disc placed near top-right corner of the boundary
        const pinGroup = new this.THREE.Group();
        pinGroup.position.set(mapped.localPoint[0] + hw, mapped.localPoint[1] + hh, 0.3);

        const mat = this.statusMaterials[status] || this.statusMaterials.review;

        // Pin disc
        const pinMesh = new this.THREE.Mesh(this.pinGeometry, mat);
        pinGroup.add(pinMesh);

        // White border ring
        const ringMesh = new this.THREE.Mesh(this.ringGeometry, this.whiteMaterial);
        ringMesh.position.z = 0.05;
        pinGroup.add(ringMesh);

        // Highlight ring (visible only when selected)
        const hlMesh = new this.THREE.Mesh(this.highlightRingGeometry, this.highlightMaterial);
        hlMesh.position.z = 0.06;
        hlMesh.visible = isSelectedFinding;
        pinGroup.add(hlMesh);

        const pinData = {
          findingId: finding.id,
          findingTitle: finding.title || 'Untitled finding',
          status,
          severity: finding.severity || 'medium',
          faceName: matchedFace,
          page: item.page,
          sourceBox: item.box,
          evidenceIndex,
          localPoint: mapped.localPoint,
          group: pinGroup,
          pinMesh,
          hlMesh,
          boundaryGroup,
          fillMesh,
          frameLine,
          cornerLines,
          overlayMesh: fillMesh,
          panelMesh,
        };

        pinMesh.userData = pinData;
        pinGroup.userData = pinData;

        // Attach pin directly to panel mesh so it stays anchored during fold!
        panelMesh.add(pinGroup);

        this.pins.push(pinData);
        this.overlays.push(fillMesh);
        locatedPins.push(pinData);
      }
    }

    return locatedPins;
  }

  /**
   * Builds pins for a single continuous surface (Can, Bottle, or Pouch).
   *
   * @param {Object} options
   * @param {Object} options.review
   * @param {Function} options.mapPointFn - (u, v) => { point: [x,y,z], normal: [nx,ny,nz] }
   * @param {THREE.Object3D} options.parentMesh
   * @param {string} [options.selectedFindingId]
   * @param {string} [options.formatName='model']
   */
  buildPinsForSurface({ review, mapPointFn, parentMesh, selectedFindingId = null, formatName = 'model' }) {
    this.clear();
    this.selectedFindingId = selectedFindingId;
    if (!review?.findings?.length || !parentMesh || !mapPointFn) return [];

    const locatedPins = [];

    for (const finding of review.findings) {
      const artworkEvidence = (finding.evidence || []).filter(
        item => item.role === 'artwork' && Array.isArray(item.box)
      );

      for (const [evidenceIndex, item] of artworkEvidence.entries()) {
        const [x0, y0, x1, y1] = item.box;
        const u = (x0 + x1) / 2;
        const v = (y0 + y1) / 2;

        const mapped = mapPointFn(u, v);
        if (!mapped || !mapped.point) continue;

        const pinGroup = new this.THREE.Group();
        pinGroup.position.set(...mapped.point);

        if (mapped.normal) {
          const normalVec = new this.THREE.Vector3(...mapped.normal).normalize();
          const upVec = new this.THREE.Vector3(0, 0, 1);
          pinGroup.quaternion.setFromUnitVectors(upVec, normalVec);
        }

        const status = finding.status || 'review';
        const mat = this.statusMaterials[status] || this.statusMaterials.review;

        const pinMesh = new this.THREE.Mesh(this.pinGeometry, mat);
        pinGroup.add(pinMesh);

        const ringMesh = new this.THREE.Mesh(this.ringGeometry, this.whiteMaterial);
        ringMesh.position.z = 0.05;
        pinGroup.add(ringMesh);

        const hlMesh = new this.THREE.Mesh(this.highlightRingGeometry, this.highlightMaterial);
        hlMesh.position.z = 0.06;
        hlMesh.visible = finding.id === this.selectedFindingId;
        pinGroup.add(hlMesh);

        const pinData = {
          findingId: finding.id,
          findingTitle: finding.title || 'Untitled finding',
          status,
          severity: finding.severity || 'medium',
          faceName: formatName,
          page: item.page,
          sourceBox: item.box,
          evidenceIndex,
          localPoint: mapped.point,
          normal: mapped.normal,
          group: pinGroup,
          pinMesh,
          hlMesh,
          panelMesh: parentMesh,
        };

        pinMesh.userData = pinData;
        pinGroup.userData = pinData;

        parentMesh.add(pinGroup);
        this.pins.push(pinData);
        locatedPins.push(pinData);
      }
    }

    return locatedPins;
  }

  /**
   * Updates selection state for all pins and overlays.
   */
  setSelectedFinding(findingId) {
    this.selectedFindingId = findingId;
    for (const pin of this.pins) {
      const isSelected = pin.findingId === findingId;
      pin.hlMesh.visible = isSelected;
      pin.group.scale.setScalar(isSelected ? 1.35 : 1.0);

      if (pin.boundaryGroup) {
        pin.boundaryGroup.position.z = isSelected ? 0.32 : 0.12;
        if (pin.fillMesh?.material) {
          pin.fillMesh.material.opacity = isSelected ? 0.38 : 0.10;
          pin.fillMesh.material.color.setHex(isSelected ? 0xf59e0b : (PIN_COLORS[pin.status] || PIN_COLORS.review));
        }
        if (pin.frameLine?.material) {
          pin.frameLine.material.opacity = isSelected ? 1.0 : 0.40;
          pin.frameLine.material.color.setHex(isSelected ? 0xf59e0b : (PIN_COLORS[pin.status] || PIN_COLORS.review));
        }
        if (pin.cornerLines?.material) {
          pin.cornerLines.material.opacity = isSelected ? 1.0 : 0.0;
        }
      } else if (pin.overlayMesh?.material) {
        pin.overlayMesh.material.opacity = isSelected ? 0.4 : 0.15;
      }
    }
  }

  /**
   * Raycast test to find a pin under pointer coordinates.
   *
   * @param {THREE.Raycaster} raycaster
   * @returns {Object|null} Clicked pin data
   */
  intersectPins(raycaster) {
    if (!this.pins.length) return null;
    const testMeshes = this.pins.map(p => p.pinMesh);
    const intersects = raycaster.intersectObjects(testMeshes, false);
    if (intersects.length > 0) {
      return intersects[0].object.userData;
    }
    return null;
  }

  /**
   * Filter visible pins by status (e.g. issues only).
   */
  filterPins(mode = 'all') {
    for (const pin of this.pins) {
      const visible = mode === 'all' || (mode === 'issues' && pin.status === 'issue');
      pin.group.visible = visible;
      if (pin.boundaryGroup) pin.boundaryGroup.visible = visible;
      else if (pin.overlayMesh) pin.overlayMesh.visible = visible;
    }
  }

  /**
   * Clear all pin objects from panels and free resources.
   */
  clear() {
    for (const pin of this.pins) {
      if (pin.group?.parent) pin.group.parent.remove(pin.group);
      if (pin.boundaryGroup?.parent) pin.boundaryGroup.parent.remove(pin.boundaryGroup);
      if (pin.fillMesh?.geometry) pin.fillMesh.geometry.dispose();
      if (pin.fillMesh?.material) pin.fillMesh.material.dispose();
      if (pin.frameLine?.geometry) pin.frameLine.geometry.dispose();
      if (pin.frameLine?.material) pin.frameLine.material.dispose();
      if (pin.cornerLines?.geometry) pin.cornerLines.geometry.dispose();
      if (pin.cornerLines?.material) pin.cornerLines.material.dispose();
      if (pin.overlayMesh?.parent) pin.overlayMesh.parent.remove(pin.overlayMesh);
      if (pin.overlayMesh?.geometry) pin.overlayMesh.geometry.dispose();
      if (pin.overlayMesh?.material) pin.overlayMesh.material.dispose();
    }
    this.pins = [];
    this.overlays = [];
  }

  dispose() {
    this.clear();
    this.pinGeometry.dispose();
    this.ringGeometry.dispose();
    this.highlightRingGeometry.dispose();
    this.whiteMaterial.dispose();
    this.highlightMaterial.dispose();
    for (const mat of Object.values(this.statusMaterials)) {
      mat.dispose();
    }
  }
}
