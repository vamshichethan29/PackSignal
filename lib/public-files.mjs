import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

export const publicFiles = new Map([
  ['/','index.html'],
  ['/index.html','index.html'],
  ['/app.js','app.js'],
  ['/review-output-panels.js','review-output-panels.js'],
  ['/styles.css','styles.css'],
  ['/icon.svg','icon.svg'],
  ['/artwork-ui.js','artwork-ui.js'],
  ['/ar-modal.js','ar-modal.js'],
  ['/campus-extras.js','campus-extras.js'],
  ['/campus-demo.js','campus-demo.js'],
  ['/campus-demo.css','campus-demo.css'],
  ['/scan','scan.html'],
  ['/scan.html','scan.html'],
  ['/mobile-scan.js','mobile-scan.js'],
  ['/mobile-scan.css','mobile-scan.css'],
  ['/scan-session.js','scan-session.js'],
  ['/scan-3d-twin.js','scan-3d-twin.js'],
  ['/samples/campus/front.png','samples/campus/front.png'],
  ['/samples/campus/right.png','samples/campus/right.png'],
  ['/samples/campus/back.png','samples/campus/back.png'],
  ['/samples/campus/bottom.png','samples/campus/bottom.png'],
  ['/samples/campus/left.png','samples/campus/left.png'],
  ['/samples/campus/top.png','samples/campus/top.png'],
  ['/samples/dancing-fish-carton.png','samples/dancing-fish-carton.png'],
  ['/samples/organizer/panels/front.png','samples/organizer/panels/front.png'],
  ['/samples/organizer/panels/right.png','samples/organizer/panels/right.png'],
  ['/samples/organizer/panels/back.png','samples/organizer/panels/back.png'],
  ['/samples/organizer/panels/bottom.png','samples/organizer/panels/bottom.png'],
  ['/samples/organizer/panels/left.png','samples/organizer/panels/left.png'],
  ['/samples/organizer/panels/top.png','samples/organizer/panels/top.png'],
  ['/ar','ar.html'],
  ['/ar.html','ar.html'],
  ['/ar-review','ar-review.html'],
  ['/ar-review.html','ar-review.html'],
  ['/ar-review.js','ar-review.js'],
  ['/ar-review.css','ar-review.css'],
  ['/samples/organizer/targets.mind','samples/organizer/targets.mind'],
  ['/samples/organizer/ar-manifest.json','samples/organizer/ar-manifest.json'],
  ['/trust-console.js','trust-console.js'],
  ['/cad-carton.js','cad-carton.js'],
  ['/camera-intake.js','camera-intake.js'],
  ['/artwork-viewport.js','artwork-viewport.js'],
  ['/evidence-canvas.js','evidence-canvas.js'],
  ['/evidence-geometry.js','evidence-geometry.js'],
  ['/source-chip.js','source-chip.js'],
  ['/source-viewer.js','source-viewer.js'],
  ['/evidence-drawer.js','evidence-drawer.js'],
  ['/evidence-drawer.css','evidence-drawer.css'],
  ['/evidence-desk.js','evidence-desk.js'],
  ['/evidence-desk.css','evidence-desk.css'],
  ['/creative-brief.js','creative-brief.js'],
  ['/creative-brief.css','creative-brief.css'],
  ['/brief-editor.js','brief-editor.js'],
  ['/brief-editor.css','brief-editor.css'],
  ['/ask-about-this.js','ask-about-this.js'],
  ['/ask-about-this.css','ask-about-this.css'],
  ['/reviewer-lenses.js','reviewer-lenses.js'],
  ['/reviewer-lenses.css','reviewer-lenses.css'],
  ['/pack-canvas.js','pack-canvas.js'],
  ['/pack-canvas.css','pack-canvas.css'],
  ['/shopper-lenses.js','shopper-lenses.js'],
  ['/shopper-lenses.css','shopper-lenses.css'],
  ['/market-radar-map.js','market-radar-map.js'],
  ['/market-radar-map.css','market-radar-map.css'],
  ['/overlap-shield.js','overlap-shield.js'],
  ['/overlap-shield.css','overlap-shield.css'],
  ['/conflict-card.js','conflict-card.js'],
  ['/conflict-cards.js','conflict-cards.js'],
  ['/review-questions.js','review-questions.js'],
  ['/review-checks.js','review-checks.js'],
  ['/review-checks.css','review-checks.css'],
  ['/rule-map.js','rule-map.js'],
  ['/preflight-dashboard.js','preflight-dashboard.js'],
  ['/preflight-engine.js','preflight-engine.js'],
  ['/deep-verification.js','deep-verification.js'],
  ['/packaging-geometry.js','packaging-geometry.js'],
  ['/artwork.css','artwork.css'],
  ['/walkthrough.js','walkthrough.js'],
  ['/panel-zones.js','panel-zones.js'],
  ['/dieline-layout.js','dieline-layout.js'],
  ['/review-pipeline.js','review-pipeline.js'],
  ['/storage-disclosure.js','storage-disclosure.js'],
  ['/engine-status-copy.js','engine-status-copy.js'],
  ['/review-summary.js','review-summary.js'],
  ['/source-impact.js','source-impact.js'],
  ['/team-review.js','team-review.js'],
  ['/review-actions.js','review-actions.js'],
  ['/clarification-message.js','clarification-message.js'],
  ['/ask-someone.js','ask-someone.js'],
  ['/ghost-overlays.js','ghost-overlays.js'],
  ['/ghost-overlays.css','ghost-overlays.css'],
  ['/regulatory-time-machine.js','regulatory-time-machine.js'],
  ['/regulatory-time-machine.css','regulatory-time-machine.css'],
  ['/carton-finding-pins.js','carton-finding-pins.js'],
  ['/carton-pin-projection.js','carton-pin-projection.js'],
  ['/carton-pin-clustering.js','carton-pin-clustering.js'],
  ['/carton-camera-controller.js','carton-camera-controller.js'],
  ['/carton-pin-ui.js','carton-pin-ui.js'],
  ['/carton-pins.css','carton-pins.css'],
  ['/department-filters.js','department-filters.js'],
  ['/department-filters.css','department-filters.css'],
  ['/department-sticky-notes.js','department-sticky-notes.js'],
  ['/department-sticky-notes.css','department-sticky-notes.css'],
  ['/sticky-notes.js','sticky-notes.js'],
  ['/sticky-notes.css','sticky-notes.css'],
  ['/quick-triage.js','quick-triage.js'],
  ['/quick-triage.css','quick-triage.css'],
  ['/remediation-diff.js','remediation-diff.js'],
  ['/remediation-studio.js','remediation-studio.js'],
  ['/revision-studio.js','revision-studio.js'],
  ['/regulatory-switcher.js','regulatory-switcher.js'],
  ['/regulatory-workbench.js','regulatory-workbench.js'],
  ['/source-ambiguity.js','source-ambiguity.js'],
  ['/independent-evaluation.js','independent-evaluation.js'],
  ['/nutrition-studio.js','nutrition-studio.js'],
  ['/three-bundle.js','three-bundle.js'],
  ['/qrcode.min.js','qrcode.min.js'],
  ['/qrcode.esm.js','qrcode.esm.js'],
  ['/three/scene.js','three/scene.js'],
  ['/three/carton-geometry.js','three/carton-geometry.js'],
  ['/three/fold-engine.js','three/fold-engine.js'],
  ['/three/texture-mapper.js','three/texture-mapper.js'],
  ['/three/evidence-pins.js','three/evidence-pins.js'],
  ['/three/camera-controller.js','three/camera-controller.js'],
  ['/three/viewer-controller.js','three/viewer-controller.js'],
  ['/three/geometry/can.js','three/geometry/can.js'],
  ['/three/geometry/bottle.js','three/geometry/bottle.js'],
  ['/three/geometry/pouch.js','three/geometry/pouch.js'],
  ['/three/geometry/standup-pouch.js','three/geometry/standup-pouch.js'],
  ['/three/geometry/carton.js','three/geometry/carton.js'],
  ['/three/materials/finishes.js','three/materials/finishes.js'],
  ['/three/materials/substrates.js','three/materials/substrates.js'],
  ['/three/materials/finish-mask.js','three/materials/finish-mask.js'],
  ['/three/materials/metallic-foil.js','three/materials/metallic-foil.js'],
  ['/three/materials/spot-uv.js','three/materials/spot-uv.js'],
  ['/three/materials/relief-effects.js','three/materials/relief-effects.js'],
  ['/three/coordinate-mapper.js','three/coordinate-mapper.js'],
  ['/three/texture-manager.js','three/texture-manager.js'],
  ['/three/studio.js','three/studio.js'],
  ['/three/revision-3d-controller.js','three/revision-3d-controller.js'],
  ['/atwater-proof-card.js','atwater-proof-card.js'],
  ['/atwater-proof-card.css','atwater-proof-card.css'],
  ['/pack-quantity-card.js','pack-quantity-card.js'],
  ['/pack-quantity-card.css','pack-quantity-card.css'],
  ['/pdf-hidden-overlays.js','pdf-hidden-overlays.js'],
  ['/pdf-hidden-overlays.css','pdf-hidden-overlays.css'],
  ['/pdf-reconstruction-overlays.js','pdf-reconstruction-overlays.js'],
  ['/pdf-reconstruction-overlays.css','pdf-reconstruction-overlays.css'],
  ['/trust-scoreboard.js','trust-scoreboard.js'],
  ['/trust-scoreboard.css','trust-scoreboard.css'],
  ['/press-quality-radar.js','press-quality-radar.js'],
  ['/press-quality-radar.css','press-quality-radar.css'],
  ['/print-radar.js','print-radar.js'],
  ['/print-radar.css','print-radar.css'],
  ['/press-overlays.js','press-overlays.js'],
  ['/press-overlays.css','press-overlays.css'],
  ['/typography-overlay.js','typography-overlay.js'],
  ['/typography-overlay.css','typography-overlay.css'],
  ['/organizer-validation-ui.js','organizer-validation-ui.js'],
  ['/decision-ripple.js','decision-ripple.js'],
  ['/decision-ripple.css','decision-ripple.css'],
  ['/shopper-personas.js','shopper-personas.js'],
  ['/shopper-personas.css','shopper-personas.css'],
  ['/shopper-experience.js','shopper-experience.js'],
  ['/shopper-experience.css','shopper-experience.css'],
  ['/colour-vision-simulator.js','colour-vision-simulator.js'],
  ['/glance-heatmap.js','glance-heatmap.js'],
  ['/evidence-confidence-glow.js','evidence-confidence-glow.js'],
  ['/shelf-distance.js','shelf-distance.js'],
  ['/shelf-readability.js','shelf-readability.js'],
  ['/shelf-readability.css','shelf-readability.css'],
  ['/demo-presentation.js','demo-presentation.js'],
  ['/demo-presentation.css','demo-presentation.css'],
  ['/source-pieces-ui.js','source-pieces-ui.js'],
  ['/source-pieces-ui.css','source-pieces-ui.css'],
  ['/fact-sheet.js','fact-sheet.js'],
  ['/fact-sheet.css','fact-sheet.css'],
  ['/requirements.js','requirements.js'],
  ['/requirements.css','requirements.css'],
  ['/font-inspector.js','font-inspector.js'],
  ['/font-inspector.css','font-inspector.css'],
  ['/package-model-registry.js','package-model-registry.js'],
  ['/package-materials.js','package-materials.js'],
  ['/package-surface-mapping.js','package-surface-mapping.js'],
  ['/package-3d-studio.js','package-3d-studio.js'],
  ['/packaging-3d/package-types.js','packaging-3d/package-types.js'],
  ['/packaging-3d/package-geometry.js','packaging-3d/package-geometry.js'],
  ['/packaging-3d/package-materials.js','packaging-3d/package-materials.js'],
  ['/packaging-3d/package-studio.js','packaging-3d/package-studio.js'],
  ['/packaging-3d/camera-controller.js','packaging-3d/camera-controller.js'],
  ['/packaging-3d/finding-pins.js','packaging-3d/finding-pins.js'],
  ['/packaging-3d/texture-mapping.js','packaging-3d/texture-mapping.js'],
  ['/revision-swipe-3d.js','revision-swipe-3d.js'],
  ['/revision-swipe-3d.css','revision-swipe-3d.css'],
  ['/finding-location-map.js','finding-location-map.js'],
  ['/red-pen-markup.js','red-pen-markup.js'],
  ['/red-pen-markup.css','red-pen-markup.css'],
  ['/artwork-track-changes.js','artwork-track-changes.js'],
]);

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mind': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
};

function encodingFor(header = '') {
  const qualities = new Map(header.toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';');
    const quality = parameters.find(value => value.trim().startsWith('q='));
    const parsed = quality === undefined ? 1 : Number(quality.trim().slice(2));
    return [name.trim(), Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0];
  }));
  const available = ['br', 'gzip'].map(name => ({ name, quality: qualities.get(name) ?? qualities.get('*') ?? 0 }));
  // An explicitly preferred identity representation must remain available.
  if (qualities.has('identity')) available.push({ name: 'identity', quality: qualities.get('identity') });
  const preferred = available.filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality)[0]?.name;
  if (preferred) return preferred;
  if ((qualities.get('identity') ?? (qualities.get('*') === 0 ? 0 : 1)) > 0) return 'identity';
}

export function createPublicFileSender(directory) {
  const cache = new Map();
  return async function sendPublicFile(req, res, route) {
    const filename = publicFiles.get(route);
    if (!filename) throw Object.assign(new Error('Public asset not found.'), { status: 404 });
    const path = join(directory, filename);
    const info = await stat(path);
    const revision = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
    let entry = cache.get(filename);
    if (entry?.revision !== revision) {
      // Share one asynchronous compression job between concurrent requests.
      const pending = (async () => {
        const source = await readFile(path);
        const [br, compressed] = await Promise.all([
          compressBrotli(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }),
          compressGzip(source),
        ]);
        return { digest: createHash('sha256').update(source).digest('base64url'), bodies: { identity: source, br, gzip: compressed } };
      })();
      entry = { revision, pending };
      cache.set(filename, entry);
      pending.catch(() => { if (cache.get(filename) === entry) cache.delete(filename); });
    }
    const encoding = encodingFor(req.headers['accept-encoding']);
    if (!encoding) {
      res.writeHead(406, { 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' });
      res.end();
      return;
    }
    const asset = await entry.pending;
    const etag = `"${asset.digest}-${encoding}"`;
    // Revalidate on each visit so a deployment is visible immediately. The
    // browser may retain these public UI bytes, but shared proxies may not.
    const headers = { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'private, no-cache', Vary: 'Accept-Encoding', ETag: etag };
    if (encoding !== 'identity') headers['Content-Encoding'] = encoding;
    const matches = (req.headers['if-none-match'] || '').split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag);
    if (matches) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const content = asset.bodies[encoding];
    res.writeHead(200, { ...headers, 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  };
}
