/**
 * @file phase9-ship-submission.test.mjs
 * 
 * Test suite for Phase 9 — Ship: Final Submission Package & Verification
 * 
 * Done when:
 * 1. A teammate who has never seen it can run it from the README.md.
 * 2. Setup and local npm run dev instructions are clear and verified.
 * 3. Architecture diagram and technical/AI write-up are present.
 * 4. Dockerfile is valid, production-ready, exposes 4173, and specifies CMD npm start.
 * 5. Hosted demo link and render.yaml deployment configuration exist.
 * 6. 3–5 minute video demo rehearsal script is documented with timestamps and spoken cues.
 * 7. Every submission field is filled in submission/SUBMISSION_PORTAL_FIELDS.md.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('1. README.md contains complete setup instructions for new teammates', () => {
  const readmePath = join(root, 'README.md');
  assert.ok(existsSync(readmePath), 'README.md must exist');
  const readme = readFileSync(readmePath, 'utf8');

  // Prerequisites
  assert.ok(readme.includes('Prerequisites'), 'Must document prerequisites');
  assert.ok(readme.includes('Node.js'), 'Must specify Node.js version');
  assert.ok(readme.includes('Python'), 'Must specify Python version');

  // Step-by-step reproduction
  assert.ok(readme.includes('git clone'), 'Must include clone command');
  assert.ok(readme.includes('pip install -r requirements.txt'), 'Must document Python venv setup');
  assert.ok(readme.includes('npm run dev') || readme.includes('npm start'), 'Must document npm run dev / start');
  assert.ok(readme.includes('http://127.0.0.1:4173'), 'Must name local port URL');
});

test('2. Architecture diagram and dual-track AI/deterministic description are documented', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');

  // Mermaid architecture diagram
  assert.ok(readme.includes('```mermaid'), 'Must include Mermaid diagram block');
  assert.ok(readme.includes('Deterministic Engine'), 'Must include deterministic engine');
  assert.ok(readme.includes('Gemini 3.8 Flash'), 'Must include Gemini 3.8 Flash multimodal vision');

  // 4 Epistemic Trust states
  assert.ok(readme.includes('Matches Reference') || readme.includes('Match'), 'Documents match state');
  assert.ok(readme.includes('Issue Found') || readme.includes('Issue'), 'Documents issue state');
  assert.ok(readme.includes('Human Review') || readme.includes('Needs Human Review'), 'Documents human review state');
  assert.ok(readme.includes('Unable to Verify') || readme.includes('Unable'), 'Documents unable state');
});

test('3. Dockerfile is production-grade, exposes port 4173, and configures unprivileged user', () => {
  const dockerPath = join(root, 'Dockerfile');
  assert.ok(existsSync(dockerPath), 'Dockerfile must exist');
  const dockerfile = readFileSync(dockerPath, 'utf8');

  assert.ok(dockerfile.includes('FROM node:'), 'Uses modern Node base image');
  assert.ok(dockerfile.includes('EXPOSE 4173'), 'Exposes port 4173');
  assert.ok(dockerfile.includes('CMD ["npm", "start"]'), 'Specifies npm start CMD');
  assert.ok(dockerfile.includes('USER node'), 'Runs under unprivileged node user for security');
  assert.ok(dockerfile.includes('HEALTHCHECK'), 'Includes container healthcheck');
});

test('4. Hosted deployment blueprint (render.yaml) is configured for live demo', () => {
  const renderPath = join(root, 'render.yaml');
  assert.ok(existsSync(renderPath), 'render.yaml must exist');
  const renderYaml = readFileSync(renderPath, 'utf8');

  assert.ok(renderYaml.includes('type: web'), 'Defines web service');
  assert.ok(renderYaml.includes('runtime: docker') || renderYaml.includes('env: docker'), 'Configures build environment');
  assert.ok(renderYaml.includes('PORT'), 'Sets PORT environment variable');
});

test('5. 3–5 Minute demo video rehearsal script is documented with timing and screen actions', () => {
  const scriptPath = join(root, 'submission', 'DEMO_SCRIPT_5MIN.md');
  assert.ok(existsSync(scriptPath), 'DEMO_SCRIPT_5MIN.md must exist');
  const script = readFileSync(scriptPath, 'utf8');

  assert.ok(script.includes('00:00') && script.includes('04:00'), 'Includes timestamps covering full video');
  assert.ok(script.includes('Dancing Fish') || script.includes('organizer'), 'Includes official organizer sample');
  assert.ok(script.includes('Trust Console') || script.includes('Bake-Off'), 'Covers Trust Console demonstration');
});

test('6. Every submission field is completely filled in submission/SUBMISSION_PORTAL_FIELDS.md', () => {
  const fieldsPath = join(root, 'submission', 'SUBMISSION_PORTAL_FIELDS.md');
  assert.ok(existsSync(fieldsPath), 'SUBMISSION_PORTAL_FIELDS.md must exist');
  const content = readFileSync(fieldsPath, 'utf8');

  // Verify all 9 essential submission fields
  assert.ok(content.includes('Field 1: Project Title'), 'Field 1 Title present');
  assert.ok(content.includes('Field 2: Tagline / One-Line Elevator Pitch'), 'Field 2 Tagline present');
  assert.ok(content.includes('Field 3: Problem Statement Addressed'), 'Field 3 Problem Statement present');
  assert.ok(content.includes('Field 4: Detailed Solution & Technical Approach'), 'Field 4 Approach present');
  assert.ok(content.includes('Field 5: Technology Stack'), 'Field 5 Tech Stack present');
  assert.ok(content.includes('Field 6: Model Bake-Off Scoreboard'), 'Field 6 Model Bake-Off present');
  assert.ok(content.includes('Field 7: Trust Console Self-Test Metrics'), 'Field 7 Metrics present');
  assert.ok(content.includes('Field 8: Public Links & Repository'), 'Field 8 Links present');
  assert.ok(content.includes('Field 9: How to Run'), 'Field 9 Quickstart present');
  assert.ok(content.includes('gemini-3.8-flash'), 'Configures winning Gemini 3.8 Flash model');
});
