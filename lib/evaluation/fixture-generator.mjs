/**
 * PackSignal Synthetic Fixture Generator (lib/evaluation/fixture-generator.mjs)
 * Phase 8: Procedurally synthesizes reproducible broken test cases, clean controls,
 * and ambiguous counterexamples from baseline fixtures using seeded PRNGs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEvaluationCase, DATASET_SPLITS, GROUND_TRUTH_AUTHORITIES, EXPECTED_OUTCOMES } from './case-schema.mjs';
import { MUTATION_OPERATORS, hashContent } from './mutations.mjs';

/**
 * Deterministic Mulberry32 Pseudo-Random Number Generator.
 * Given an integer seed, produces a sequence of uniform floats in [0, 1).
 */
export function createSeededRandom(seed = 1337) {
  let s = Number(seed) >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Baseline clean fixtures that serve as seeds for mutations.
 */
export const BASELINE_FIXTURES = [
  {
    id: 'base-carton-cereal-01',
    name: 'DancingFish Organic Berry Crunch Granola Carton',
    spec: {
      productName: 'Organic Berry Crunch Granola',
      netQuantity: '16 FL OZ (473 mL)',
      ingredients: 'Organic Rolled Oats, Cane Sugar, Canola Oil, Freeze Dried Strawberries, Sea Salt.',
      allergens: 'CONTAINS: WHEAT.',
      storage: 'Store in a cool, dry place.',
      gtin: '012345678905',
      calories: 240,
      sodiumMg: 140,
    },
    artworkLines: [
      'DancingFish Organics',
      'Berry Crunch Granola',
      'NET WT 16 FL OZ (473 mL)',
      'INGREDIENTS: Organic Rolled Oats, Cane Sugar, Canola Oil, Freeze Dried Strawberries, Sea Salt.',
      'CONTAINS: WHEAT.',
      'Store in a cool, dry place.',
      'Calories 240',
      'Sodium 140mg (6% DV)',
      'BARCODE: 012345678905',
    ],
  },
  {
    id: 'base-pouch-beverage-02',
    name: 'PureOat Barista Oat Milk 1L',
    spec: {
      productName: 'PureOat Barista Blend',
      netQuantity: '1 L (33.8 FL OZ)',
      ingredients: 'Oat Base (Water, Oats 10%), Rapeseed Oil, Dipotassium Phosphate, Calcium Carbonate, Sea Salt.',
      allergens: 'CONTAINS: OATS.',
      storage: 'Refrigerate after opening.',
      gtin: '098765432104',
      calories: 140,
      sodiumMg: 100,
    },
    artworkLines: [
      'PureOat Barista Blend',
      'NET QUANTITY: 1 L (33.8 FL OZ)',
      'INGREDIENTS: Oat Base (Water, Oats 10%), Rapeseed Oil, Dipotassium Phosphate, Calcium Carbonate, Sea Salt.',
      'CONTAINS: OATS.',
      'Refrigerate after opening.',
      'Calories 140',
      'Sodium 100mg (4% DV)',
      'BARCODE: 098765432104',
    ],
  },
];

/**
 * Generates an evaluation suite with reproducible seeded mutations.
 *
 * @param {Object} options
 * @param {number} [options.seed=42]
 * @param {number} [options.count=20]
 * @param {string} [options.split=DATASET_SPLITS.REGRESSION]
 * @param {string[]} [options.operatorIds]
 * @param {string} [options.outputDir]
 * @returns {Array<Object>} Generated evaluation cases
 */
export function generateEvaluationSuite({
  seed = 42,
  count = 20,
  split = DATASET_SPLITS.REGRESSION,
  operatorIds = Object.keys(MUTATION_OPERATORS),
  outputDir = null,
} = {}) {
  const prng = createSeededRandom(seed);
  const selectedOps = operatorIds.map(id => MUTATION_OPERATORS[id]).filter(Boolean);
  const baseline = BASELINE_FIXTURES[0];

  const cases = [];
  const manifests = [];

  for (let i = 0; i < count; i++) {
    const op = selectedOps[i % selectedOps.length];
    const caseSeed = Math.floor(prng() * 1000000);
    const caseId = `case-${split.toLowerCase()}-${String(i + 1).padStart(3, '0')}-${op.id.toLowerCase()}`;

    const originalHash = hashContent(baseline.artworkLines.join('\n'));
    const mutated = op.apply(baseline, caseSeed);
    const generatedHash = hashContent(mutated.artwork ? mutated.artwork.join('\n') : '');

    const manifest = {
      caseId,
      mutationId: op.id,
      mutationType: op.category,
      seed: caseSeed,
      originalHash,
      generatedHash,
      transformedField: op.field,
      expectedOutcome: mutated.expectedOutcome,
      verifiedDifference: originalHash !== generatedHash || mutated.expectedOutcome === EXPECTED_OUTCOMES.MATCH,
    };
    manifests.push(manifest);

    const evalCase = createEvaluationCase({
      caseId,
      suiteId: `suite-${split.toLowerCase()}-v1`,
      caseVersion: '1.0.0',
      scenarioType: mutated.expectedOutcome === EXPECTED_OUTCOMES.ISSUE ? 'defect_detection' : mutated.expectedOutcome === EXPECTED_OUTCOMES.MATCH ? 'clean_control' : 'ambiguous_abstention',
      documentType: 'carton_packaging',
      sourceDocumentHashes: { baseline: originalHash, generated: generatedHash },
      mutationId: op.id,
      mutationType: op.category,
      mutationSeed: caseSeed,
      expectedOutcome: mutated.expectedOutcome,
      expectedRuleId: `rules:EVAL-${op.id}`,
      expectedField: op.field,
      expectedSeverity: op.severity,
      statutoryRule: op.statutoryRule,
      groundTruthAuthority: GROUND_TRUTH_AUTHORITIES.DETERMINISTIC_MUTATION_ORACLE,
      datasetSplit: split,
      validationStatus: manifest.verifiedDifference ? 'VALIDATED' : 'INVALID_FIXTURE',
      name: `${op.name} (#${i + 1})`,
      description: mutated.description,
      reference: mutated.reference,
      references: mutated.references,
      artwork: mutated.artwork,
      before: mutated.before,
      after: mutated.after,
      kind: mutated.kind || 'copy',
      category: op.category,
      complete: mutated.complete !== false,
      netConfirmed: true,
      nutritionConfirmed: true,
      metadata: {
        mutationManifest: manifest,
        baselineFixtureId: baseline.id,
      },
    });

    cases.push(evalCase);
  }

  // If output directory is specified, write cases and protected ground-truth
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const gtDir = path.join(outputDir, '..', 'ground-truth');
    fs.mkdirSync(gtDir, { recursive: true });

    // Store public case inputs
    fs.writeFileSync(
      path.join(outputDir, `cases-${split.toLowerCase()}.json`),
      JSON.stringify(cases.map(c => {
        // Strip protected scoring keys and mutation manifests from public input
        const { mutationId, expectedOutcome, expectedSeverity, metadata, ...publicInput } = c;
        return publicInput;
      }), null, 2)
    );

    // Store protected ground truth separately
    fs.writeFileSync(
      path.join(gtDir, `ground-truth-${split.toLowerCase()}.json`),
      JSON.stringify(cases.map(c => ({
        caseId: c.caseId,
        expectedOutcome: c.expectedOutcome,
        expectedField: c.expectedField,
        expectedRuleId: c.expectedRuleId,
        expectedSeverity: c.expectedSeverity,
        groundTruthAuthority: c.groundTruthAuthority,
        mutationManifest: c.metadata?.mutationManifest,
      })), null, 2)
    );
  }

  return cases;
}
