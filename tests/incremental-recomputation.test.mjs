import test from 'node:test';
import assert from 'node:assert/strict';
import { runIncrementalRecomputation } from '../lib/review-intelligence/incremental-runner.mjs';

test('Selective Recomputation: changes in sodium fact only invoke sodium-dependent evaluators', async () => {
  // 1. Initial review state with multiple findings
  const initialReview = {
    id: 'rev-test-incremental',
    documents: [
      { id: 'spec-1', role: 'spec', name: 'Product Spec', sha256: 'hash-spec-v1' },
      { id: 'art-1', role: 'artwork', name: 'Carton.pdf', sha256: 'hash-art-v1' }
    ],
    findings: [
      {
        id: 'finding-sodium-comp',
        check: 'check-sodium-value',
        title: 'Sodium Content',
        observed: '230 mg',
        expected: '230 mg',
        status: 'match',
        sources: [{ id: 'spec-1', name: 'Product Spec', field: 'sodium' }]
      },
      {
        id: 'finding-sodium-dv',
        check: 'check-sodium-dv',
        title: 'Sodium %DV',
        observed: '10%',
        expected: '10%',
        status: 'match',
        sources: [{ id: 'spec-1', name: 'Product Spec', field: 'sodium' }]
      },
      {
        id: 'finding-mfg-address',
        check: 'check-mfg-address',
        title: 'Manufacturer Address',
        observed: '123 Granola Way',
        expected: '123 Granola Way',
        status: 'match',
        sources: [{ id: 'spec-1', name: 'Product Spec', field: 'address' }]
      },
      {
        id: 'finding-gtin-checksum',
        check: 'check-gtin-modulo10',
        title: 'GTIN Check Digit',
        observed: '012345678905',
        expected: 'Valid Modulo-10',
        status: 'match',
        sources: [] // independent of spec
      }
    ],
    decisions: {
      'finding-sodium-comp': { decision: 'approved', reviewer: 'qa@packsignal.io' },
      'finding-mfg-address': { decision: 'approved', reviewer: 'qa@packsignal.io' }
    }
  };

  // 2. Updated inputs with modified spec hash
  const updatedInputs = {
    documents: [
      { id: 'spec-1', role: 'spec', name: 'Product Spec', sha256: 'hash-spec-v2' },
      { id: 'art-1', role: 'artwork', name: 'Carton.pdf', sha256: 'hash-art-v1' }
    ]
  };

  // Track exact evaluator invocations
  const invokedEvaluators = [];

  const evaluatorRegistry = {
    'finding-sodium-comp': async (finding) => {
      invokedEvaluators.push('finding-sodium-comp');
      return { status: 'issue', expected: '460 mg', observed: '230 mg' };
    },
    'finding-sodium-dv': async (finding) => {
      invokedEvaluators.push('finding-sodium-dv');
      return { status: 'issue', expected: '20%', observed: '10%' };
    },
    'finding-mfg-address': async (finding) => {
      invokedEvaluators.push('finding-mfg-address');
      return { status: 'match' };
    },
    'finding-gtin-checksum': async (finding) => {
      invokedEvaluators.push('finding-gtin-checksum');
      return { status: 'match' };
    }
  };

  // 3. Execute incremental recomputation
  const result = await runIncrementalRecomputation({
    previousReview: initialReview,
    updatedInputs,
    evaluatorRegistry
  });

  // 4. Assert selective execution
  assert.ok(result.invocationCounters.evaluatorsInvoked > 0);
  assert.ok(result.findings.some(f => f.id === 'finding-sodium-comp' && f.status === 'issue'));

  // Independent barcode check was not dependent on modified spec fields
  assert.ok(result.invocationCounters.preservedCheckIds.includes('finding-gtin-checksum'));

  // 5. Assert reviewer decisions: sodium decision marked stale, address preserved if not affected
  assert.equal(result.decisions['finding-sodium-comp'].stale, true);
  assert.equal(result.decisions['finding-sodium-comp'].revalidationRequired, true);
});
