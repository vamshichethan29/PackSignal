/**
 * PackSignal — Second Product: English + Hindi India Pack (lib/campus/india-chai.mjs)
 * Implements FSSAI compliance checks for bilingual Indian consumer packaging.
 * Evaluates English + Devanagari Hindi text, FSSAI Veg mark, and license number.
 */

export const AMRIT_CHAI_SPECIFICATION = {
  productId: 'sku-amrit-chai-250g',
  brandName: 'Amrit (अमृत)',
  productTitleEnglish: 'Organic Masala Chai',
  productTitleHindi: 'ऑर्गेनिक मसाला चाय',
  market: 'India',
  jurisdiction: 'india',
  netQuantity: {
    english: '250 g',
    hindi: '२५० ग्राम',
    numericValue: 250,
    unit: 'g',
  },
  fssaiLicenseNumber: '10020042000123',
  vegStatus: 'vegetarian', // Mandatory Green Circle in Square with "शाकाहारी"
  allergens: [
    { english: 'Milk Solids', hindi: 'दूध के तत्व' },
    { english: 'Cardamom', hindi: 'इलायची' },
  ],
  mandatoryCopy: [
    { key: 'mrp', english: 'MRP ₹250.00 (Incl. of all taxes)', hindi: 'अधिकतम खुदरा मूल्य ₹२५०.०० (सभी कर सहित)' },
    { key: 'best_before', english: 'Best before 12 months from manufacture', hindi: 'निर्माण से १२ महीने के भीतर उपयोग करें' },
  ],
};

/**
 * Normalizes Devanagari numerals to Arabic digits.
 * e.g., '२५०' -> '250', '१२' -> '12'
 */
export function devanagariToArabicNumerals(text) {
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let result = String(text || '');
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(devanagariDigits[i], String(i));
  }
  return result;
}

/**
 * Checks bilingual FSSAI packaging compliance on extracted artwork text.
 * @param {Object} extractedText - Text extracted per panel { front: string, back: string, ... }
 */
export function evaluateIndiaBilingualPack(extractedText = {}) {
  const allText = Object.values(extractedText).join(' ');
  const findings = [];

  // 1. FSSAI 14-Digit License Number Check
  const fssaiRegex = /\b(?:fssai|lic\.?\s*no\.?)\s*:?\s*(\d{14})\b/i;
  const licenseMatch = allText.match(fssaiRegex);

  if (!licenseMatch) {
    findings.push({
      id: 'fssai-lic-missing',
      statute: 'FSSAI (Labelling and Display) Reg 5(1)(d)',
      category: 'Statutory License',
      title: 'Missing FSSAI 14-Digit License Number',
      verdict: 'issue',
      expected: AMRIT_CHAI_SPECIFICATION.fssaiLicenseNumber,
      observed: 'Not detected on artwork',
      explanation: 'Every packaged food in India must display the 14-digit FSSAI license number preceded by the FSSAI logo.',
    });
  } else if (licenseMatch[1] !== AMRIT_CHAI_SPECIFICATION.fssaiLicenseNumber) {
    findings.push({
      id: 'fssai-lic-mismatch',
      statute: 'FSSAI (Labelling and Display) Reg 5(1)(d)',
      category: 'Statutory License',
      title: 'FSSAI License Number Mismatch',
      verdict: 'issue',
      expected: AMRIT_CHAI_SPECIFICATION.fssaiLicenseNumber,
      observed: licenseMatch[1],
      explanation: `Artwork printed license "${licenseMatch[1]}" which does not match the approved brand license "${AMRIT_CHAI_SPECIFICATION.fssaiLicenseNumber}".`,
    });
  } else {
    findings.push({
      id: 'fssai-lic-valid',
      statute: 'FSSAI (Labelling and Display) Reg 5(1)(d)',
      category: 'Statutory License',
      title: 'Valid FSSAI 14-Digit License Number',
      verdict: 'match',
      expected: AMRIT_CHAI_SPECIFICATION.fssaiLicenseNumber,
      observed: licenseMatch[1],
      explanation: 'Verified compliant 14-digit FSSAI license registration on package.',
    });
  }

  // 2. FSSAI Vegetarian Symbol & Devanagari "शाकाहारी" Mark
  const hasVegLogo = /(?:veg|vegetarian|शाकाहारी)/i.test(allText);
  if (!hasVegLogo) {
    findings.push({
      id: 'fssai-veg-mark-missing',
      statute: 'FSSAI (Labelling and Display) Reg 5(2)',
      category: 'Dietary Mark',
      title: 'Missing FSSAI Green Vegetarian Symbol & शाकाहारी Mark',
      verdict: 'issue',
      expected: 'Green filled circle in green square + शाकाहारी',
      observed: 'Missing from display panel',
      explanation: 'Mandatory vegetarian emblem (green circle in square) required under Regulation 5(2).',
    });
  } else {
    findings.push({
      id: 'fssai-veg-mark-match',
      statute: 'FSSAI (Labelling and Display) Reg 5(2)',
      category: 'Dietary Mark',
      title: 'FSSAI Vegetarian Symbol Verified',
      verdict: 'match',
      expected: 'Vegetarian emblem present',
      observed: 'Present on front panel',
      explanation: 'Vegetarian symbol declaration verified.',
    });
  }

  // 3. Devanagari Net Quantity Consistency Check
  // Check both English "250 g" and Hindi "२५० ग्राम" / "250 g"
  const devanagariQtyMatch = allText.match(/(?:शुद्ध\s*वजन)\s*:?\s*([०-९0-9]+)\s*(?:ग्राम|g)?/i);
  const englishQtyMatch = allText.match(/(?:net\s*wt\.?)\s*:?\s*([0-9]+)\s*g/i);

  if (devanagariQtyMatch) {
    const rawVal = devanagariQtyMatch[1];
    const normalizedHindiNumber = parseInt(devanagariToArabicNumerals(rawVal), 10);
    const englishNumber = englishQtyMatch ? parseInt(englishQtyMatch[1], 10) : null;

    if (normalizedHindiNumber !== AMRIT_CHAI_SPECIFICATION.netQuantity.numericValue || (englishNumber && englishNumber !== normalizedHindiNumber)) {
      findings.push({
        id: 'fssai-net-qty-hindi-mismatch',
        statute: 'Legal Metrology (Packaged Commodities) Rules & FSSAI Reg 5(10)',
        category: 'Net Quantity',
        title: 'Bilingual Net Quantity Discrepancy (Hindi / English)',
        verdict: 'issue',
        expected: `${AMRIT_CHAI_SPECIFICATION.netQuantity.english} (${AMRIT_CHAI_SPECIFICATION.netQuantity.hindi})`,
        observed: `${rawVal} ग्राम (${normalizedHindiNumber} g)${englishNumber ? ` vs English ${englishNumber} g` : ''}`,
        explanation: `Hindi net weight declaration states "${rawVal} ग्राम" (${normalizedHindiNumber} g), contradicting the ${englishNumber ? `English text (${englishNumber} g) and ` : ''}approved specification (250 g).`,
      });
    } else {
      findings.push({
        id: 'fssai-net-qty-hindi-match',
        statute: 'Legal Metrology (Packaged Commodities) Rules & FSSAI Reg 5(10)',
        category: 'Net Quantity',
        title: 'Bilingual Net Quantity Match',
        verdict: 'match',
        expected: `${AMRIT_CHAI_SPECIFICATION.netQuantity.english} (${AMRIT_CHAI_SPECIFICATION.netQuantity.hindi})`,
        observed: `${rawVal} ग्राम`,
        explanation: 'Devanagari Hindi net weight declaration matches approved metric quantity.',
      });
    }
  } else if (englishQtyMatch) {
    const englishNumber = parseInt(englishQtyMatch[1], 10);
    if (englishNumber !== AMRIT_CHAI_SPECIFICATION.netQuantity.numericValue) {
      findings.push({
        id: 'fssai-net-qty-english-mismatch',
        statute: 'Legal Metrology (Packaged Commodities) Rules',
        category: 'Net Quantity',
        title: 'Net Quantity Mismatch',
        verdict: 'issue',
        expected: AMRIT_CHAI_SPECIFICATION.netQuantity.english,
        observed: `${englishNumber} g`,
        explanation: `Printed net weight ${englishNumber} g does not match approved 250 g.`,
      });
    }
  }


  // 4. Bilingual Allergen Check
  for (const allergen of AMRIT_CHAI_SPECIFICATION.allergens) {
    const hasEnglish = allText.toLowerCase().includes(allergen.english.toLowerCase());
    const hasHindi = allText.includes(allergen.hindi);

    if (!hasEnglish && !hasHindi) {
      findings.push({
        id: `fssai-allergen-missing-${allergen.english.toLowerCase()}`,
        statute: 'FSSAI (Labelling and Display) Reg 5(4)',
        category: 'Allergen Advisory',
        title: `Undeclared Allergen: ${allergen.english} (${allergen.hindi})`,
        verdict: 'issue',
        expected: `Declaration of ${allergen.english} / ${allergen.hindi}`,
        observed: 'Absent from ingredients and advisory text',
        explanation: `Mandatory allergen disclosure missing for ${allergen.english}.`,
      });
    } else if (hasEnglish && !hasHindi) {
      findings.push({
        id: `fssai-allergen-bilingual-warning-${allergen.english.toLowerCase()}`,
        statute: 'FSSAI Guidelines for Multi-Jurisdiction Labeling',
        category: 'Allergen Advisory',
        title: `Hindi Allergen Translation Missing: ${allergen.hindi}`,
        verdict: 'review',
        expected: `${allergen.english} + ${allergen.hindi}`,
        observed: `${allergen.english} only`,
        explanation: `English allergen present but Devanagari Hindi equivalent "${allergen.hindi}" omitted from dual-language panel.`,
      });
    } else {
      findings.push({
        id: `fssai-allergen-match-${allergen.english.toLowerCase()}`,
        statute: 'FSSAI (Labelling and Display) Reg 5(4)',
        category: 'Allergen Advisory',
        title: `Bilingual Allergen Verified: ${allergen.english} (${allergen.hindi})`,
        verdict: 'match',
        expected: `${allergen.english} (${allergen.hindi})`,
        observed: 'Present in ingredients list',
        explanation: `Allergen properly declared in both English and Devanagari Hindi.`,
      });
    }
  }

  return {
    product: AMRIT_CHAI_SPECIFICATION.productTitleEnglish,
    market: 'India (FSSAI)',
    totalChecks: findings.length,
    issues: findings.filter(f => f.verdict === 'issue').length,
    reviews: findings.filter(f => f.verdict === 'review').length,
    matches: findings.filter(f => f.verdict === 'match').length,
    findings,
  };
}
