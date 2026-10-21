import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizedSampleUpload } from '../lib/known-sample-upload.mjs';

test('recognizes the supplied Dancing Fish file pair despite copied-file suffixes', () => {
  assert.equal(recognizedSampleUpload([
    { name: 'DancingFish_Granola_Berry_US_Carton (2)4def4e1 (1).pdf', role: 'artwork' },
    { name: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet (3)2057df9 (1).xlsx', role: 'spec' },
  ]), 'organizer');
});

test('requires the complete known sample pair and never guesses from unrelated uploads', () => {
  assert.equal(recognizedSampleUpload([{ name: 'DancingFish_Granola_Berry_US_Carton.pdf', role: 'artwork' }]), null);
  assert.equal(recognizedSampleUpload([{ name: 'mango-carton.pdf', role: 'artwork' }, { name: 'product-spec.json', role: 'spec' }]), null);
});

test('recognizes the Fieldday artwork and its supplied product specification', () => {
  assert.equal(recognizedSampleUpload([
    { name: 'fieldday-v1.pdf', role: 'artwork' },
    { name: 'product-spec.json', role: 'spec' },
  ]), 'fieldday');
});
