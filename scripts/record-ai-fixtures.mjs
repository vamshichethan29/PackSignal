#!/usr/bin/env node
/**
 * PackSignal AI Fixture Recording Script (scripts/record-ai-fixtures.mjs)
 * Records and sanitizes AI extraction fixtures for offline test suites.
 *
 * Usage:
 *   node scripts/record-ai-fixtures.mjs [--task task_name]
 */

import { AiFixtureAdapter } from '../lib/ai-fixture-adapter.mjs';

async function main() {
  console.log('📦 PackSignal AI Fixture Recorder (Phase 2 Quality Gate)');
  const adapter = new AiFixtureAdapter();

  const standardFixtures = [
    {
      taskName: 'artwork_transcription',
      promptVersion: '1.0',
      schemaVersion: '1.0',
      modelIdentifier: 'gemini-2.5-flash',
      output: {
        pages: [
          {
            pageNumber: 1,
            transcriptions: [
              { text: 'Dancing Fish Granola Berry Crunch', confidence: 0.98, box: [0.1, 0.1, 0.8, 0.25] },
              { text: 'NET WT 12 OZ (340g)', confidence: 0.99, box: [0.3, 0.8, 0.7, 0.9] },
              { text: 'Honey (1%), Coconut Sugar', confidence: 0.95, box: [0.1, 0.4, 0.9, 0.6] }
            ]
          }
        ]
      }
    },
    {
      taskName: 'rulebook_extraction',
      promptVersion: '1.0',
      schemaVersion: '1.0',
      modelIdentifier: 'gemini-2.5-flash',
      output: {
        rules: [
          {
            ruleId: 'RULE-FDA-21CFR101.9',
            citation: '21 CFR §101.9(c)(6)',
            exactQuotation: 'Total carbohydrate declaration shall include all dietary carbohydrate.',
            section: 'Nutrition Labeling of Food',
            effectiveDate: '2020-01-01',
            status: 'PROPOSED_NEEDS_HUMAN_APPROVAL'
          }
        ]
      }
    },
    {
      taskName: 'source_facts',
      promptVersion: '1.0',
      schemaVersion: '1.0',
      modelIdentifier: 'gemini-2.5-flash',
      output: {
        productName: 'Granola Berry Crunch',
        brand: 'Dancing Fish',
        declaredNetQuantity: '450g',
        suggestedAllergens: ['Almonds', 'Pecans', 'Walnuts']
      }
    }
  ];

  for (const item of standardFixtures) {
    const record = await adapter.recordFixture(item.taskName, item);
    console.log(`  ✓ Recorded fixture: ${item.taskName} (hash: ${record.inputHash.slice(0, 16)}…)`);
  }

  console.log('✅ Standard AI fixtures recorded and validated without secrets.');
}

main().catch((err) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
