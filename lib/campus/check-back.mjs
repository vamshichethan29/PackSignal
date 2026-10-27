/**
 * PackSignal — Check-Back Verification Engine (lib/campus/check-back.mjs)
 * Phase 10 Campus Extra: Post-remediation verification loop.
 * Confirms whether physical reprint or updated scan resolved earlier correction tickets.
 */

export function runCheckBackVerification(previousReview, freshScanData) {
  const previousTickets = previousReview?.tickets || previousReview?.findings?.filter(f => f.status === 'issue') || [];
  const freshText = Object.values(freshScanData?.panels || {}).map(p => p.text || '').join(' ') || String(freshScanData?.text || '');

  const checkBackResults = [];

  for (const ticket of previousTickets) {
    const requiredText = ticket.approvedReplacement || ticket.expected || ticket.targetPhrase || '';
    const originalError = ticket.originalText || ticket.observed || '';

    let status = 'UNRESOLVED';
    let explanation = '';

    if (!requiredText) {
      status = 'MANUAL_VERIFY';
      explanation = 'No exact replacement phrase specified; visual inspection required.';
    } else {
      const isFixed = freshText.toLowerCase().includes(requiredText.toLowerCase());
      const stillHasOldError = originalError ? freshText.toLowerCase().includes(originalError.toLowerCase()) : false;

      if (isFixed && !stillHasOldError) {
        status = 'VERIFIED_FIXED';
        explanation = `The corrected text "${requiredText}" is now present on the physical pack, and the previous defect "${originalError}" has been eradicated.`;
      } else if (isFixed && stillHasOldError) {
        status = 'PARTIAL_FIX';
        explanation = `Corrected text "${requiredText}" was added, but the old incorrect copy "${originalError}" is still visible on another panel.`;
      } else {
        status = 'UNRESOLVED';
        explanation = `The physical reprint still lacks the approved text "${requiredText}".`;
      }
    }

    checkBackResults.push({
      ticketId: ticket.id || `TICKET-${checkBackResults.length + 1}`,
      title: ticket.title || ticket.field || 'Packaging Discrepancy',
      panel: ticket.panel || 'front',
      requiredText,
      originalError,
      status,
      explanation,
    });
  }

  const fixedCount = checkBackResults.filter(r => r.status === 'VERIFIED_FIXED').length;
  const unresolvedCount = checkBackResults.filter(r => r.status === 'UNRESOLVED').length;

  return {
    verifiedAt: new Date().toISOString(),
    totalTicketsChecked: checkBackResults.length,
    fixedCount,
    unresolvedCount,
    passRate: checkBackResults.length ? `${Math.round((fixedCount / checkBackResults.length) * 100)}%` : '100%',
    allDefectsEradicated: unresolvedCount === 0 && checkBackResults.length > 0,
    results: checkBackResults,
  };
}
