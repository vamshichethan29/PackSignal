# PackSignal Canonical Review Contract Specification
## Step 1: Frozen Interface Specification for Multi-Agent Engineering

**Document:** `docs/REVIEW_CONTRACT.md`  
**Module:** `lib/contracts/review-contract.mjs`  
**Status:** **FROZEN** (Lead Architect Sign-Off)  
**Theme:** Esko AIForge Track 2 — Artwork Verification & Launch Readiness

---

## 1. Finding Contract (`createFinding`)

```typescript
interface Finding {
  findingId: string;
  checkId: string;
  ruleIds: string[];
  kind: string;
  title: string;
  whyItMatters: string;
  expected: string;
  observed: string;
  proof: string | null;
  evaluationMethod: string;
  findingStatus: 'issue' | 'review' | 'match' | 'unable';
  sourceEvidenceIds: string[];
  artworkEvidenceIds: string[];
  factIds: string[];
  conflictIds: string[];
  requirementIds: string[];
  reviewerDecisionId: string | null;
  reviewRevision: number;
  limitations: string;
}
```

### Finding Status Axioms:
- `issue`: Action required. A supported check with verified evidence and an empirical defect.
- `review`: Needs human review. Source conflict, draft specification, or unverified rule.
- `match`: Evaluated check passed with documented proof.
- `unable`: Missing input file, unreadable stream, or uncompiled rule. **Never hidden inside a PASS.**

---

## 2. Evidence Contract (`createEvidence`)

```typescript
interface Evidence {
  evidenceId: string;
  documentId: string;
  documentHash: string; // SHA-256 digest of original bytes
  sourceType: 'spreadsheet' | 'artwork' | 'pdf' | 'docx' | 'txt' | 'json';
  originalQuote: string; // Verbatim extracted character sequence
  quoteVerified: boolean; // Confirmed present in byte stream
  sourceAuthority: 'approved' | 'draft' | 'unconfirmed';
  page: number | null;
  panel: string | null;
  sheet: string | null;
  cell: string | null;
  boundingBox: [number, number, number, number] | null;
  coordinateSystem: string;
  extractionMethod: string;
  visibilityState: string;
}
```

---

## 3. Rulebook Rule Contract (`createRulebookRule`)

```typescript
interface RulebookRule {
  ruleId: string;
  title: string;
  originalQuote: string;
  sourceDocumentId: string;
  sourceHash: string;
  sourceLocation: string; // Section or citation
  quoteVerification: 'verified' | 'unverified';
  approvalStatus: 'PROPOSED' | 'VERIFIED_QUOTE' | 'APPROVED' | 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNSUPPORTED' | 'BLOCKED' | 'EXECUTED';
  applicability: string;
  checkType: string;
  evaluatorId: string;
  executionStatus: string;
  findingIds: string[];
  blockers: string[];
}
```

---

## 4. Cleared Check Contract (`createClearedCheck`)

```typescript
interface ClearedCheck {
  clearedId: string;
  checkId: string;
  ruleId: string | null;
  title: string;
  proof: string; // Mathematical or string proof
  sourceEvidenceIds: string[];
  artworkEvidenceIds: string[];
  executionId: string;
  verificationMethod: string;
  limitations: string;
}
```

---

## 5. Review Decision Contract (`createReviewDecision`)

```typescript
interface ReviewDecision {
  decisionId: string;
  findingId: string;
  actorId: string;
  decision: 'CONFIRMED_ISSUE' | 'NOT_A_PROBLEM' | 'NEEDS_MORE_EVIDENCE' | 'REQUEST_CHANGES' | 'CONFIRM_REVISION' | 'USE_SOURCE';
  note: string;
  timestamp: string;
  sourceDependencyHash: string;
  ruleDependencyHash: string;
  artworkDependencyHash: string;
  staleState: boolean;
}
```

---

## 6. Source Role Adapter (`canonicalSourceRole`)

Maps external / competitor role constants cleanly to PackSignal's existing internal types:
- `ARTWORK` $\rightarrow$ `artwork`
- `PRODUCT_SPECIFICATION` $\rightarrow$ `reference`
- `RULEBOOK` $\rightarrow$ `rules`
- `SUPPORTING_DOCUMENT` $\rightarrow$ `supplemental`
- `OTHER` $\rightarrow$ `other`
