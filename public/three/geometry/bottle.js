/**
 * PackSignal 3D Bottle Geometry Generator
 * Constructs a physically proportioned bottle with cylindrical body,
 * smooth shoulder taper, threaded neck, ribbed cap, and wrapped/front label mesh.
 */

export class BottleGeometryManager {
  constructor(THREE) {
    this.THREE = THREE;
    this.rootGroup = new this.THREE.Group();
    this.dimensions = {
      radius: 36,
      height: 190,
      bodyHeight: 105,
      neckRadius: 14,
      neckHeight: 45,
      shoulderHeight: 25,
      capHeight: 18,
    };
    this.bodyMesh = null;
    this.labelMesh = null;
    this.capMesh = null;
    this.bottleType = 'glass'; // 'glass' | 'plastic'
  }

  /**
   * Build the 3D bottle model.
   *
   * @param {Object} options
   * @param {THREE.Texture} [options.labelTexture]
   * @param {string} [options.bottleType='glass'] - 'glass' | 'plastic'
   * @param {number} [options.radius=36]
   * @param {number} [options.height=190]
   */
  buildBottle({ labelTexture = null, bottleType = 'glass', radius = 36, height = 190 } = {}) {
    this.clear();
    this.bottleType = bottleType;

    const R = radius;
    const totalH = height;
    const bodyH = totalH * 0.55;
    const capH = totalH * 0.1;
    const neckH = totalH * 0.22;
    const shoulderH = totalH - bodyH - capH - neckH;
    const neckR = R * 0.38;

    this.dimensions = {
      radius: R,
      height: totalH,
      bodyHeight: bodyH,
      neckRadius: neckR,
      neckHeight: neckH,
      shoulderHeight: shoulderH,
      capHeight: capH,
    };

    // 1. Create Lathed Bottle Profile Points
    const points = [];
    const baseR = R * 0.96;
    const bottomH = totalH * 0.03;

    // Base bottom
    points.push(new this.THREE.Vector2(0, -totalH / 2));
    points.push(new this.THREE.Vector2(baseR, -totalH / 2));
    points.push(new this.THREE.Vector2(R, -totalH / 2 + bottomH));

    // Cylindrical Body
    const bodyTopY = -totalH / 2 + bottomH + bodyH;
    points.push(new this.THREE.Vector2(R, bodyTopY));

    // Curved Shoulder
    const shoulderSteps = 8;
    const shoulderTopY = bodyTopY + shoulderH;
    for (let i = 1; i <= shoulderSteps; i++) {
      const t = i / shoulderSteps;
      const angle = (t * Math.PI) / 2;
      const curR = R - (R - neckR) * Math.sin(angle);
      const curY = bodyTopY + shoulderH * Math.sin((t * Math.PI) / 2);
      points.push(new this.THREE.Vector2(curR, curY));
    }

    // Neck
    const neckTopY = shoulderTopY + neckH;
    points.push(new this.THREE.Vector2(neckR, neckTopY));

    // Bottle Material (PBR glass / plastic)
    let bottleMat;
    if (bottleType === 'glass') {
      bottleMat = new this.THREE.MeshPhysicalMaterial({
        color: 0xe6f0e8,
        transmission: 0.9,
        opacity: 1,
        transparent: true,
        roughness: 0.08,
        metalness: 0.05,
        ior: 1.52,
        thickness: 2.2,
        side: this.THREE.DoubleSide,
      });
    } else {
      bottleMat = new this.THREE.MeshStandardMaterial({
        color: 0xfdfdfd,
        roughness: 0.25,
        metalness: 0.05,
        transparent: true,
        opacity: 0.88,
        side: this.THREE.DoubleSide,
      });
    }

    const latheGeom = new this.THREE.LatheGeometry(points, 48);
    this.bodyMesh = new this.THREE.Mesh(latheGeom, bottleMat);
    this.bodyMesh.name = 'bottle_body';
    this.rootGroup.add(this.bodyMesh);

    // 2. Front / Wrap Label Mesh (slightly larger cylinder so it wraps cleanly over the glass)
    const labelR = R + 0.35;
    const labelH = bodyH * 0.82;
    const labelGeom = new this.THREE.CylinderGeometry(labelR, labelR, labelH, 64, 1, true);

    // UV mapping: u=0.5 at front (+Z)
    const uvAttr = labelGeom.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      let u = uvAttr.getX(i);
      u = (u + 0.5) % 1.0;
      uvAttr.setX(i, u);
    }
    uvAttr.needsUpdate = true;

    const labelMat = new this.THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.38,
      metalness: 0.05,
      side: this.THREE.DoubleSide,
      transparent: true,
    });

    this.labelMesh = new this.THREE.Mesh(labelGeom, labelMat);
    this.labelMesh.name = 'bottle_label';
    this.labelMesh.position.y = -totalH / 2 + bottomH + bodyH * 0.5;
    this.rootGroup.add(this.labelMesh);

    // 3. Molded Screw Cap
    const capR = neckR * 1.1;
    const capGeom = new this.THREE.CylinderGeometry(capR, capR, capH, 32);
    const capMat = new this.THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.15,
    });
    this.capMesh = new this.THREE.Mesh(capGeom, capMat);
    this.capMesh.name = 'bottle_cap';
    this.capMesh.position.y = neckTopY + capH / 2;
    this.rootGroup.add(this.capMesh);

    return {
      rootGroup: this.rootGroup,
      bodyMesh: this.bodyMesh,
      labelMesh: this.labelMesh,
      capMesh: this.capMesh,
      dimensions: this.dimensions,
    };
  }

  /**
   * Maps a 2D normalized artwork point [u, v] to bottle label 3D coordinates.
   *
   * @param {number} u - Horizontal coordinate in [0, 1]
   * @param {number} v - Vertical coordinate in [0, 1] (0 is top, 1 is bottom)
   * @param {number} [offset=0.5] - Radial offset above label surface
   * @returns {{ point: [x, y, z], normal: [nx, ny, nz] }}
   */
  mapPointToBottle(u, v, offset = 0.5) {
    if (!this.labelMesh) {
      return { point: [0, 0, this.dimensions.radius], normal: [0, 0, 1] };
    }

    const R = this.dimensions.radius + 0.35 + offset;
    const labelH = this.dimensions.bodyHeight * 0.82;

    const theta = (u - 0.5) * 2 * Math.PI;
    const x = R * Math.sin(theta);
    const z = R * Math.cos(theta);
    const y = this.labelMesh.position.y + (0.5 - v) * labelH;

    const normal = [Math.sin(theta), 0, Math.cos(theta)];

    return {
      point: [x, y, z],
      normal,
    };
  }

  setLabelTexture(texture) {
    if (this.labelMesh && this.labelMesh.material) {
      this.labelMesh.material.map = texture;
      this.labelMesh.material.needsUpdate = true;
    }
  }

  setBottleMaterial(material) {
    if (this.bodyMesh) {
      this.bodyMesh.material = material;
    }
  }

  /**
   * Set bottle substrate material preview: 'glass' (flint clear) | 'amber' (amber glass) | 'plastic' (translucent PET).
   *
   * @param {string} substrateType
   */
  setBottleSubstrate(substrateType = 'glass') {
    this.bottleType = substrateType;
    if (!this.bodyMesh) return;

    if (substrateType === 'amber') {
      this.bodyMesh.material = new this.THREE.MeshPhysicalMaterial({
        color: 0x8b4513,
        transmission: 0.82,
        opacity: 1,
        transparent: true,
        roughness: 0.12,
        metalness: 0.05,
        ior: 1.54,
        thickness: 2.5,
        side: this.THREE.DoubleSide,
      });
    } else if (substrateType === 'plastic') {
      this.bodyMesh.material = new this.THREE.MeshStandardMaterial({
        color: 0xf3f4f6,
        roughness: 0.28,
        metalness: 0.04,
        transparent: true,
        opacity: 0.88,
        side: this.THREE.DoubleSide,
      });
    } else {
      // Clear Flint Glass
      this.bodyMesh.material = new this.THREE.MeshPhysicalMaterial({
        color: 0xe6f0e8,
        transmission: 0.92,
        opacity: 1,
        transparent: true,
        roughness: 0.08,
        metalness: 0.05,
        ior: 1.52,
        thickness: 2.2,
        side: this.THREE.DoubleSide,
      });
    }
  }

  /**
   * Sets bottle label placement: 'wrap' (360° cylindrical wrap) or 'front' (front-facing panel).
   *
   * @param {string} placement - 'wrap' | 'front'
   */
  setLabelPlacement(placement = 'wrap') {
    if (this.labelMesh?.material?.map) {
      const tex = this.labelMesh.material.map;
      if (placement === 'front') {
        tex.repeat.set(0.5, 1);
        tex.offset.set(0.25, 0);
      } else {
        tex.repeat.set(1, 1);
        tex.offset.set(0, 0);
      }
      tex.needsUpdate = true;
    }
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
    this.bodyMesh = null;
    this.labelMesh = null;
    this.capMesh = null;
  }

  dispose() {
    this.clear();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
