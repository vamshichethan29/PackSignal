/**
 * PackSignal Product Family — Spreadsheet Parser
 * (lib/product-family/spreadsheet-parser.mjs)
 *
 * Implements Step 9 of Phase 6:
 * Robust tabular parsing across multiple sheets, reordered columns,
 * cell coordinate provenance, and draft row preservation.
 */

import { normal } from '../engine.mjs';
import { SKU_COLUMN_ALIASES, createProductRecord } from './sku-registry.mjs';

/**
 * Extracts product family records from document spreadsheet cells.
 */
export function extractProductFamilyFromDocument(doc = {}) {
  const cells = doc.cells || [];
  if (!Array.isArray(cells) || cells.length === 0) return [];

  // Group cells by sheet and row
  const sheetRows = new Map(); // key `${sheet}\0${row}` -> [cells]
  for (const cell of cells) {
    if (!String(cell.value ?? '').trim()) continue;
    const key = `${cell.sheet}\0${cell.row}`;
    if (!sheetRows.has(key)) sheetRows.set(key, []);
    sheetRows.get(key).push(cell);
  }

  const allRows = Array.from(sheetRows.entries()).map(([key, rowCells]) => ({
    key,
    sheet: rowCells[0].sheet,
    row: rowCells[0].row,
    cells: rowCells
  }));

  const products = [];
  const processedKeys = new Set();

  for (const headerRow of allRows) {
    const columns = {};
    for (const cell of headerRow.cells) {
      const headerText = normal(cell.value);
      for (const [field, aliases] of Object.entries(SKU_COLUMN_ALIASES)) {
        if (aliases.some(alias => headerText === normal(alias))) {
          columns[field] = cell.col;
        }
      }
    }

    // Require at least SKU or variant, plus at least one descriptive field
    const hasIdentityCol = Boolean(columns.sku !== undefined || columns.variant !== undefined || columns.productName !== undefined);
    const hasDetailCol = Boolean(columns.ingredients !== undefined || columns.netQuantity !== undefined || columns.barcode !== undefined || columns.allergens !== undefined);

    if (!hasIdentityCol || !hasDetailCol) continue;

    // Found candidate header row; find data rows below it in the same sheet
    const dataRows = allRows.filter(r => r.sheet === headerRow.sheet && r.row > headerRow.row);
    let consecutiveEmptyRows = 0;

    for (const dataRow of dataRows) {
      if (processedKeys.has(dataRow.key)) continue;

      const sourceCells = {};
      const rowValues = {};

      for (const [field, col] of Object.entries(columns)) {
        const matchingCell = dataRow.cells.find(c => c.col === col);
        if (matchingCell && String(matchingCell.value ?? '').trim()) {
          rowValues[field] = String(matchingCell.value).trim();
          sourceCells[field] = {
            sheet: matchingCell.sheet,
            row: matchingCell.row,
            col: matchingCell.col,
            cell: matchingCell.cell,
            value: matchingCell.value
          };
        }
      }

      const hasIdentity = Boolean(rowValues.sku || rowValues.variant || rowValues.productName);
      if (!hasIdentity) {
        if (++consecutiveEmptyRows >= 3) break;
        continue;
      }
      consecutiveEmptyRows = 0;
      processedKeys.add(dataRow.key);

      const record = createProductRecord({
        sku: rowValues.sku || '',
        gtin: rowValues.barcode || '',
        productName: rowValues.productName || '',
        variant: rowValues.variant || '',
        netQuantity: rowValues.netQuantity || '',
        ingredients: rowValues.ingredients || '',
        allergens: rowValues.allergens || '',
        market: rowValues.market || '',
        status: rowValues.status || (doc.data?.status || 'active'),
        sourceDocumentId: doc.id,
        sourceDocumentHash: doc.sha256 || '',
        sourceSheet: dataRow.sheet,
        sourceRow: dataRow.row,
        sourceCells
      });

      products.push(record);
    }
  }

  return products;
}

/**
 * Extracts product family records across all specification documents in a review.
 */
export function extractReviewProductFamily(review = {}) {
  const docs = (review.documents || []).filter(d => ['spec', 'catalog'].includes(d.role) || (d.cells && d.cells.length > 0));
  const allProducts = [];

  for (const doc of docs) {
    const products = extractProductFamilyFromDocument(doc);
    allProducts.push(...products);
  }

  return allProducts;
}
