import { createHash, randomUUID } from 'node:crypto';

export const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const sha256Hex = value =>
  createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');

const GENESIS_PREV_HASH = '0'.repeat(64);

/**
 * Computes canonical hash of an audit event including previous event hash
 */
export function computeEventHash(event) {
  const payload = {
    sequence: event.sequence,
    timestampUTC: event.timestampUTC,
    actorId: event.actorId,
    actorName: event.actorName,
    actorType: event.actorType,
    action: event.action,
    targetType: event.targetType || 'review',
    targetId: event.targetId || null,
    safeDetails: event.safeDetails !== undefined ? event.safeDetails : (event.detail || ''),
    previousEventHash: event.previousEventHash || GENESIS_PREV_HASH,
  };
  return sha256Hex(payload);
}

/**
 * Normalizes an actor into standard actorId, actorName, actorType
 */
export function resolveActor(actor, teamEnabled = false) {
  if (!actor) {
    return {
      actorId: 'system',
      actorName: 'PackSignal System',
      actorType: 'system',
    };
  }
  if (actor.id === 'system') {
    return {
      actorId: 'system',
      actorName: actor.displayName || 'PackSignal System',
      actorType: 'system',
    };
  }
  // Check if authenticated via team users or legacy admin
  if (teamEnabled || actor.role === 'admin' || actor.role === 'reviewer') {
    return {
      actorId: actor.id || 'authenticated_user',
      actorName: actor.displayName || actor.username || 'Authenticated Reviewer',
      actorType: 'authenticated_user',
    };
  }
  // Otherwise unauthenticated local demonstration
  return {
    actorId: actor.id || 'local-demo',
    actorName: actor.displayName || 'Local Operator',
    actorType: 'unauthenticated_local_demo',
  };
}

/**
 * Appends a tamper-evident audit event to review.audit
 */
export function appendAuditEvent(review, eventInput, actor = null, teamEnabled = false) {
  review.audit ||= [];
  const resolvedActor = resolveActor(actor, teamEnabled);
  const now = new Date().toISOString();
  const sequence = review.audit.length + 1;
  const previousEvent = review.audit.length > 0 ? review.audit[review.audit.length - 1] : null;
  const previousEventHash = previousEvent?.eventHash || (previousEvent ? computeEventHash(previousEvent) : GENESIS_PREV_HASH);

  const action = typeof eventInput === 'string' ? eventInput : eventInput.action;
  const detail = typeof eventInput === 'string' ? (arguments[3] || '') : (eventInput.detail || eventInput.safeDetails || '');
  const targetType = typeof eventInput === 'object' ? (eventInput.targetType || 'review') : 'review';
  const targetId = typeof eventInput === 'object' ? (eventInput.targetId || review.id) : review.id;
  const options = typeof eventInput === 'object' ? eventInput.options : undefined;

  const event = {
    eventId: randomUUID(),
    reviewId: review.id,
    sequence,
    timestampUTC: now,
    // Maintain legacy fields for compatibility
    at: now,
    action,
    detail,
    ...(options ? { options } : {}),
    // Chained tamper-evident fields
    actorId: resolvedActor.actorId,
    actorName: resolvedActor.actorName,
    actorType: resolvedActor.actorType,
    targetType,
    targetId,
    safeDetails: detail,
    previousEventHash,
  };

  event.eventHash = computeEventHash(event);
  review.audit.push(event);
  return event;
}

/**
 * Chains an entire audit trail if legacy events exist without hashes
 */
export function chainAuditTrail(auditTrail, reviewId = 'unknown') {
  if (!Array.isArray(auditTrail)) return [];
  let previousHash = GENESIS_PREV_HASH;
  return auditTrail.map((entry, index) => {
    const sequence = index + 1;
    const timestampUTC = entry.timestampUTC || entry.at || new Date().toISOString();
    const actorId = entry.actorId || (entry.actorName ? 'demo-user' : 'system');
    const actorName = entry.actorName || (entry.actorId ? entry.actorId : 'System');
    const actorType = entry.actorType || (entry.actorId === 'system' ? 'system' : 'unauthenticated_local_demo');
    const action = entry.action || 'unknown_action';
    const detail = entry.safeDetails !== undefined ? entry.safeDetails : (entry.detail || '');
    const targetType = entry.targetType || 'review';
    const targetId = entry.targetId || reviewId;

    const chained = {
      eventId: entry.eventId || randomUUID(),
      reviewId: entry.reviewId || reviewId,
      sequence,
      timestampUTC,
      at: timestampUTC,
      actorId,
      actorName,
      actorType,
      action,
      targetType,
      targetId,
      detail,
      safeDetails: detail,
      ...(entry.options ? { options: entry.options } : {}),
      previousEventHash: previousHash,
    };
    chained.eventHash = computeEventHash(chained);
    previousHash = chained.eventHash;
    return chained;
  });
}

/**
 * Verifies that an audit chain is continuous, validly hashed, and untampered
 */
export function verifyAuditChain(auditTrail) {
  if (!Array.isArray(auditTrail) || auditTrail.length === 0) {
    return { valid: true, reason: 'Empty audit trail is trivially valid.', length: 0, finalHash: GENESIS_PREV_HASH };
  }

  let previousHash = GENESIS_PREV_HASH;
  for (let i = 0; i < auditTrail.length; i += 1) {
    const event = auditTrail[i];
    const expectedSequence = i + 1;

    if (event.sequence !== undefined && event.sequence !== expectedSequence) {
      return {
        valid: false,
        reason: `Audit event at index ${i} has out-of-order sequence: expected ${expectedSequence}, got ${event.sequence}.`,
        failedIndex: i,
      };
    }

    if (event.previousEventHash !== previousHash) {
      return {
        valid: false,
        reason: `Audit chain broken at sequence ${expectedSequence}: previousEventHash mismatch.`,
        failedIndex: i,
      };
    }

    const calculatedHash = computeEventHash(event);
    if (event.eventHash && event.eventHash !== calculatedHash) {
      return {
        valid: false,
        reason: `Audit event hash at sequence ${expectedSequence} has been tampered with.`,
        failedIndex: i,
      };
    }

    previousHash = calculatedHash;
  }

  return {
    valid: true,
    reason: 'All audit events are sequentially chained and cryptographically valid.',
    length: auditTrail.length,
    finalHash: previousHash,
  };
}
