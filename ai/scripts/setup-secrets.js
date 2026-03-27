#!/usr/bin/env node

/**
 * Interactive setup for kimi-ide secrets (macOS Keychain).
 *
 * Usage: node scripts/setup-secrets.js
 */

const readline = require('readline');
const secrets = require('../kimi-ide-server/lib/secrets');

const KNOWN_SECRETS = [
  { key: 'GITLAB_TOKEN', description: 'GitLab Personal Access Token (glpat-...)' },
  // Add future keys here
];

async function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n  kimi-ide Secrets Setup');
  console.log('  ─────────────────────\n');
  console.log(`  Account: "${secrets.ACCOUNT}" in macOS Keychain\n`);

  for (const { key, description } of KNOWN_SECRETS) {
    const exists = await secrets.has(key);
    const status = exists ? '✅ set' : '⬚  not set';
    console.log(`  ${key} — ${status}`);
    console.log(`    ${description}\n`);

    if (exists) {
      const answer = await prompt(rl, '  Overwrite? (y/N): ');
      if (answer.trim().toLowerCase() !== 'y') {
        console.log('  Skipped.\n');
        continue;
      }
    }

    const value = await prompt(rl, `  Enter value for ${key}: `);
    if (!value.trim()) {
      console.log('  Empty — skipped.\n');
      continue;
    }

    try {
      await secrets.set(key, value.trim());
      console.log('  ✅ Saved to Keychain.\n');
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}\n`);
    }
  }

  rl.close();
  console.log('  Done.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
