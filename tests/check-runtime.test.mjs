import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckRegistry } from '../lib/check-runtime/registry.mjs';
import { CheckExecutionContext } from '../lib/check-runtime/context.mjs';
import { CheckExecutionLedger } from '../lib/check-runtime/ledger.mjs';
import { executeCheck } from '../lib/check-runtime/evaluator.mjs';

test('CheckRegistry registers and retrieves typed checks', () => {
  const registry = new CheckRegistry();
  const def = registry.register({
    checkId: 'CHK-001',
    checkVersion: '1.0.0',
    evaluatorFunction: async (input) => ({ outcome: 'match', observedValue: input.val }),
  });

  assert.equal(def.checkId, 'CHK-001');
  assert.equal(registry.has('CHK-001'), true);
  assert.equal(registry.get('CHK-001').checkVersion, '1.0.0');
});

test('executeCheck enforces source prerequisites and blocks execution if unconfirmed', async () => {
  const registry = new CheckRegistry();
  const checkDef = registry.register({
    checkId: 'CHK-SRC',
    requiredSourceStatus: 'confirmed',
    inputDocumentRoles: ['specification'],
    evaluatorFunction: async () => ({ outcome: 'match' }),
  });

  const unconfirmedContext = new CheckExecutionContext({
    sourceHashes: { artwork: 'hash123' }, // missing specification
  });

  const ledger = new CheckExecutionLedger();
  const result = await executeCheck(checkDef, {}, unconfirmedContext, ledger);

  assert.equal(result.executionState, 'blocked');
  assert.equal(result.outcome, 'review');
  assert.equal(ledger.summary().totalBlocked, 1);
});

test('executeCheck executes evaluator and records ledger trace upon success', async () => {
  const registry = new CheckRegistry();
  const checkDef = registry.register({
    checkId: 'CHK-RUN',
    requiredSourceStatus: 'confirmed',
    inputDocumentRoles: ['artwork'],
    evaluatorFunction: async (input) => ({
      outcome: 'issue',
      observedValue: input.printed,
      expectedValue: input.spec,
      sourceEvidence: { file: 'spec.xlsx' },
      artworkEvidence: { page: 1 },
      explanation: 'Mismatch detected',
    }),
  });

  const context = new CheckExecutionContext({
    sourceHashes: { artwork: 'hash_art' },
  });

  const ledger = new CheckExecutionLedger();
  const result = await executeCheck(checkDef, { printed: '10 oz', spec: '12 oz' }, context, ledger);

  assert.equal(result.executionState, 'executed');
  assert.equal(result.outcome, 'issue');
  assert.equal(result.observedValue, '10 oz');
  assert.equal(ledger.summary().totalExecuted, 1);
  assert.equal(ledger.summary().byOutcome.issue, 1);
});
