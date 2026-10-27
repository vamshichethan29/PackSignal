/**
 * PackSignal Transparent Question Priority Scoring (lib/questions/question-priority.mjs)
 * 
 * Computes deterministic priority rankings based on:
 * - Regulatory severity of blocked rules
 * - Downstream check dependency count
 * - Source conflict severity
 * - Department workflow urgency
 * 
 * NOTE: Never invents clinical safety risk or consumer harm probabilities.
 */

export function scoreQuestionPriority(question, rulesById = new Map()) {
  const components = {
    baseScore: question.priorityBase || 50,
    blockedRuleWeight: 0,
    severityWeight: 0,
    conflictWeight: 0,
    departmentWeight: 0
  };

  // 1. Blocked downstream rules
  const blockedRules = question.affectedRules || [];
  components.blockedRuleWeight = Math.min(blockedRules.length * 8, 24);

  // 2. Regulatory severity of blocked rules
  let maxSev = 0;
  for (const rId of blockedRules) {
    const r = rulesById.get(rId);
    if (r) {
      if (r.severity === 'CRITICAL') maxSev = Math.max(maxSev, 25);
      else if (r.severity === 'HIGH') maxSev = Math.max(maxSev, 15);
      else if (r.severity === 'MEDIUM') maxSev = Math.max(maxSev, 10);
    }
  }
  components.severityWeight = maxSev;

  // 3. Sourced conflict weight
  if (question.affectedFacts && question.affectedFacts.length > 1) {
    components.conflictWeight = 15;
  }

  // 4. Department urgency
  if (question.responsibleDepartment === 'Regulatory & Legal') components.departmentWeight = 10;
  else if (question.responsibleDepartment === 'R&D / Formulations') components.departmentWeight = 8;
  else if (question.responsibleDepartment === 'Prepress & Packaging') components.departmentWeight = 6;
  else components.departmentWeight = 4;

  const total = components.baseScore + components.blockedRuleWeight + components.severityWeight + components.conflictWeight + components.departmentWeight;

  return {
    ...question,
    priorityScore: total,
    priorityComponents: components
  };
}

export function rankQuestions(questions = [], rulesById = new Map()) {
  const scored = questions.map(q => scoreQuestionPriority(q, rulesById));
  return scored.sort((a, b) => b.priorityScore - a.priorityScore);
}
