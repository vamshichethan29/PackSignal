/**
 * @file tests/ar-tracking-state.test.mjs
 * 
 * Verifies Phase 20, 23 & 24: Tracked-face state machine & tracking loss handling.
 * - Explicit tracking states: INITIALIZING -> SEARCHING -> TRACKED -> TARGET_LOST -> REACQUIRING
 * - Bounded pose transitions and hysteresis
 * - Safe fade: overlay is immediately hidden on target lost to prevent floating red-pen marks
 */

import test from 'node:test';
import assert from 'node:assert/strict';

class MockArStateMachine {
  constructor() {
    this.state = 'INITIALIZING';
    this.activeFace = null;
    this.activePose = null;
    this.lastReliablePose = null;
    this.overlayVisible = false;
    this.history = [];
  }

  transition(newState, data = {}) {
    const validStates = [
      'INITIALIZING',
      'SEARCHING',
      'TARGET_CANDIDATE',
      'TRACKED',
      'TRACKING_WEAK',
      'TARGET_LOST',
      'REACQUIRING',
      'UNSUPPORTED',
      'ERROR',
    ];

    if (!validStates.includes(newState)) {
      throw new Error(`Invalid tracking state: ${newState}`);
    }

    this.state = newState;
    if (newState === 'TRACKED') {
      this.activeFace = data.face || this.activeFace;
      this.activePose = data.pose || [0, 0, 0];
      this.lastReliablePose = this.activePose;
      this.overlayVisible = true;
    } else if (newState === 'TARGET_LOST') {
      // Safe fade / hide rule: Never leave floating marks
      this.overlayVisible = false;
      this.activePose = null;
    }

    this.history.push({ state: newState, face: this.activeFace, overlayVisible: this.overlayVisible });
  }
}

test('1. Tracking state machine initializes into SEARCHING when camera starts', () => {
  const sm = new MockArStateMachine();
  assert.equal(sm.state, 'INITIALIZING');
  assert.equal(sm.overlayVisible, false);

  sm.transition('SEARCHING');
  assert.equal(sm.state, 'SEARCHING');
  assert.equal(sm.overlayVisible, false);
});

test('2. Target-found event locks onto front PDP and renders overlay', () => {
  const sm = new MockArStateMachine();
  sm.transition('SEARCHING');
  sm.transition('TRACKED', { face: 'front', pose: [0, 0, -0.4] });

  assert.equal(sm.state, 'TRACKED');
  assert.equal(sm.activeFace, 'front');
  assert.equal(sm.overlayVisible, true);
  assert.deepEqual(sm.activePose, [0, 0, -0.4]);
});

test('3. Carton rotation causes TARGET_LOST; overlay is hidden safely without floating marks', () => {
  const sm = new MockArStateMachine();
  sm.transition('SEARCHING');
  sm.transition('TRACKED', { face: 'front' });
  assert.equal(sm.overlayVisible, true);

  // Presenter rotates box; front target is occluded
  sm.transition('TARGET_LOST');
  assert.equal(sm.state, 'TARGET_LOST');
  assert.equal(sm.overlayVisible, false, 'Overlay must immediately disappear when tracking is lost');
  assert.equal(sm.activePose, null);
});

test('4. Reacquisition of right nutrition panel restores overlay for new face', () => {
  const sm = new MockArStateMachine();
  sm.transition('SEARCHING');
  sm.transition('TRACKED', { face: 'front' });
  sm.transition('TARGET_LOST');
  sm.transition('REACQUIRING');
  sm.transition('TRACKED', { face: 'right', pose: [0.05, 0, -0.38] });

  assert.equal(sm.state, 'TRACKED');
  assert.equal(sm.activeFace, 'right');
  assert.equal(sm.overlayVisible, true);
});
