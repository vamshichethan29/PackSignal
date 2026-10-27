/**
 * PackSignal Nutrition Evidence Resolver (lib/nutrition/evidence.mjs)
 * Resolves spreadsheet source cells and packaging artwork bounding box locations.
 */

/**
 * Resolves source cell evidence either from a document and coordinate,
 * or collects cell locations from a list of normalized source nutrient records.
 */
export function resolveSourceCellEvidence(docOrList, cellCoordinate) {
  if (Array.isArray(docOrList)) {
    // List of source nutrient records
    return docOrList
      .filter(r => r.sourceSheet && r.sourceCell)
      .map(r => ({
        nutrientId: r.nutrientId,
        canonicalName: r.canonicalName,
        sheet: r.sourceSheet,
        cell: r.sourceCell,
        location: `${r.sourceSheet}!${r.sourceCell}`,
        value: r.value,
        unit: r.unit,
        quote: r.sourceQuote
      }));
  }

  if (!docOrList || !cellCoordinate) return null;
  const cells = docOrList.cells || [];
  const found = cells.find(c => c.cell === cellCoordinate || `${c.sheet}!${c.cell}` === cellCoordinate);
  if (!found) return null;

  return {
    documentId: docOrList.id,
    documentName: docOrList.name || 'Spreadsheet Specification',
    documentHash: docOrList.sha256 || null,
    sheet: found.sheet,
    cell: found.cell,
    row: found.row,
    col: found.col,
    value: found.value,
    numberFormat: found.numberFormat || null,
    location: `${found.sheet}!${found.cell}`
  };
}

/**
 * Resolves artwork bounding box evidence from panels or a document
 */
export function resolveArtworkBoxEvidence(panelsOrDoc) {
  if (Array.isArray(panelsOrDoc)) {
    // List of detected nutrition panels
    const boxes = [];
    for (const panel of panelsOrDoc) {
      if (panel.box) {
        boxes.push({
          panelId: panel.panelId,
          page: panel.page,
          box: panel.box,
          type: 'panel_boundary',
          title: panel.title
        });
      }
      for (const nut of panel.nutrientRecords || []) {
        if (nut.artworkBox) {
          boxes.push({
            panelId: panel.panelId,
            nutrientId: nut.nutrientId,
            page: nut.artworkPage,
            box: nut.artworkBox,
            type: 'nutrient_declaration',
            quote: nut.artworkQuote
          });
        }
      }
    }
    return boxes;
  }

  return [];
}

export function resolveArtworkEvidence(doc, searchPattern, preferredPage = 1) {
  if (!doc) return null;
  const pages = doc.pages || [];
  const lines = doc.lines || [];

  const regex = searchPattern instanceof RegExp ? searchPattern : new RegExp(searchPattern, 'i');

  // Look for line match with bounding box
  const matchingLine = lines.find(l => regex.test(l.text) && (l.page === preferredPage || !preferredPage));
  if (matchingLine && Array.isArray(matchingLine.box)) {
    return {
      documentId: doc.id,
      documentName: doc.name || 'Artwork PDF',
      page: matchingLine.page || preferredPage,
      box: matchingLine.box,
      quote: matchingLine.text,
      location: `Page ${matchingLine.page || preferredPage}, text box`
    };
  }

  // Fallback: check whole page text
  for (const p of pages) {
    if (regex.test(p.text || '')) {
      const match = (p.text || '').match(regex);
      return {
        documentId: doc.id,
        documentName: doc.name || 'Artwork PDF',
        page: p.number,
        box: null,
        quote: match ? match[0] : 'Located in page text',
        location: `Page ${p.number} (unlocated bounding box)`
      };
    }
  }

  return null;
}
