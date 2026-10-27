/**
 * PackSignal Common Check Registry (lib/check-runtime/registry.mjs)
 * Implements Phase 1: Shared executable-check execution contract.
 */

export class CheckRegistry {
  constructor() {
    this.checks = new Map();
  }

  /**
   * Registers a check definition adhering to the common execution contract.
   */
  register(checkDef) {
    if (!checkDef.checkId) throw new Error('Check definition must have checkId');
    if (!checkDef.evaluatorFunction || typeof checkDef.evaluatorFunction !== 'function') {
      throw new Error(`Check ${checkDef.checkId} must provide an evaluatorFunction`);
    }

    const checkRecord = {
      checkId: checkDef.checkId,
      checkVersion: checkDef.checkVersion || '1.0.0',
      jurisdiction: checkDef.jurisdiction || 'universal',
      ruleId: checkDef.ruleId || checkDef.checkId,
      applicabilityRequirements: checkDef.applicabilityRequirements || [],
      inputFactFields: checkDef.inputFactFields || [],
      inputDocumentRoles: checkDef.inputDocumentRoles || ['artwork'],
      requiredSourceStatus: checkDef.requiredSourceStatus || 'confirmed',
      requiredArtworkCoverage: checkDef.requiredArtworkCoverage || 'any',
      evaluationMethod: checkDef.evaluationMethod || 'DETERMINISTIC_CHECK',
      evaluatorFunction: checkDef.evaluatorFunction,
      outputFindingKeys: checkDef.outputFindingKeys || [checkDef.checkId],
      description: checkDef.description || '',
    };

    this.checks.set(checkDef.checkId, checkRecord);
    return checkRecord;
  }

  get(checkId) {
    return this.checks.get(checkId) || null;
  }

  has(checkId) {
    return this.checks.has(checkId);
  }

  list() {
    return Array.from(this.checks.values());
  }
}

export const globalCheckRegistry = new CheckRegistry();
