export function mergeReviewSummary(reviews, review) {
  const summary = {
    id: review.id,
    name: review.name,
    createdAt: review.createdAt,
    finishedAt: review.finishedAt,
    status: review.status,
    counts: review.counts,
    engine: review.engine,
    sample: review.sample,
    parentId: review.parentId,
  };
  return [summary, ...(Array.isArray(reviews) ? reviews : []).filter((item) => item.id !== review.id)]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function reviewCoverage(review) {
  const coverage = review?.coverage && typeof review.coverage === 'object' ? review.coverage : {};
  return {
    completeArtwork: coverage.completeArtwork === true,
    limits: Array.isArray(coverage.limits) ? coverage.limits : [],
  };
}
