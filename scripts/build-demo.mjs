#!/usr/bin/env node
/**
 * Static hosted-demo build: bundled evidence only, no credentials required.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps/web/dist-demo');

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

const base = process.env.INFRALENS_DEMO_BASE || './';

await run('npm', ['run', 'build', '-w', '@infralens/web'], {
  VITE_INFRALENS_DEMO: '1',
  // Vite reads base from CLI; we pass via env consumed in vite.config when set.
  INFRALENS_DEMO_BASE: base,
});

const dist = join(root, 'apps/web/dist');
if (!existsSync(dist)) {
  console.error('Web build did not produce apps/web/dist');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
cpSync(dist, outDir, { recursive: true });
writeFileSync(
  join(outDir, 'DEMO.md'),
  [
    '# InfraLens hosted demo build',
    '',
    'This directory is a static site built with `npm run build:demo`.',
    'It uses bundled synthetic reference estates only.',
    'Serve with any static file server (for example `npx serve apps/web/dist-demo`).',
    '',
    'See docs/demo/hosted-demo.md for GitHub Pages notes.',
    '',
  ].join('\n'),
);

console.log(`Hosted demo assets written to ${outDir}`);
console.log('Serve locally: npx --yes serve apps/web/dist-demo');
