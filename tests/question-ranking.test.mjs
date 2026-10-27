import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreQuestionPriority, rankQuestions } from '../lib/questions/question-priority.mjs';
import { deduplicateAndCapQuestions } from '../lib/questions/question-deduplication.mjs';
import { formatDeterministicQuestionWording, enhanceQuestionWordingWithAi } from '../lib/questions/question-wording.mjs';

describe('Phase 3 — Smart Question Ranking, Deduplication, & Hard-10 Queue', () => {

  test('1. Scores questions transparently based on blocked rules, conflicts, and severity', () => {
    const criticalQ = {
      questionId: 'Q-01',
      title: 'Critical Regulatory Question',
      priorityBase: 80,
      affectedRules: ['RULE-CRITICAL-1', 'RULE-CRITICAL-2'],
      affectedFacts: ['fact-1', 'fact-2'],
      responsibleDepartment: 'Regulatory & Legal'
    };

    const rulesMap = new Map([
      ['RULE-CRITICAL-1', { severity: 'CRITICAL' }],
      ['RULE-CRITICAL-2', { severity: 'HIGH' }]
    ]);

    const scored = scoreQuestionPriority(criticalQ, rulesMap);
    assert.ok(scored.priorityScore > 100);
    assert.ok(scored.priorityComponents.severityWeight >= 25);
    assert.ok(scored.priorityComponents.conflictWeight >= 15);
  });

  test('2. Ranks multiple questions in descending priority order', () => {
    const qList = [
      { questionId: 'Q-LOW', title: 'Low Priority', priorityBase: 40, affectedRules: [] },
      { questionId: 'Q-HIGH', title: 'High Priority', priorityBase: 90, affectedRules: ['RULE-1'] }
    ];
    const ranked = rankQuestions(qList);
    assert.equal(ranked[0].questionId, 'Q-HIGH');
    assert.equal(ranked[1].questionId, 'Q-LOW');
  });

  test('3. Enforces a HARD MAXIMUM of 10 questions in active reviewer queue', () => {
    const twelveQuestions = Array.from({ length: 15 }, (_, i) => ({
      questionId: `Q-${i + 1}`,
      title: `Question ${i + 1}`,
      triggerId: `TRIGGER_${i + 1}`,
      priorityScore: 100 - i
    }));

    const result = deduplicateAndCapQuestions(twelveQuestions, 10);
    assert.equal(result.prioritizedQuestions.length, 10, 'Must strictly cap active queue at 10');
    assert.equal(result.backlogQuestions.length, 5, 'Excess questions must be moved to backlog');
    assert.equal(result.totalDeduplicated, 15);
  });

  test('4. Merges duplicate questions addressing the same root uncertainty', () => {
    const duplicates = [
      { questionId: 'Q-1', title: 'Nutrition Basis', triggerId: 'AMBIGUOUS_NUTRITION_BASIS', affectedRules: ['US-NUTR-004'] },
      { questionId: 'Q-2', title: 'Carb Basis', triggerId: 'AMBIGUOUS_NUTRITION_BASIS', affectedRules: ['US-NUTR-005'] }
    ];

    const result = deduplicateAndCapQuestions(duplicates, 10);
    assert.equal(result.prioritizedQuestions.length, 1);
    assert.deepEqual(result.prioritizedQuestions[0].affectedRules, ['US-NUTR-004', 'US-NUTR-005']);
  });

  test('5. Deterministic question template fallback works offline without external credentials', async () => {
    const candidate = {
      title: 'Confirm Formula',
      question: 'Which formula percentage is authorized?',
      reason: 'Blocks QUID compliance.',
      answerOptions: ['1%', '9%']
    };

    const formatted = formatDeterministicQuestionWording(candidate);
    assert.equal(formatted.title, candidate.title);
    assert.equal(formatted.question, candidate.question);

    const enhanced = await enhanceQuestionWordingWithAi(candidate, null);
    assert.equal(enhanced.title, candidate.title);
    assert.equal(enhanced.question, candidate.question);
  });
});
