/**
 * PackSignal Phase 1 — Unified Source Piece Extractor & Dieline Parser
 * (lib/source-pieces.mjs)
 * 
 * Implements Phase 1:
 * - Turns every sample file into unified text pieces that know where they came from.
 * - PDF parser: text with page, box, panel and layer.
 * - Excel parser: sheet and cell, columns A–C only (scaled columns are Excel 365 formulas).
 * - Dieline: maps each piece to its panel using the Artwork panel layer.
 * - Rebuilds letter-spaced and curved text ("1 5 g" -> "15 g", "GRANOLA", "PACKED WITH GOODNESS").
 * - Drops guide text into an "ignored" list ("Art orientation" and "Copy free" in ignoredList).
 * - Marks text covered by artwork as hidden by checking it against a render (EU per-100 g table marked hidden).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');
const python = process.env.PYTHON_BIN || 'python3';

const piecesCache = new Map();

/**
 * Computes SHA-256 hash of a file for caching.
 */
function getFileHash(filePath) {
  try {
    const buf = readFileSync(filePath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return filePath;
  }
}

/**
 * Parses any supported sample file (PDF or Excel) into unified source pieces.
 * 
 * @param {string} filePath - Absolute or relative path to file.
 * @param {object} options - Optional parser configurations.
 * @returns {object} Unified parse result containing pieces, ignoredList, hiddenPieces, activePieces.
 */
export function parseSourceFile(filePath, options = {}) {
  if (options.isContent || (typeof filePath === 'string' && (filePath.includes('\n') || filePath.length > 255 || (!filePath.includes('.') && filePath.includes(' '))))) {
    const fileName = options.fileName || 'pasted_notes.txt';
    const lines = filePath.split(/\r?\n/);
    const pieces = [];
    lines.forEach((l, idx) => {
      const t = l.trim();
      if (t) {
        pieces.push({
          id: `note_${idx + 1}`,
          file: fileName,
          filePath: fileName,
          sourceType: 'note',
          line: idx + 1,
          location: `Line ${idx + 1}`,
          text: t,
          rawText: l,
          panel: null,
          cell: null,
          page: null,
          paragraph: null,
          hidden: false,
          ignored: false,
          displayName: `${fileName} [Line ${idx + 1}]`
        });
      }
    });
    return {
      file: fileName,
      filePath: fileName,
      sourceType: 'note',
      pieces,
      activePieces: pieces,
      ignoredList: [],
      hiddenPieces: [],
      summary: { total: pieces.length, active: pieces.length, ignored: 0, hidden: 0, lines: lines.length }
    };
  }

  const fullPath = resolve(root, filePath);
  if (!existsSync(fullPath)) {
    // Fallback: if it does not exist on disk, treat as raw text content for non-binary extensions
    const ext = extname(filePath).toLowerCase();
    if (!['.pdf', '.xlsx', '.xls', '.docx', '.png', '.jpg', '.jpeg'].includes(ext)) {
      return parseSourceFile(filePath, { ...options, isContent: true });
    }
    throw new Error(`File not found: ${filePath}`);
  }

  const fileHash = getFileHash(fullPath);
  const cacheKey = `${fileHash}:${JSON.stringify(options)}`;
  if (!options.noCache && piecesCache.has(cacheKey)) {
    return piecesCache.get(cacheKey);
  }

  const scriptPath = join(root, 'lib', 'source-pieces.py');
  const args = [scriptPath, fullPath];
  if (options.is_plain_pdf) {
    args.push('--plain-pdf');
  }
  const res = spawnSync(python, args, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: 45000,
    env: {
      ...process.env,
      PYTHONPATH: [join(root, 'lib'), process.env.PYTHONPATH].filter(Boolean).join(':')
    }
  });

  if (res.error || res.status !== 0) {
    const errMsg = res.stderr || res.error?.message || `Failed to parse file: ${filePath}`;
    console.warn(`Source piece parser warning for ${filePath}: ${errMsg}`);
    return {
      schema_version: '1.0.0',
      document_hash: fileHash,
      file_name: basename(fullPath),
      pieces: [],
      active_pieces: [],
      activePieces: [],
      hidden_pieces: [],
      hiddenPieces: [],
      ignored_list: [],
      ignoredList: [],
      summary: { total: 0, active: 0, ignored: 0, hidden: 0, rebuilt: 0 }
    };
  }

  let result;
  try {
    result = JSON.parse(res.stdout);
  } catch (parseErr) {
    console.warn(`Failed to parse source-pieces JSON output for ${filePath}:`, parseErr.message);
    return {
      schema_version: '1.0.0',
      document_hash: fileHash,
      file_name: basename(fullPath),
      pieces: [],
      active_pieces: [],
      activePieces: [],
      hidden_pieces: [],
      hiddenPieces: [],
      ignored_list: [],
      ignoredList: [],
      summary: { total: 0, active: 0, ignored: 0, hidden: 0, rebuilt: 0 }
    };
  }

  // Ensure arrays exist
  result.pieces = Array.isArray(result.pieces) ? result.pieces : [];
  result.activePieces = Array.isArray(result.activePieces) ? result.activePieces : (Array.isArray(result.active_pieces) ? result.active_pieces : result.pieces);
  result.active_pieces = result.activePieces;
  result.hiddenPieces = Array.isArray(result.hiddenPieces) ? result.hiddenPieces : (Array.isArray(result.hidden_pieces) ? result.hidden_pieces : []);
  result.hidden_pieces = result.hiddenPieces;
  result.ignoredList = Array.isArray(result.ignoredList) ? result.ignoredList : (Array.isArray(result.ignored_list) ? result.ignored_list : []);
  result.ignored_list = result.ignoredList;

  // Enhance pieces with helper accessors
  if (Array.isArray(result.pieces)) {
    for (const p of result.pieces) {
      if (p.panel) {
        p.displayName = `${p.file} [${p.panel}]`;
      } else if (p.cell) {
        p.displayName = `${p.file} [${p.cell}]`;
      } else if (p.paragraph) {
        p.displayName = `${p.file} [Paragraph ${p.paragraph}]`;
      } else if (p.page && p.line) {
        p.displayName = `${p.file} [Page ${p.page}, Line ${p.line}]`;
      } else if (p.line) {
        p.displayName = `${p.file} [Line ${p.line}]`;
      } else if (p.location) {
        p.displayName = `${p.file} [${p.location}]`;
      } else {
        p.displayName = p.file;
      }
    }
  }

  piecesCache.set(cacheKey, result);
  return result;
}

/**
 * Parses PDF sample file into dieline-mapped source pieces.
 */
export function parsePdfSourcePieces(pdfPath, options = {}) {
  return parseSourceFile(pdfPath, options);
}

/**
 * Parses Excel spreadsheet into source pieces (Columns A–C only).
 */
export function parseExcelSourcePieces(xlsxPath, options = {}) {
  return parseSourceFile(xlsxPath, options);
}

/**
 * Phase 4 Word Reader: Extracts source pieces with paragraph locations.
 */
export function parseDocxSourcePieces(docxPath, options = {}) {
  return parseSourceFile(docxPath, options);
}

/**
 * Phase 4 Plain-PDF Document Reader: Extracts source pieces with page and line (no panels).
 */
export function parsePlainPdfSourcePieces(pdfPath, options = {}) {
  return parseSourceFile(pdfPath, { ...options, is_plain_pdf: true });
}

/**
 * Phase 4 Note Reader: Extracts source pieces with line numbers as source.
 */
export function parseNoteSourcePieces(notePath, options = {}) {
  return parseSourceFile(notePath, options);
}

/**
 * Phase 4 Image Reader: Reads old design image with vision model (facts start AI-suggested).
 */
export function parseImageSourcePieces(imagePath, options = {}) {
  return parseSourceFile(imagePath, options);
}

/**
 * Convenience helper to parse both official organizer sample files plus Phase 4 inputs.
 */
export function parseOrganizerSamples(samplesDir = join(root, 'samples', 'organizer')) {
  const pdfPath = join(samplesDir, 'DancingFish_Granola_Berry_US_Carton.pdf');
  const xlsxPath = join(samplesDir, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
  const docxPath = join(samplesDir, 'DancingFish_Granola_Product_Spec.docx');
  const plainPdfPath = join(samplesDir, 'DancingFish_Granola_Tech_Spec.pdf');
  const txtPath = join(samplesDir, 'DancingFish_QA_Notes.txt');
  const imgPath = join(samplesDir, 'DancingFish_Old_Design.png');

  const pdfResult = parsePdfSourcePieces(pdfPath);
  const xlsxResult = parseExcelSourcePieces(xlsxPath);

  const extra = {};
  if (existsSync(docxPath)) {
    extra.docx = parseDocxSourcePieces(docxPath);
  }
  if (existsSync(plainPdfPath)) {
    extra.plainPdf = parsePlainPdfSourcePieces(plainPdfPath);
  }
  if (existsSync(txtPath)) {
    extra.notes = parseNoteSourcePieces(txtPath);
  }
  if (existsSync(imgPath)) {
    extra.image = parseImageSourcePieces(imgPath);
  }

  const allPieces = [
    ...(Array.isArray(pdfResult?.pieces) ? pdfResult.pieces : []),
    ...(Array.isArray(xlsxResult?.pieces) ? xlsxResult.pieces : []),
    ...(Array.isArray(extra.docx?.pieces) ? extra.docx.pieces : []),
    ...(Array.isArray(extra.plainPdf?.pieces) ? extra.plainPdf.pieces : []),
    ...(Array.isArray(extra.notes?.pieces) ? extra.notes.pieces : []),
    ...(Array.isArray(extra.image?.pieces) ? extra.image.pieces : [])
  ];

  return {
    pdf: pdfResult,
    excel: xlsxResult,
    ...extra,
    allPieces,
    allActivePieces: allPieces.filter(p => !p.hidden && !p.ignored),
    allIgnoredPieces: [
      ...(Array.isArray(pdfResult?.ignoredList) ? pdfResult.ignoredList : (Array.isArray(pdfResult?.ignored_list) ? pdfResult.ignored_list : [])),
      ...(Array.isArray(xlsxResult?.ignoredList) ? xlsxResult.ignoredList : (Array.isArray(xlsxResult?.ignored_list) ? xlsxResult.ignored_list : []))
    ],
    allHiddenPieces: [
      ...(Array.isArray(pdfResult?.hiddenPieces) ? pdfResult.hiddenPieces : (Array.isArray(pdfResult?.hidden_pieces) ? pdfResult.hidden_pieces : [])),
      ...(Array.isArray(xlsxResult?.hiddenPieces) ? xlsxResult.hiddenPieces : (Array.isArray(xlsxResult?.hidden_pieces) ? xlsxResult.hidden_pieces : []))
    ]
  };
}

