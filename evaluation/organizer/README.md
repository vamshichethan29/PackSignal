# PackSignal Organizer Verification Suite

## Overview
This directory contains the independent, evidence-driven investigation of the official Esko AIForge hackathon packaging samples:
- `samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf`
- `samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx`

## Core Principle
**AI reads and proposes. Deterministic code verifies and compares. Humans resolve ambiguity.**

Competitor answer keys are authored test fixtures and hypotheses, not ground truth. Furthermore, the organizer spreadsheet bears the status **"Draft / In Review"** in cell `E3`. Therefore, differences between the spreadsheet and carton are classified as `SOURCE_ARTWORK_MISMATCH` or `REVIEW`, never automatic regulatory violations.

## Files
- `candidate-checks.json`: Full evidence schema for all candidate checks (Phase 2 model).
- `verified-observations.json`: Observations with cell coordinates, panel locations, and calculation proofs.
- `results.json`: Full output of the verification run including manifest SHA-256 checks, PDF structure occlusion analysis, ingredient diffs, Daily Value arithmetic, and rulebook ledger.

## Execution
Run the verification suite via:
```bash
npm run evaluate:organizer
```
