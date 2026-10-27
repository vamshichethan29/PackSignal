/**
 * PackSignal Remediation Diff Engine (public/remediation-diff.js)
 * Phase 16: Before vs After Copy Diff
 * Token-level & numeric-level side-by-side comparison with red strikethrough for removed text
 * and green highlighting for added text.
 */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Splits text into words/tokens while preserving punctuation and numbers.
 */
function tokenizeCopy(text = '') {
  // Tokenize words, numbers with units (e.g. 230mg, 15%), and symbols
  const matches = String(text || '').match(/\S+|\s+/g) || [];
  return matches.map(token => {
    const isWhitespace = /^\s+$/.test(token);
    const isNumeric = /[0-9]+(?:\.[0-9]+)?%?/.test(token);
    return { token, isWhitespace, isNumeric };
  });
}

/**
 * Computes side-by-side word and number diff.
 */
export function computeCopyDiff(originalText = '', proposedText = '') {
  const origTokens = tokenizeCopy(originalText);
  const propTokens = tokenizeCopy(proposedText);

  const origWordSet = new Set(
    origTokens.filter(t => !t.isWhitespace).map(t => t.token.toLowerCase())
  );
  const propWordSet = new Set(
    propTokens.filter(t => !t.isWhitespace).map(t => t.token.toLowerCase())
  );

  // Generate Before (Original) HTML
  const beforeHtml = origTokens.map(item => {
    if (item.isWhitespace) return item.token;
    const lower = item.token.toLowerCase();
    const unchanged = propWordSet.has(lower);

    if (unchanged) {
      return `<span class="diff-token unchanged">${esc(item.token)}</span>`;
    }

    if (item.isNumeric) {
      return `<del class="diff-del diff-numeric-del" title="Observed numeric value">${esc(item.token)}</del>`;
    }

    return `<del class="diff-del" title="Removed wording">${esc(item.token)}</del>`;
  }).join('');

  // Generate After (Proposed) HTML
  const afterHtml = propTokens.map(item => {
    if (item.isWhitespace) return item.token;
    const lower = item.token.toLowerCase();
    const unchanged = origWordSet.has(lower);

    if (unchanged) {
      return `<span class="diff-token unchanged">${esc(item.token)}</span>`;
    }

    if (item.isNumeric) {
      return `<ins class="diff-ins diff-numeric-ins" title="Corrected numeric value">${esc(item.token)}</ins>`;
    }

    return `<ins class="diff-ins" title="Added / corrected wording">${esc(item.token)}</ins>`;
  }).join('');

  return { beforeHtml, afterHtml };
}

/**
 * Renders the complete side-by-side comparison block for the Remediation Studio.
 */
export function renderSideBySideDiff(originalText, proposedText, options = {}) {
  const { beforeHtml, afterHtml } = computeCopyDiff(originalText, proposedText);
  const hasUserEdits = Boolean(options.hasUserEdits);

  return `
    <div class="remediation-diff-container">
      <div class="remediation-diff-grid">
        <div class="diff-column original-column">
          <div class="diff-column-header">
            <span class="diff-tag tag-original">ORIGINAL ARTWORK</span>
            <small class="subtle">Extracted from packaging page</small>
          </div>
          <div class="diff-content diff-original-box" data-original-display>
            ${beforeHtml || '<span class="subtle">No copy extracted</span>'}
          </div>
        </div>

        <div class="diff-column proposed-column">
          <div class="diff-column-header">
            <span class="diff-tag tag-proposed">PROPOSED CORRECTION</span>
            ${hasUserEdits ? '<span class="badge-edited">✏️ Reviewer Edited</span>' : '<span class="badge-evidence">✓ Source Anchored</span>'}
          </div>
          <div class="diff-content diff-proposed-box" data-proposed-display>
            ${afterHtml || '<span class="subtle">No proposed copy</span>'}
          </div>
        </div>
      </div>
    </div>
  `;
}
