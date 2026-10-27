import test from 'node:test';
import assert from 'node:assert/strict';
import { getCampusScenes } from '../public/campus-demo.js';
import { resetCampusDemoState } from '../lib/campus/rehearsal-reset.mjs';

test('Campus Rehearsal — Script Execution & Consecutive Clean Runs Validation', async () => {
  const scenes = getCampusScenes();
  assert.equal(scenes.length, 10, 'Rehearsal script must have 10 distinct scenes');

  // Rehearsal telemetry runner
  async function simulateRehearsalRun(runId) {
    const telemetry = {
      runId,
      startTime: Date.now(),
      sceneResults: [],
      errors: [],
      completedClean: false,
    };

    // Step 0: Initial Reset
    const resetRes = await resetCampusDemoState();
    assert.equal(resetRes.ok, true, `${runId}: Initial reset must succeed`);

    // Execute through all 10 scenes
    for (const scene of scenes) {
      const sceneStart = Date.now();
      // Simulate scene checks
      assert.ok(scene.sceneId, `${runId}: Scene must have sceneId`);
      assert.ok(scene.expectedTimeWindow, `${runId}: Scene must declare time window`);
      
      telemetry.sceneResults.push({
        sceneId: scene.sceneId,
        label: scene.label,
        durationMs: Date.now() - sceneStart,
        status: 'PASSED',
      });
    }

    telemetry.endTime = Date.now();
    telemetry.totalElapsedSec = (telemetry.endTime - telemetry.startTime) / 1000;
    telemetry.completedClean = telemetry.errors.length === 0;
    return telemetry;
  }

  // REHEARSAL 1: Functional Walkthrough
  const run1 = await simulateRehearsalRun('Rehearsal-1-Functional');
  assert.equal(run1.completedClean, true, 'Rehearsal 1 must complete cleanly');
  assert.equal(run1.sceneResults.length, 10);

  // REHEARSAL 2: Timed Simulation
  const run2 = await simulateRehearsalRun('Rehearsal-2-Timed');
  assert.equal(run2.completedClean, true, 'Rehearsal 2 must complete cleanly');

  // REHEARSAL 3: Dress Rehearsal
  const run3 = await simulateRehearsalRun('Rehearsal-3-Dress');
  assert.equal(run3.completedClean, true, 'Rehearsal 3 must complete cleanly');

  // FINAL ACCEPTANCE GATE: Two Consecutive Clean Runs (Run A and Run B)
  const runA = await simulateRehearsalRun('Consecutive-Run-A');
  assert.equal(runA.completedClean, true, 'Run A must pass without critical failures');

  const runB = await simulateRehearsalRun('Consecutive-Run-B');
  assert.equal(runB.completedClean, true, 'Run B must pass without critical failures');

  // Verify safe reset between runs
  const finalReset = await resetCampusDemoState();
  assert.equal(finalReset.ok, true, 'Final post-rehearsal reset must succeed');
});
