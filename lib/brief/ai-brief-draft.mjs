/**
 * @file lib/brief/ai-brief-draft.mjs
 * 
 * Phase 5 — AI-Assisted Brief Drafting Engine
 * Uses structured output LLM generation with strict schema validation
 * and an offline deterministic fallback builder.
 */

import { buildBriefFromSession } from './brief-builder.mjs';
import { validateBriefSchema } from './brief-schema.mjs';

/**
 * System prompt strictly constraining the LLM to supplied facts and preventing hallucination.
 */
export const BRIEF_DRAFTING_SYSTEM_PROMPT = `You are a packaging design brief architect drafting a professional packaging brief using ONLY the supplied structured facts, regulatory rules, and reviewer decisions.
For every factual sentence:
- Reference the exact supporting fact IDs.
- For regulatory directives, reference applicable rule IDs.
- For brand/design decisions, reference approved decision IDs.
Do not invent product values, nutrition numbers, ingredients, claims, or certifications.
If data is missing or in conflict, label it as an OPEN_QUESTION.
Return strictly structured JSON.`;

/**
 * Drafts a brief using AI when available, or cleanly falls back to the deterministic builder.
 */
export async function draftBriefWithAi(session, options = {}) {
  // If AI service is unavailable or offline, execute deterministic fallback
  const fallbackBrief = buildBriefFromSession(session, options);

  try {
    // If external AI is invoked in real deployment with configured credentials
    if (options.aiService && typeof options.aiService.generateBrief === 'function') {
      const aiResult = await options.aiService.generateBrief({
        facts: session.facts,
        rules: session.rules,
        decisions: session.decisions,
        market: session.market,
        prompt: BRIEF_DRAFTING_SYSTEM_PROMPT
      });

      const validation = validateBriefSchema(aiResult);
      if (validation.valid) {
        return aiResult;
      }
      // If AI output fails schema validation, fall back safely
      console.warn('AI brief drafting schema validation failed, falling back to deterministic builder:', validation.errors);
    }
  } catch (err) {
    console.warn('AI brief drafting encountered an error, falling back to deterministic builder:', err.message);
  }

  return fallbackBrief;
}
