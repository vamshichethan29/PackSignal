import test from 'node:test';
import assert from 'node:assert/strict';
import { packageTypeFromSources } from '../lib/package-type-from-source.mjs';

test('uses an explicit supported package type from the supplied product specification', () => {
  assert.equal(packageTypeFromSources([{ role: 'spec', data: { product: { package_type: 'bottle label' } } }]), 'bottle_label');
});

test('does not infer a package type from arbitrary copy or conflicting sources', () => {
  assert.equal(packageTypeFromSources([{ role: 'spec', data: { product: { name: 'Bottle' } } }]), null);
  assert.equal(packageTypeFromSources([
    { role: 'spec', data: { product: { package_type: 'carton' } } },
    { role: 'spec', data: { product: { package_type: 'pouch' } } },
  ]), null);
});
