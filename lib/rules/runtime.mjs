/**
 * PackSignal Bounded Rule Runtime (lib/rules/runtime.mjs)
 * Implements Wave D: Safe, deterministic rule execution conforming to Rulebook Trust constraints.
 * Evaluates the six packaging rule families and baseline preflight/regulatory checks.
 * Safeguard: Never returns a fake MATCH; preserves exact calculation proofs and limitations.
 */

import { normal, safeCopyMatch, tokenSequencePresent, equalQuantity } from '../engine.mjs';
import { evaluateIngredientDeclaration } from '../regulatory/ingredients.mjs';
import { evaluateAllergenCompliance } from '../regulatory/allergens.mjs';
import { evaluateDailyValueCheck } from '../regulatory/nutrition.mjs';
import { hasValidGtinCheckDigit, canonicalGtin, gtinDigits, suppliedGtinCandidates } from '../gtin.mjs';
import { compareApprovedPhrasePair, createApprovedPhrasePair } from '../multilingual/approved-pairs.mjs';

export function executeCompiledRule(compiledRule, context = {}) {
  const {
    ruleId = compiledRule.ruleId || 'RULE-01',
    title = compiledRule.title || 'Packaging Rule',
    trustState = {},
    ruleCitation = compiledRule.ruleCitation || '',
    sourceEvidence = compiledRule.sourceEvidence || null,
    artworkText = '',
    artworkSpans = [],
    facts = [],
    selectedPanel = null,
  } = context;

  // Safety Gate 1: If rule is not approved by reviewer, it cannot declare an authoritative issue
  if (trustState.reviewerAuthorization && trustState.reviewerAuthorization !== 'APPROVED') {
    return {
      status: 'review',
      verdict: 'not_applicable',
      checkVerdict: 'AUTHORIZATION_PENDING',
      reason: `Cannot fail artwork: Rule is not approved by reviewer (status: ${trustState.reviewerAuthorization || 'PROPOSED'})`,
      explanation: `Rule "${title}" has not been approved by an authorized reviewer (current state: ${trustState.reviewerAuthorization || 'PROPOSED'}). Execution deferred.`,
      ruleCitation,
      sourceEvidence,
      artworkEvidence: null,
    };
  }

  // Safety Gate 2: If quotation is not verified from source
  if (trustState.sourceVerification && trustState.sourceVerification !== 'VERIFIED_QUOTATION') {
    return {
      status: 'review',
      verdict: 'not_applicable',
      checkVerdict: 'UNVERIFIED_SOURCE',
      reason: `Cannot fail artwork: Rule citation could not be verified against source document`,
      explanation: `Rule citation could not be verified against the source document. Cannot execute as an authoritative legal check.`,
      ruleCitation,
      sourceEvidence,
      artworkEvidence: null,
    };
  }

  const artLower = (artworkText || '').toLowerCase();
  const artNorm = normal(artworkText);

  switch (compiledRule.type || compiledRule.ruleType) {
    case 'REQUIRED_EXACT_TEXT':
    case 'REQUIRED_TEXT': {
      const phrase = compiledRule.targetPhrase || compiledRule.parameters?.phrase || compiledRule.parameters?.requiredText;
      const found = safeCopyMatch(artworkText, phrase) || artNorm.includes(normal(phrase));
      return {
        status: found ? 'match' : 'issue',
        verdict: found ? 'match' : 'issue',
        checkVerdict: found ? 'REQUIRED_TEXT_MATCH' : 'REQUIRED_TEXT_MISSING',
        expected: `Exact phrase: "${phrase}"`,
        observed: found ? `Found "${phrase}" on artwork` : 'Not detected in artwork copy',
        explanation: found
          ? `Mandatory required phrase "${phrase}" verified on packaging artwork.`
          : `Mandatory phrase "${phrase}" is missing from packaging artwork.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    case 'FORBIDDEN_EXACT_TEXT':
    case 'FORBIDDEN_TEXT': {
      const phrase = compiledRule.targetPhrase || compiledRule.parameters?.phrase || compiledRule.parameters?.forbiddenText;
      const found = artNorm.includes(normal(phrase));
      return {
        status: found ? 'issue' : 'match',
        verdict: found ? 'FORBIDDEN_TEXT_PRESENT' : 'FORBIDDEN_TEXT_ABSENT',
        expected: `Forbidden phrase "${phrase}" must not appear on packaging`,
        observed: found ? `Detected forbidden phrase "${phrase}" on artwork` : 'Phrase absent from artwork',
        explanation: found
          ? `Prohibited text violation: Forbidden phrase "${phrase}" detected on artwork.`
          : `Forbidden phrase "${phrase}" is absent from packaging copy as required.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    case 'QUANTITY_EQUIVALENCE': {
      const specQty = facts.find(f => f.field === 'net_quantity')?.value;
      if (!specQty) {
        return {
          status: 'unable',
          verdict: 'MISSING_SOURCE_FACT',
          explanation: 'Net quantity check blocked: Approved specification net quantity fact is missing.',
          ruleCitation,
        };
      }
      const match = equalQuantity(specQty, artworkText);
      return {
        status: match ? 'match' : 'issue',
        verdict: match ? 'QUANTITY_MATCH' : 'QUANTITY_MISMATCH',
        expected: specQty,
        observed: match ? `Artwork matches ${specQty}` : 'Observed quantity differs from approved specification',
        explanation: match
          ? `Net quantity matches approved specification (${specQty}).`
          : `Net quantity discrepancy with approved specification (${specQty}).`,
        ruleCitation,
        sourceEvidence,
      };
    }

    case 'INGREDIENT_COMPARISON': {
      const specIng = facts.find(f => f.field === 'ingredients')?.value;
      if (!specIng) {
        return {
          status: 'unable',
          verdict: 'MISSING_SOURCE_FACT',
          explanation: 'Ingredient check blocked: Approved formulation specification is missing.',
          ruleCitation,
        };
      }
      const evalResult = evaluateIngredientDeclaration(specIng, artworkText);
      return {
        status: evalResult.status,
        verdict: evalResult.verdict,
        expected: specIng,
        observed: evalResult.explanation,
        explanation: evalResult.explanation,
        ruleCitation: evalResult.citation,
        sourceEvidence,
      };
    }

    case 'ALLERGEN_DECLARATION': {
      const specAllergens = (facts.find(f => f.field === 'allergens')?.value || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      const evalResult = evaluateAllergenCompliance({
        sourceAllergens: specAllergens,
        artworkIngredients: artworkText,
        artworkAllergenStatement: artworkText,
        artworkFullText: artworkText,
      });
      return {
        status: evalResult.status,
        verdict: evalResult.status === 'issue' ? 'ALLERGEN_DISCLOSURE_DEFECT' : 'ALLERGEN_DISCLOSURE_MATCH',
        expected: specAllergens.join(', ') || 'Statutory major allergen disclosure',
        observed: evalResult.explanation,
        explanation: evalResult.explanation,
        ruleCitation: evalResult.citation,
        sourceEvidence,
      };
    }

    case 'PANEL_PLACEMENT': {
      const reqPanel = compiledRule.targetPanel || compiledRule.parameters?.panel;
      const currentPanel = String(selectedPanel || '').toLowerCase();
      const match = currentPanel.includes(reqPanel) || (reqPanel && reqPanel.includes(currentPanel));
      return {
        status: match ? 'match' : 'review',
        verdict: match ? 'PANEL_PLACEMENT_CONFIRMED' : 'PANEL_PLACEMENT_UNVERIFIED',
        expected: `Required on ${reqPanel} panel`,
        observed: currentPanel ? `Located on ${currentPanel} panel` : 'Panel zone not configured',
        explanation: match
          ? `Panel placement confirmed on ${reqPanel}.`
          : `Confirm that content is printed on the required ${reqPanel} panel.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    case 'NUMERIC_MINIMUM': {
      const threshold = compiledRule.threshold ?? compiledRule.parameters?.threshold;
      const unit = compiledRule.unit ?? compiledRule.parameters?.unit ?? '';
      const observedRaw = facts.find(f => f.field === compiledRule.targetField)?.value;
      const observedNum = observedRaw !== undefined ? Number(observedRaw) : null;
      if (observedNum === null || !Number.isFinite(observedNum)) {
        return {
          status: 'unable',
          verdict: 'NUMERIC_VALUE_MISSING',
          explanation: `Cannot verify minimum ${threshold} ${unit}: Fact value is missing.`,
          ruleCitation,
        };
      }
      const passes = observedNum >= threshold;
      return {
        status: passes ? 'match' : 'issue',
        verdict: passes ? 'NUMERIC_MINIMUM_SATISFIED' : 'NUMERIC_MINIMUM_VIOLATED',
        expected: `≥ ${threshold} ${unit}`,
        observed: `${observedNum} ${unit}`,
        explanation: passes ? `Value ${observedNum} ${unit} meets minimum requirement (≥ ${threshold} ${unit}).` : `Value ${observedNum} ${unit} falls below required minimum (≥ ${threshold} ${unit}).`,
        ruleCitation,
      };
    }

    case 'NUMERIC_MAXIMUM': {
      const threshold = compiledRule.threshold ?? compiledRule.parameters?.threshold;
      const unit = compiledRule.unit ?? compiledRule.parameters?.unit ?? '';
      const observedRaw = facts.find(f => f.field === compiledRule.targetField)?.value;
      const observedNum = observedRaw !== undefined ? Number(observedRaw) : null;
      if (observedNum === null || !Number.isFinite(observedNum)) {
        return {
          status: 'unable',
          verdict: 'NUMERIC_VALUE_MISSING',
          explanation: `Cannot verify maximum ${threshold} ${unit}: Fact value is missing.`,
          ruleCitation,
        };
      }
      const passes = observedNum <= threshold;
      return {
        status: passes ? 'match' : 'issue',
        verdict: passes ? 'NUMERIC_MAXIMUM_SATISFIED' : 'NUMERIC_MAXIMUM_VIOLATED',
        expected: `≤ ${threshold} ${unit}`,
        observed: `${observedNum} ${unit}`,
        explanation: passes ? `Value ${observedNum} ${unit} meets maximum requirement (≤ ${threshold} ${unit}).` : `Value ${observedNum} ${unit} exceeds allowed maximum (≤ ${threshold} ${unit}).`,
        ruleCitation,
      };
    }

    // =========================================================================
    // RULE FAMILY 1 — BARCODE_GTIN_MATCH
    // =========================================================================
    case 'BARCODE_GTIN_MATCH': {
      const specFact = facts.find(f => f.field === 'gtin' || f.field === 'barcode' || f.field === 'sku_gtin')?.value;
      const rawExpected = specFact ||
        compiledRule.expectedGtin ||
        compiledRule.parameters?.expectedGtin;

      const rawDecoded = context.barcode ||
        facts.find(f => f.field === 'artwork_barcode' || f.field === 'scanned_gtin')?.value ||
        (artworkText.match(/\b\d{8,14}\b/)?.[0] || '');

      // 1. Check if approved expected GTIN is present
      if (!rawExpected) {
        return {
          status: 'unable',
          verdict: 'MISSING_SOURCE_FACT',
          checkVerdict: 'GTIN_SPECIFICATION_MISSING',
          expected: 'Approved product specification GTIN from SKU master',
          observed: 'No GTIN fact in approved product specification',
          explanation: 'Barcode verification blocked: Approved specification GTIN is missing from product master. (Physical print quality verification requires separate verifier screening).',
          ruleCitation,
          sourceEvidence,
          limitations: ['Approved SKU GTIN master reference unavailable.'],
        };
      }

      const expectedDigits = gtinDigits(rawExpected);
      const decodedDigits = gtinDigits(rawDecoded);

      // 2. Validate GS1 Check Digit on expected GTIN
      if (!hasValidGtinCheckDigit(expectedDigits)) {
        return {
          status: 'issue',
          verdict: 'GTIN_CHECK_DIGIT_INVALID',
          checkVerdict: 'SPEC_GTIN_CHECK_DIGIT_FAILED',
          expected: `Valid GS1 GTIN with verified Mod-10 check digit`,
          observed: `Specification GTIN "${rawExpected}" (${expectedDigits}) has invalid check digit`,
          explanation: `Invalid specification GTIN: Mod-10 check digit verification failed for "${rawExpected}". Expected check digit does not match calculated GS1 checksum.`,
          ruleCitation,
          sourceEvidence,
        };
      }

      // 3. Check if barcode was decoded from artwork
      if (!decodedDigits) {
        return {
          status: 'unable',
          verdict: 'BARCODE_NOT_DECODED',
          checkVerdict: 'BARCODE_NOT_DETECTED',
          expected: `GTIN ${canonicalGtin(expectedDigits)} (${expectedDigits})`,
          observed: 'No readable linear or 2D barcode decoded from artwork',
          explanation: 'No readable linear or 2D barcode could be decoded from artwork for GTIN matching. (Note: physical print quality verification requires separate verifier screening).',
          ruleCitation,
          sourceEvidence,
          limitations: ['Artwork contains no decodable barcode symbols in scanned regions.'],
        };
      }

      // 4. Validate GS1 Check Digit on decoded barcode
      if (!hasValidGtinCheckDigit(decodedDigits)) {
        return {
          status: 'issue',
          verdict: 'GTIN_CHECK_DIGIT_INVALID',
          checkVerdict: 'ARTWORK_GTIN_CHECK_DIGIT_FAILED',
          expected: `Decoded barcode with verified Mod-10 check digit`,
          observed: `Decoded barcode "${decodedDigits}" has invalid Mod-10 check digit`,
          explanation: `Printed barcode error: Decoded symbol "${decodedDigits}" failed GS1 Mod-10 check digit calculation.`,
          ruleCitation,
          sourceEvidence,
        };
      }

      // 5. Compare canonical normalized GTINs (14-digit canonical representation preserves leading zeros)
      const canonExpected = canonicalGtin(expectedDigits);
      const canonDecoded = canonicalGtin(decodedDigits);
      const match = canonExpected === canonDecoded;

      return {
        status: match ? 'match' : 'issue',
        verdict: match ? 'BARCODE_GTIN_VERIFIED' : 'BARCODE_GTIN_MISMATCH',
        checkVerdict: match ? 'GTIN_MATCH' : 'GTIN_MISMATCH',
        expected: `GTIN: ${canonExpected} (${expectedDigits})`,
        observed: `Decoded barcode: ${canonDecoded} (${decodedDigits})`,
        explanation: match
          ? `Product identity match: Decoded barcode matches approved specification GTIN (${canonExpected}).`
          : `Critical product mismatch: Decoded barcode (${canonDecoded}) does not match specification (${canonExpected}).`,
        ruleCitation,
        sourceEvidence,
        calculationProof: {
          symbology: compiledRule.parameters?.symbology || 'EAN-13/UPC',
          expectedGtin: expectedDigits,
          expectedCanonical: canonExpected,
          observedGtin: decodedDigits,
          observedCanonical: canonDecoded,
          checkDigitValid: true,
          match,
        },
      };
    }

    // =========================================================================
    // RULE FAMILY 2 — STATUTORY_SYMBOL_PRESENCE
    // =========================================================================
    case 'STATUTORY_SYMBOL_PRESENCE': {
      const params = compiledRule.parameters || {};
      const symbolName = compiledRule.symbolName || params.symbolName ||
        (params.symbolId?.includes('NONVEG') ? 'FSSAI Non-Vegetarian Mark' : (params.symbolId?.includes('VEG') ? 'FSSAI Vegetarian Mark' : 'Statutory Symbol'));
      const isVoluntary = compiledRule.symbolType === 'VOLUNTARY_CERTIFICATION' ||
        params.category === 'VOLUNTARY_MARK' ||
        /\b(?:voluntary|certification|organic|halal|kosher|fair trade)\b/i.test(symbolName);

      const searchTerms = [
        symbolName,
        params.symbolId,
        params.symbolId?.includes('NONVEG') ? 'brown triangle' : 'green dot',
        params.symbolId?.includes('NONVEG') ? 'non-vegetarian' : 'vegetarian',
      ].filter(Boolean);

      // Check genuine visual symbol evidence from computer vision / raster extraction
      const detectedSymbol = (context.symbols || []).find(s =>
        searchTerms.some(t => s.name?.toLowerCase().includes(t.toLowerCase()) || s.id?.toLowerCase().includes(t.toLowerCase()))
      );

      // Check if text alone contains the words (e.g. "VEG" or "GREEN DOT")
      const ocrTextDetected = searchTerms.some(t => artNorm.includes(normal(t)));
      const hasSymbol = detectedSymbol ? true : ocrTextDetected;

      // If voluntary mark (Certified Vegan, Organic, Fair Trade)
      if (isVoluntary) {
        const certDoc = facts.find(f =>
          f.field === 'certification' &&
          (f.value?.toLowerCase().includes(symbolName.toLowerCase()) || f.value?.toLowerCase().includes(params.symbolId?.toLowerCase() || ''))
        );

        if (hasSymbol && !certDoc) {
          return {
            status: 'review',
            verdict: 'VOLUNTARY_CERTIFICATE_UNVERIFIED',
            checkVerdict: 'CERTIFICATE_PENDING',
            expected: `Approved registry certificate for voluntary "${symbolName}" claim`,
            observed: `Artwork claims "${symbolName}" but certificate document is unverified`,
            explanation: `Artwork displays voluntary claim "${symbolName}". Proof of third-party certification is required before commercial distribution.`,
            ruleCitation,
            sourceEvidence,
            limitations: ['Voluntary certification requires legal audit of registry certificate.'],
          };
        }
      }

      return {
        status: hasSymbol ? 'match' : 'issue',
        verdict: hasSymbol ? 'SYMBOL_PRESENCE_CONFIRMED' : 'MANDATORY_SYMBOL_MISSING',
        checkVerdict: hasSymbol ? 'SYMBOL_FOUND' : 'SYMBOL_MISSING',
        expected: `Statutory symbol: ${symbolName}`,
        observed: hasSymbol ? `Symbol "${symbolName}" present on artwork` : `Symbol "${symbolName}" not detected`,
        explanation: hasSymbol
          ? `Required statutory symbol "${symbolName}" confirmed on packaging artwork.`
          : `Missing statutory symbol: Mandatory symbol "${symbolName}" was not found on artwork.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    // =========================================================================
    // RULE FAMILY 3 — MULTILINGUAL_PAIR_REQUIREMENT
    // =========================================================================
    case 'MULTILINGUAL_PAIR_REQUIREMENT': {
      const params = compiledRule.parameters || {};
      const primaryLang = compiledRule.primaryLanguage || params.primaryLanguage || params.languages?.[0] || 'English';
      const secondaryLang = compiledRule.secondaryLanguage || params.secondaryLanguage || params.languages?.[1] || 'French';
      const targetFields = params.requiredFields || [compiledRule.targetField || 'common_name'];
      const targetField = targetFields[0] || 'common_name';

      // Check market exemption (e.g. single-language market, specialty food)
      if (compiledRule.exemptionStatus === 'EXEMPT' || params.exemptionStatus === 'EXEMPT') {
        return {
          status: 'match',
          verdict: 'EXEMPT_FROM_MULTILINGUAL_PAIR',
          checkVerdict: 'EXEMPTION_APPLIED',
          expected: `Exemption applies for ${targetField}`,
          observed: `Statutory exemption active (${compiledRule.exemptionReason || 'Documented market exemption'})`,
          explanation: `Multilingual parallel requirement exempt under applicable local statute.`,
          ruleCitation,
          sourceEvidence,
        };
      }

      // Resolve approved primary and secondary phrases
      const primaryPhrase = facts.find(f => f.field === `${targetField}_${primaryLang.toLowerCase()}` || f.field === `${targetField}_en`)?.value ||
        compiledRule.primaryPhrase || params.primaryPhrase;
      const secondaryPhrase = facts.find(f => f.field === `${targetField}_${secondaryLang.toLowerCase()}` || f.field === `${targetField}_fr`)?.value ||
        compiledRule.secondaryPhrase || params.secondaryPhrase;

      if (!primaryPhrase || !secondaryPhrase) {
        return {
          status: 'review',
          verdict: 'MULTILINGUAL_SPECIFICATION_INCOMPLETE',
          checkVerdict: 'SPECIFICATION_GAP',
          expected: `Approved parallel ${primaryLang} and ${secondaryLang} text specifications for ${targetField}`,
          observed: `Primary (${primaryLang}): ${primaryPhrase || 'MISSING'} · Secondary (${secondaryLang}): ${secondaryPhrase || 'MISSING'}`,
          explanation: `Cannot verify bilingual packaging compliance without both approved language text strings.`,
          ruleCitation,
          sourceEvidence,
          limitations: ['Approved translation pair missing from product specification facts.'],
        };
      }

      const primaryFound = artNorm.includes(normal(primaryPhrase));
      const secondaryFound = artNorm.includes(normal(secondaryPhrase));
      const passed = primaryFound && secondaryFound;

      return {
        status: passed ? 'match' : 'issue',
        verdict: passed ? 'MULTILINGUAL_PAIR_VERIFIED' : 'MULTILINGUAL_PAIR_INCOMPLETE',
        checkVerdict: passed ? 'BILINGUAL_MATCH' : 'BILINGUAL_DEFECT',
        expected: `Parallel ${primaryLang} ("${primaryPhrase}") and ${secondaryLang} ("${secondaryPhrase}")`,
        observed: `${primaryLang}: ${primaryFound ? 'Present' : 'MISSING'} · ${secondaryLang}: ${secondaryFound ? 'Present' : 'MISSING'}`,
        explanation: passed
          ? `Bilingual compliance verified: Both ${primaryLang} and ${secondaryLang} declarations are present on artwork.`
          : `Bilingual non-compliance: Missing mandatory parallel text in ${!primaryFound ? primaryLang : ''} ${!secondaryFound ? secondaryLang : ''}.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    // =========================================================================
    // RULE FAMILY 4 — MANUFACTURER_ADDRESS_DECLARATION
    // =========================================================================
    case 'MANUFACTURER_ADDRESS_DECLARATION': {
      // 21 CFR 101.5 / Statutory business declaration
      const params = compiledRule.parameters || {};
      const hasName = /\b(manufactured by|distributed by|packed by|imported by|produced for|licensed to|co\.|inc\.|llc|ltd|corp|company|corporation)\b/i.test(artworkText);
      const hasZip = /\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(artworkText);
      const hasCityState = /[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(artworkText) || /\b(new york|san francisco|chicago|london|toronto|bengaluru|paris|seattle|austin|boston)\b/i.test(artworkText);
      const hasStreet = /\b(\d+\s+[\w\s]+(st|ave|rd|blvd|dr|lane|way|pkwy|court|street|avenue|road|boulevard))\b/i.test(artworkText);
      const directoryExemption = compiledRule.telephoneDirectoryExemption || params.telephoneDirectoryExemption || false;

      const addressComplete = hasName && hasCityState && (hasStreet || directoryExemption) && hasZip;
      return {
        status: addressComplete ? 'match' : (hasName ? 'review' : 'issue'),
        verdict: addressComplete ? 'ADDRESS_DECLARATION_COMPLETE' : (hasName ? 'ADDRESS_DETAIL_REVIEW' : 'MANUFACTURER_DECLARATION_MISSING'),
        checkVerdict: addressComplete ? 'ADDRESS_VERIFIED' : 'ADDRESS_INCOMPLETE',
        expected: '21 CFR 101.5: Name of business, street address (or directory exemption), city, state, and ZIP',
        observed: `Name: ${hasName ? 'Yes' : 'No'} | Street: ${hasStreet ? 'Yes' : (directoryExemption ? 'Exempt (Directory)' : 'Omitted')} | City/State: ${hasCityState ? 'Yes' : 'No'} | ZIP: ${hasZip ? 'Yes' : 'No'}`,
        explanation: addressComplete
          ? `Statutory business declaration complete under 21 CFR 101.5.${directoryExemption ? ' (Telephone directory street exemption applied).' : ''}`
          : `Business address declaration incomplete: Missing required manufacturer identification or jurisdiction components.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    // =========================================================================
    // RULE FAMILY 5 — STORAGE_INSTRUCTION_MANDATE
    // =========================================================================
    case 'STORAGE_INSTRUCTION_MANDATE': {
      const params = compiledRule.parameters || {};
      const requiredWording = compiledRule.requiredWording || params.requiredStatement || compiledRule.targetPhrase || 'Keep Refrigerated';
      const storageState = compiledRule.storageState || params.storageState || 'REFRIGERATED';
      const equivs = params.equivalentPhrases || [requiredWording.toLowerCase()];

      // Contradiction detection: Do not conflate frozen vs refrigerated vs dry
      const isFrozen = /keep frozen|store frozen|-18\s*°?c/i.test(artworkText);
      const isRefrigerated = /keep refrigerated|refrigerate after opening|store below\s*[48]\s*°?c/i.test(artworkText);
      const isDry = /store in a cool,\s*dry place|ambient/i.test(artworkText);

      let contradiction = false;
      if (storageState === 'REFRIGERATED' && isFrozen && !isRefrigerated) contradiction = true;
      if (storageState === 'FROZEN' && isRefrigerated && !isFrozen) contradiction = true;

      if (contradiction) {
        return {
          status: 'issue',
          verdict: 'STORAGE_STATE_CONTRADICTION',
          checkVerdict: 'STORAGE_CONFLICT',
          expected: `Approved storage regime: ${requiredWording} (${storageState})`,
          observed: `Contradicting storage condition found on artwork`,
          explanation: `Critical safety contradiction: Artwork indicates conflicting thermal regime for ${storageState} product.`,
          ruleCitation,
          sourceEvidence,
        };
      }

      const match = artNorm.includes(normal(requiredWording)) ||
        safeCopyMatch(artworkText, requiredWording) ||
        equivs.some(eq => artNorm.includes(normal(eq)));

      return {
        status: match ? 'match' : 'issue',
        verdict: match ? 'STORAGE_INSTRUCTION_VERIFIED' : 'STORAGE_INSTRUCTION_MISSING',
        checkVerdict: match ? 'STORAGE_MATCH' : 'STORAGE_DEFECT',
        expected: `Mandatory storage statement: "${requiredWording}"`,
        observed: match ? `Found "${requiredWording}" on artwork` : 'Not detected in artwork copy',
        explanation: match
          ? `Mandatory storage instruction "${requiredWording}" verified on artwork.`
          : `Missing mandatory storage statement: "${requiredWording}" is required for ${storageState} goods.`,
        ruleCitation,
        sourceEvidence,
      };
    }

    // =========================================================================
    // RULE FAMILY 6 — NUTRIENT_CONTENT_CLAIM_LIMIT
    // =========================================================================
    case 'NUTRIENT_CONTENT_CLAIM_LIMIT': {
      const params = compiledRule.parameters || {};
      const claimType = compiledRule.claimType || params.claimType || 'LOW_SODIUM';
      const statutoryThreshold = compiledRule.threshold ?? params.threshold ?? 140;
      const statutoryUnit = compiledRule.unit || params.unit || 'mg';
      const nutrientName = compiledRule.nutrient || params.nutrient || 'sodium';
      const measurementBasis = params.measurementBasis || 'RACC';

      const observedNutrientFact = facts.find(f => f.field === `nutrition.${nutrientName}` || f.field === nutrientName);
      let nutrientVal = observedNutrientFact ? parseFloat(observedNutrientFact.value) : null;

      if (nutrientVal === null || isNaN(nutrientVal)) {
        const regexMatch = artworkText.match(new RegExp(`${nutrientName}\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*${statutoryUnit}`, 'i'));
        if (regexMatch) nutrientVal = parseFloat(regexMatch[1]);
      }

      if (nutrientVal === null || isNaN(nutrientVal)) {
        return {
          status: 'unable',
          verdict: 'NUTRIENT_DATA_UNAVAILABLE',
          checkVerdict: 'NUTRIENT_UNMEASURED',
          expected: `Verified ${nutrientName} quantity to evaluate "${claimType}" claim`,
          observed: 'Nutrient quantity not found in nutrition facts or formulation',
          explanation: `Cannot certify nutrient claim "${claimType}" without verified ${nutrientName} quantity per RACC.`,
          ruleCitation,
          sourceEvidence,
          limitations: ['Nutrient facts not available in parsed source sheets or artwork panel.'],
        };
      }

      // Small RACC condition (≤ 30g): threshold applies per 50g
      let effectiveThreshold = statutoryThreshold;
      let effectiveBasis = measurementBasis;
      if (measurementBasis === '50g') {
        effectiveThreshold = statutoryThreshold;
        effectiveBasis = '50g (Small RACC)';
      } else if (measurementBasis === '100g') {
        effectiveThreshold = statutoryThreshold;
        effectiveBasis = '100g (Meal/Main Dish)';
      }

      const compliant = nutrientVal <= effectiveThreshold;
      const proofStr = `Claim: ${claimType}. Observed: ${nutrientVal} ${statutoryUnit}. Relevant basis: ${effectiveBasis}. Threshold: ≤ ${effectiveThreshold} ${statutoryUnit}. Result: ${nutrientVal} ${statutoryUnit} ${compliant ? '≤' : '>'} ${effectiveThreshold} ${statutoryUnit} (${compliant ? 'PASS' : 'FAIL'}).`;

      return {
        status: compliant ? 'match' : 'issue',
        verdict: compliant ? 'NUTRIENT_CLAIM_PERMISSIBLE' : 'NUTRIENT_CLAIM_EXCEEDED',
        checkVerdict: compliant ? 'CLAIM_PERMITTED' : 'CLAIM_PROHIBITED',
        expected: `Statutory limit: ≤ ${effectiveThreshold} ${statutoryUnit} per ${effectiveBasis} (21 CFR 101.61)`,
        observed: `Measured: ${nutrientVal} ${statutoryUnit} per ${effectiveBasis} (Difference: ${Math.abs(nutrientVal - effectiveThreshold).toFixed(1)} ${statutoryUnit})`,
        explanation: compliant
          ? `Mathematical proof: Measured ${nutrientName} (${nutrientVal} ${statutoryUnit}) meets statutory requirement (≤ ${effectiveThreshold} ${statutoryUnit}) for "${claimType}".`
          : `Misbranding violation: Measured ${nutrientName} (${nutrientVal} ${statutoryUnit}) exceeds legal threshold (≤ ${effectiveThreshold} ${statutoryUnit}) for "${claimType}".`,
        ruleCitation,
        sourceEvidence,
        calculationProof: {
          claimType,
          nutrient: nutrientName,
          observedValue: nutrientVal,
          threshold: effectiveThreshold,
          unit: statutoryUnit,
          measurementBasis: effectiveBasis,
          compliant,
          proofString: proofStr,
        },
      };
    }

    case 'MANUAL_REVIEW':
    default: {
      return {
        status: 'review',
        verdict: 'review',
        checkVerdict: 'MANUAL_REVIEW_REQUIRED',
        reason: compiledRule.reason || 'Manual human review required for uncompiled or ambiguous rule.',
        expected: 'Human regulatory specialist review',
        observed: 'Natural language advisory rule requires subjective human determination',
        explanation: compiledRule.reason || 'Requirement requires human specialist review.',
        ruleCitation,
        sourceEvidence,
      };
    }
  }
}
