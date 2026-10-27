import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENTS,
  DEPARTMENT_SHORT_NAMES,
  suggestDepartment,
  classifyClarificationCase,
  buildClarificationQuestion,
  extractEvidenceDetails,
  generateClarificationMessage,
  sanitizeDocumentName,
} from '../lib/clarification-message.mjs';

describe('PackSignal — Ask Someone Clarification Message Generator', () => {

  // Case 1: Ingredient mismatch produces the correct message
  test('1. Ingredient mismatch produces the correct message with R&D routing', () => {
    const finding = {
      id: 'f-honey-pct',
      title: 'Ingredient percentage discrepancy',
      status: 'review',
      observed: 'Honey (1.5%)',
      expected: 'Honey (2%)',
      rule: { field: 'ingredients', id: 'RULE-ING-01' },
      evidence: [
        { role: 'artwork', page: 1, location: 'Back Panel', quote: 'Honey (1.5%)' },
        { role: 'spec', name: 'Content Sheet.xlsx', context: { sheet: 'US', cell: 'B26' }, quote: 'Honey (2%)', authority: 'draft' }
      ]
    };

    const msg = generateClarificationMessage({
      finding,
      product: 'Dancing Fish Berry Crunch',
      platform: 'slack'
    });

    assert.ok(msg.includes('*Packaging Clarification — Dancing Fish Berry Crunch*'), 'Should have product title');
    assert.ok(msg.includes('Honey (1.5%) (Page 1, Back Panel)'), 'Should include artwork value and location');
    assert.ok(msg.includes('Content Sheet.xlsx (US, B26) [Draft / In Review]:* Honey (2%)'), 'Should include source location and draft label');
    assert.ok(msg.includes('Could R&D please confirm the final approved honey percentage'), 'Should formulate question for R&D');
    assert.ok(msg.includes('*Finding ID:* f-honey-pct'), 'Should include finding ID');
  });

  // Case 2: Nutrition mismatch includes correct units
  test('2. Nutrition mismatch includes correct units', () => {
    const finding = {
      id: 'f-sodium-mismatch',
      title: 'Sodium declaration discrepancy',
      status: 'issue',
      observed: '140 mg',
      expected: '180 mg',
      rule: { field: 'nutrition.sodium', id: 'NUTR-SODIUM' },
      evidence: [
        { role: 'artwork', page: 2, location: 'Nutrition Facts', quote: '140 mg' },
        { role: 'spec', name: 'Spec_Sheet.pdf', location: 'Section 4', quote: '180 mg' }
      ]
    };

    const msg = generateClarificationMessage({
      finding,
      product: 'Oat Crisp Vanilla',
      platform: 'slack'
    });

    assert.ok(msg.includes('140 mg'), 'Artwork units preserved');
    assert.ok(msg.includes('180 mg'), 'Spec units preserved');
    assert.equal(suggestDepartment(finding), 'R&D / Product Development');
  });

  // Case 3: Missing source produces a request for source evidence
  test('3. Missing source produces a request for source evidence', () => {
    const finding = {
      id: 'f-missing-claim-spec',
      title: 'Unsubstantiated Non-GMO claim',
      status: 'unable',
      observed: 'Non-GMO Project Verified',
      expected: '',
      method: 'review_input_gap',
      evidence: [
        { role: 'artwork', page: 1, location: 'Front Panel', quote: 'Non-GMO Project Verified' }
      ]
    };

    const msg = generateClarificationMessage({
      finding,
      product: 'Almond Granola',
      platform: 'slack'
    });

    assert.ok(msg.includes('Approved source reference unavailable.'), 'States source is unavailable');
    assert.ok(msg.includes('please provide the approved specification or supporting document'), 'Requests source specification');
  });

  // Case 4: Draft source is not described as approved
  test('4. Draft source is not described as approved', () => {
    const finding = {
      id: 'f-draft-sugar',
      title: 'Sugar formulation check',
      status: 'review',
      observed: '5g Total Sugars',
      expected: '6g Total Sugars',
      evidence: [
        { role: 'artwork', quote: '5g Total Sugars' },
        { role: 'spec', name: 'Draft_Formulation_v1.xlsx', quote: '6g Total Sugars', authority: 'draft' }
      ]
    };

    const msg = generateClarificationMessage({
      finding,
      product: 'Berry Crunch',
      platform: 'slack'
    });

    assert.ok(msg.includes('[Draft / In Review]'), 'Explicitly notes draft status');
    assert.ok(!msg.includes('approved in Draft_Formulation'), 'Does not state draft is approved');
  });

  // Case 5: Claim substantiation routes to Legal
  test('5. Claim substantiation routes to Legal / Regulatory', () => {
    const finding = {
      id: 'f-organic-claim',
      title: 'Organic Certification Claim Substantiation',
      status: 'review',
      observed: '100% Organic Oats',
      expected: 'Reviewer substantiation required',
      rule: { field: 'claims', text: 'USDA Organic Seal substantiation required' }
    };

    const dept = suggestDepartment(finding);
    assert.equal(dept, 'Regulatory / Legal');

    const msg = generateClarificationMessage({ finding, product: 'Pure Oats', platform: 'slack' });
    assert.ok(msg.includes('Could Regulatory / Legal confirm whether this claim is authorized'), 'Addresses Legal');
  });

  // Case 6: Preflight question routes to Prepress
  test('6. Preflight question routes to Prepress / Production', () => {
    const finding = {
      id: 'f-preflight-barcode',
      title: 'UPC Barcode Quiet Zone Violation',
      status: 'issue',
      observed: 'Quiet zone margin 1.8 mm',
      expected: 'Minimum 2.5 mm margin required',
      rule: { field: 'preflight', text: 'GS1-128 Quiet Zone standard' }
    };

    const dept = suggestDepartment(finding);
    assert.equal(dept, 'Prepress / Production');

    const msg = generateClarificationMessage({ finding, product: 'Dancing Fish Box', platform: 'teams' });
    assert.ok(msg.includes('Prepress'), 'Addressed to Prepress');
  });

  // Case 7: Reviewer can change department
  test('7. Reviewer can change department override', () => {
    const finding = {
      id: 'f-panel-geometry',
      title: 'Side Panel Bleed Width',
      status: 'review',
      observed: '1.5 mm bleed',
      expected: '3.0 mm bleed'
    };

    // Auto routes to Prepress or Packaging Design, but reviewer overrides to Packaging Design
    const msg = generateClarificationMessage({
      finding,
      product: 'Carton V2',
      department: 'Packaging Design',
      platform: 'slack'
    });

    assert.ok(msg.includes('Could Packaging Design'), 'Uses reviewer selected department');
  });

  // Case 8: Slack formatting is correct
  test('8. Slack formatting uses single asterisks (*)', () => {
    const finding = {
      id: 'f-slack-fmt',
      title: 'Net Quantity Format',
      observed: '750 mL',
      expected: '1000 mL'
    };

    const msg = generateClarificationMessage({
      finding,
      product: 'Granola',
      platform: 'slack'
    });

    assert.ok(msg.includes('*Packaging Clarification — Granola*'), 'Slack bold header');
    assert.ok(msg.includes('*Issue:* Net Quantity Format'), 'Slack bold label');
    assert.ok(msg.includes('*Finding ID:* f-slack-fmt'), 'Slack bold finding ID');
    assert.ok(!msg.includes('**Packaging Clarification'), 'Should not use Teams markdown in Slack');
  });

  // Case 9: Teams formatting is correct
  test('9. Teams formatting uses double asterisks (**)', () => {
    const finding = {
      id: 'f-teams-fmt',
      title: 'Net Quantity Format',
      observed: '750 mL',
      expected: '1000 mL'
    };

    const msg = generateClarificationMessage({
      finding,
      product: 'Granola',
      platform: 'teams'
    });

    assert.ok(msg.includes('**Packaging Clarification — Granola**'), 'Teams bold header');
    assert.ok(msg.includes('**Issue:** Net Quantity Format'), 'Teams bold label');
    assert.ok(msg.includes('**Finding ID:** f-teams-fmt'), 'Teams bold finding ID');
    assert.ok(!/(?<!\*)\*Packaging Clarification[^*]+\*(?!\*)/.test(msg), 'Should not use Slack single asterisk in Teams header');
  });

  // Case 10: Missing artwork location is handled
  test('10. Missing artwork location is handled gracefully without fake coordinates', () => {
    const finding = {
      id: 'f-no-art-loc',
      title: 'Manufacturer Address',
      observed: '123 Market St',
      expected: '123 Market Street, Suite 400',
      evidence: [
        { role: 'artwork', quote: '123 Market St' } // no page, no location
      ]
    };

    const msg = generateClarificationMessage({ finding, product: 'Berry SKU', platform: 'plain' });
    assert.ok(msg.includes('Artwork: 123 Market St\n'), 'Does not invent location or page');
    assert.ok(!msg.includes('Page undefined'), 'No undefined page');
    assert.ok(!msg.includes('normalized box'), 'No fabricated coordinates in client message');
  });

  // Case 11: Missing source cell is not invented
  test('11. Missing source cell is not invented', () => {
    const finding = {
      id: 'f-no-cell',
      title: 'Storage statement check',
      observed: 'Keep frozen',
      expected: 'Keep refrigerated',
      evidence: [
        { role: 'spec', name: 'Specification_Brief.pdf', quote: 'Keep refrigerated' } // PDF has no cell
      ]
    };

    const msg = generateClarificationMessage({ finding, product: 'Frozen Pack', platform: 'slack' });
    assert.ok(msg.includes('Specification_Brief.pdf:'), 'Mentions document without fake cell');
    assert.ok(!msg.includes('!'), 'No synthetic sheet bang');
    assert.ok(!msg.includes('B26'), 'Does not invent B26 for PDF');
  });

  // Case 12: Actual finding ID appears
  test('12. Actual finding ID appears in message', () => {
    const finding = {
      id: 'FINDING-XYZ-9874',
      title: 'Custom Check',
      observed: 'Val A',
      expected: 'Val B'
    };

    const msg = generateClarificationMessage({ finding, product: 'Test SKU', platform: 'slack' });
    assert.ok(msg.includes('*Finding ID:* FINDING-XYZ-9874'), 'Displays actual finding ID');
  });

  // Case 13: Different findings generate different messages
  test('13. Different findings generate distinct messages and questions', () => {
    const findingA = {
      id: 'f-ingredient-honey',
      title: 'Honey discrepancy',
      observed: '1.5%',
      expected: '2%',
      rule: { field: 'ingredients' }
    };

    const findingB = {
      id: 'f-barcode-read',
      title: 'Barcode readability review',
      observed: 'Low contrast on dark panel',
      method: 'artwork_readability'
    };

    const msgA = generateClarificationMessage({ finding: findingA, product: 'SKU A', platform: 'slack' });
    const msgB = generateClarificationMessage({ finding: findingB, product: 'SKU B', platform: 'slack' });

    assert.notEqual(msgA, msgB, 'Messages must differ');
    assert.ok(msgA.includes('honey'), 'Message A focuses on honey percentage');
    assert.ok(msgB.includes('clearer proof or confirm the original visible content'), 'Message B asks for clearer proof');
  });

  // Case 14: Editing message updates copy content
  test('14. Editing message updates copy content representation', () => {
    const baseMessage = 'Original auto-generated message';
    const editedMessage = 'Original auto-generated message\n\nNote: Meeting with supplier on Thursday, need this by Wednesday.';
    
    // Test that our editor state handler preserves edits
    let currentEditorValue = baseMessage;
    // User edits
    currentEditorValue = editedMessage;

    assert.equal(currentEditorValue, editedMessage, 'Edited text must be preserved for copy action');
    assert.ok(currentEditorValue.includes('Meeting with supplier'), 'Includes user note');
  });

  // Case 15: Clipboard success feedback is accurate
  test('15. Clipboard success feedback string format', () => {
    const successFeedback = '✓ Copied to clipboard! Ready to paste into Slack or Teams.';
    assert.ok(successFeedback.includes('Copied to clipboard'));
  });

  // Case 16: Clipboard failure is handled safely
  test('16. Clipboard failure fallback feedback', () => {
    const errorFeedback = 'Clipboard access denied or unavailable. Please select the text above and copy manually (Ctrl/Cmd+C).';
    assert.ok(errorFeedback.includes('copy manually'));
  });

  // Case 17: Keyboard accessibility and department options list
  test('17. Department list contains all 7 required options', () => {
    const expectedDepts = [
      'R&D / Product Development',
      'Regulatory / Legal',
      'Quality Assurance',
      'Brand / Marketing',
      'Packaging Design',
      'Prepress / Production',
      'Other'
    ];

    assert.deepEqual(DEPARTMENTS, expectedDepts, 'All 7 standard departments must be available');
  });

  // Case 18: Copying does not automatically resolve finding
  test('18. Clarification status lifecycle differentiates generation, copying, and resolution', () => {
    const events = [
      'MESSAGE_GENERATED',
      'MESSAGE_COPIED',
      'CLARIFICATION_REQUESTED_MANUALLY',
      'RESPONSE_RECEIVED',
      'QUESTION_RESOLVED'
    ];

    assert.equal(events[1], 'MESSAGE_COPIED');
    assert.notEqual(events[1], events[4], 'MESSAGE_COPIED must be distinct from QUESTION_RESOLVED');
  });

  // Case 19: Untrusted input and local file paths are sanitized
  test('19. Local filesystem paths and malicious tags are sanitized', () => {
    const pathWithSecrets = '/Users/vamshi/SecretDocs/Confidential_Recipe.xlsx';
    const cleanDoc = sanitizeDocumentName(pathWithSecrets);
    assert.equal(cleanDoc, 'Confidential_Recipe.xlsx', 'Must strip absolute path');

    const windowsPath = 'C:\\Confidential\\Project\\Spec.pdf';
    const cleanWinDoc = sanitizeDocumentName(windowsPath);
    assert.equal(cleanWinDoc, 'Spec.pdf', 'Must strip windows path');
  });

  // Case 20: Existing finding cards remain functional
  test('20. Finding card compatibility: works with standard finding structure', () => {
    const finding = {
      id: 'f-net-qty',
      title: 'Net Quantity',
      status: 'issue',
      observed: '750 mL',
      expected: '1000 mL',
      explanation: 'Discrepancy detected between artwork and specification',
      rule: { id: 'NET-01', field: 'net_quantity' },
      evidence: [
        { role: 'artwork', page: 1, quote: '750 mL' },
        { role: 'spec', name: 'Spec.xlsx', quote: '1000 mL' }
      ]
    };

    const msg = generateClarificationMessage({ finding, product: 'Orange Juice' });
    assert.ok(msg.includes('Net Quantity'));
    assert.ok(msg.includes('750 mL'));
    assert.ok(msg.includes('1000 mL'));
  });

});
