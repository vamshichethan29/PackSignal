/**
 * PackSignal 3D Packaging Studio Scene
 * Sets up lighting, camera, renderer, studio floor, and render loop.
 */

export class CartonScene {
  constructor(THREE, container) {
    this.THREE = THREE;
    this.container = container;
    this.disposed = false;

    // 1. Scene
    this.scene = new this.THREE.Scene();
    this.scene.background = new this.THREE.Color(0x10231b); // Matching PackSignal studio theme

    // 2. Camera
    const aspect = (container.clientWidth || 600) / (container.clientHeight || 400);
    this.camera = new this.THREE.PerspectiveCamera(42, aspect, 1, 3000);
    this.camera.position.set(-60, 50, 260);

    // 3. Renderer
    this.renderer = new this.THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth || 600, container.clientHeight || 400);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;
    this.renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Append canvas
    this.domElement = this.renderer.domElement;
    this.domElement.style.display = 'block';
    this.domElement.style.width = '100%';
    this.domElement.style.height = '100%';
    this.container.appendChild(this.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. Studio Floor Grid
    this.setupFloor();

    // 6. Resize handling
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  setupLighting() {
    // Soft ambient light
    const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Key light (front-right-above)
    const keyLight = new this.THREE.DirectionalLight(0xfff8ee, 1.4);
    keyLight.position.set(150, 200, 200);
    this.scene.add(keyLight);

    // Fill light (front-left)
    const fillLight = new this.THREE.DirectionalLight(0xedf4f8, 0.7);
    fillLight.position.set(-150, 80, 150);
    this.scene.add(fillLight);

    // Rim / Back light (highlights edges)
    const rimLight = new this.THREE.DirectionalLight(0xdcf0dc, 0.9);
    rimLight.position.set(0, -100, -200);
    this.scene.add(rimLight);
  }

  setupFloor() {
    // Subtle studio floor grid
    const gridHelper = new this.THREE.GridHelper(600, 30, 0x2e493a, 0x1b352a);
    gridHelper.position.y = -70;
    this.scene.add(gridHelper);
    this.gridHelper = gridHelper;
  }

  onResize() {
    if (this.disposed || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.gridHelper) {
      this.gridHelper.geometry.dispose();
      this.gridHelper.material.dispose();
    }
    this.renderer.dispose();
    if (this.domElement.parentElement) {
      this.domElement.parentElement.removeChild(this.domElement);
    }
  }
}
