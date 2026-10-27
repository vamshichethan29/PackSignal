import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyAuditChain } from './audit-chain.mjs';

const keyPromises = new Map();

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const digest = value => createHash('sha256').update(canonical(value)).digest('hex');

function signedPayloadV1(review) {
  return {
    schema: 'packproof-review-seal/v1',
    review: { id: review.id, createdAt: review.createdAt, finishedAt: review.finishedAt, name: review.name },
    sources: (review.documents || []).map(document => ({
      id: document.id,
      role: document.role,
      name: document.name,
      sha256: document.sha256,
    })),
    options: review.options || {},
    findings: (review.findings || []).map(finding => ({
      id: finding.id,
      status: finding.status,
      expected: finding.expected,
      observed: finding.observed,
      evidence: (finding.evidence || []).map(evidence => ({
        documentId: evidence.documentId,
        quote: evidence.quote,
        page: evidence.page || null,
        box: evidence.box || null,
      })),
    })),
    decisions: review.decisions || {},
    followUps: review.followUps || [],
    revision: review.revision || null,
    auditDigest: digest((review.audit || []).map(entry => ({ at: entry.at, action: entry.action, detail: entry.detail, options: entry.options || null }))),
  };
}

function signedPayloadV2(review) {
  // Capture audit chain head
  const auditEntries = review.audit || [];
  const lastEvent = auditEntries[auditEntries.length - 1];
  const auditChainHead = lastEvent?.eventHash || digest(auditEntries.map(e => ({ at: e.at, action: e.action, detail: e.detail })));

  return {
    schema: 'packproof-review-seal/v2',
    reviewId: review.id,
    reviewRevision: review.reviewRevision || 1,
    name: review.name,
    createdAt: review.createdAt,
    finishedAt: review.finishedAt,
    market: review.market || 'Unspecified',
    engine: review.engine || 'Packaging Intelligence',
    sources: (review.documents || []).map(doc => ({
      id: doc.id,
      role: doc.role,
      name: doc.name,
      sha256: doc.sha256,
      sizeBytes: doc.sizeBytes || null,
    })),
    options: review.options || {},
    findings: (review.findings || []).map(f => ({
      id: f.id,
      ruleId: f.rule?.id || null,
      status: f.status,
      expected: f.expected,
      observed: f.observed,
      method: f.method || null,
      calculationProof: f.calculationProof || f.preflight?.calculationProof || null,
      evidence: (f.evidence || []).map(e => ({
        documentId: e.documentId,
        quote: e.quote,
        page: e.page || null,
        box: e.box || null,
        location: e.location || null,
      })),
    })),
    calculationProofs: {
      atwater: review.deepVerification?.atwaterVerification?.formulaProof || null,
      netQuantity: review.deepVerification?.netQuantityVerification?.calcProof || null,
      nutrition: review.nutrition?.calculations || null,
    },
    prepressResults: (review.pdfPreflight?.findings || []).map(pf => ({
      checkId: pf.check || pf.id,
      status: pf.status,
      measurement: pf.preflight?.measurement || pf.observed,
      threshold: pf.preflight?.threshold || pf.expected,
    })),
    reviewerDecisions: review.decisions || {},
    reviewerSignoffs: (review.team?.approvals || []).map(app => ({
      reviewerId: app.reviewerId,
      reviewerName: app.reviewerName,
      outcome: app.outcome,
      at: app.at,
      note: app.note || '',
    })),
    revision: review.revision ? {
      previousId: review.revision.previousId || review.parentId || null,
      kind: review.revision.kind || 'artwork',
      summary: review.revision.intelligence?.summaryText || null,
      changesCount: review.revision.changes?.length || 0,
    } : null,
    auditChainHead,
    auditEventCount: auditEntries.length,
    ...(Array.isArray(review.ghostRegions) && review.ghostRegions.length > 0 ? {
      missingDeclarationPlacementReview: review.ghostRegions.map(g => ({
        ghostId: g.ghostId,
        findingId: g.findingId,
        declarationType: g.declarationType,
        authorityCitation: g.authorityCitation || null,
        jurisdiction: g.jurisdiction || 'US',
        panelRole: g.selectedPanel || null,
        panelFace: g.selectedFace || null,
        placementAuthority: g.placementAuthority || g.panelAuthority || 'VERIFIED_STATUTORY',
        legalBounds: g.legalRegion?.normalizedBounds || null,
        suggestedBounds: g.suggestedPlacement?.normalizedBounds || null,
        verificationState: g.verificationState || null,
      }))
    } : {}),
  };
}

export function signedPayload(review, version = 'v2') {
  if (version === 'v1' || review?.signature?.schema === 'packproof-review-seal/v1') {
    return signedPayloadV1(review);
  }
  return signedPayloadV2(review);
}

export function resetKeyCache(storage) {
  if (storage) keyPromises.delete(storage);
  else keyPromises.clear();
}

async function signingKeys(storage) {
  if (keyPromises.has(storage)) return keyPromises.get(storage);
  const pending = readOrCreateSigningKeys(storage).catch(error => {
    keyPromises.delete(storage);
    throw error;
  });
  keyPromises.set(storage, pending);
  return pending;
}

async function readOrCreateSigningKeys(storage) {
  const keyDirectory = join(storage, 'keys');
  const privatePath = join(keyDirectory, 'review-seal-private.pem');
  const publicPath = join(keyDirectory, 'review-seal-public.pem');
  await mkdir(keyDirectory, { recursive: true, mode: 0o700 });

  const hasPrivate = existsSync(privatePath);
  const hasPublic = existsSync(publicPath);

  if (!hasPrivate && !hasPublic) {
    const pair = generateKeyPairSync('ed25519');
    await writeFile(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    await writeFile(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
    return { privateKey: await readFile(privatePath, 'utf8'), publicKey: await readFile(publicPath, 'utf8') };
  }

  if (hasPrivate && !hasPublic) {
    const privPem = await readFile(privatePath, 'utf8');
    const pubKeyObj = createPublicKey(privPem);
    const pubPem = pubKeyObj.export({ type: 'spki', format: 'pem' });
    await writeFile(publicPath, pubPem, { mode: 0o644 });
    return { privateKey: privPem, publicKey: pubPem };
  }

  if (!hasPrivate && hasPublic) {
    throw new Error('Key management safety error: Private key file is missing while public key exists. Refusing to silently overwrite existing keys.');
  }

  return { privateKey: await readFile(privatePath, 'utf8'), publicKey: await readFile(publicPath, 'utf8') };
}

export async function rotateSigningKeys(storage) {
  const keyDirectory = join(storage, 'keys');
  const privatePath = join(keyDirectory, 'review-seal-private.pem');
  const publicPath = join(keyDirectory, 'review-seal-public.pem');
  await mkdir(keyDirectory, { recursive: true, mode: 0o700 });

  if (existsSync(privatePath) && existsSync(publicPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = join(keyDirectory, 'archived', ts);
    await mkdir(archiveDir, { recursive: true, mode: 0o700 });
    const oldPriv = await readFile(privatePath, 'utf8');
    const oldPub = await readFile(publicPath, 'utf8');
    await writeFile(join(archiveDir, 'review-seal-private.pem'), oldPriv, { mode: 0o600 });
    await writeFile(join(archiveDir, 'review-seal-public.pem'), oldPub, { mode: 0o644 });
  }

  const pair = generateKeyPairSync('ed25519');
  await writeFile(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  await writeFile(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
  keyPromises.delete(storage);
  return {
    privateKey: await readFile(privatePath, 'utf8'),
    publicKey: await readFile(publicPath, 'utf8'),
    rotatedAt: new Date().toISOString(),
  };
}

export async function sealReview(review, storage, options = {}) {
  const keys = await signingKeys(storage);
  const schemaVersion = options.schemaVersion || 'v2';
  const payload = schemaVersion === 'v1' ? signedPayloadV1(review) : signedPayloadV2(review);
  const payloadHash = digest(payload);
  const publicKeyId = createHash('sha256').update(keys.publicKey).digest('hex').slice(0, 16);
  return {
    algorithm: 'Ed25519',
    schema: payload.schema,
    payloadHash,
    publicKeyId,
    publicKey: keys.publicKey,
    signature: sign(null, Buffer.from(canonical(payload)), keys.privateKey).toString('base64'),
    sealedAt: new Date().toISOString(),
  };
}

export function reviewSealProof(review) {
  const schemaVersion = review?.signature?.schema === 'packproof-review-seal/v1' ? 'v1' : 'v2';
  const payload = schemaVersion === 'v1' ? signedPayloadV1(review) : signedPayloadV2(review);
  return { canonicalPayload: canonical(payload), payloadHash: digest(payload) };
}

export function verifyPortableSealProof(proof) {
  try {
    if (!proof?.publicKey || !proof?.signature || proof.algorithm !== 'Ed25519') {
      return { valid: false, reason: 'The portable signature proof is incomplete.' };
    }
    const keyId = createHash('sha256').update(proof.publicKey).digest('hex').slice(0, 16);
    const payloadHash = createHash('sha256').update(proof.canonicalPayload).digest('hex');
    const valid = keyId === proof.publicKeyId
      && payloadHash === proof.payloadHash
      && verify(null, Buffer.from(proof.canonicalPayload), proof.publicKey, Buffer.from(proof.signature, 'base64'));
    return {
      valid,
      reason: valid ? 'The Ed25519 signature matches the included canonical payload.' : 'The payload, key fingerprint, or signature does not match.',
      publicKeyId: keyId,
      payloadHash,
      schema: proof.schema || (proof.canonicalPayload?.includes('packproof-review-seal/v2') ? 'packproof-review-seal/v2' : 'packproof-review-seal/v1'),
    };
  } catch {
    return { valid: false, reason: 'The portable signature proof is malformed.' };
  }
}

export async function verifyReviewSeal(review, storage) {
  const seal = review.signature;
  if (!seal?.signature || !['packproof-review-seal/v1', 'packproof-review-seal/v2'].includes(seal.schema)) {
    return { valid: false, reason: 'No current signed seal is attached to this review.' };
  }
  const keys = await signingKeys(storage);
  const proof = { ...reviewSealProof(review), ...seal };
  const portable = verifyPortableSealProof(proof);
  const isTrusted = seal.publicKey === keys.publicKey;
  const valid = isTrusted && portable.valid;

  let auditChainStatus = 'UNAVAILABLE';
  if (review.audit && Array.isArray(review.audit)) {
    const auditRes = verifyAuditChain(review.audit);
    auditChainStatus = auditRes.valid ? 'VALID' : 'INVALID';
  }

  const hasSignoffs = (review.team?.approvals || []).length > 0;
  const releaseAuthorization = hasSignoffs ? 'RECORDED' : 'NOT ESTABLISHED';

  return {
    valid,
    reason: valid ? 'The signed payload matches the current source hashes, findings, decisions and audit digest.' : 'The review changed after its last seal or the signature is invalid.',
    algorithm: seal.algorithm,
    payloadHash: seal.payloadHash,
    publicKeyId: seal.publicKeyId,
    sealedAt: seal.sealedAt,
    schema: seal.schema,
    signerTrust: isTrusted ? 'TRUSTED' : 'UNVERIFIED',
    auditChain: auditChainStatus,
    releaseAuthorization,
    attachmentsCount: (review.documents || []).length,
  };
}
