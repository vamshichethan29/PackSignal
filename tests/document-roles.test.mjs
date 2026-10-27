import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { uploadDeskInput } from '../lib/evidence-desk.mjs';

describe('Phase 4 — Document Roles & Format Decoupling', () => {
  const VALID_ROLES = [
    'ARTWORK',
    'PRODUCT_SPECIFICATION',
    'REGULATORY_RULEBOOK',
    'CLAIMS_SOURCE',
    'PREVIOUS_DESIGN',
    'REVIEWER_NOTES',
    'STRUCTURAL_DIELINE'
  ];

  it('supports all 7 canonical document roles', () => {
    VALID_ROLES.forEach(role => {
      const { newFile } = uploadDeskInput('role-test-session', {
        fileName: `sample_${role.toLowerCase()}.txt`,
        content: `Sample content for role ${role}`,
        fileType: 'txt',
        role
      });
      assert.equal(newFile.role, role);
    });
  });

  it('decouples file extension from document role', () => {
    // PDF as PRODUCT_SPECIFICATION (not packaging dieline)
    const resSpec = uploadDeskInput('decouple-session', {
      fileName: 'FDA_Compliance_Guide.pdf',
      content: 'Line 1: 21 CFR 101.9 Nutrition labeling standard',
      fileType: 'pdf',
      role: 'REGULATORY_RULEBOOK'
    });
    assert.equal(resSpec.newFile.type, 'pdf');
    assert.equal(resSpec.newFile.role, 'REGULATORY_RULEBOOK');

    // PDF as ARTWORK
    const resArtwork = uploadDeskInput('decouple-session', {
      fileName: 'Carton_Dieline.pdf',
      content: 'Artwork Proof Layer 1',
      fileType: 'pdf',
      role: 'ARTWORK'
    });
    assert.equal(resArtwork.newFile.type, 'pdf');
    assert.equal(resArtwork.newFile.role, 'ARTWORK');
  });

  it('marks facts extracted from PREVIOUS_DESIGN images as AI_SUGGESTED', () => {
    const resImg = uploadDeskInput('image-role-session', {
      fileName: 'Old_Carton_Photo.png',
      content: 'Base64ImageByteString',
      fileType: 'png',
      role: 'PREVIOUS_DESIGN'
    });
    assert.equal(resImg.newFile.role, 'PREVIOUS_DESIGN');

    // Facts derived from previous design images must be AI_SUGGESTED
    const imgFacts = resImg.session.facts.filter(f => f.sourceRole === 'PREVIOUS_DESIGN');
    assert.ok(imgFacts.length > 0);
    imgFacts.forEach(f => {
      assert.equal(f.state, 'AI_SUGGESTED');
      assert.equal(f.approvalStatus, 'UNAPPROVED');
    });
  });

  it('marks facts extracted from REVIEWER_NOTES as unapproved reference notes', () => {
    const resNotes = uploadDeskInput('notes-role-session', {
      fileName: 'Reviewer_Handover.txt',
      content: 'Line 1: Batch QA release notes\nLine 2: Please confirm whether honey is 9%',
      fileType: 'txt',
      role: 'REVIEWER_NOTES'
    });
    assert.equal(resNotes.newFile.role, 'REVIEWER_NOTES');

    const noteFacts = resNotes.session.facts.filter(f => f.sourceRole === 'REVIEWER_NOTES');
    assert.ok(noteFacts.length > 0);
    noteFacts.forEach(f => {
      assert.equal(f.state, 'AI_SUGGESTED');
      assert.equal(f.approvalStatus, 'UNAPPROVED');
    });
  });
});
