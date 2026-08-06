#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { capabilityMatrix } from '@infralens/edition-capabilities';
import { validateBundle, type ScanBundle } from '@infralens/graph-model';
import { compareBundles } from '@infralens/reconciliation';
import { renderDiffMarkdown, renderHtmlReport } from '@infralens/reporting';
import { scanPath } from '@infralens/scanner';

const PRODUCT_VERSION = '0.1.0';

function usage() {
  console.log(`InfraLens scanner CLI v${PRODUCT_VERSION}

Usage:
  infralens scan <path> [--output scan.bundle.json]
  infralens inspect <bundle.json>
  infralens compare <baseline.bundle.json> <candidate.bundle.json>
  infralens report <bundle.json> [--format html|json] [--output report.html]
  infralens capabilities
`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === '--help' || cmd === 'help') {
    usage();
    return;
  }

  if (cmd === 'capabilities') {
    console.log(
      JSON.stringify({ productVersion: PRODUCT_VERSION, capabilities: capabilityMatrix() }, null, 2),
    );
    return;
  }

  if (cmd === 'scan') {
    const target = rest[0];
    if (!target) {
      usage();
      process.exit(1);
    }
    const output = flag(rest, '--output') ?? 'scan.bundle.json';
    const bundle = await scanPath(path.resolve(target), {
      policyDir: path.resolve('policies/default'),
      project: path.basename(path.resolve(target)),
    });
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    await writeFile(path.resolve(output), JSON.stringify(bundle, null, 2));
    console.log(
      JSON.stringify(
        {
          ok: true,
          output: path.resolve(output),
          project: bundle.graph.scan.project,
          resources: bundle.graph.resources.length,
          edges: bundle.graph.edges.length,
          findings: bundle.graph.findings.length,
          drifts: bundle.graph.drifts.length,
          completeness: bundle.graph.completeness.overall,
          contentHash: bundle.graph.scan.contentHash,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === 'inspect') {
    const file = rest[0];
    const bundle = await loadBundle(file);
    console.log(
      JSON.stringify(
        {
          project: bundle.graph.scan.project,
          generatedAt: bundle.graph.scan.generatedAt,
          adapters: bundle.graph.scan.adapters,
          resources: bundle.graph.resources.length,
          edges: bundle.graph.edges.length,
          findings: bundle.graph.findings.map((f) => ({
            severity: f.severity,
            title: f.title,
            blocksSignOff: f.blocksSignOff,
          })),
          drifts: bundle.graph.drifts.length,
          unsupported: bundle.graph.unsupported.length,
          completeness: bundle.graph.completeness,
          narrative: bundle.graph.narrative,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === 'compare') {
    const [a, b] = rest;
    const baseline = await loadBundle(a);
    const candidate = await loadBundle(b);
    const comparison = compareBundles(baseline, candidate);
    console.log(renderDiffMarkdown(comparison));
    return;
  }

  if (cmd === 'report') {
    const file = rest[0];
    const format = flag(rest, '--format') ?? 'html';
    const output = flag(rest, '--output') ?? (format === 'html' ? 'report.html' : 'report.json');
    const bundle = await loadBundle(file);
    const content = format === 'json' ? JSON.stringify(bundle, null, 2) : renderHtmlReport(bundle);
    await writeFile(path.resolve(output), content);
    console.log(JSON.stringify({ ok: true, output: path.resolve(output), format }, null, 2));
    return;
  }

  usage();
  process.exit(1);
}

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx >= 0) return args[idx + 1];
  return undefined;
}

async function loadBundle(file: string): Promise<ScanBundle> {
  const raw = JSON.parse(await readFile(path.resolve(file), 'utf8'));
  if (!validateBundle(raw)) throw new Error(`Invalid scan bundle: ${file}`);
  return raw;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
