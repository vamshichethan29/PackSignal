import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

// Headless / Node-compatible DemoTimer test harness
class NodeDemoTimer {
  constructor({ durationSec = 30, onTick = () => {}, onExpire = () => {} }) {
    this.totalDurationMs = durationSec * 1000;
    this.remainingMs = this.totalDurationMs;
    this.isRunning = false;
    this.startTime = null;
    this.elapsedBeforePause = 0;
    this.onTick = onTick;
    this.onExpire = onExpire;
  }

  start() {
    if (this.isRunning) return;
    if (this.remainingMs <= 0) this.remainingMs = this.totalDurationMs;
    this.isRunning = true;
    this.startTime = performance.now();
  }

  tick() {
    if (!this.isRunning) return this.remainingMs;
    const now = performance.now();
    const currentRun = now - this.startTime;
    const totalElapsed = this.elapsedBeforePause + currentRun;
    this.remainingMs = Math.max(0, this.totalDurationMs - totalElapsed);
    this.onTick(this.remainingMs);
    if (this.remainingMs <= 0) {
      this.stop();
      this.onExpire();
    }
    return this.remainingMs;
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    const now = performance.now();
    this.elapsedBeforePause += (now - this.startTime);
    this.onTick(this.remainingMs);
  }

  reset() {
    this.isRunning = false;
    this.remainingMs = this.totalDurationMs;
    this.elapsedBeforePause = 0;
    this.startTime = null;
    this.onTick(this.remainingMs);
  }

  skip() {
    this.isRunning = false;
    this.remainingMs = 0;
    this.elapsedBeforePause = this.totalDurationMs;
    this.onTick(this.remainingMs);
    this.onExpire();
  }

  stop() {
    this.isRunning = false;
  }
}

test('Demo Timer initializes at 30 seconds', () => {
  let tickVal = null;
  const timer = new NodeDemoTimer({
    durationSec: 30,
    onTick: (ms) => { tickVal = ms; }
  });

  assert.equal(timer.remainingMs, 30000);
  assert.equal(timer.isRunning, false);
});

test('Demo Timer starts and calculates monotonic remaining time', async () => {
  const timer = new NodeDemoTimer({ durationSec: 30 });
  timer.start();
  assert.equal(timer.isRunning, true);

  // Wait 60ms
  await new Promise(r => setTimeout(r, 60));
  const remaining = timer.tick();

  assert.ok(remaining < 30000, `Remaining ${remaining} should be less than 30000`);
  assert.ok(remaining > 29800, `Remaining ${remaining} should reflect ~60ms elapsed`);
  timer.stop();
});

test('Demo Timer can pause and resume without drift', async () => {
  const timer = new NodeDemoTimer({ durationSec: 30 });
  timer.start();
  await new Promise(r => setTimeout(r, 40));
  timer.tick();
  timer.pause();
  assert.equal(timer.isRunning, false);
  const pausedRemaining = timer.remainingMs;

  // Wait while paused
  await new Promise(r => setTimeout(r, 40));
  timer.tick();
  assert.equal(timer.remainingMs, pausedRemaining, 'Time must not decrease while paused');

  // Resume
  timer.start();
  assert.equal(timer.isRunning, true);
  await new Promise(r => setTimeout(r, 40));
  timer.tick();
  assert.ok(timer.remainingMs < pausedRemaining, 'Time must resume decreasing');
  timer.stop();
});

test('Demo Timer can reset back to 30 seconds', async () => {
  const timer = new NodeDemoTimer({ durationSec: 30 });
  timer.start();
  await new Promise(r => setTimeout(r, 40));
  timer.tick();
  assert.ok(timer.remainingMs < 30000);

  timer.reset();
  assert.equal(timer.remainingMs, 30000);
  assert.equal(timer.isRunning, false);
  assert.equal(timer.elapsedBeforePause, 0);
});

test('Demo Timer skip countdown immediately expires', () => {
  let expired = false;
  const timer = new NodeDemoTimer({
    durationSec: 30,
    onExpire: () => { expired = true; }
  });

  timer.skip();
  assert.equal(timer.remainingMs, 0);
  assert.equal(timer.isRunning, false);
  assert.equal(expired, true);
});
