#!/usr/bin/env node
/**
 * Deterministic demo storyboard + optional Playwright screenshots.
 * Does not claim a GIF/WebM exists unless capture succeeds.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/assets/demo');
mkdirSync(outDir, { recursive: true });

const storyboard = `# InfraLens 30-second demonstration storyboard

Deterministic walkthrough for Retail SaaS (no production changes).

1. Open Architecture Governance (Review mode).
2. Observe architecture status: not ready / non-compliant.
3. Select the high-availability (production resilience) intent.
4. Show the failed assumption linked to \`retail-prod-db\`.
5. Open the database node; reveal evidence \`multi_az = false\`.
6. Show finding + ADR / assumption impact.
7. Confirm approval blocked / sign-off invalid.
8. Run graph-only simulation enabling Multi-AZ.
9. Observe finding resolve and readiness change.

Manual media (optional): record the Playwright flow as GIF/WebM locally.
Do not commit large binaries unless optimized and reviewed.

Assets:
- Hero: docs/assets/infralens-hero.svg
- Screenshots (when capture runs): docs/assets/demo/*.png
`;

writeFileSync(join(outDir, 'STORYBOARD.md'), storyboard);

const storyboardOnly = process.argv.includes('--storyboard');
if (storyboardOnly) {
  console.log(`Wrote ${join(outDir, 'STORYBOARD.md')}`);
  console.log('Storyboard-only mode; skipping Playwright capture.');
  process.exit(0);
}

const e2e = join(root, 'tests/e2e');
const hasE2e = existsSync(e2e);
if (!hasE2e) {
  console.log('No tests/e2e harness found. Storyboard written; capture skipped.');
  console.log(`See ${join(outDir, 'STORYBOARD.md')}`);
  process.exit(0);
}

const result = spawnSync(
  'npx',
  ['playwright', 'test', '--project=chromium', 'tests/e2e/demo-walkthrough.spec.ts'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
);

if (result.status !== 0) {
  console.error('Playwright capture failed or spec missing. Storyboard remains available.');
  console.error(`See ${join(outDir, 'STORYBOARD.md')}`);
  process.exit(result.status ?? 1);
}

console.log('Capture finished. Check docs/assets/demo/ for screenshots.');
