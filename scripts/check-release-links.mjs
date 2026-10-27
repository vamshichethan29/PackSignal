import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

const root = process.cwd();
const filesToCheck = [
  'README.md',
  'submission/SHORT_WRITEUP.md',
  'submission/PROJECT_DESCRIPTION.md',
  'submission/SUBMISSION_CHECKLIST.md',
  'submission/DEMO_SCRIPT.md',
  'submission/ARCHITECTURE.md',
  'docs/architecture.mmd'
];

let localBroken = 0;
let localChecked = 0;
let externalChecked = 0;

console.log('============================================================');
console.log('PackSignal Release Link & Asset Accessibility Validator');
console.log('============================================================\n');

for (const relFile of filesToCheck) {
  const fullPath = join(root, relFile);
  if (!existsSync(fullPath)) {
    console.warn(`File not found to scan: ${relFile}`);
    continue;
  }

  const content = readFileSync(fullPath, 'utf8');
  // Match markdown links: [text](target) and ![alt](target)
  const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  console.log(`Checking [${relFile}]:`);
  while ((match = linkRegex.exec(content)) !== null) {
    const rawTarget = match[2].trim();
    // Ignore in-page anchors like #section
    if (rawTarget.startsWith('#')) continue;

    // Check external URLs
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
      externalChecked++;
      console.log(`  [EXTERNAL] ${rawTarget}`);
      continue;
    }

    // Local file path
    localChecked++;
    const cleanTarget = rawTarget.split('#')[0].split('?')[0];
    const resolvedTarget = cleanTarget.startsWith('/')
      ? join(root, cleanTarget.replace(/^\//, ''))
      : resolve(dirname(fullPath), cleanTarget);

    if (existsSync(resolvedTarget)) {
      console.log(`  OK: ${cleanTarget}`);
    } else {
      console.error(`  FAIL (404 Not Found): ${cleanTarget} (referenced in ${relFile})`);
      localBroken++;
    }
  }
}

console.log('\n============================================================');
console.log(`Summary: Checked ${localChecked} local links (${localBroken} broken), ${externalChecked} external links.`);

if (localBroken > 0) {
  console.error(`Verification FAILED: ${localBroken} broken local links detected!`);
  console.log('============================================================');
  process.exitCode = 1;
} else {
  console.log('Verification PASSED: All local relative links and assets exist.');
  console.log('============================================================');
  process.exitCode = 0;
}
