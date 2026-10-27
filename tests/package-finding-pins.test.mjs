import test from 'node:test';
import assert from 'node:assert/strict';

import { PackagingFindingPinManager } from '../public/packaging-3d/finding-pins.js';

function createMockThree() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    normalize() { return this; }
  }
  class Quaternion {
    setFromUnitVectors() { return this; }
  }
  class Group {
    constructor() { this.children = []; }
    add(c) { this.children.push(c); }
    remove(c) {
      const idx = this.children.indexOf(c);
      if (idx !== -1) this.children.splice(idx, 1);
    }
  }
  class Mesh {
    constructor(geom, mat) {
      this.geometry = geom;
      this.material = mat;
      this.position = new Vector3();
      this.quaternion = new Quaternion();
      this.scale = { setScalar: () => {} };
      this.visible = true;
    }
  }
  class ConeGeometry {}
  class SphereGeometry {}
  class OctahedronGeometry {}
  class MeshStandardMaterial {
    constructor(opts) { Object.assign(this, opts); }
  }

  return {
    Vector3,
    Quaternion,
    Group,
    Mesh,
    ConeGeometry,
    SphereGeometry,
    OctahedronGeometry,
    MeshStandardMaterial,
  };
}

test('26. Finding pin coordinates remain correct and preserve surface offset', () => {
  const THREE = createMockThree();
  const manager = new PackagingFindingPinManager(THREE);

  const findings = [
    {
      id: 'FINDING-NET-QTY',
      title: 'Net Quantity Discrepancy',
      status: 'issue',
      box: [0.2, 0.7, 0.4, 0.8],
      department: 'Legal / Regulatory',
    }
  ];

  const mapPointFn = (u, v) => ({
    point: [u * 100, v * 200, 35],
    normal: [0, 0, 1],
  });

  const pins = manager.projectFindings({ findings, mapPointFn });
  assert.equal(pins.length, 1);
  assert.equal(pins[0].id, 'FINDING-NET-QTY');
  assert.equal(pins[0].status, 'issue');
  assert.equal(pins[0].point[2], 35);
});

test('27. Unmapped or unlocated findings do not create fake pins', () => {
  const THREE = createMockThree();
  const manager = new PackagingFindingPinManager(THREE);

  const unlocatedFindings = [
    {
      id: 'UNLOCATED-01',
      title: 'Missing Document Source Fact',
      status: 'review',
      // No box / bbox
      department: 'R&D',
    },
    {
      id: 'UNLOCATED-02',
      title: 'General Claim Policy',
      status: 'review',
      box: null,
      department: 'Legal',
    }
  ];

  const mapPointFn = (u, v) => ({ point: [u * 100, v * 100, 0], normal: [0, 0, 1] });
  const pins = manager.projectFindings({ findings: unlocatedFindings, mapPointFn });

  // Truthful abstention: 0 pins created
  assert.equal(pins.length, 0);
  assert.equal(manager.activePins.length, 0);
});

test('28. Selected finding ID remains synchronized and highlights active pin', () => {
  const THREE = createMockThree();
  const manager = new PackagingFindingPinManager(THREE);

  const findings = [
    { id: 'F1', status: 'issue', box: [0.1, 0.1, 0.2, 0.2], department: 'Legal' },
    { id: 'F2', status: 'review', box: [0.3, 0.3, 0.4, 0.4], department: 'Prepress' },
  ];

  const mapPointFn = (u, v) => ({ point: [u, v, 0], normal: [0, 0, 1] });
  manager.projectFindings({ findings, mapPointFn, selectedFindingId: 'F1' });

  assert.equal(manager.activePins[0].mesh.material.emissiveIntensity, 0.6);
  assert.equal(manager.activePins[1].mesh.material.emissiveIntensity, 0.15);

  manager.highlightFinding('F2');
  assert.equal(manager.activePins[0].mesh.material.emissiveIntensity, 0.15);
  assert.equal(manager.activePins[1].mesh.material.emissiveIntensity, 0.7);
});

test('29. Department filtering updates visible mapped pins without dropping finding records', () => {
  const THREE = createMockThree();
  const manager = new PackagingFindingPinManager(THREE);

  const findings = [
    { id: 'F-LEGAL', status: 'issue', box: [0.1, 0.1, 0.2, 0.2], department: 'Legal / Regulatory' },
    { id: 'F-PREPRESS', status: 'review', box: [0.3, 0.3, 0.4, 0.4], department: 'Prepress / Production' },
    { id: 'F-RD', status: 'issue', box: [0.5, 0.5, 0.6, 0.6], department: 'R&D / Food Science' },
  ];

  const mapPointFn = (u, v) => ({ point: [u, v, 0], normal: [0, 0, 1] });
  manager.projectFindings({ findings, mapPointFn });

  assert.equal(manager.activePins.length, 3);

  // Filter to Prepress only
  manager.setDepartmentFilter('prepress');
  assert.equal(manager.activePins[0].mesh.visible, false); // Legal
  assert.equal(manager.activePins[1].mesh.visible, true);  // Prepress
  assert.equal(manager.activePins[2].mesh.visible, false); // R&D

  // Filter to All
  manager.setDepartmentFilter('all');
  assert.equal(manager.activePins[0].mesh.visible, true);
  assert.equal(manager.activePins[1].mesh.visible, true);
  assert.equal(manager.activePins[2].mesh.visible, true);
});

test('30. 2D evidence links and finding metadata are preserved on the 3D pin object', () => {
  const THREE = createMockThree();
  const manager = new PackagingFindingPinManager(THREE);

  const finding = {
    id: 'F-ATWATER',
    title: 'Calories Math Discrepancy (4-4-9)',
    status: 'issue',
    box: [0.65, 0.2, 0.95, 0.5],
    page: 1,
    evidence: { quote: 'Calories 166', computed: 535 },
    department: 'R&D / Food Science',
  };

  const mapPointFn = (u, v) => ({ point: [10, 20, 30], normal: [0, 0, 1] });
  const pins = manager.projectFindings({ findings: [finding], mapPointFn });

  assert.equal(pins[0].finding.evidence.computed, 535);
  assert.equal(pins[0].finding.page, 1);
  assert.equal(pins[0].mesh.userData.findingId, 'F-ATWATER');
});
