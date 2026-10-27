import test from 'node:test';
import assert from 'node:assert/strict';
import { runPreflight, preflightFindings, summarizePreflight } from '../lib/preflight-engine.mjs';
import { analyze } from '../lib/engine.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

test('runPreflight executes master Python preflight pipeline on synthetic PDF', () => {
  const pdfPath = join(root, 'tests', 'fixtures', 'preflight', 'bleed_valid_3mm.pdf');
  const res = runPreflight(pdfPath);
  assert.equal(res.status, 'success');
  assert.ok(Array.isArray(res.findings));
  assert.ok(res.categories);
  assert.ok(res.details.bleed_trim);
});

test('preflightFindings creates valid findings with measurement metadata and evidence', () => {
  const review = {
    documents: [
      {
        id: 'art-001',
        name: 'test-carton.pdf',
        role: 'artwork',
        preflight: {
          findings: [
            {
              id: 'preflight:typography:small-font:p1',
              key: 'preflight:typography:small-font:p1',
              check: 'font_size_minimum',
              category: 'typography',
              title: 'Small font size (5.71 pt) below 6.0 pt threshold',
              status: 'issue',
              severity: 'major',
              expected: '≥ 6.0 pt (FDA 21 CFR minimum)',
              observed: 'Detected 5.71 pt text in Acorn-Medium',
              difference: '0.29 pt below minimum',
              unit: 'pt',
              measuredValue: 5.71,
              requiredValue: 6.0,
              measurementMethod: 'native_pdf_font_dict',
              explanation: 'Text is smaller than required 6.0 pt minimum.',
              verificationLimitations: 'Nominal font point size from font descriptor dict.',
              rule: { id: 'RULE-TYPOGRAPHY-01', source: 'FDA 21 CFR 101.9', text: 'Mandatory text must be ≥ 6.0 pt' },
              evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.2, 0.4, 0.3], quote: 'Small print' }]
            }
          ]
        }
      }
    ]
  };

  const findings = preflightFindings(review);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.status, 'issue');
  assert.equal(f.category, 'typography');
  assert.equal(f.measuredValue, 5.71);
  assert.equal(f.requiredValue, 6.0);
  assert.equal(f.unit, 'pt');
  assert.equal(f.difference, '0.29 pt below minimum');
  assert.equal(f.measurementMethod, 'native_pdf_font_dict');
  assert.equal(f.evidence[0].documentId, 'art-001');
  assert.deepEqual(f.evidence[0].box, [0.1, 0.2, 0.4, 0.3]);
});

test('preflightFindings detects barcode quiet zone touching trim edge', () => {
  const review = {
    documents: [
      {
        id: 'art-002',
        name: 'edge-barcode.pdf',
        role: 'artwork',
        pages: [
          {
            number: 1,
            codes: [
              {
                format: 'EAN-13',
                gtin: '1234567890128',
                box: [0.01, 0.70, 0.30, 0.90] // box[0] < 0.02 touching left edge
              }
            ]
          }
        ]
      }
    ]
  };

  const findings = preflightFindings(review);
  const edgeFinding = findings.find(f => f.check === 'barcode_quiet_zone');
  assert.ok(edgeFinding);
  assert.equal(edgeFinding.status, 'issue');
  assert.match(edgeFinding.title, /quiet zone touches or nears trim edge/);
});

test('summarizePreflight categorizes checks into six distinct preflight areas', () => {
  const findings = [
    { id: 'preflight:1', method: 'preflight_engine', category: 'barcode', status: 'issue' },
    { id: 'preflight:2', method: 'preflight_engine', category: 'bleed_trim', status: 'match' },
    { id: 'preflight:3', method: 'preflight_engine', category: 'typography', status: 'review' },
    { id: 'preflight:4', method: 'preflight_engine', category: 'color_separation', status: 'match' },
    { id: 'preflight:5', method: 'preflight_engine', category: 'safe_area', status: 'issue' },
    { id: 'preflight:6', method: 'preflight_engine', category: 'barcode', status: 'unable' },
  ];

  const categories = summarizePreflight(findings);
  assert.equal(categories.barcode.issues, 1);
  assert.equal(categories.bleed_trim.matches, 1);
  assert.equal(categories.typography.reviews, 1);
  assert.equal(categories.color_separation.matches, 1);
  assert.equal(categories.safe_area.issues, 1);
  assert.equal(categories.unable.checks, 1);
});

test('analyze review integrates preflight findings alongside content and signal findings', () => {
  const review = {
    options: { completeArtwork: true },
    documents: [
      {
        id: 'spec-001',
        role: 'spec',
        name: 'spec.json',
        data: {
          product: { name: 'Berry Granola', variant: 'Berry' },
          net_quantity: '500 g'
        },
        text: 'Product: Berry Granola\nNet: 500 g'
      },
      {
        id: 'art-003',
        role: 'artwork',
        name: 'carton.pdf',
        pages: [
          { number: 1, method: 'pdf_text', text: 'Berry Granola Net 500 g' }
        ],
        text: 'Berry Granola Net 500 g',
        preflight: {
          findings: [
            {
              id: 'preflight:bleed:box:p1',
              key: 'preflight:bleed:box:p1',
              check: 'bleed_box_dimensions',
              category: 'bleed_trim',
              title: 'Configured bleed meets 3.0 mm specification',
              status: 'match',
              severity: 'minor',
              expected: '≥ 3.0 mm bleed',
              observed: '3.0 mm available bleed',
              measurementMethod: 'pdf_page_box_header',
              explanation: 'Page 1 has adequate bleed.',
              evidence: [{ role: 'artwork', page: 1, box: [0, 0, 1, 1], quote: 'Trim box' }]
            }
          ]
        }
      }
    ]
  };

  const analyzed = analyze(review);
  assert.ok(Array.isArray(analyzed.findings));
  const preflightMatch = analyzed.findings.find(f => f.key === 'preflight:bleed:box:p1');
  assert.ok(preflightMatch, 'Preflight finding should be present in review findings');
  assert.equal(preflightMatch.status, 'match');
  assert.equal(preflightMatch.category, 'bleed_trim');
});

test('preflightFindings generates 4 physical prepress findings when pressProfile is set', () => {
  const review = {
    pressProfile: 'FTA-FLEXO-POUCH-280',
    documents: [
      {
        id: 'art-flexo',
        role: 'artwork',
        name: 'pouch.pdf',
        pages: [{ number: 1, text: 'Clean pouch artwork' }],
        colorAnalysis: {
          colorSpaces: ['DeviceCMYK'],
          samples: [{ c: 70, m: 60, y: 60, k: 80 }], // TAC = 270% <= 280%
        },
        dieline: {
          source: 'SOURCE_VERIFIED',
          trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
          bleedBox: { x1: 2, y1: 2, x2: 108, y2: 108 },
        }
      }
    ]
  };

  const findings = preflightFindings(review);
  const prepressKeys = findings.map(f => f.key || f.id);
  assert.ok(prepressKeys.includes('prepress:tac_excess'), 'Must generate prepress:tac_excess');
  assert.ok(prepressKeys.includes('prepress:bleed_extension'), 'Must generate prepress:bleed_extension');
  assert.ok(prepressKeys.includes('prepress:trim_safety'), 'Must generate prepress:trim_safety');
  assert.ok(prepressKeys.includes('prepress:crease_clearance'), 'Must generate prepress:crease_clearance');

  const tacFinding = findings.find(f => f.key === 'prepress:tac_excess');
  assert.equal(tacFinding.requiredValue, 280);
  assert.equal(tacFinding.category, 'prepress');
  assert.equal(tacFinding.primaryDepartment, 'prepress');
});

