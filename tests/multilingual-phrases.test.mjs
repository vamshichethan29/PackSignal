import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenSequencePresent, normal } from '../lib/engine.mjs';

test('multilingual phrase verification preserves scripts, accents, and NFKC normalization', () => {
  // English / Hindi approved phrase pair
  const englishApproved = 'Store in a cool, dry place.';
  const hindiApproved = 'ठंडी और सूखी जगह में रखें।';

  // Artwork containing exact Hindi phrase
  const artworkText = `Dancing Fish Granola\n${hindiApproved}\nNet Wt 340g`;

  // NFKC normalization check
  const normSource = hindiApproved.normalize('NFKC');
  const normArtwork = artworkText.normalize('NFKC');

  assert.ok(normArtwork.includes(normSource), 'Approved Hindi phrase must match in NFKC normalized script');

  // Script-preserving check: word shapes and matras must not be mangled
  assert.equal(tokenSequencePresent(artworkText, hindiApproved), true);

  // Mismatched or altered translation must NOT match
  const alteredHindi = 'गर्म और सूखी जगह में रखें।'; // altered word "गर्म" (hot) instead of "ठंडी" (cool)
  assert.equal(tokenSequencePresent(artworkText, alteredHindi), false);
});
