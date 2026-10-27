/**
 * PackSignal Remediation Engine (lib/remediation-engine.mjs)
 * Re-exports from modular lib/remediation/ package for backward compatibility.
 */

export * from './remediation/index.mjs';
export { generateRemediation as generateRemediationProposal } from './remediation/index.mjs';
