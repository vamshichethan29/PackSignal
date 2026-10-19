const esc = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function latestByReviewer(approvals) {
  const latest = new Map();
  for (const approval of approvals) latest.set(approval.reviewerId, approval);
  return [...latest.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export function teamReviewView(review, finding, appStatus) {
  const teamStatus = appStatus?.team;
  if (!teamStatus?.enabled) {
    return `<section class="panel team-review"><div class="eyebrow">TEAM REVIEW</div><h3>Assignments and separate sign-offs</h3><p class="subtle">Named reviewer accounts enable individual assignments, evidence comments, and separate sign-offs.</p></section>`;
  }
  const user = teamStatus.currentUser;
  const reviewers = teamStatus.members.filter(member => member.role === 'reviewer');
  const assignment = review.team?.assignments?.[finding.id]?.reviewerIds || [];
  const canAssign = review.teamAccess?.canAssign === true;
  const canContribute = user.role === 'admin' || review.team?.createdBy === user.id || assignment.includes(user.id);
  const comments = (review.team?.comments || []).filter(comment => comment.findingId === finding.id).sort((a, b) => a.at.localeCompare(b.at));
  const approvals = latestByReviewer((review.team?.approvals || []).filter(approval => approval.findingId === finding.id));
  const outcomeLabels = { approved: 'Approved by reviewer', needs_changes: 'Changes requested', abstain: 'Abstained' };
  const outcomeNames = { approved: 'Approve', needs_changes: 'Request changes', abstain: 'Abstain' };
  const approvalRows = approvals.map(approval => `<article class="team-approval ${approval.stale ? 'stale' : ''}"><div><b>${esc(approval.reviewerName)}</b><span class="pill ${approval.outcome === 'approved' ? 'match' : approval.outcome === 'needs_changes' ? 'issue' : 'review'}">${esc(outcomeNames[approval.outcome] || approval.outcome)}</span></div><p>${esc(approval.note)}</p><small>${esc(new Date(approval.at).toLocaleString())}${approval.stale ? ' · recheck required after evidence changed' : ''}</small></article>`).join('');
  const commentRows = comments.map(comment => `<article class="team-comment"><div class="team-byline"><b>${esc(comment.authorName)}</b><time>${esc(new Date(comment.at).toLocaleString())}${comment.stale ? ' · evidence changed since comment' : ''}</time></div>${comment.evidence ? `<small>${esc(comment.evidence.role)} · ${esc(comment.evidence.name)} · ${esc(comment.evidence.location)}</small><blockquote>${esc(comment.evidence.quote || 'Evidence location attached')}</blockquote>` : '<small>Finding-level comment</small>'}<p>${esc(comment.comment)}</p></article>`).join('');
  const assignmentForm = canAssign ? `<form class="team-form" data-team-form="assignments" data-finding-id="${esc(finding.id)}"><fieldset><legend>Assigned reviewers</legend><div class="team-reviewers">${reviewers.map(member => `<label><input type="checkbox" name="reviewerIds" value="${esc(member.id)}" ${assignment.includes(member.id) ? 'checked' : ''}><span>${esc(member.displayName)}</span></label>`).join('') || '<small>No reviewer accounts configured.</small>'}</div><button class="secondary" type="submit">Save assignment</button></fieldset><p class="team-form-error" data-team-error role="alert"></p></form>` : `<p class="subtle">Assigned to: ${assignment.map(id => esc(reviewers.find(member => member.id === id)?.displayName || id)).join(', ') || 'No reviewer yet'}</p>`;
  const commentForm = canContribute ? `<form class="team-form" data-team-form="comments" data-finding-id="${esc(finding.id)}"><label for="team-evidence-${esc(finding.id)}">Comment on evidence</label><select id="team-evidence-${esc(finding.id)}" name="evidenceIndex"><option value="">Finding-level note</option>${finding.evidence.map((evidence, index) => `<option value="${index}">${esc(evidence.role)} · ${esc(evidence.name)} · ${esc(evidence.location)}${evidence.quote ? ` — ${esc(evidence.quote.slice(0, 100))}` : ''}</option>`).join('')}</select><textarea name="comment" required minlength="2" maxlength="2000" placeholder="Add a note about this evidence."></textarea><button class="secondary" type="submit">Add comment</button><p class="team-form-error" data-team-error role="alert"></p></form>` : '<p class="subtle">Only an assigned reviewer or workspace admin can comment on this finding.</p>';
  const approvalForm = canContribute ? `<form class="team-form" data-team-form="approvals" data-finding-id="${esc(finding.id)}"><label for="team-outcome-${esc(finding.id)}">Your independent sign-off</label><select id="team-outcome-${esc(finding.id)}" name="outcome"><option value="approved">Approve this finding</option><option value="needs_changes">Request changes</option><option value="abstain">Abstain</option></select><textarea name="note" required minlength="3" maxlength="2000" placeholder="Explain your sign-off. This is recorded separately from the analysis result."></textarea><button class="primary" type="submit">Record my sign-off</button><p class="team-form-error" data-team-error role="alert"></p></form>` : '';
  return `<section class="panel team-review"><div class="eyebrow">TEAM REVIEW · ${esc(user.displayName)}</div><h3>Assignment and independent sign-off</h3><p class="subtle">Each reviewer’s latest response is recorded separately. A sign-off is reviewer input, not legal or print-release approval.</p>${assignmentForm}<div class="team-approval-list"><h4>Reviewer sign-offs</h4>${approvalRows || '<p class="subtle">No sign-offs recorded for this finding.</p>'}</div>${approvalForm}<div class="team-comments"><h4>Evidence comments</h4>${commentRows || '<p class="subtle">No reviewer comments yet.</p>'}${commentForm}</div></section>`;
}
