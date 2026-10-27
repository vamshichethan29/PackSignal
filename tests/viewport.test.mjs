import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFit, constrainView, zoomAt, sourcePoint, focusBox, mountViewport } from '../public/artwork-viewport.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('fit keeps landscape, portrait and square artwork fully visible without distorting aspect ratio', () => {
  for (const [w, h] of [[1292, 1081], [1200, 860], [400, 1800], [1200, 1200]]) {
    for (const [vw, vh] of [[720, 500], [300, 340], [950, 450]]) {
      const layout = pageFit(vw, vh, w, h);
      close(layout.pageWidth / layout.pageHeight, w / h);
      assert.ok(layout.pageWidth <= vw - 36 + 1e-8);
      assert.ok(layout.pageHeight <= vh - 36 + 1e-8);
      assert.deepEqual(constrainView({ scale: 1, x: 500, y: -500 }, layout), { scale: 1, x: 0, y: 0 });
    }
  }
});

test('zoom under the cursor retains the same source point after panning', () => {
  const layout = pageFit(700, 500, 1200, 860);
  const view = { scale: 2, x: 60, y: -40 }, cursor = { x: 80, y: -50 };
  const before = sourcePoint(view, cursor, layout);
  const next = zoomAt(view, 3.5, cursor, layout);
  const after = sourcePoint(next, cursor, layout);
  close(after.x, before.x); close(after.y, before.y);
});

test('panning reaches all four source edges and clamps before losing the page', () => {
  const layout = pageFit(600, 480, 1200, 860);
  for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const view = constrainView({ scale: 3, x: x * 100000, y: y * 100000 }, layout);
    const edge = sourcePoint(view, { x: -x * (layout.width / 2 - layout.padding), y: -y * (layout.height / 2 - layout.padding) }, layout);
    close(edge.x, x > 0 ? 0 : 1); close(edge.y, y > 0 ? 0 : 1);
  }
});

test('focus keeps evidence at the page edge inside the viewport', () => {
  const layout = pageFit(620, 450, 1200, 860);
  const box = [.84, .8, .98, .93], view = focusBox(box, layout);
  for (const [x, y] of [[box[0], box[1]], [box[2], box[3]]]) {
    const screenX = layout.width / 2 + view.x + (x - .5) * layout.pageWidth * view.scale;
    const screenY = layout.height / 2 + view.y + (y - .5) * layout.pageHeight * view.scale;
    assert.ok(screenX >= 0 && screenX <= layout.width);
    assert.ok(screenY >= 0 && screenY <= layout.height);
  }
});

// Exercise the actual event handlers without a browser or external dependencies.
class Element extends EventTarget {
  dataset = {}; style = { setProperty(name, value) { this[name] = value; } };
  children = new Map(); clientWidth = 600; clientHeight = 480;
  flags = new Set(); textContent = ''; value = '100'; max = '400';
  classList = { toggle: (s, enabled) => enabled ? this.flags.add(s) : this.flags.delete(s), add: s => this.flags.add(s), remove: s => this.flags.delete(s) };
  querySelector(key) { return this.children.get(key) || null; }
  querySelectorAll(key) { return this.children.get(key) || []; }
  hasAttribute(key) { return key === 'data-start-focused' && this.startFocused; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  setPointerCapture() {}
  focus() { this.focused = true; }
}
function fire(node, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: 1, clientX: 300, clientY: 240, button: 0, deltaMode: 0, deltaX: 0, deltaY: 0, ...properties });
  node.dispatchEvent(event);
  return event;
}
function setup(initialView = { scale: 1, x: 0, y: 0 }, startFocused = false) {
  const frame = new Element(), content = new Element(), controls = new Element(), slider = new Element(), output = new Element();
  frame.dataset = { pageWidth: '1200', pageHeight: '860' };
  frame.startFocused = startFocused;
  slider.parentElement = new Element(); slider.parentElement.children.set('output', output);
  const fit = new Element(), focus = new Element(), left = new Element(), right = new Element();
  left.dataset.viewportPan = '-1,0'; right.dataset.viewportPan = '1,0';
  controls.children.set('[data-viewport-fit]', fit); controls.children.set('[data-viewport-focus]', focus);
  controls.children.set('[data-viewport-pan]', [left, right]);
  let changes = 0, cursor;
  const controller = mountViewport({ frame, content, controls, slider, initialView, focus: [.12, .15, .22, .3], onChange: () => changes++, onPoint: p => cursor = p });
  return { frame, content, controls, slider, output, fit, focus, left, right, controller, changes: () => changes, cursor: () => cursor };
}

test('drag actually changes horizontal and vertical pan and suppresses a click after dragging', () => {
  const h = setup({ scale: 2, x: 0, y: 0 });
  fire(h.frame, 'pointerdown');
  fire(h.frame, 'pointermove', { clientX: 380, clientY: 300 });
  assert.deepEqual(h.controller.getView(), { scale: 2, x: 80, y: 60 });
  assert.match(h.content.style.transform, /translate\(80px, 60px\) scale\(2\)/);
  fire(h.frame, 'pointerup');
  assert.equal(h.frame.flags.has('is-panning'), false);
  assert.equal(fire(h.frame, 'click').defaultPrevented, true);
  close(h.cursor().x, .5); close(h.cursor().y, .5);
  // A new stationary pointer click must still reach the evidence button.
  fire(h.frame, 'pointerdown'); fire(h.frame, 'pointerup');
  assert.equal(fire(h.frame, 'click').defaultPrevented, false);
});

test('trackpad scrolling, shift-wheel, pan buttons and arrow keys navigate horizontally', () => {
  const h = setup({ scale: 2, x: 0, y: 0 });
  assert.equal(fire(h.frame, 'wheel', { deltaX: 40, deltaY: 20 }).defaultPrevented, true);
  assert.deepEqual(h.controller.getView(), { scale: 2, x: -40, y: -20 });
  fire(h.frame, 'wheel', { deltaY: 30, shiftKey: true });
  assert.equal(h.controller.getView().x, -70);
  fire(h.frame, 'keydown', { key: 'ArrowLeft' });
  assert.equal(h.controller.getView().x, -30);
  fire(h.left, 'click'); assert.equal(h.controller.getView().x, 78);
  fire(h.right, 'click'); assert.equal(h.controller.getView().x, -30);
  fire(h.frame, 'keydown', { key: 'Home' });
  assert.deepEqual(h.controller.getView(), { scale: 1, x: 0, y: 0 });
  assert.equal(fire(h.frame, 'wheel', { deltaY: 50 }).defaultPrevented, false, 'Normal page scrolling is available at Fit');
});

test('slider, toolbar focus and Fit share one state and update the percentage', () => {
  const h = setup();
  h.slider.value = '275'; fire(h.slider, 'input');
  assert.equal(h.controller.getView().scale, 2.75); assert.equal(h.output.textContent, '275%');
  fire(h.focus, 'click'); assert.ok(h.controller.getView().x > 0);
  fire(h.fit, 'click');
  assert.deepEqual(h.controller.getView(), { scale: 1, x: 0, y: 0 });
  assert.equal(h.output.textContent, '100%');
  assert.ok(h.changes() >= 4);
});

test('two-pointer pinch changes scale and cancellation releases drag state', () => {
  const h = setup();
  fire(h.frame, 'pointerdown', { pointerId: 1, clientX: 250 });
  fire(h.frame, 'pointerdown', { pointerId: 2, clientX: 350 });
  fire(h.frame, 'pointermove', { pointerId: 2, clientX: 450 });
  close(h.controller.getView().scale, 2);
  fire(h.frame, 'pointercancel', { pointerId: 1 }); fire(h.frame, 'pointercancel', { pointerId: 2 });
  assert.equal(h.frame.flags.has('is-panning'), false);
  const before = h.controller.getView(); fire(h.frame, 'pointermove', { clientX: 570 });
  assert.deepEqual(h.controller.getView(), before);
});

test('a retained view survives remount and resizing retains its source center', () => {
  const h = setup({ scale: 3, x: 100, y: -55 });
  const before = sourcePoint(h.controller.getView(), { x: 0, y: 0 }, pageFit(600, 480, 1200, 860));
  h.frame.clientWidth = 340; h.frame.clientHeight = 320; h.controller.resize();
  const after = sourcePoint(h.controller.getView(), { x: 0, y: 0 }, pageFit(340, 320, 1200, 860));
  close(after.x, before.x); close(after.y, before.y);
  const remount = setup(h.controller.getView());
  close(remount.controller.getView().scale, 3);
});

test('evidence spotlight starts focused and uses the same pan controller', () => {
  const h = setup(undefined, true);
  assert.ok(h.controller.getView().scale > 1);
  const before = h.controller.getView();
  fire(h.frame, 'pointerdown'); fire(h.frame, 'pointermove', { clientX: 220, clientY: 190 });
  assert.ok(h.controller.getView().x < before.x);
  assert.ok(h.controller.getView().y < before.y);
});

test('dynamic focus and page changes reuse one viewport and disposal removes its listeners', () => {
  const h=setup();
  const again=mountViewport({frame:h.frame,content:h.content,controls:h.controls,slider:h.slider});
  assert.equal(again,h.controller);
  h.controller.focusOnBox([.7,.7,.9,.9]);
  assert.ok(h.controller.getView().x<0);
  h.controller.setPage(400,1200);
  assert.deepEqual(h.controller.getView(),{scale:1,x:0,y:0});
  close(h.controller.getLayout().pageWidth/h.controller.getLayout().pageHeight,1/3);
  h.controller.focusOnBox([.05,.1,.2,.2]);
  assert.ok(h.controller.getView().y>0);
  const before=h.changes();
  h.controller.dispose();fire(h.frame,'keydown',{key:'+'});fire(h.slider,'input');
  assert.equal(h.changes(),before);
  assert.equal(h.frame.dataset.viewportMounted,undefined);
});
