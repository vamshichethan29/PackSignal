import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReviewSummary, reviewCoverage } from '../public/review-summary.js';

const sample = (id, createdAt) => ({
  id,
  name: `Review ${id}`,
  createdAt,
  finishedAt: createdAt,
  status: 'ready',
  counts: { issue: 1, review: 2, match: 3, unable: 0 },
  engine: 'Local checks',
});

test('opening a deep-linked review initializes history when startup skipped the history request', () => {
  const review = sample('revision', '2026-10-18T11:12:24.162Z');
  assert.deepEqual(mergeReviewSummary(null, review), [{
    ...review,
    sample: undefined,
    parentId: undefined,
  }]);
});

test('review history replaces duplicate ids and remains newest-first', () => {
  const old = sample('older', '2026-10-17T11:12:24.162Z');
  const duplicate = sample('same', '2026-10-16T11:12:24.162Z');
  const updated = { ...duplicate, createdAt: '2026-10-18T11:12:24.162Z', name: 'Updated' };
  assert.deepEqual(mergeReviewSummary([old, duplicate], updated).map(({ id, name }) => [id, name]), [
    ['same', 'Updated'],
    ['older', 'Review older'],
  ]);
});

test('legacy or partial reviews without artwork coverage stay openable and unconfirmed', () => {
  assert.deepEqual(reviewCoverage({ id: 'legacy' }), { completeArtwork: false, limits: [] });
  assert.deepEqual(reviewCoverage({ coverage: null }), { completeArtwork: false, limits: [] });
  assert.deepEqual(reviewCoverage({ coverage: { completeArtwork: true, limits: 'invalid' } }), {
    completeArtwork: true,
    limits: [],
  });
});
