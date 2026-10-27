# PackSignal — Production Security Architecture & Threat Model Notes

This document details the DevSecOps controls, threat modeling, and residual security constraints engineered into PackSignal.

---

## 1. Access Control & Fail-Closed Authentication

### Fail-Closed Principle
PackSignal treats uploaded packaging artwork and specifications as confidential commercial assets. The application implements a fail-closed access architecture:
- If running in production (`NODE_ENV=production`) without configured authentication credentials, the server **refuses to launch or defaults to an access-restricted state**, preventing an accidental public upload exposure.
- Authentication modes supported:
  1. **Password Gate**: Single-tenant or hackathon review access via `PACKPROOF_ACCESS_USER` and `PACKPROOF_ACCESS_PASSWORD`.
  2. **Named Team Authentication**: Role-based reviewer tokens via `PACKPROOF_TEAM_USERS` with auditable user attribution for finding approvals.

### Public vs Protected Surface Area
| Endpoint | Access Level | Data Disclosed |
|---|---|---|
| `GET /` | Public / Preview | Application UI shell, static asset bundles |
| `GET /healthz` | Public (Hosting) | Minimal `{ "ok": true }` (process liveness only) |
| `GET /api/status` | Protected / Token | Operational metadata, sanitised capabilities (no keys) |
| `POST /api/reviews` | Authenticated | Uploads confidential artwork; requires CSRF token |
| `GET /api/reviews/:id` | Authenticated | Review findings, evidence coordinates, notes |
| `POST /api/reviews/:id/decision` | Authenticated | Reviewer approvals; logs tamper-evident audit record |
| `GET /api/reviews/:id/report.json` | Authenticated | Full Ed25519-signed verification audit report |

---

## 2. Request Security & Anti-CSRF Architecture

- **Double-Submit Cookie / Header Token**: Every mutating request (`POST`, `PUT`, `DELETE`, `PATCH`) must supply the `x-packproof-token` HTTP header matching the server-issued cryptographic token.
- **HTTP Security Headers**:
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:;`
  - `X-Content-Type-Options: nosniff` (prevents MIME-type confusion attacks)
  - `X-Frame-Options: DENY` (prevents clickjacking)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cache-Control: no-store, max-age=0` on sensitive review routes to prevent shared intermediary caching.

---

## 3. Untrusted Document Parsing & Subprocess Isolation

Packaging files (PDFs, Excel spreadsheets, Word DOCX) submitted by external vendors are untrusted by definition. PackSignal applies defensive ingestion controls:

### Safe Subprocess Ingestion
- Document parsing runs in a dedicated Python worker process (`lib/extract.py`).
- **Zero Shell Interpolation**: Subprocesses are invoked via `child_process.spawn()` with explicit arguments array (`['python3', 'lib/extract.py', '--file', targetPath]`), eliminating shell injection (`$()`, `;`, `&&`).
- **Timeout Watchdog**: Subprocesses are terminated if execution exceeds 30 seconds, preventing CPU exhaustion via algorithmic complexity attacks.
- **Temporary Scratch Directories**: Each review executes within an isolated, randomized temporary directory; scratch files are securely unlinked upon review completion.

### File Format Defenses
- **PDF Ingestion**: Uses `pypdfium2` and `fitz` for vector object inspection. JavaScript execution in PDFs is disabled; embedded action scripts are ignored.
- **Spreadsheet Security**: Uses `openpyxl` with XML entity resolution disabled to prevent XML External Entity (XXE) and billion-laughs expansion attacks.
- **Path Traversal Protection**: Uploaded filenames are sanitized (`path.basename()`), stripped of directory traversal sequences (`../`, `..\\`), and assigned random UUID storage identifiers.

---

## 4. Server-Side AI Secret Protection

- **Zero Client-Side Leaks**: Google Gemini API credentials (`GEMINI_API_KEY`) are read strictly within Node.js process memory (`process.env`).
- **Bundle Auditing**: Client-side JavaScript bundles (`public/app.js`, `public/artwork-ui.js`, etc.) contain zero references to API keys or raw auth credentials.
- **Error Sanitization**: API failure exceptions caught in `lib/gemini-transport.mjs` strip request headers and authorization strings before returning human-readable error messages to the client.

---

## 5. Audit Trail & Cryptographic Non-Repudiation

- **Ed25519 Asymmetric Signatures**: Each finalized review report calculates a SHA-256 Merkle root across all finding evidence, reviewer decisions, and source documents, which is then signed with an Ed25519 private key.
- **Independent Offline Verification**: Anyone in possession of the public key can verify the authenticity and unaltered integrity of the report using `node scripts/verify-report.mjs <report-file>`.

---

## 6. Threat Model Residual Risks & Boundaries

1. **Authentication Mode**: Basic password / token authentication is designed for controlled hackathon review and staging deployments. Production enterprise deployments should integrate an enterprise Identity Provider (IdP) with SAML 2.0 / OIDC.
2. **Subprocess Isolation**: While Python workers run with timeouts and bounded arguments, full containerized virtualization (e.g., gVisor, Firecracker microVMs) is recommended when processing completely untrusted public submissions at massive scale.
3. **No Legal Certification**: PackSignal establishes technical and discrepancy evidence; the software explicitly does not claim legal certification or guaranteed print readiness.
