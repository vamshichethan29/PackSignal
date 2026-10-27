import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gtinDigits,
  hasValidGtinCheckDigit,
  canonicalGtin,
  classifyGtinFormat,
  suppliedGtinCandidates,
  GTIN_VERIFICATION_DISCLAIMERS,
} from '../lib/gtin.mjs';

describe('Phase 4: GTIN Decoding & Modulo-10 Checksum Verification', () => {
  it('correctly validates valid check digits across GTIN-8, GTIN-12, GTIN-13, and GTIN-14', () => {
    // GTIN-8
    assert.equal(hasValidGtinCheckDigit('96385074'), true);
    assert.equal(classifyGtinFormat('96385074'), 'GTIN-8');

    // GTIN-12 (UPC-A)
    assert.equal(hasValidGtinCheckDigit('036000291452'), true);
    assert.equal(hasValidGtinCheckDigit('120000000043'), true);
    assert.equal(classifyGtinFormat('036000291452'), 'GTIN-12');

    // GTIN-13 (EAN-13)
    assert.equal(hasValidGtinCheckDigit('4006381333931'), true);
    assert.equal(classifyGtinFormat('4006381333931'), 'GTIN-13');

    // GTIN-14 (ITF-14 / Shipping container)
    assert.equal(hasValidGtinCheckDigit('10012345678902'), true);
    assert.equal(classifyGtinFormat('10012345678902'), 'GTIN-14');
  });

  it('rejects invalid check digits across all supported formats', () => {
    // Invalid GTIN-8
    assert.equal(hasValidGtinCheckDigit('96385075'), false);

    // Invalid GTIN-12
    assert.equal(hasValidGtinCheckDigit('036000291459'), false);

    // Invalid GTIN-13
    assert.equal(hasValidGtinCheckDigit('4006381333932'), false);

    // Invalid GTIN-14
    assert.equal(hasValidGtinCheckDigit('10012345678909'), false);

    // Malformed lengths
    assert.equal(hasValidGtinCheckDigit('1234567'), false);
    assert.equal(hasValidGtinCheckDigit('123456789012345'), false);
    assert.equal(hasValidGtinCheckDigit(''), false);
  });

  it('canonicalizes valid GTINs to 14 digits with leading zeros', () => {
    assert.equal(canonicalGtin('96385074'), '00000096385074');
    assert.equal(canonicalGtin('036000291452'), '00036000291452');
    assert.equal(canonicalGtin('4006381333931'), '04006381333931');
    assert.equal(canonicalGtin('10012345678902'), '10012345678902');

    // Invalid check digit produces empty string
    assert.equal(canonicalGtin('4006381333932'), '');
  });

  it('normalizes formatting variations, dashes, spaces, and NFKC unicode', () => {
    assert.equal(gtinDigits('0-36000-29145-2'), '036000291452');
    assert.equal(gtinDigits('4006 381 333931'), '4006381333931');
    assert.equal(gtinDigits('  １２００００００００４３  '), '120000000043');
    assert.equal(hasValidGtinCheckDigit('0-36000-29145-2'), true);
  });

  it('discloses that checksum verification does not certify print quality or quiet zones', () => {
    assert.ok(GTIN_VERIFICATION_DISCLAIMERS.CHECKSUM_ONLY.includes('quiet-zone'));
    assert.ok(GTIN_VERIFICATION_DISCLAIMERS.CHECKSUM_ONLY.includes('print contrast'));
  });

  it('extracts GTIN candidates from complex specification documents with location tracking', () => {
    const specDoc = {
      id: 'spec-granola',
      name: 'product-spec.json',
      role: 'spec',
      data: {
        product: {
          name: 'Berry Crunch',
          upc: '036000291452',
          gtin14: '10012345678902',
        },
      },
      lines: [
        { line: 12, text: 'Outer Case GTIN-14: 10012345678902' },
      ],
      cells: [],
    };

    const candidates = suppliedGtinCandidates([specDoc]);
    assert.ok(candidates.length >= 2);
    assert.ok(candidates.some(c => c.value === '036000291452'));
    assert.ok(candidates.some(c => c.value === '10012345678902'));
  });
});
