# PackSignal — Hosted Deployment Reliability & Pre-Flight Checklist

This checklist establishes the deployment readiness standards for PackSignal on hosted cloud platforms (e.g., Render, AWS, Docker containers). Every criterion must be verified prior to staging or production use.

---

## 1. Hosting Environment & Infrastructure Baseline

- [x] **Container Runtime**: Dockerized Linux Debian / Alpine with Node.js >= 24.0.0 and Python 3.11+.
- [x] **Python Dependency Isolation**: PyMuPDF (`fitz`), `pypdfium2`, `openpyxl`, `python-docx`, `pillow`, `zxing-cpp` installed via virtualenv / container layer.
- [x] **Persistent Storage Volume**:
  - Mounted volume at `/var/data` (configured via `PACKPROOF_DATA_DIR` or `PACKPROOF_PERSISTENT_STORAGE_PATH`).
  - Atomic rename (`.tmp` -> target file) ensures zero partial-write corruption.
  - In-process mutex queue prevents concurrent write race conditions.
- [x] **Deployment Blueprint**: `render.yaml` declares web service, persistent disk mount (`/var/data`, 10GB minimum), health check path (`/healthz`), and environment variables.

---

## 2. Security & Access Gate Standards

- [x] **Fail-Closed Authentication**:
  - Unauthenticated requests cannot upload confidential artwork or modify review records.
  - Environment flags: `PACKPROOF_REQUIRE_AUTH=true`, `PACKPROOF_ACCESS_USER`, `PACKPROOF_ACCESS_PASSWORD`, or `PACKPROOF_TEAM_USERS`.
  - Missing authentication configuration fails safe: disables anonymous public write access.
- [x] **Public Health Endpoint (`GET /healthz`)**:
  - Responds with minimal `{ "ok": true }`.
  - Discloses zero API keys, reviewer names, storage paths, or stack traces.
  - Independent of Gemini API liveness: external AI outages do not cause container flapping or restarts.
- [x] **Authenticated Status Endpoint (`GET /api/status`)**:
  - Requires session / CSRF token.
  - Discloses safe operational status (`aiConfigured: boolean`, upload limits, capabilities).
  - Strictly distinguishes `AI_CONFIGURED` from `AI_LIVE_VERIFIED`.
  - Never leaks raw credentials or password hashes.
- [x] **CSRF & Security Headers**:
  - Double-submit CSRF token (`x-packproof-token`) enforced on all mutating HTTP methods (`POST`, `PUT`, `DELETE`).
  - Security headers present: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self' ...`, `Strict-Transport-Security`.
- [x] **Server-Side AI Secrets Protection**:
  - Gemini API credentials read solely from environment (`process.env.GEMINI_API_KEY`).
  - Completely absent from browser JavaScript bundles, public API responses, error logs, and CI artifacts.

---

## 3. Resource & Upload Safety Bounds

- [x] **File Size Bounds**:
  - Max single file upload: 60 MB.
  - Max total request payload: 120 MB.
  - Reject payloads exceeding limits immediately with `413 Payload Too Large`.
- [x] **Subprocess Worker Isolation**:
  - Document extraction worker (`lib/extract.py`) invoked via `child_process.spawn` with explicit argument arrays (zero shell interpolation).
  - Execution timeout bounded (30-second kill switch) to prevent infinite loops on malformed PDFs.
  - Isolated temporary scratch directories cleaned up automatically post-extraction.
- [x] **Spreadsheet & PDF Safety**:
  - Untrusted spreadsheet XML parsed without entity resolution (XXE prevention).
  - JavaScript execution in PDFs disabled (`pypdfium2` / `fitz` vector object inspection only).

---

## 4. Cryptographic Integrity & Backup Retention

- [x] **Ed25519 Signing Keys**:
  - Asymmetric private key stored in `/var/data/keys/review-signing.pem` with `0600` permissions.
  - Stable key persistence ensures review signatures remain verifiable across container restarts.
- [x] **Signed Report Verification**:
  - Exported JSON reports include Ed25519 signature and SHA-256 evidence Merkle tree.
  - Independent verification executable offline via `scripts/verify-report.mjs`.
- [x] **Retention Policy**:
  - Transient preview renders deleted upon session completion.
  - Review records, audit logs, and signatures retained in persistent storage until explicitly archived by reviewer.

---

## 5. Verification Commands

Run the automated deployment readiness check before signing off on any environment:

```bash
# Full automated pre-deployment verification
npm run verify:deployment

# Full judge-path preflight audit
npm run demo:check

# End-to-end browser regression suite
npx playwright test
```
