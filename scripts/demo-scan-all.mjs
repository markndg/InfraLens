#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'fixtures/scans'), { recursive: true });

const estates = [
  ['fixtures/demo-estate', 'fixtures/scans/demo.bundle.json'],
  ['fixtures/serverless-aws', 'fixtures/scans/serverless-aws.bundle.json'],
  ['fixtures/k8s-microservices', 'fixtures/scans/k8s-microservices.bundle.json'],
  ['fixtures/legacy-hybrid', 'fixtures/scans/legacy-hybrid.bundle.json'],
];

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'apps/scanner-cli/src/cli.ts', 'scan', ...args], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`scan failed: ${code}`))));
  });
}

for (const [input, output] of estates) {
  console.log(`Scanning ${input} → ${output}`);
  await run([input, '--output', output]);
}
console.log('All reference estate bundles written under fixtures/scans/');
