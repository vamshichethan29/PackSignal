# Autonomous Build & Visual Verification Protocol (PackSignal / AIFORGE)

Whenever a feature, fix, or prompt is requested:

1. **Direct Workspace Integration**:
   - Implement all requests directly into this existing project (`/Users/vamshi/Desktop/AIFORGE`).
   - Build completely and production-grade. No placeholders, dummy stubs, or half-done work.

2. **Automated Error & Fix Loop**:
   - Run tests, preflights, and diagnostic checks (`npm test`, node syntax checks, doctor scripts).
   - If any errors or regressions are detected, analyze, fix them immediately, and re-run.
   - Loop this self-healing process until all tests and checks pass cleanly.

3. **Live Server & Browser Visual QA Loop**:
   - Start or check the dev server (`npm run dev` on port 3000 / configured port).
   - Use the browser subagent in Chrome to visually inspect the live UI.
   - Check for:
     - Visual bugs, alignment issues, layout shifts, or clipping.
     - Console warnings and runtime errors.
     - Interaction flow, animation smoothness, and peak visual aesthetics.
   - If any defects or visual mistakes are observed, adjust the styling/code and re-verify in the browser until it looks and works at its absolute peak.
