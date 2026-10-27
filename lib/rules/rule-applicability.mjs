/**
 * PackSignal Typed Rule Applicability Engine (lib/rules/rule-applicability.mjs)
 * 
 * Evaluates declarative `appliesIf` conditions against fact records and product metadata.
 * Deterministic and safe: No eval() or dynamic function compilation.
 * 
 * Returns:
 *   status: 'APPLIES' | 'DOES_NOT_APPLY' | 'APPLICABILITY_UNKNOWN'
 *   reasons: Array<string>
 */

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Evaluates a single atomic condition: { field, operator, value }
 */
export function evaluateAtomicCondition(condition, context) {
  const { field, operator, value } = condition;
  const actual = getNestedValue(context, field);

  if (operator === 'isUnknown') {
    const isUnk = actual === undefined || actual === null || actual === 'UNKNOWN';
    return {
      status: isUnk ? 'SATISFIED' : 'FAILED',
      reason: isUnk ? `Field "${field}" is unknown or missing.` : `Field "${field}" has value "${actual}".`
    };
  }

  if (operator === 'exists') {
    const exists = actual !== undefined && actual !== null && actual !== '';
    return {
      status: exists ? 'SATISFIED' : 'FAILED',
      reason: exists ? `Field "${field}" exists (value: "${actual}").` : `Required field "${field}" is missing.`
    };
  }

  if (actual === undefined || actual === null) {
    return {
      status: 'UNKNOWN',
      reason: `Context field "${field}" is missing from product facts.`
    };
  }

  switch (operator) {
    case 'equals': {
      const match = String(actual).toLowerCase() === String(value).toLowerCase();
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `"${field}" equals "${value}".` : `"${field}" (${actual}) does not equal "${value}".`
      };
    }
    case 'notEquals': {
      const match = String(actual).toLowerCase() !== String(value).toLowerCase();
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `"${field}" (${actual}) does not equal "${value}".` : `"${field}" equals "${value}".`
      };
    }
    case 'in': {
      const arr = Array.isArray(value) ? value : [value];
      const actualArr = Array.isArray(actual) ? actual : [actual];
      const match = actualArr.some(a => arr.some(v => String(a).toLowerCase() === String(v).toLowerCase()));
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `"${field}" matches allowed values [${arr.join(', ')}].` : `"${field}" (${actual}) not in [${arr.join(', ')}].`
      };
    }
    case 'notIn': {
      const arr = Array.isArray(value) ? value : [value];
      const actualArr = Array.isArray(actual) ? actual : [actual];
      const match = !actualArr.some(a => arr.some(v => String(a).toLowerCase() === String(v).toLowerCase()));
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `"${field}" is not in [${arr.join(', ')}].` : `"${field}" matches excluded values [${arr.join(', ')}].`
      };
    }
    case 'greaterThan': {
      const numActual = Number(actual);
      const numExpected = Number(value);
      const match = !isNaN(numActual) && !isNaN(numExpected) && numActual > numExpected;
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `${actual} > ${value}` : `${actual} is not > ${value}`
      };
    }
    case 'greaterThanOrEqual': {
      const numActual = Number(actual);
      const numExpected = Number(value);
      const match = !isNaN(numActual) && !isNaN(numExpected) && numActual >= numExpected;
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `${actual} >= ${value}` : `${actual} is not >= ${value}`
      };
    }
    case 'lessThan': {
      const numActual = Number(actual);
      const numExpected = Number(value);
      const match = !isNaN(numActual) && !isNaN(numExpected) && numActual < numExpected;
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `${actual} < ${value}` : `${actual} is not < ${value}`
      };
    }
    case 'lessThanOrEqual': {
      const numActual = Number(actual);
      const numExpected = Number(value);
      const match = !isNaN(numActual) && !isNaN(numExpected) && numActual <= numExpected;
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `${actual} <= ${value}` : `${actual} is not <= ${value}`
      };
    }
    case 'contains': {
      const match = String(actual).toLowerCase().includes(String(value).toLowerCase());
      return {
        status: match ? 'SATISFIED' : 'FAILED',
        reason: match ? `"${field}" contains "${value}".` : `"${field}" does not contain "${value}".`
      };
    }
    default:
      return {
        status: 'FAILED',
        reason: `Unsupported operator "${operator}".`
      };
  }
}

/**
 * Recursively evaluates compound condition trees (all, any, not).
 */
export function evaluateConditionTree(node, context) {
  if (!node || typeof node !== 'object') {
    return { status: 'APPLIES', reasons: ['No condition specified (defaults to applicable).'] };
  }

  // Handle 'all' clause
  if (Array.isArray(node.all)) {
    const reasons = [];
    let hasUnknown = false;
    for (const sub of node.all) {
      const res = evaluateConditionTree(sub, context);
      reasons.push(...res.reasons);
      if (res.status === 'DOES_NOT_APPLY') {
        return { status: 'DOES_NOT_APPLY', reasons };
      }
      if (res.status === 'APPLICABILITY_UNKNOWN') {
        hasUnknown = true;
      }
    }
    return {
      status: hasUnknown ? 'APPLICABILITY_UNKNOWN' : 'APPLIES',
      reasons
    };
  }

  // Handle 'any' clause
  if (Array.isArray(node.any)) {
    const reasons = [];
    let hasApplicable = false;
    let hasUnknown = false;
    for (const sub of node.any) {
      const res = evaluateConditionTree(sub, context);
      reasons.push(...res.reasons);
      if (res.status === 'APPLIES') {
        hasApplicable = true;
        break;
      }
      if (res.status === 'APPLICABILITY_UNKNOWN') {
        hasUnknown = true;
      }
    }
    if (hasApplicable) return { status: 'APPLIES', reasons };
    if (hasUnknown) return { status: 'APPLICABILITY_UNKNOWN', reasons };
    return { status: 'DOES_NOT_APPLY', reasons };
  }

  // Handle 'not' clause
  if (node.not) {
    const res = evaluateConditionTree(node.not, context);
    if (res.status === 'APPLIES') {
      return { status: 'DOES_NOT_APPLY', reasons: [`Negated condition was satisfied: ${res.reasons.join('; ')}`] };
    }
    if (res.status === 'DOES_NOT_APPLY') {
      return { status: 'APPLIES', reasons: [`Negated condition failed as expected: ${res.reasons.join('; ')}`] };
    }
    return { status: 'APPLICABILITY_UNKNOWN', reasons: res.reasons };
  }

  // Atomic condition
  if (node.field && node.operator) {
    const atomic = evaluateAtomicCondition(node, context);
    if (atomic.status === 'SATISFIED') return { status: 'APPLIES', reasons: [atomic.reason] };
    if (atomic.status === 'FAILED') return { status: 'DOES_NOT_APPLY', reasons: [atomic.reason] };
    return { status: 'APPLICABILITY_UNKNOWN', reasons: [atomic.reason] };
  }

  return { status: 'APPLIES', reasons: ['Vacuously applicable condition.'] };
}

/**
 * Main applicability resolution for a rule given full fact context.
 */
export function evaluateRuleApplicability(rule, context) {
  if (!rule.appliesIf) {
    return {
      status: 'APPLIES',
      reason: 'Rule has no conditional applicability constraints; applies globally.'
    };
  }

  const result = evaluateConditionTree(rule.appliesIf, context);
  return {
    status: result.status,
    reason: result.reasons.join(' | ')
  };
}
