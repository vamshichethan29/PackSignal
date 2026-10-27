# PackSignal — Production Deployment Readiness Baseline

**Document Version**: 1.0.0  
**Audit Date**: October 2026  
**Repository**: [https://github.com/vamshichethan29/PackSignal](https://github.com/vamshichethan29/PackSignal)  
**Evaluated Commit**: `cd3db9dc2b19422667e8be7f2c87c70d145d6191`  
**Host Target**: Render Cloud Platform (`https://packsignal.onrender.com/`) / Container Runtime

---

## 1. System Runtime & Environmental Baseline

- **Application Name**: PackSignal (`packsignal@1.0.0`)
- **Node.js Runtime**: Node.js `v24.20.0` (ES Modules mode)
- **Python Runtime**: Python `3.9.6` / `3.11+` in Docker image
- **Operating System**: macOS (local development) / Debian Linux (Render Docker container)
- **Primary Dependencies**:
  - Node.js: `@playwright/test`, native `node:crypto`, `node:test`, `node:http`
  - Python: `pymupdf` (fitz), `pypdfium2`, `openpyxl`, `python-docx`, `pillow`, `zxing-cpp`
- **AI Backend**: Google Gemini API (`@google/genai` transport) — strictly optional with deterministic local fallback

---

## 2. Requirement Verification Status & Evidence

Every requirement is audited and recorded with one of the following statuses:
`VERIFIED`, `FAILED`, `UNVERIFIED`, `NOT_APPLICABLE`, `BLOCKED`.

| # | Requirement | Status | Verification Evidence / Inspection Details |
|---|---|---|---|
| **R01** | **Node.js >= 24 Runtime** | `VERIFIED` | `node -v` reports `v24.20.0`. Validated in `scripts/deployment-readiness.mjs`. |
| **R02** | **Python Extraction Runtime** | `VERIFIED` | Python 3 executes `lib/extract.py`. Pytest runs 52 tests with 100% pass rate. |
| **R03** | **Public Health Endpoint (`/healthz`)** | `VERIFIED` | Returns minimal `{ "ok": true }`. Zero secrets, keys, or private review paths exposed. Independent of external Gemini API status. |
| **R04** | **Protected Status Endpoint (`/api/status`)** | `VERIFIED` | Requires CSRF/Session token. Sanitizes credentials; reports `aiConfigured: boolean`, upload bounds, and supported capabilities. Does not conflate `AI_CONFIGURED` with `AI_LIVE_VERIFIED`. |
| **R05** | **Fail-Closed Hosted Authentication** | `VERIFIED` | When `PACKPROOF_REQUIRE_AUTH=true`, unauthenticated `POST /api/reviews` returns `401 Unauthorized`. Verified in `scripts/team-smoke.mjs`. |
| **R06** | **Persistent Storage Mount** | `VERIFIED (Local) / UNVERIFIED (Live Host)` | Local storage path `data/` and Docker mount `/var/data` configured. Verified atomic renaming and write serialization mutex. Restart persistence verified in local tests. Live Render cloud persistent volume attachment remains UNVERIFIED without cloud provider credentials. |
| **R07** | **Storage Failure & Safe Recovery** | `VERIFIED` | Atomic write pattern uses `.tmp` files with rename. Failed writes do not corrupt existing review files. Storage failure halts review creation safely. |
| **R08** | **Server-Side Gemini Secrets Isolation** | `VERIFIED` | `GEMINI_API_KEY` read strictly server-side in Node process. Frontend bundle grep confirms zero API keys in client-side JavaScript. Error logs strip auth headers. |
| **R09** | **Deterministic AI Fallback** | `VERIFIED` | When `GEMINI_API_KEY` is omitted or mock fails, 100% of core checks (net qty, nutrition, barcodes, approved copy) run cleanly. Verified in `e2e/ai-unavailable.spec.mjs`. |
| **R10** | **File Upload Bounds & Resource Limits** | `VERIFIED` | Max file size (60MB) and total payload (120MB) enforced server-side. Subprocess timeouts (30s) prevent infinite loops. |
| **R11** | **Untrusted Document Ingestion Safety** | `VERIFIED` | Subprocess uses explicit argument arrays (`child_process.spawn`), preventing shell injection. PDF scripts disabled. XML entity resolution disabled in `openpyxl`. |
| **R12** | **Double-Submit CSRF & Security Headers** | `VERIFIED` | `x-packproof-token` enforced on mutating routes. CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff present. |
| **R13** | **Ed25519 Tamper-Evident Report Sealing** | `VERIFIED` | Reports signed with Ed25519 asymmetric keys. Verified via `scripts/verify-report.mjs` and `e2e/judge-demo.spec.mjs`. Tampered reports fail verification. |
| **R14** | **End-to-End Browser Regression Suite** | `VERIFIED` | All 23 Playwright test suites pass (100%), including official judge demonstration workflow. |
| **R15** | **Live Render Deployment Smoke** | `UNVERIFIED` | Free-tier host `https://packsignal.onrender.com/` requires remote admin session. Live cloud container verification marked UNVERIFIED to avoid fabricating live connectivity. |

---

## 3. Current Known Limitations

1. **Free-Tier Cold Starts**: On Render free tier, idle containers spin down and take up to 45 seconds to answer initial requests.
2. **Preflight vs Certification**: Preflight provides technical vector/font screening, not legal certification or prepress print warranty.
3. **Draft Ambiguity Safeguard**: The official Dancing Fish spreadsheet contains draft stamps and conflicting nutrition servings; PackSignal intentionally refuses to guess, marking them as `AMBIGUOUS_SOURCE` requiring human reviewer sign-off.
4. **Independent Evaluation Sample**: Reproducible blind review evaluation completed on a controlled pilot of 12 real-world packaging units, not a statistical census.
