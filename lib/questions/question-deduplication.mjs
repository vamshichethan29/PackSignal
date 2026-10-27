/**
 * PackSignal Question Deduplication & Hard-10 Queue Enforcement
 * (lib/questions/question-deduplication.mjs)
 * 
 * - Merges questions addressing the same root uncertainty.
 * - Enforces HARD MAXIMUM OF 10 questions in active reviewer queue.
 * - Moves excess candidates to an optional backlog.
 */

export function deduplicateAndCapQuestions(rankedQuestions = [], maxActive = 10) {
  const seenTriggers = new Map();
  const deduplicated = [];

  for (const q of rankedQuestions) {
    const key = q.triggerId || q.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
    if (!seenTriggers.has(key)) {
      seenTriggers.set(key, q);
      deduplicated.push(q);
    } else {
      // Merge affected rules and facts into existing question
      const existing = seenTriggers.get(key);
      const combinedRules = Array.from(new Set([...(existing.affectedRules || []), ...(q.affectedRules || [])]));
      const combinedFacts = Array.from(new Set([...(existing.affectedFacts || []), ...(q.affectedFacts || [])]));
      existing.affectedRules = combinedRules;
      existing.affectedFacts = combinedFacts;
    }
  }

  // Enforce HARD maximum of 10 in active briefing queue
  const prioritizedQuestions = deduplicated.slice(0, maxActive);
  const backlogQuestions = deduplicated.slice(maxActive);

  return {
    prioritizedQuestions,
    backlogQuestions,
    totalDeduplicated: deduplicated.length,
    activeCount: prioritizedQuestions.length,
    backlogCount: backlogQuestions.length
  };
}
