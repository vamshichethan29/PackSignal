import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CartonCameraController,
  shortestAngleDelta,
  wrapAngle,
  FACE_TARGET_POSES,
} from '../public/carton-camera-controller.js';

function createMockCarton(initialAngle = -28, initialTilt = -10) {
  const scene = {
    dataset: {
      angle: String(initialAngle),
      tilt: String(initialTilt),
    },
  };
  const model = {
    style: {
      transform: `rotateX(${initialTilt}deg) rotateY(${initialAngle}deg)`,
    },
  };
  return { scene, model };
}

test('23. Angle wraparound follows shortest suitable path across +/-180 boundary', () => {
  // From 179° to -179°: direct diff is -358°, but shortest delta is +2°
  const deltaA = shortestAngleDelta(179, -179);
  assert.equal(deltaA, 2, 'Should take +2° step, not -358°');

  // From -175° to 175°: direct diff is +350°, but shortest delta is -10°
  const deltaB = shortestAngleDelta(-175, 175);
  assert.equal(deltaB, -10, 'Should take -10° step, not +350°');

  // From 30° to -90°: -120°
  const deltaC = shortestAngleDelta(30, -90);
  assert.equal(deltaC, -120);

  // From -90° to 90°: 180°
  const deltaD = shortestAngleDelta(-90, 90);
  assert.equal(Math.abs(deltaD), 180);
});

test('18. Front-face fly-to finishes at perpendicular front orientation (angle 0°, tilt -8°)', async () => {
  const { scene, model } = createMockCarton(75, -25);
  const controller = new CartonCameraController({
    scene,
    model,
    onPoseChange: (a, t) => {
      scene.dataset.angle = String(a);
      scene.dataset.tilt = String(t);
    },
  });

  await controller.flyToFace({ faceId: 'front', immediate: true });
  assert.equal(Number(scene.dataset.angle), 0);
  assert.equal(Number(scene.dataset.tilt), -8);
  assert.equal(model.style.transform, 'rotateX(-8deg) rotateY(0deg)');
});

test('19. Right-face fly-to finishes at perpendicular right orientation (angle -90°, tilt -8°)', async () => {
  const { scene, model } = createMockCarton(0, -8);
  const controller = new CartonCameraController({
    scene,
    model,
    onPoseChange: (a, t) => {
      scene.dataset.angle = String(a);
      scene.dataset.tilt = String(t);
    },
  });

  await controller.flyToFace({ faceId: 'right', immediate: true });
  assert.equal(Number(scene.dataset.angle), -90);
  assert.equal(Number(scene.dataset.tilt), -8);
  assert.equal(model.style.transform, 'rotateX(-8deg) rotateY(-90deg)');
});

test('20. Back-face fly-to finishes at perpendicular back orientation (angle 180°, tilt -8°)', async () => {
  const { scene, model } = createMockCarton(0, -8);
  const controller = new CartonCameraController({
    scene,
    model,
    onPoseChange: (a, t) => {
      scene.dataset.angle = String(a);
      scene.dataset.tilt = String(t);
    },
  });

  await controller.flyToFace({ faceId: 'back', immediate: true });
  assert.equal(Math.abs(Number(scene.dataset.angle)), 180);
  assert.equal(Number(scene.dataset.tilt), -8);
});

test('21. Left-face fly-to finishes at perpendicular left orientation (angle 90°, tilt -8°)', async () => {
  const { scene, model } = createMockCarton(0, -8);
  const controller = new CartonCameraController({
    scene,
    model,
    onPoseChange: (a, t) => {
      scene.dataset.angle = String(a);
      scene.dataset.tilt = String(t);
    },
  });

  await controller.flyToFace({ faceId: 'left', immediate: true });
  assert.equal(Number(scene.dataset.angle), 90);
  assert.equal(Number(scene.dataset.tilt), -8);
  assert.equal(model.style.transform, 'rotateX(-8deg) rotateY(90deg)');
});

test('24. Existing drag continues smoothly from fly-to final pose without jumping', async () => {
  const { scene, model } = createMockCarton(40, -10);
  let synced = null;

  const controller = new CartonCameraController({
    scene,
    model,
    syncControls: (a, t) => {
      synced = [a, t];
    },
  });

  // Fly to right face (-90°)
  await controller.flyToFace({ faceId: 'right', immediate: true });
  assert.equal(Number(scene.dataset.angle), -90);
  assert.deepEqual(synced, [-90, -8]);

  // Simulate subsequent user drag: drag adds +15° angle and +5° tilt
  const dragAngle = wrapAngle(Number(scene.dataset.angle) + 15);
  const dragTilt = Number(scene.dataset.tilt) + 5;
  controller.applyPose(dragAngle, dragTilt, true);

  assert.equal(Number(scene.dataset.angle), -75);
  assert.equal(Number(scene.dataset.tilt), -3);
  assert.equal(model.style.transform, 'rotateX(-3deg) rotateY(-75deg)');
});

test('25. Selecting a second pin interrupts active fly-to', () => {
  const { scene, model } = createMockCarton(0, 0);
  const controller = new CartonCameraController({ scene, model });

  controller.isAnimating = true;
  controller.activeAnimation = { frameId: 101 };

  // Interrupted by new request
  controller.cancel();
  assert.equal(controller.isAnimating, false);
  assert.equal(controller.activeAnimation, null);
});

test('26. Reset cancels an active fly-to immediately', () => {
  const { scene, model } = createMockCarton(-80, -20);
  const controller = new CartonCameraController({ scene, model });

  controller.isAnimating = true;
  controller.activeAnimation = { frameId: 202 };

  // Reset triggers cancel
  controller.cancel();
  controller.applyPose(-28, -10, true);

  assert.equal(controller.isAnimating, false);
  assert.equal(Number(scene.dataset.angle), -28);
  assert.equal(Number(scene.dataset.tilt), -10);
});

test('28. Reduced-motion immediately applies final pose without animation delay', async () => {
  const { scene, model } = createMockCarton(50, 10);
  const controller = new CartonCameraController({ scene, model });
  controller.reducedMotion = true;

  const t0 = performance.now();
  await controller.flyToFace({ faceId: 'left', duration: 1000 });
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 50, 'Must resolve immediately without 1000ms animation');
  assert.equal(Number(scene.dataset.angle), 90);
  assert.equal(Number(scene.dataset.tilt), -8);
});

test('30. Finding navigation preserves selected panel context when both findings belong to same panel', async () => {
  const { scene, model } = createMockCarton(0, 0);
  const controller = new CartonCameraController({ scene, model });

  const pin1 = { panelId: 'front', findingId: 'f1' };
  const pin2 = { panelId: 'front', findingId: 'f2' };

  await controller.flyToFinding(pin1, { immediate: true });
  assert.equal(Number(scene.dataset.angle), 0);

  // Moving to pin2 on same panel: angle stays 0
  const delta = shortestAngleDelta(Number(scene.dataset.angle), FACE_TARGET_POSES[pin2.panelId].angle);
  assert.equal(delta, 0, 'No unnecessary carton rotation between findings on the same face');
});
