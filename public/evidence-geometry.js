// Display geometry only. The original evidence object is never rewritten.
export function normalizeEvidenceBox(evidence, page) {
  const original = evidence?.box;
  const warnings = [];
  const fail = reason => ({ box: null, original, warnings, reason });
  if (!Array.isArray(original) || original.length !== 4 || !original.every(Number.isFinite)) return fail('No finite artwork bounding box was extracted.');
  if (!(Number.isFinite(page?.width) && page.width > 0 && Number.isFinite(page?.height) && page.height > 0)) return fail('Page dimensions are unavailable.');
  const space = evidence.coordinateSpace || 'normalized';
  const rotation = evidence.rotation ?? page.rotation ?? 0;
  if (![0, 90, 180, 270].includes(rotation)) return fail('Unsupported page rotation.');
  // Existing extractors report normalized coordinates in the rendered page frame.
  // Rotated source-space data needs explicit dimensions and a declared frame.
  if (rotation && evidence.coordinateFrame !== 'rendered' && evidence.coordinateFrame !== 'unrotated') return fail('Rotated geometry has no declared coordinate frame.');
  let [x0, y0, x1, y1] = original;
  if (x1 <= x0 || y1 <= y0) return fail('Reversed or empty bounding box.');
  if (space !== 'normalized') {
    if (!['pixels', 'pdf-points'].includes(space)) return fail('Unsupported coordinate space.');
    const width = evidence.sourceWidth, height = evidence.sourceHeight;
    if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return fail('Source coordinate dimensions are unavailable.');
    const origin = evidence.origin || (space === 'pdf-points' ? 'bottom-left' : 'top-left');
    if (!['top-left', 'bottom-left'].includes(origin)) return fail('Unsupported coordinate origin.');
    const ox = evidence.sourceX ?? 0, oy = evidence.sourceY ?? 0;
    if (![ox, oy].every(Number.isFinite)) return fail('Invalid source origin.');
    x0 = (x0 - ox) / width; x1 = (x1 - ox) / width;
    y0 = (y0 - oy) / height; y1 = (y1 - oy) / height;
    if (origin === 'bottom-left') [y0, y1] = [1 - y1, 1 - y0];
  }
  if (evidence.coordinateFrame === 'unrotated') {
    if (rotation === 90) [x0, y0, x1, y1] = [1-y1, x0, 1-y0, x1];
    if (rotation === 180) [x0, y0, x1, y1] = [1-x1, 1-y1, 1-x0, 1-y0];
    if (rotation === 270) [x0, y0, x1, y1] = [y0, 1-x1, y1, 1-x0];
  }
  const raw = [x0,y0,x1,y1];
  const box = raw.map(n => Math.min(1, Math.max(0, n)));
  if (box[2] <= box[0] || box[3] <= box[1]) return fail('Bounding box falls outside the artwork page.');
  if (box.some((n,i) => n !== raw[i])) warnings.push('Evidence clipped to the page boundary; original coordinates retained.');
  return { box, original: [...original], warnings, reason: null };
}

export function artworkOccurrences(review, finding) {
  return (finding.evidence || []).flatMap((evidence, index) => {
    if (evidence.role !== 'artwork') return [];
    const document = review.documents?.find(doc => doc.id === evidence.documentId && doc.role === 'artwork');
    const page = document?.pages?.find(page => page.number === evidence.page && page.image);
    if (!page) return [];
    const geometry = normalizeEvidenceBox(evidence, page);
    return geometry.box ? [{ key: `${finding.id}:${index}`, finding, evidence, index, document, page, ...geometry }] : [];
  });
}

export function markersAt(markers, x, y) {
  return markers.filter(({box:[x0,y0,x1,y1]}) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

// Screen-space proximity clusters. Never changes or unions the evidence boxes.
export function clusterMarkers(markers, width, height, radius = 24) {
  const clusters = [];
  for (const marker of markers) {
    const x = (marker.box[0]+marker.box[2])/2, y = (marker.box[1]+marker.box[3])/2;
    const cluster = clusters.find(c => Math.hypot((c.x-x)*width,(c.y-y)*height) < radius);
    if (cluster) cluster.members.push(marker);
    else clusters.push({x,y,members:[marker]});
  }
  return clusters;
}

export function filterFindings(review, filter = 'all', query = '') {
  const search = query.trim().toLowerCase();
  return (review.findings || []).filter(finding => {
    const located = artworkOccurrences(review, finding).length > 0;
    const included = filter === 'all' || (filter === 'attention' ? finding.status !== 'match' : filter === 'located' ? located : filter === 'unlocated' ? !located : finding.status === filter);
    return included && [finding.title, finding.rule?.id, finding.observed, finding.expected, ...(finding.evidence || []).map(e => e.quote)].join(' ').toLowerCase().includes(search);
  });
}
