/**
 * PackSignal Question Wording & AI Enhancement (lib/questions/question-wording.mjs)
 * 
 * Generates clear, professional reviewer wording while strictly guarding against
 * invented regulatory citations or modified question intents.
 */

export function formatDeterministicQuestionWording(candidate) {
  return {
    title: candidate.title,
    question: candidate.question,
    reason: candidate.reason,
    answerOptions: candidate.answerOptions || []
  };
}

/**
 * Optional AI phrasing polisher.
 * Falls back safely to deterministic wording if AI is unconfigured or returns invalid content.
 */
export async function enhanceQuestionWordingWithAi(candidate, aiProvider = null) {
  const fallback = formatDeterministicQuestionWording(candidate);

  if (!aiProvider || typeof aiProvider.call !== 'function') {
    return fallback;
  }

  try {
    const prompt = `You are a packaging regulatory review assistant. Refine this question for clarity:
Original Question: "${candidate.question}"
Reason: "${candidate.reason}"
Department: "${candidate.responsibleDepartment}"

Return JSON:
{
  "title": "Concise headline (max 8 words)",
  "question": "Clear, professional question text referencing the exact facts",
  "reason": "Brief explanation of regulatory or commercial importance"
}`;

    const res = await aiProvider.call({ prompt, format: 'json' });
    if (res && res.question && res.title) {
      return {
        title: res.title,
        question: res.question,
        reason: res.reason || candidate.reason,
        answerOptions: candidate.answerOptions || []
      };
    }
  } catch {
    // Graceful offline fallback
  }

  return fallback;
}
