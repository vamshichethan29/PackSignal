/**
 * PackSignal Check Execution Context (lib/check-runtime/context.mjs)
 * Implements context tracking: source hashes, fact IDs, rule versions, timestamps.
 */

export class CheckExecutionContext {
  constructor({
    reviewId = '',
    market = 'us',
    sourceHashes = {},
    factIds = [],
    ruleVersions = {},
    productSku = null,
    artworkCoverage = { complete: false, panels: [] },
    reviewerDecisions = {},
  } = {}) {
    this.reviewId = reviewId;
    this.market = market;
    this.sourceHashes = sourceHashes;
    this.factIds = factIds;
    this.ruleVersions = ruleVersions;
    this.productSku = productSku;
    this.artworkCoverage = artworkCoverage;
    this.reviewerDecisions = reviewerDecisions;
    this.startedAt = new Date().toISOString();
  }

  isSourceConfirmed(documentRole) {
    return Boolean(this.sourceHashes[documentRole]);
  }
}
