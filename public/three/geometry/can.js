/**
 * PackSignal 3D Beverage Can Geometry Generator
 * Generates an accurate 3D beverage can with wrapped cylindrical artwork,
 * beveled aluminum top chime, recessed lid with pull tab, and tapered bottom dome.
 */

export class CanGeometryManager {
  constructor(THREE) {
    this.THREE = THREE;
    this.rootGroup = new this.THREE.Group();
    this.dimensions = { radius: 33, height: 122, bodyHeight: 104 };
    this.bodyMesh = null;
    this.metalParts = [];
  }

  /**
   * Build the 3D beverage can model.
   *
   * @param {Object} options
   * @param {THREE.Texture} options.labelTexture
   * @param {THREE.Material} [options.bodyMaterial]
   * @param {number} [options.radius=33]
   * @param {number} [options.height=122]
   */
  buildCan({ labelTexture = null, bodyMaterial = null, radius = 33, height = 122 } = {}) {
    this.clear();
    this.dimensions = { radius, height, bodyHeight: height * 0.85 };

    const R = this.dimensions.radius;
    const bodyH = this.dimensions.bodyHeight;
    const rimH = (height - bodyH) * 0.6;
    const baseH = (height - bodyH) * 0.4;

    // 1. Brushed Aluminum Material for unprinted can metal (top, rim, bottom)
    const aluminumMaterial = new this.THREE.MeshStandardMaterial({
      color: 0xd8dcde,
      metalness: 0.9,
      roughness: 0.22,
      side: this.THREE.DoubleSide,
    });

    // 2. Printed Body Cylinder
    const bodyGeom = new this.THREE.CylinderGeometry(R, R, bodyH, 64, 1, true);

    // Adjust cylinder UVs so artwork wraps seamlessly with front center at Z+
    const uvAttr = bodyGeom.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      let u = uvAttr.getX(i);
      // Offset so u=0.5 is at front facing camera (+Z)
      u = (u + 0.5) % 1.0;
      uvAttr.setX(i, u);
    }
    uvAttr.needsUpdate = true;

    const defaultBodyMat = new this.THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.35,
      metalness: 0.1,
      side: this.THREE.DoubleSide,
    });

    this.bodyMesh = new this.THREE.Mesh(bodyGeom, bodyMaterial || defaultBodyMat);
    this.bodyMesh.name = 'can_body';
    this.bodyMesh.position.y = (rimH - baseH) / 2;
    this.rootGroup.add(this.bodyMesh);

    // 3. Top Neck & Beveled Chime
    const neckTopR = R * 0.84;
    const topY = this.bodyMesh.position.y + bodyH / 2;

    const neckGeom = new this.THREE.CylinderGeometry(neckTopR, R, rimH, 64, 1, true);
    const neckMesh = new this.THREE.Mesh(neckGeom, aluminumMaterial);
    neckMesh.position.y = topY + rimH / 2;
    this.rootGroup.add(neckMesh);
    this.metalParts.push(neckMesh);

    // Recessed Lid Disc
    const lidGeom = new this.THREE.CircleGeometry(neckTopR, 64);
    lidGeom.rotateX(-Math.PI / 2);
    const lidMesh = new this.THREE.Mesh(lidGeom, aluminumMaterial);
    lidMesh.position.y = topY + rimH - 0.5;
    this.rootGroup.add(lidMesh);
    this.metalParts.push(lidMesh);

    // Pull Tab
    const tabGeom = new this.THREE.BoxGeometry(6, 0.4, 14);
    const tabMesh = new this.THREE.Mesh(tabGeom, aluminumMaterial);
    tabMesh.position.set(0, topY + rimH + 0.3, 3);
    this.rootGroup.add(tabMesh);
    this.metalParts.push(tabMesh);

    // 4. Bottom Tapered Dome
    const bottomBaseR = R * 0.82;
    const bottomY = this.bodyMesh.position.y - bodyH / 2;

    const baseGeom = new this.THREE.CylinderGeometry(R, bottomBaseR, baseH, 64, 1, true);
    const baseMesh = new this.THREE.Mesh(baseGeom, aluminumMaterial);
    baseMesh.position.y = bottomY - baseH / 2;
    this.rootGroup.add(baseMesh);
    this.metalParts.push(baseMesh);

    // Bottom Base Cap
    const bottomCapGeom = new this.THREE.CircleGeometry(bottomBaseR, 64);
    bottomCapGeom.rotateX(Math.PI / 2);
    const bottomCapMesh = new this.THREE.Mesh(bottomCapGeom, aluminumMaterial);
    bottomCapMesh.position.y = bottomY - baseH;
    this.rootGroup.add(bottomCapMesh);
    this.metalParts.push(bottomCapMesh);

    // 5. Back Seam Indicator (thin subtle line)
    const seamGeom = new this.THREE.PlaneGeometry(0.3, bodyH);
    const seamMat = new this.THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.4 });
    this.seamMesh = new this.THREE.Mesh(seamGeom, seamMat);
    this.seamMesh.position.set(0, this.bodyMesh.position.y, -R - 0.05);
    this.seamMesh.rotateY(Math.PI);
    this.seamMesh.visible = false;
    this.rootGroup.add(this.seamMesh);
    this.metalParts.push(this.seamMesh);

    this.seamAngleDeg = 0;
    this.wrapMode = 'full';

    return {
      rootGroup: this.rootGroup,
      bodyMesh: this.bodyMesh,
      dimensions: this.dimensions,
    };
  }

  /**
   * Adjusts the label wrap seam position around the cylinder.
   *
   * @param {number} degrees - Angle in degrees [0, 360]
   */
  setSeamAngle(degrees) {
    this.seamAngleDeg = ((Number(degrees) || 0) % 360 + 360) % 360;
    const rad = (this.seamAngleDeg * Math.PI) / 180;
    if (this.bodyMesh) {
      this.bodyMesh.rotation.y = rad;
    }
    if (this.seamMesh) {
      const R = this.dimensions.radius;
      this.seamMesh.rotation.y = Math.PI + rad;
      this.seamMesh.position.set(
        -(R + 0.05) * Math.sin(rad),
        this.bodyMesh ? this.bodyMesh.position.y : 0,
        -(R + 0.05) * Math.cos(rad)
      );
    }
  }

  /**
   * Toggles the visibility of the cylindrical seam indicator line.
   *
   * @param {boolean} [show]
   */
  toggleSeamHighlight(show = null) {
    if (!this.seamMesh) return false;
    this.seamMesh.visible = show !== null ? Boolean(show) : !this.seamMesh.visible;
    if (this.seamMesh.material) {
      this.seamMesh.material.opacity = this.seamMesh.visible ? 0.85 : 0;
      if (this.seamMesh.material.color?.setHex) {
        this.seamMesh.material.color.setHex(this.seamMesh.visible ? 0xf59e0b : 0x888888);
      }
    }
    return this.seamMesh.visible;
  }

  /**
   * Set wrap coverage mode: 'full' (360° cylindrical wrap) or 'partial' (180° front label).
   *
   * @param {string} mode - 'full' | 'partial'
   */
  setWrapMode(mode = 'full') {
    this.wrapMode = mode === 'partial' ? 'partial' : 'full';
    if (this.bodyMesh?.material?.map) {
      const tex = this.bodyMesh.material.map;
      if (this.wrapMode === 'partial') {
        tex.repeat.set(0.5, 1);
        tex.offset.set(0.25, 0);
      } else {
        tex.repeat.set(1, 1);
        tex.offset.set(0, 0);
      }
      tex.needsUpdate = true;
    }
  }

  /**
   * Maps a 2D normalized artwork point [u, v] to cylindrical 3D coordinates.
   *
   * @param {number} u - Horizontal coordinate in [0, 1]
   * @param {number} v - Vertical coordinate in [0, 1] (0 is top, 1 is bottom)
   * @param {number} [offset=0.5] - Radial offset above surface
   * @returns {{ point: [x, y, z], normal: [nx, ny, nz] }}
   */
  mapPointToCylinder(u, v, offset = 0.5) {
    const R = this.dimensions.radius + offset;
    const bodyH = this.dimensions.bodyHeight;

    // Angle theta: u=0.5 corresponds to theta=0 (front along +Z)
    // u=0 is at back (-pi), u=1 is at back (+pi)
    const seamOffsetRad = ((this.seamAngleDeg || 0) * Math.PI) / 180;
    const theta = (u - 0.5) * 2 * Math.PI + seamOffsetRad;

    const x = R * Math.sin(theta);
    const z = R * Math.cos(theta);
    const y = this.bodyMesh.position.y + (0.5 - v) * bodyH;

    const normal = [Math.sin(theta), 0, Math.cos(theta)];

    return {
      point: [x, y, z],
      normal,
    };
  }

  clear() {
    if (this.bodyMesh) {
      if (this.bodyMesh.geometry) this.bodyMesh.geometry.dispose();
      this.bodyMesh = null;
    }
    for (const part of this.metalParts) {
      if (part.geometry) part.geometry.dispose();
    }
    this.metalParts = [];
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
  }

  dispose() {
    this.clear();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
