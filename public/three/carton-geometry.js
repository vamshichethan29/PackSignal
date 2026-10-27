/**
 * PackSignal 3D Carton Geometry Generator
 * Generates Three.js PlaneGeometries, crease lines, and panel labels
 * from validated DXF or confirmed panel zone dimensions.
 */

import { CARTON_FACES, FACE_TITLES, calculateFoldTransforms } from './fold-engine.js';

export class CartonGeometryManager {
  constructor(THREE) {
    this.THREE = THREE;
    this.panels = {};
    this.labelMeshes = {};
    this.creaseLines = [];
    this.rootGroup = new this.THREE.Group();
    this.tree = null;
    this.xray = false;
    this.showLabels = false;
  }

  /**
   * Builds the 6 carton panel meshes and adds them to rootGroup.
   *
   * @param {Object} tree - Hinge tree from buildHingeTree()
   * @param {TextureMapper} textureMapper
   * @param {Object} review
   * @param {Object} panelZones
   */
  async buildCarton(tree, textureMapper, review, panelZones) {
    this.clear();
    this.tree = tree;

    for (const face of CARTON_FACES) {
      const pDef = tree.panels[face];
      const width = pDef.width;
      const height = pDef.height;

      // Plane geometry with normal facing +Z
      const geom = new this.THREE.PlaneGeometry(width, height);

      // Load real artwork texture or fallback
      const zone = panelZones?.[face];
      const texture = await textureMapper.createPanelTexture({
        review,
        faceName: face,
        label: FACE_TITLES[face],
        zone,
      });

      const mat = new this.THREE.MeshStandardMaterial({
        map: texture,
        side: this.THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.05,
        transparent: false,
        opacity: 1.0,
      });

      const mesh = new this.THREE.Mesh(geom, mat);
      mesh.name = `panel_${face}`;
      mesh.matrixAutoUpdate = false;
      mesh.userData = {
        faceName: face,
        panelId: face,
        width,
        height,
        zone,
      };

      // Subtle panel name label (for Show Panel Names toggle)
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      const ctx = labelCanvas.getContext('2d');
      ctx.fillStyle = 'rgba(16, 35, 27, 0.75)';
      ctx.roundRect(4, 4, 248, 56, 8);
      ctx.fill();
      ctx.strokeStyle = '#628750';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(FACE_TITLES[face] || face, 128, 32);

      const labelTex = new this.THREE.CanvasTexture(labelCanvas);
      const labelMat = new this.THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        depthWrite: false,
        side: this.THREE.DoubleSide,
      });
      const labelGeom = new this.THREE.PlaneGeometry(Math.min(width * 0.8, 40), 10);
      const labelMesh = new this.THREE.Mesh(labelGeom, labelMat);
      labelMesh.position.set(0, 0, 0.3);
      labelMesh.visible = this.showLabels;

      mesh.add(labelMesh);
      this.labelMeshes[face] = labelMesh;

      this.panels[face] = mesh;
      this.rootGroup.add(mesh);
    }

    // Set initial 0% (flat dieline) transforms
    this.updateFoldProgress(0);

    return this.panels;
  }

  /**
   * Updates panel transformations according to fold progress (0.0 to 1.0).
   */
  updateFoldProgress(progress) {
    if (!this.tree) return;

    const transforms = calculateFoldTransforms(this.tree, progress);

    for (const face of CARTON_FACES) {
      const mesh = this.panels[face];
      const mat = transforms[face];
      if (mesh && mat) {
        mesh.matrix.fromArray(mat.elements);
        mesh.updateMatrixWorld(true);
      }
    }
  }

  applyFold(progress) {
    this.updateFoldProgress(progress);
  }

  /**
   * Toggles X-Ray inspection mode (translucent carton faces).
   */
  setXRay(enabled) {
    this.xray = Boolean(enabled);
    for (const mesh of Object.values(this.panels)) {
      if (mesh.material) {
        mesh.material.transparent = this.xray;
        mesh.material.opacity = this.xray ? 0.35 : 1.0;
        mesh.material.depthWrite = !this.xray;
        mesh.material.needsUpdate = true;
      }
    }
  }

  /**
   * Toggles 3D panel title labels on faces.
   */
  setShowLabels(enabled) {
    this.showLabels = Boolean(enabled);
    for (const labelMesh of Object.values(this.labelMeshes)) {
      labelMesh.visible = this.showLabels;
    }
  }

  clear() {
    for (const face of Object.keys(this.panels)) {
      const mesh = this.panels[face];
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      }
      const label = this.labelMeshes[face];
      if (label) {
        if (label.geometry) label.geometry.dispose();
        if (label.material) {
          if (label.material.map) label.material.map.dispose();
          label.material.dispose();
        }
      }
    }
    this.panels = {};
    this.labelMeshes = {};
    this.creaseLines = [];
  }

  dispose() {
    this.clear();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
