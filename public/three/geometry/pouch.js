/**
 * PackSignal 3D Stand-Up Pouch Geometry Generator
 * Constructs an authentic flexible stand-up pouch with front/back panels,
 * heat-seal perimeter flanges, expanding bottom gusset, and progressive inflation animation.
 */

export class PouchGeometryManager {
  constructor(THREE) {
    this.THREE = THREE;
    this.rootGroup = new this.THREE.Group();
    this.dimensions = {
      width: 140,
      height: 200,
      depth: 65, // Max inflated depth at bottom
      sealWidth: 8,
      tearNotchHeight: 30,
    };
    this.frontMesh = null;
    this.backMesh = null;
    this.bottomGussetMesh = null;
    this.sealMeshes = [];
    this.inflation = 0.85; // 0.0 (flat) to 1.0 (fully expanded)
  }

  /**
   * Build the 3D stand-up pouch model.
   *
   * @param {Object} options
   * @param {THREE.Texture} [options.frontTexture]
   * @param {THREE.Texture} [options.backTexture]
   * @param {number} [options.inflation=0.85]
   * @param {number} [options.width=140]
   * @param {number} [options.height=200]
   * @param {number} [options.depth=65]
   */
  buildPouch({
    frontTexture = null,
    backTexture = null,
    inflation = 0.85,
    width = 140,
    height = 200,
    depth = 65,
  } = {}) {
    this.clear();
    this.inflation = Math.max(0, Math.min(1, inflation));
    this.dimensions = {
      width,
      height,
      depth,
      sealWidth: Math.max(6, width * 0.05),
      tearNotchHeight: height * 0.15,
    };

    const W = width;
    const H = height;
    const D = depth * this.inflation;
    const seal = this.dimensions.sealWidth;

    // Substrate material for flexible film pouch (glossy / matte barrier film)
    const filmMaterialFront = new this.THREE.MeshStandardMaterial({
      map: frontTexture,
      roughness: 0.32,
      metalness: 0.08,
      side: this.THREE.DoubleSide,
    });

    const filmMaterialBack = new this.THREE.MeshStandardMaterial({
      map: backTexture || frontTexture,
      roughness: 0.32,
      metalness: 0.08,
      side: this.THREE.DoubleSide,
    });

    const sealMaterial = new this.THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.45,
      metalness: 0.1,
      side: this.THREE.DoubleSide,
    });

    // 1. Front Curved Body Panel
    // Plane subdivided into a grid to allow convex inflation deformation
    const segmentsX = 32;
    const segmentsY = 32;
    const frontGeom = new this.THREE.PlaneGeometry(W, H, segmentsX, segmentsY);
    this._deformPouchPanel(frontGeom, W, H, D * 0.5, true);

    this.frontMesh = new this.THREE.Mesh(frontGeom, filmMaterialFront);
    this.frontMesh.name = 'pouch_front';
    this.rootGroup.add(this.frontMesh);

    // 2. Back Curved Body Panel
    const backGeom = new this.THREE.PlaneGeometry(W, H, segmentsX, segmentsY);
    this._deformPouchPanel(backGeom, W, H, D * 0.5, false);

    this.backMesh = new this.THREE.Mesh(backGeom, filmMaterialBack);
    this.backMesh.name = 'pouch_back';
    this.rootGroup.add(this.backMesh);

    // 3. Top Heat Seal Strip
    const topSealGeom = new this.THREE.BoxGeometry(W, seal, 1.2);
    const topSealMesh = new this.THREE.Mesh(topSealGeom, sealMaterial);
    topSealMesh.position.set(0, H / 2 - seal / 2, 0);
    this.rootGroup.add(topSealMesh);
    this.sealMeshes.push(topSealMesh);

    // 4. Side Heat Seal Flanges
    const sideSealGeom = new this.THREE.BoxGeometry(seal, H - seal, 1.2);
    const leftSeal = new this.THREE.Mesh(sideSealGeom, sealMaterial);
    leftSeal.position.set(-W / 2 + seal / 2, -seal / 2, 0);
    this.rootGroup.add(leftSeal);
    this.sealMeshes.push(leftSeal);

    const rightSeal = new this.THREE.Mesh(sideSealGeom, sealMaterial);
    rightSeal.position.set(W / 2 - seal / 2, -seal / 2, 0);
    this.rootGroup.add(rightSeal);
    this.sealMeshes.push(rightSeal);

    // 5. Expanding Bottom Gusset (K-seal / round bottom gusset)
    if (this.inflation > 0.05) {
      const gussetGeom = new this.THREE.BufferGeometry();
      const hw = W * 0.42;
      const hd = (D * 0.5) * 0.95;
      const by = -H / 2;

      // Vertices for elliptical bottom floor
      const gussetVertices = [
        -hw, by, 0,
        0, by, hd,
        hw, by, 0,
        -hw, by, 0,
        hw, by, 0,
        0, by, -hd,
      ];
      gussetGeom.setAttribute('position', new this.THREE.Float32BufferAttribute(gussetVertices, 3));
      gussetGeom.computeVertexNormals();

      const gussetMat = new this.THREE.MeshStandardMaterial({
        color: 0xbbbbbb,
        roughness: 0.4,
        metalness: 0.1,
        side: this.THREE.DoubleSide,
      });

      this.bottomGussetMesh = new this.THREE.Mesh(gussetGeom, gussetMat);
      this.bottomGussetMesh.name = 'pouch_bottom_gusset';
      this.rootGroup.add(this.bottomGussetMesh);
    }

    return {
      rootGroup: this.rootGroup,
      frontMesh: this.frontMesh,
      backMesh: this.backMesh,
      dimensions: this.dimensions,
      inflation: this.inflation,
    };
  }

  /**
   * Deforms a flat plane geometry into an inflated stand-up pouch pillow profile.
   * Max expansion is at bottom-center; tapers toward the top seal and side welds.
   *
   * @private
   */
  _deformPouchPanel(geometry, width, height, maxBulge, isFront) {
    const pos = geometry.attributes.position;
    const sign = isFront ? 1 : -1;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);

      // Normalized coordinates: nx in [-1, 1], ny in [0, 1] (0 at bottom, 1 at top)
      const nx = (2 * x) / width;
      const ny = (y + height / 2) / height;

      // Horizontal pillow profile: 1 at center (nx=0), 0 at side seals (nx=±1)
      const xFactor = Math.max(0, 1 - nx * nx);

      // Vertical pouch profile: largest bulge around lower-middle (ny ~ 0.25), 0 at top seal
      const yFactor = Math.sin((1 - ny) * Math.PI * 0.85);

      const z = sign * maxBulge * xFactor * yFactor;
      pos.setZ(i, z);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  /**
   * Set inflation progress (0.0 flat to 1.0 fully inflated).
   *
   * @param {number} progress
   */
  setInflation(progress) {
    this.inflation = Math.max(0, Math.min(1, progress));
    const W = this.dimensions.width;
    const H = this.dimensions.height;
    const D = this.dimensions.depth * this.inflation;

    if (this.frontMesh) {
      this._deformPouchPanel(this.frontMesh.geometry, W, H, D * 0.5, true);
    }
    if (this.backMesh) {
      this._deformPouchPanel(this.backMesh.geometry, W, H, D * 0.5, false);
    }
  }

  /**
   * Toggles visibility of the expanding bottom gusset.
   *
   * @param {boolean} [show]
   */
  toggleGusset(show = null) {
    if (!this.bottomGussetMesh) return false;
    this.bottomGussetMesh.visible = show !== null ? Boolean(show) : !this.bottomGussetMesh.visible;
    return this.bottomGussetMesh.visible;
  }

  /**
   * Toggles visibility / highlight of the perimeter heat-seal flanges.
   *
   * @param {boolean} [show]
   */
  toggleSeals(show = null) {
    let anyVisible = false;
    for (const mesh of this.sealMeshes) {
      mesh.visible = show !== null ? Boolean(show) : !mesh.visible;
      anyVisible = mesh.visible;
      if (mesh.material) {
        mesh.material.color.setHex(anyVisible ? 0xf59e0b : 0xcccccc);
      }
    }
    return anyVisible;
  }

  /**
   * Maps a 2D normalized artwork point [u, v] to pouch 3D surface point.
   *
   * @param {number} u - Horizontal coordinate in [0, 1]
   * @param {number} v - Vertical coordinate in [0, 1]
   * @param {string} [face='front'] - 'front' | 'back'
   * @param {number} [offset=0.6] - Surface offset
   * @returns {{ point: [x, y, z], normal: [nx, ny, nz] }}
   */
  mapPointToPouch(u, v, face = 'front', offset = 0.6) {
    const W = this.dimensions.width;
    const H = this.dimensions.height;
    const D = this.dimensions.depth * this.inflation;
    const isFront = face === 'front';
    const sign = isFront ? 1 : -1;

    const x = (u - 0.5) * W;
    const y = (0.5 - v) * H;

    const nx = (2 * x) / W;
    const ny = (y + H / 2) / H;

    const xFactor = Math.max(0, 1 - nx * nx);
    const yFactor = Math.sin((1 - Math.max(0, Math.min(1, ny))) * Math.PI * 0.85);

    const z = sign * (D * 0.5 * xFactor * yFactor + offset);
    const normal = [0, 0, sign];

    return {
      point: [x, y, z],
      normal,
    };
  }

  clear() {
    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children[0];
      this.rootGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }
    this.frontMesh = null;
    this.backMesh = null;
    this.bottomGussetMesh = null;
    this.sealMeshes = [];
  }

  dispose() {
    this.clear();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
