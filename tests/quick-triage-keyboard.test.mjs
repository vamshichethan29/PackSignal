import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretTriageShortcut } from '../public/quick-triage.js';

test('interpretTriageShortcut: J, K, 1, 2, 3, 4, ?, Escape return correct actions in findings tab', () => {
  const context = { tab: 'findings', isModalOpen: false, isComposerOpen: false, isHelpOpen: false };

  assert.equal(interpretTriageShortcut({ key: 'j' }, context), 'NAVIGATE_NEXT');
  assert.equal(interpretTriageShortcut({ key: 'J' }, context), 'NAVIGATE_NEXT');
  assert.equal(interpretTriageShortcut({ key: 'k' }, context), 'NAVIGATE_PREVIOUS');
  assert.equal(interpretTriageShortcut({ key: 'K' }, context), 'NAVIGATE_PREVIOUS');
  assert.equal(interpretTriageShortcut({ key: '1' }, context), 'ACCEPT');
  assert.equal(interpretTriageShortcut({ key: '2' }, context), 'FLAG_REMEDY');
  assert.equal(interpretTriageShortcut({ key: '3' }, context), 'NEEDS_EVIDENCE');
  assert.equal(interpretTriageShortcut({ key: '4' }, context), 'SKIP');
  assert.equal(interpretTriageShortcut({ key: '?' }, context), 'OPEN_HELP');
  assert.equal(interpretTriageShortcut({ key: 'Escape' }, context), 'ESCAPE');
});

test('interpretTriageShortcut: Ignored when on non-findings tab', () => {
  const context = { tab: 'revisions', isModalOpen: false };
  assert.equal(interpretTriageShortcut({ key: 'j' }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '1' }, context), 'IGNORE');
});

test('interpretTriageShortcut: Typing in input, textarea, or contenteditable is ignored', () => {
  const context = { tab: 'findings' };

  const inputEl = { tagName: 'INPUT' };
  assert.equal(interpretTriageShortcut({ key: 'j', target: inputEl }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '1', target: inputEl }, context), 'IGNORE');

  const textareaEl = { tagName: 'TEXTAREA' };
  assert.equal(interpretTriageShortcut({ key: 'k', target: textareaEl }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '2', target: textareaEl }, context), 'IGNORE');

  const contentEditableEl = { tagName: 'DIV', isContentEditable: true };
  assert.equal(interpretTriageShortcut({ key: 'j', target: contentEditableEl }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '3', target: contentEditableEl }, context), 'IGNORE');
});

test('interpretTriageShortcut: Modifiers (Ctrl, Meta/Cmd, Alt) are ignored and preserve browser behavior', () => {
  const context = { tab: 'findings' };

  // Cmd+C, Cmd+R, Cmd+1, Ctrl+J, Alt+K
  assert.equal(interpretTriageShortcut({ key: 'j', metaKey: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: 'k', ctrlKey: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '1', metaKey: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '2', altKey: true }, context), 'IGNORE');
});

test('interpretTriageShortcut: IME composition is ignored', () => {
  const context = { tab: 'findings' };
  assert.equal(interpretTriageShortcut({ key: 'j', isComposing: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '1', isComposing: true }, context), 'IGNORE');
});

test('interpretTriageShortcut: Key repeat on decision keys (1,2,3,4) is ignored to prevent duplicate writes', () => {
  const context = { tab: 'findings' };
  assert.equal(interpretTriageShortcut({ key: '1', repeat: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '2', repeat: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '3', repeat: true }, context), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '4', repeat: true }, context), 'IGNORE');
});

test('interpretTriageShortcut: Modal suppression and Escape behavior', () => {
  // 1. Unrelated blocking modal open
  const modalContext = { tab: 'findings', isModalOpen: true, isComposerOpen: false, isHelpOpen: false };
  assert.equal(interpretTriageShortcut({ key: 'j' }, modalContext), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: '1' }, modalContext), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: 'Escape' }, modalContext), 'CLOSE_MODAL');

  // 2. Help open
  const helpContext = { tab: 'findings', isModalOpen: false, isComposerOpen: false, isHelpOpen: true };
  assert.equal(interpretTriageShortcut({ key: 'j' }, helpContext), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: 'Escape' }, helpContext), 'CLOSE_HELP');
  assert.equal(interpretTriageShortcut({ key: '?' }, helpContext), 'CLOSE_HELP');

  // 3. Triage composer open
  const composerContext = { tab: 'findings', isModalOpen: false, isComposerOpen: true, isHelpOpen: false };
  assert.equal(interpretTriageShortcut({ key: 'j' }, composerContext), 'IGNORE');
  assert.equal(interpretTriageShortcut({ key: 'Escape' }, composerContext), 'CANCEL_COMPOSER');

  // Escape inside composer text input closes/cancels composer
  const composerTextarea = { tagName: 'TEXTAREA', closest: sel => sel === '.triage-composer' };
  assert.equal(interpretTriageShortcut({ key: 'Escape', target: composerTextarea }, composerContext), 'CANCEL_COMPOSER');

  // Enter inside composer submits
  assert.equal(interpretTriageShortcut({ key: 'Enter', target: composerTextarea }, composerContext), 'SUBMIT_COMPOSER');
});
