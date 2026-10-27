/**
 * PackSignal Phase 2 — Vision & Graphical Marks Unit Tests
 * (tests/fact-vision.test.mjs)
 * 
 * Verifies:
 * - Graphical mark detection requires genuine image evidence.
 * - Does NOT fabricate an official "Certified Vegan" trademark logo when only text wording exists.
 * - Distinguishes VEGAN_WORDING_DETECTED from CERTIFICATION_AUTHORITY_UNVERIFIED.
 * - Native text "Suitable for Vegans." preserved with exact quote.
 * - Image-only marks carry visual crop references without invented quotes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inspectArtworkVisualMarks } from '../lib/facts/fact-vision.mjs';

describe('Phase 2 — Vision for Graphical Marks & Vegan Verification', () => {

  const dancingFishPieces = [
    {
      id: 'sp_vegan_text',
      documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      documentSha256: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
      text: 'DIETARY INFORMATION: Suitable for Vegans.',
      rawText: 'DIETARY INFORMATION: Suitable for Vegans.',
      page: 1,
      panel: 'Back panel',
      box: [134.56, 728.39, 262.08, 738.63],
      visibility: 'VISIBLE',
      classification: 'PRINTABLE_COPY'
    },
    {
      id: 'sp_recycling',
      documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      documentSha256: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
      text: 'Recyclable paperboard mark',
      rawText: 'Recyclable paperboard mark',
      page: 1,
      panel: 'Left panel',
      box: [1098.8, 817.1, 1220.0, 850.0],
      visibility: 'VISIBLE'
    }
  ];

  it('1. Detects actual native vegan wording "Suitable for Vegans."', () => {
    const res = inspectArtworkVisualMarks('DancingFish_Granola_Berry_US_Carton.pdf', dancingFishPieces);

    assert.equal(res.veganWordingStatus, 'VEGAN_WORDING_DETECTED');
    assert.equal(res.summary.wordingFound, true);

    const textFact = res.proposedFacts.find(f => f.field === 'claims.dietary.vegan_text');
    assert.ok(textFact, 'Must create verified text fact for observed vegan wording');
    assert.equal(textFact.verificationState, 'VERIFIED');
    assert.equal(textFact.evidence.quote, 'DIETARY INFORMATION: Suitable for Vegans.');
    assert.equal(textFact.evidence.method, 'native_pdf_text');
  });

  it('2. Does NOT fabricate an official Certified Vegan trademark without registrar authority', () => {
    const res = inspectArtworkVisualMarks('DancingFish_Granola_Berry_US_Carton.pdf', dancingFishPieces);

    const markFact = res.proposedFacts.find(f => f.field === 'claims.dietary.vegan_certification_mark');
    assert.ok(markFact, 'Should record the visual observation');
    
    // Crucial: Must NOT be marked as an authoritative approved certification!
    assert.equal(markFact.verificationState, 'AI_SUGGESTED', 'Unverified visual mark must be AI_SUGGESTED');
    assert.equal(markFact.sourceAuthority, 'UNCONFIRMED');
    assert.ok(markFact.qualifiers.includes('CERTIFICATION_AUTHORITY_UNVERIFIED'));
    assert.equal(markFact.evidence.quote, null, 'Must not invent a text quote for an image mark');
    assert.equal(markFact.evidence.quoteMatch, 'IMAGE_EVIDENCE');
    assert.ok(markFact.evidence.visualEvidenceRef, 'Must carry visual evidence reference with crop');
  });

  it('3. Visual mark evidence includes genuine crop coordinates and page identity', () => {
    const res = inspectArtworkVisualMarks('DancingFish_Granola_Berry_US_Carton.pdf', dancingFishPieces);
    const veganMark = res.marks.find(m => m.markType === 'dietary_vegan_claim');

    assert.ok(veganMark);
    assert.equal(veganMark.page, 1);
    assert.ok(veganMark.crop.width > 0 && veganMark.crop.height > 0);
    assert.equal(veganMark.isOfficiallyCertified, false, 'Product cannot be marked officially certified without proof');
  });
});
