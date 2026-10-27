// One coordinate model for the full artwork and the evidence spotlight.
// Offsets are viewport pixels; artwork coordinates stay normalized to the source.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const controllers = new WeakMap();

export function pageFit(width, height, pageWidth, pageHeight, padding = 18) {
  const ratio = Math.max(1, pageWidth) / Math.max(1, pageHeight);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const fitWidth = Math.min(usableWidth, usableHeight * ratio);
  return { width, height, pageWidth: fitWidth, pageHeight: fitWidth / ratio, padding };
}

export function constrainView(view, layout, maxScale = 4, minScale = 1) {
  const scale = clamp(Number(view.scale) || 1, minScale, maxScale);
  if (scale === 1) return { scale: 1, x: 0, y: 0 };
  const maxX = Math.max(0, (layout.pageWidth * scale - layout.width) / 2 + layout.padding);
  const maxY = Math.max(0, (layout.pageHeight * scale - layout.height) / 2 + layout.padding);
  return { scale, x: clamp(Number(view.x) || 0, -maxX, maxX), y: clamp(Number(view.y) || 0, -maxY, maxY) };
}

export function zoomAt(view, scale, point, layout, maxScale = 4, minScale = 1) {
  const nextScale = clamp(scale, minScale, maxScale);
  const ratio = nextScale / view.scale;
  return constrainView({ scale: nextScale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }, layout, maxScale, minScale);
}

export function sourcePoint(view, point, layout) {
  return { x: clamp(.5 + (point.x - view.x) / (layout.pageWidth * view.scale), 0, 1), y: clamp(.5 + (point.y - view.y) / (layout.pageHeight * view.scale), 0, 1) };
}

export function focusBox(box, layout, maxScale = 4) {
  const [x0, y0, x1, y1] = box;
  const scale = clamp(Math.min(layout.width * .66 / (layout.pageWidth * Math.max(.06, x1 - x0)), layout.height * .54 / (layout.pageHeight * Math.max(.06, y1 - y0))), 1, maxScale);
  return constrainView({ scale, x: (.5 - (x0 + x1) / 2) * layout.pageWidth * scale, y: (.5 - (y0 + y1) / 2) * layout.pageHeight * scale }, layout, maxScale);
}

export function mountViewport({ frame, content, controls, slider, initialView, focus, onChange, onPoint }) {
  if (!frame || !content) return;
  if (controllers.has(frame)) return controllers.get(frame);
  frame.dataset.viewportMounted = 'true';
  const maxScale = Number(slider?.max || 400) / 100;
  const minScale = Number(slider?.min || 100) / 100;
  let layout, view = { scale: 1, x: 0, y: 0, ...initialView }, gesture = null, suppressClick = false;
  const pointers = new Map();
  const cleanups = [];
  const on = (element, type, handler, options) => {
    if (!element) return;
    element.addEventListener(type, handler, options);
    cleanups.push(() => element.removeEventListener(type, handler, options));
  };
  let animation = null, disposed = false;
  const cancel = () => { if (animation !== null) globalThis.cancelAnimationFrame?.(animation); animation = null; };
  const framePoint = event => {
    const rect = frame.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const render = () => {
    view = constrainView(view, layout, maxScale, minScale);
    content.style.width = `${layout.pageWidth}px`;
    content.style.height = `${layout.pageHeight}px`;
    content.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    frame.dataset.zoom = String(Math.round(view.scale * 100));
    frame.dataset.panX = String(view.x);
    frame.dataset.panY = String(view.y);
    frame.classList.toggle('is-zoomed', view.scale > 1.001);
    content.style.setProperty('--inverse-zoom', String(1 / view.scale));
    if (slider) {
      slider.value = String(Math.round(view.scale * 100));
      const output = slider.parentElement?.querySelector('output');
      if (output) output.textContent = `${Math.round(view.scale * 100)}%`;
    }
    controls?.querySelectorAll('[data-viewport-step]').forEach(button => {
      button.disabled = Number(button.dataset.viewportStep) < 0 ? view.scale <= minScale : view.scale >= maxScale;
    });
    onChange?.({ ...view });
    frame.dispatchEvent(new Event('viewportchange'));
  };
  const resize = () => {
    const width = frame.clientWidth, height = frame.clientHeight;
    if (!width || !height) return;
    const previous = layout;
    layout = pageFit(width, height, Number(frame.dataset.pageWidth) || 1200, Number(frame.dataset.pageHeight) || 860);
    if (previous) {
      view.x *= layout.pageWidth / previous.pageWidth;
      view.y *= layout.pageHeight / previous.pageHeight;
    }
    render();
  };
  resize();
  if (!layout) return;
  const setScale = (scale, point = { x: 0, y: 0 }) => { cancel(); view = zoomAt(view, scale, point, layout, maxScale, minScale); render(); };
  const fit = () => { cancel(); view = { scale: 1, x: 0, y: 0 }; render(); };
  const setView = (next, { animate = false } = {}) => {
    cancel();
    const target = constrainView(next, layout, maxScale, minScale);
    if (!animate || !globalThis.requestAnimationFrame || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { view = target; render(); return; }
    const start = { ...view }; let started;
    const step = now => {
      started ??= now;
      const progress = Math.min(1, (now-started)/280), t = 1-Math.pow(1-progress,3);
      view = { scale:start.scale+(target.scale-start.scale)*t, x:start.x+(target.x-start.x)*t, y:start.y+(target.y-start.y)*t };
      render();
      animation = progress < 1 ? requestAnimationFrame(step) : null;
    };
    animation = requestAnimationFrame(step);
  };
  const focusOnBox = (box, options = {}) => {
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= box[0] || box[3] <= box[1]) return;
    focus = [...box]; setView(focusBox(focus, layout, maxScale), options);
  };
  const focusEvidence = () => { if (focus) focusOnBox(focus, { animate: true }); };
  if (frame.hasAttribute('data-start-focused')) focusEvidence();
  on(slider, 'input', () => setScale(Number(slider.value) / 100));
  on(controls?.querySelector('[data-viewport-fit]'), 'click', fit);
  on(controls?.querySelector('[data-viewport-focus]'), 'click', focusEvidence);
  controls?.querySelectorAll('[data-viewport-step]').forEach(button => on(button, 'click', () => setScale(view.scale + Number(button.dataset.viewportStep))));
  controls?.querySelectorAll('[data-viewport-pan]').forEach(button => on(button, 'click', () => {
    cancel();
    const [dx, dy] = button.dataset.viewportPan.split(',').map(Number);
    if (view.scale === 1) view = zoomAt(view, 2, { x: 0, y: 0 }, layout, maxScale);
    view.x -= dx * layout.width * .18; view.y -= dy * layout.height * .18; render();
  }));

  const startGesture = () => {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      const a = points[0], b = points[1];
      gesture = { type: 'pinch', center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view: { ...view } };
    } else if (points.length) gesture = { type: 'drag', start: points[0], view: { ...view }, moved: false };
    else gesture = null;
  };
  on(frame, 'pointerdown', event => {
    if (event.button !== 0) return;
    if (typeof event.target?.closest === 'function' && event.target.closest('button, .workbench-ghost-box, .workbench-legal-region, [data-action]')) return;
    cancel();
    suppressClick = false;
    pointers.set(event.pointerId, framePoint(event));
    event.target.setPointerCapture?.(event.pointerId);
    startGesture();
    frame.focus({ preventScroll: true });
    event.preventDefault();
  });
  on(frame, 'pointermove', event => {
    const point = framePoint(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, point);
      if (gesture?.type === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        view = zoomAt(gesture.view, gesture.view.scale * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance, gesture.center, layout, maxScale);
        view.x += center.x - gesture.center.x; view.y += center.y - gesture.center.y;
        suppressClick = true; frame.classList.add('is-panning'); render();
      } else if (gesture?.type === 'drag') {
        const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
        if (gesture.moved || Math.hypot(dx, dy) > 4) {
          gesture.moved = true; suppressClick = true; frame.classList.add('is-panning');
          // Auto-zoom to 1.5× if the user starts dragging at 100% so the pan is visible.
          if (!gesture.autoZoomed && view.scale <= 1) {
            gesture.autoZoomed = true;
            view = zoomAt(view, 1.5, { x: 0, y: 0 }, layout, maxScale);
            gesture.view = { ...view, x: view.x - dx, y: view.y - dy };
          }
          view = { ...view, x: gesture.view.x + dx, y: gesture.view.y + dy }; render();
        }
      }
    }
    onPoint?.(sourcePoint(view, point, layout));
  });
  const stopPointer = event => {
    pointers.delete(event.pointerId);
    startGesture();
    if (!pointers.size) frame.classList.remove('is-panning');
  };
  on(frame, 'pointerup', stopPointer);
  on(frame, 'pointercancel', stopPointer);
  on(frame, 'lostpointercapture', stopPointer);
  on(frame, 'click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } }, true);
  on(frame, 'dragstart', event => event.preventDefault());
  on(frame, 'dblclick', event => { event.preventDefault(); view.scale > 1 ? fit() : setScale(2, framePoint(event)); });
  on(frame, 'wheel', event => {
    cancel();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault(); setScale(view.scale * Math.exp(-event.deltaY * .006), framePoint(event));
    } else if (view.scale > 1) {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? layout.height : 1;
      view.x -= (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
      view.y -= (event.shiftKey ? 0 : event.deltaY) * unit;
      render();
    }
  }, { passive: false });
  on(frame, 'keydown', event => {
    if (event.target !== frame) return;
    cancel();
    const arrows = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (arrows[event.key] && view.scale > 1) {
      event.preventDefault(); const [x, y] = arrows[event.key]; const step = event.shiftKey ? 100 : 40;
      view.x += x * step; view.y += y * step; render();
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault(); setScale(view.scale + (event.key === '-' ? -.25 : .25));
    } else if (event.key === 'Home' || event.key === '0') { event.preventDefault(); fit(); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); focusEvidence(); }
  });
  const observer = globalThis.ResizeObserver ? new ResizeObserver(resize) : null;
  observer?.observe(frame);
  // Removed review views must release observers and pointer state.
  const removal = globalThis.MutationObserver ? new MutationObserver(() => {
    if (!frame.isConnected) dispose();
  }) : null;
  if (removal) removal.observe(frame.ownerDocument.body, { childList: true, subtree: true });
  function dispose() {
    if (disposed) return;
    disposed = true; cancel(); observer?.disconnect(); removal?.disconnect(); pointers.clear();
    cleanups.forEach(cleanup => cleanup()); controllers.delete(frame); delete frame.dataset.viewportMounted;
  }
  const controller = {
    getView: () => ({ ...view }), getLayout: () => ({ ...layout }), fit, reset: fit, focus: focusEvidence,
    focusOnBox, setFocus: box => { focus = box; }, setView, resize, dispose,
    point: event => sourcePoint(view, framePoint(event), layout),
    setPage: (width, height, nextView = { scale:1, x:0, y:0 }) => {
      cancel(); pointers.clear(); gesture = null;
      frame.dataset.pageWidth = String(width); frame.dataset.pageHeight = String(height);
      layout = pageFit(frame.clientWidth, frame.clientHeight, width, height); view = { ...nextView }; render();
    },
  };
  controllers.set(frame, controller);
  return controller;
}
