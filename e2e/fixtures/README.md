# PackSignal E2E Test Fixtures

This directory contains deterministic, controlled file fixtures for Playwright end-to-end browser testing and regression protection.

## Fixture Inventory

| File | Format | Purpose | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `artwork-revA.pdf` | PDF 1.4 | Revision A artwork with Net Quantity `750 mL` | Mismatch against 1000 mL specification (`issue`) |
| `artwork-revB.pdf` | PDF 1.4 | Revision B artwork with Net Quantity `1000 mL` | Resolution of net quantity discrepancy (`match`) |
| `spec-approved.xlsx` | Excel XLSX | Approved specification: `1000 mL`, storage instructions, manufacturer address, GTIN `012345678905` | Verified source authority |
| `spec-draft.xlsx` | Excel XLSX | Conflicting specification with unconfirmed variants (`750 mL` vs `1000 mL`) | Ambiguity detection and question queue generation (`review`) |
| `rulebook.json` | JSON | Structured packaging compliance ruleset (`21 CFR 101.7`, `Brand Standard S-401`) | Direct rule compilation and quote verification |
| `rulebook.txt` | TXT | Section-delimited compliance text | Rule extraction and quote verification |
| `rulebook.docx` | OpenXML DOCX | Binary Word document packaging guideline | Rule extraction |
| `malformed-rulebook.json`| JSON | Syntax-broken JSON rulebook | Safe error handling without crash |
| `carton-dieline.dxf` | AutoCAD DXF | Minimal dieline with CUT (red) and CREASE (green) layers | Layer classification and 3D unfold preview |
| `corrupt.pdf` | Binary | Corrupt non-PDF stream | Handled safely with user-facing validation error |
| `corrupt.xlsx` | Binary | Invalid ZIP archive pretending to be Excel | Handled safely with user-facing error |
| `empty.pdf` | Binary (0-byte) | Empty file | 400 Bad Request rejection |
| `unsupported.xyz` | Text | Unsupported file extension | Rejection with clear supported file format guidance |

## Integrity Guidelines
- Fixtures do not contain confidential customer data.
- Fixtures are not hardcoded into inference logic.
- Ground truth is evaluated independently through predefined test assertions.
