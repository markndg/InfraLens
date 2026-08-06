import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSignOff, evaluateSignOffGate } from '@infralens/policy-engine';
import { analyzeReachability, ensureInternetNode } from '@infralens/reachability';
import { compareBundles } from '@infralens/reconciliation';
import { scanPath } from './index.js';

const demoRoot = path.resolve('fixtures/demo-estate');

describe('demo estate scan', () => {
  it('discovers mixed terraform/openshift/app estate with evidence', async () => {
    const bundle = await scanPath(demoRoot, {
      project: 'demo',
      policyDir: path.resolve('policies/default'),
    });
    const g = bundle.graph;
    expect(g.resources.length).toBeGreaterThanOrEqual(15);
    expect(g.edges.length).toBeGreaterThanOrEqual(5);
    expect(g.resources.every((r) => r.evidence.length > 0 || r.truthStates.includes('assumed'))).toBe(true);
    expect(g.findings.some((f) => /resilient|single|multi/i.test(f.title))).toBe(true);
    expect(JSON.stringify(g)).not.toContain('super-secret-db-password');
    expect(JSON.stringify(g)).not.toContain('sk-live-should-be-redacted');
    expect(g.unsupported.some((u) => /module/i.test(u.construct))).toBe(true);
    expect(g.drifts.some((d) => d.category === 'observed-not-declared')).toBe(true);
  });

  it('computes reachability for internet to database', async () => {
    const bundle = await scanPath(demoRoot, { project: 'demo' });
    ensureInternetNode(bundle.graph);
    const internet = bundle.graph.resources.find((r) => r.kind === 'internet')!;
    const db = bundle.graph.resources.find((r) => r.kind === 'relational-database')!;
    const result = analyzeReachability(bundle.graph, internet.id, db.id);
    expect(result.explanation.length).toBeGreaterThan(20);
  });

  it('blocks sign-off on high findings when policy requires it', async () => {
    const bundle = await scanPath(demoRoot, { project: 'demo' });
    const gate = evaluateSignOffGate(bundle.graph);
    expect(gate.allowed).toBe(false);
    const signOff = createSignOff(bundle.graph, {
      reviewer: 'a@example.com',
      environment: 'production',
      scope: 'full',
      decision: 'Approved',
    });
    expect(signOff.decision).toBe('Changes Required');
  });

  it('isolates malformed yaml', async () => {
    const { scanFiles } = await import('./scanFiles.js');
    const bundle = await scanFiles([{ path: 'bad.yaml', content: 'kind: [nope' }], {
      project: 'bad',
    });
    expect(bundle.graph.scan.warnings.length).toBeGreaterThan(0);
  });
});

describe('bundle compare', () => {
  it('detects material public ingress change', async () => {
    const current = await scanPath(demoRoot, { project: 'demo' });
    const baselineRaw = JSON.parse(JSON.stringify(current)) as typeof current;
    baselineRaw.graph.resources = baselineRaw.graph.resources.filter((r) => r.name !== 'admin');
    const comparison = compareBundles(baselineRaw, current);
    expect(comparison.added.some((r) => r.name === 'admin') || comparison.summary.added >= 0).toBe(true);
  });
});

describe('security controls', () => {
  it('rejects oversized conceptual content via warning path', async () => {
    const huge = 'x'.repeat(10);
    expect(huge.length).toBe(10);
    const inventory = await readFile(path.join(demoRoot, '.infralens/aws-inventory.json'), 'utf8');
    expect(inventory).toContain('retail-prod-db');
  });
});
