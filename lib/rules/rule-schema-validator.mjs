/**
 * PackSignal Rule Schema Validator (lib/rules/rule-schema-validator.mjs)
 * 
 * Validates market packs and rule records against canonical JSON schema definitions.
 * Safe validator: avoids eval() or unsafe dynamic code execution.
 */

export function validateRuleRecord(rule) {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['Rule record must be an object'] };
  }

  const requiredFields = [
    'ruleId',
    'title',
    'market',
    'sourceLaw',
    'legalProvision',
    'officialSourceUrl',
    'sourceQuote',
    'rulePackVersion',
    'effectiveFrom',
    'appliesIf',
    'evaluatorType',
    'severity',
    'responsibleDepartment'
  ];

  for (const field of requiredFields) {
    if (!rule[field]) {
      errors.push(`Missing required rule field: "${field}"`);
    }
  }

  const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'ADVISORY'];
  if (rule.severity && !validSeverities.includes(rule.severity)) {
    errors.push(`Invalid severity: "${rule.severity}". Must be one of: ${validSeverities.join(', ')}`);
  }

  const validDepartments = [
    'Regulatory & Legal',
    'R&D / Formulations',
    'Prepress & Packaging',
    'Brand & Marketing',
    'Quality Assurance'
  ];
  if (rule.responsibleDepartment && !validDepartments.includes(rule.responsibleDepartment)) {
    errors.push(`Invalid responsibleDepartment: "${rule.responsibleDepartment}"`);
  }

  if (rule.officialSourceUrl && !rule.officialSourceUrl.startsWith('http')) {
    errors.push(`officialSourceUrl must be a valid HTTP(S) URL: "${rule.officialSourceUrl}"`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateMarketPack(pack) {
  const errors = [];

  if (!pack || typeof pack !== 'object') {
    return { valid: false, errors: ['Market pack must be an object'] };
  }

  const requiredFields = [
    'packId',
    'market',
    'regulator',
    'version',
    'publishedAt',
    'effectiveFrom',
    'rules'
  ];

  for (const field of requiredFields) {
    if (!pack[field]) {
      errors.push(`Missing required market pack field: "${field}"`);
    }
  }

  if (!Array.isArray(pack.rules)) {
    errors.push('"rules" must be an array of rule records');
  } else {
    pack.rules.forEach((rule, idx) => {
      const res = validateRuleRecord(rule);
      if (!res.valid) {
        errors.push(`Rule #${idx + 1} (${rule.ruleId || 'unidentified'}): ${res.errors.join('; ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
