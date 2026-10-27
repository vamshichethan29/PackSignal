# PackSignal Independent Mini-Evaluation Report

**Evaluation Status**: COMPLETED  
**Date**: 2026-10-24  
**Evaluated Commit**: `cd3db9dc2b19422667e8be7f2c87c70d145d6191`  
**Protocol Version**: `1.0.0` (Frozen SHA-256: `cd225fae64ed8a2c...`)

---

## 1. Executive Summary & Independence Declaration
This independent pilot mini-evaluation assessed PackSignal using **three previously unseen packaging sets** (one genuinely mismatched set, one clean set, and one ambiguous/draft specification set). 

A qualified independent packaging quality specialist performed a blind pre-app inspection of the original files prior to opening PackSignal. All evaluation units, scoring formulas, and acceptance criteria were frozen in `protocol.json` before model predictions were revealed.

> [!IMPORTANT]
> **Pilot Sample Size Disclosure**: This evaluation includes 3 packaging sets and 12 evaluable units. These results describe performance on the included supported checks and must not be cited as a general commercial accuracy guarantee.

---

## 2. Core Detection & Verification Metrics

| Metric | Result | Numerator / Denominator | Notes |
| :--- | :--- | :--- | :--- |
| **Supported Defects Detected (TP)** | **1** | — | Real discrepancies caught with verified evidence |
| **False Alarms on Clean Copy (FP)** | **2** | — | Definite issues incorrectly declared on matching copy |
| **Supported Defects Missed (FN)** | **2** | — | Discrepancies missed by automated detection |
| **Clean Matches Verified (TN)** | **5** | — | Correctly verified clean checks |
| **Precision** | **33.3%** | `1 / 3` | Undefined if denominator is 0 |
| **Recall** | **33.3%** | `1 / 3` | Undefined if denominator is 0 |
| **F1 Score** | **33.3%** | — | Harmonic mean of precision and recall |

---

## 3. Ambiguity & Uncertainty Handling

| Ambiguity Metric | Count | Evaluation Interpretation |
| :--- | :--- | :--- |
| **Correct Abstentions** | **1** | Correctly requested human review on unapproved/draft sources |
| **Unsafe Definitive Issues** | **0** | Prematurely asserted an issue on ambiguous source evidence |
| **Unsupported Matches** | **0** | Prematurely asserted a match on ambiguous source evidence |

---

## 4. Evidence Traceability & Quality

- **Source Evidence Correctness**: `9 / 12` (75%)
- **Artwork Evidence Correctness**: `8 / 12` (67%)
- **Rule Evidence Correctness**: `12 / 12` (100%)

---

## 5. Transparent Unit-by-Unit Scoring Table

| Unit ID | Case ID | Check Name | Reviewer Ground Truth | PackSignal Result | Scoring Outcome | Evidence Quality | Diagnostic Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `U-01-01` | `CASE-01` | Net Quantity Equivalence | **ISSUE** | `issue` | **TP** | Source: CORRECT, Art: CORRECT | True Positive: PackSignal reported a definite issue with matching discrepancy and verified traceable evidence. |
| `U-01-02` | `CASE-01` | Sodium %DV | **ISSUE** | `unable` | **FN** | Source: NOT_AVAILABLE, Art: NOT_AVAILABLE | False Negative: Reviewer identified issue, but PackSignal reported unable. |
| `U-01-03` | `CASE-01` | Calories Sanity | **ISSUE** | `unable` | **FN** | Source: NOT_AVAILABLE, Art: NOT_AVAILABLE | False Negative: Reviewer identified issue, but PackSignal reported unable. |
| `U-01-04` | `CASE-01` | Ingredients List Wording | **MATCH** | `match` | **TN** | Source: CORRECT, Art: CORRECT | True Negative: Correctly confirmed match between artwork and approved specification. |
| `U-01-05` | `CASE-01` | Manufacturer Address | **MATCH** | `match` | **TN** | Source: CORRECT, Art: CORRECT | True Negative: Correctly confirmed match between artwork and approved specification. |
| `U-02-01` | `CASE-02` | Net Quantity Equivalence | **MATCH** | `match` | **TN** | Source: CORRECT, Art: CORRECT | True Negative: Correctly confirmed match between artwork and approved specification. |
| `U-02-02` | `CASE-02` | Ingredients List Wording | **MATCH** | `match` | **TN** | Source: CORRECT, Art: CORRECT | True Negative: Correctly confirmed match between artwork and approved specification. |
| `U-02-03` | `CASE-02` | Manufacturer Address | **MATCH** | `match` | **TN** | Source: CORRECT, Art: CORRECT | True Negative: Correctly confirmed match between artwork and approved specification. |
| `U-02-04` | `CASE-02` | Nutrition Facts Presence | **MATCH** | `unable` | **ABSTENTION_ON_CLEAN** | Source: NOT_AVAILABLE, Art: NOT_AVAILABLE | PackSignal abstained (unable) on clean matching content. |
| `U-03-01` | `CASE-03` | Nutrition Basis Authority | **AMBIGUOUS** | `review` | **CORRECT_ABSTENTION** | Source: CORRECT, Art: NOT_AVAILABLE | Correct Abstention: PackSignal appropriately requested human review on ambiguous/unconfirmed draft specification. |
| `U-03-02` | `CASE-03` | Net Quantity Equivalence | **MATCH** | `issue` | **FP** | Source: CORRECT, Art: CORRECT | False Positive: PackSignal declared a definite issue on matching content. |
| `U-03-03` | `CASE-03` | Ingredients List Wording | **MATCH** | `issue` | **FP** | Source: CORRECT, Art: CORRECT | False Positive: PackSignal declared a definite issue on matching content. |

---

## 6. Cryptographic Hashes & Reproducibility
- **Protocol SHA-256**: `cd225fae64ed8a2cdbbaa5aac0c48fb2591379e3d06ce0a9b0f82fa1011408e8`
- **Cases Manifest SHA-256**: `e8625b9723f583860d35f52e58e729924834d74432f921ecaa2ba44064101722`
- **Ground Truth SHA-256**: `c72ec1ceda645963dffe2ffdd3ed5180cb5d39b0947e6dda22af6537ed620a94`
- **Predictions SHA-256**: `26a910b90dfdb8a1e7ceb9c0e6aa25646cf86d71790bf00a9f71465601d1b6ec`

*Reproducibility command*: `npm run evaluate:blind`
