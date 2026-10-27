async function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

function addJsonExportLink() {
  const actions = document.querySelector('.review-heading .actions');
  if (!actions || actions.querySelector('[data-report-json]')) return;
  const pdf = actions.querySelector('a[href$="report.pdf"]');
  if (!pdf) return;
  const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  if (!reviewId) return;
  const link = document.createElement('a');
  link.className = 'secondary';
  link.href = `/api/reviews/${reviewId}/report.json`;
  link.textContent = 'Export signed JSON ↓';
  link.dataset.reportJson = 'true';
  actions.insertBefore(link, pdf);
}

const reviewRoot = document.querySelector('#app');
if (reviewRoot) {
  new MutationObserver(addJsonExportLink).observe(reviewRoot, { childList: true, subtree: true });
  addJsonExportLink();
}

document.addEventListener('click', async event => {
  const copyCmdBtn = event.target.closest('[data-action="copy-audit-command"]');
  if (copyCmdBtn) {
    const cmd = copyCmdBtn.dataset.cmd || 'node scripts/verify-report.mjs output/report.json';
    await navigator.clipboard?.writeText(cmd).catch(() => {});
    await showToast(`Copied audit command: ${cmd}`);
    return;
  }

  const sealButton = event.target.closest('[data-action="verify-seal"]');
  if (sealButton) {
    const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
    if (!reviewId) return;
    sealButton.disabled = true;
    try {
      const response = await fetch(`/api/reviews/${reviewId}/signature`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify the seal.');

      const resultsSlot = document.querySelector('#live-verification-results');
      if (resultsSlot) {
        resultsSlot.innerHTML = `
          <div style="background:#020617;border:1px solid ${result.valid ? '#166534' : '#991b1b'};border-radius:6px;padding:14px;color:#f8fafc;font-family:monospace;font-size:11px;line-height:1.6;">
            <div style="font-weight:700;font-size:12px;color:${result.valid ? '#4ade80' : '#f87171'};margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <span>${result.valid ? '✓ CRYPTOGRAPHIC VERIFICATION PASSED' : '✕ VERIFICATION FAILED'}</span>
              <span style="font-size:10px;color:#94a3b8;font-weight:400;">(${new Date().toLocaleTimeString()})</span>
            </div>
            <div>Algorithm: <span style="color:#38bdf8;">${result.algorithm || 'Ed25519'}</span></div>
            <div>Payload Hash: <span style="color:#a855f7;">${result.payloadHash || 'N/A'}</span></div>
            <div>Signer Fingerprint: <span style="color:#38bdf8;">${result.publicKeyId || 'N/A'}</span></div>
            <div>Signer Trust: <span style="color:${result.signerTrust === 'TRUSTED' ? '#4ade80' : '#facc15'};">${result.signerTrust || 'UNVERIFIED'}</span></div>
            <div>Audit Hash Chain: <span style="color:${result.auditChain === 'VALID' ? '#4ade80' : '#94a3b8'};">${result.auditChain || 'UNAVAILABLE'}</span></div>
            <div>Release Authorization: <span style="color:${result.releaseAuthorization === 'RECORDED' ? '#4ade80' : '#f59e0b'};">${result.releaseAuthorization || 'NOT ESTABLISHED'}</span></div>
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid #1e293b;color:#94a3b8;">${result.reason}</div>
          </div>
        `;
      }
      await showToast(result.valid ? `Digital seal verified · ${result.payloadHash.slice(0, 16)}…` : result.reason);
    } catch (error) {
      await showToast(error.message);
    } finally {
      sealButton.disabled = false;
    }
  }

  const findingButton = event.target.closest('[data-action="proof"]');
  if (findingButton) {
    const findingId = findingButton.dataset.id;
    const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
    if (reviewId) {
      setTimeout(async () => {
        const response = await fetch(`/api/reviews/${reviewId}`);
        if (!response.ok) return;
        const review = await response.json();
        const followUps = (review.followUps || []).filter(item => item.findingId === findingId);
        const content = document.querySelector('#dialog .dialog-content');
        const actions = content?.querySelector('.finding-actions');
        const questionForm = actions?.querySelector('[data-question-form]');
        if (!actions || !questionForm || !followUps.length) return;
        for (const item of followUps) {
          const article = document.createElement('article');
          article.className = 'evidence-card';
          const question = document.createElement('b');
          question.textContent = item.question;
          const answer = document.createElement('p');
          answer.textContent = item.answer;
          article.append(question, answer);
          actions.insertBefore(article, questionForm);
        }
      }, 0);
    }
  }

  // Remediation Studio Handlers (Phase 1 & Phase 8)
  const remBtn = event.target.closest('[data-action="generate-suggested-fix"], [data-action="auto-fix"], [data-action="create-correction-ticket"]');
  if (remBtn) {
    const findingId = remBtn.dataset.id;
    const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
    if (!reviewId || !findingId) return;

    const isTicketAction = remBtn.dataset.action === 'create-correction-ticket';
    const originalText = remBtn.textContent;
    remBtn.disabled = true;
    remBtn.textContent = isTicketAction ? '📋 Creating Ticket…' : '✨ Generating Fix…';

    try {
      // Find mount element
      let mount = document.querySelector(`#remediation-slot-${findingId}`);
      if (!mount) mount = document.querySelector('#workbench-remediation-mount');
      if (!mount) {
        mount = document.createElement('div');
        mount.id = `remediation-slot-${findingId}`;
        remBtn.parentElement?.after(mount);
      }

      mount.innerHTML = `
        <div class="panel notice info" style="margin-top:12px">
          <strong>✨ Packaging Remediation Studio:</strong><br>
          Retrieving approved specifications, verified rules, and generating bounded proposed fix…
        </div>
      `;

      const csrfToken = window.__PACKSIGNAL_CSRF || (await fetch('/api/status').then(r => r.json()).then(s => s.csrf).catch(() => ''));
      const response = await fetch(`/api/reviews/${reviewId}/findings/${findingId}/remediation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-packproof-token': csrfToken,
        },
        body: JSON.stringify({ forceTicket: isTicketAction }),
      });
      const proposal = await response.json();
      if (!response.ok) throw new Error(proposal.error || 'Failed to generate proposal.');

      // Fetch review to pass finding object
      const revResp = await fetch(`/api/reviews/${reviewId}`);
      const reviewData = await revResp.json();
      const finding = (reviewData.findings || []).find(f => f.id === findingId) || { id: findingId, title: 'Inspection Finding' };

      const { renderRemediationStudio, mountRemediationStudio } = await import('/remediation-studio.js');
      mount.innerHTML = renderRemediationStudio(finding, proposal);
      mountRemediationStudio(mount, {
        reviewId,
        findingId,
        onUpdate: updated => {
          mount.innerHTML = renderRemediationStudio(finding, updated);
          mountRemediationStudio(mount, { reviewId, findingId });
        },
      });

      mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await showToast(proposal.mode === 'DESIGN_TICKET' ? 'Designer correction ticket ready for Illustrator/ArtPro+.' : 'Suggested fix generated for reviewer evaluation.');
    } catch (err) {
      await showToast(err.message);
    } finally {
      remBtn.disabled = false;
      remBtn.textContent = originalText;
    }
  }

  // Ask Someone Communication Assistant Handler
  const askBtn = event.target.closest('[data-action="ask-someone"]');
  if (askBtn) {
    const findingId = askBtn.dataset.id;
    const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
    if (findingId) {
      try {
        let reviewData = window.__PACKSIGNAL_CURRENT_REVIEW;
        if (!reviewData && reviewId) {
          const resp = await fetch(`/api/reviews/${reviewId}`);
          if (resp.ok) reviewData = await resp.json();
        }
        const finding = (reviewData?.findings || []).find(f => f.id === findingId) || { id: findingId, title: 'Packaging Finding' };
        const { openAskSomeoneModal } = await import('/ask-someone.js');
        openAskSomeoneModal(finding, reviewData || { id: reviewId });
      } catch (err) {
        console.error('Failed to open Ask Someone modal:', err);
      }
    }
  }
});
