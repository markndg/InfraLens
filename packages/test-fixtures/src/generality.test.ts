import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enrichArchitectureIntelligence } from '@infralens/architecture-intelligence';
import { renderHtmlReport } from '@infralens/reporting';
import { scanPath } from '@infralens/scanner';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

interface EstateSpec {
  id: string;
  label: string;
  fixtureDir: string;
  minResources: number;
  expectKinds: string[];
}

const ESTATES: EstateSpec[] = [
  {
    id: 'retail-saas',
    label: 'Retail SaaS',
    fixtureDir: 'fixtures/demo-estate',
    minResources: 40,
    expectKinds: ['relational-database', 'workload', 'route'],
  },
  {
    id: 'serverless-aws',
    label: 'Serverless AWS',
    fixtureDir: 'fixtures/serverless-aws',
    minResources: 20,
    expectKinds: ['function', 'queue', 'bucket'],
  },
  {
    id: 'k8s-microservices',
    label: 'Kubernetes Services',
    fixtureDir: 'fixtures/k8s-microservices',
    minResources: 15,
    expectKinds: ['workload', 'service', 'network-policy'],
  },
  {
    id: 'legacy-hybrid',
    label: 'Legacy Hybrid',
    fixtureDir: 'fixtures/legacy-hybrid',
    minResources: 10,
    expectKinds: ['relational-database', 'bucket'],
  },
];

const SECRETISH = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /aws_secret_access_key\s*=\s*["']?[A-Za-z0-9/+]{20,}/i,
];

function loadExpected(fixtureDir: string): Record<string, unknown> | null {
  const p = path.join(root, fixtureDir, 'expected', 'stats.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
}

function danglingEdgeCount(graph: {
  resources: { id: string }[];
  edges: { source: string; target: string }[];
}): number {
  const ids = new Set(graph.resources.map((r) => r.id));
  return graph.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target)).length;
}

async function assessEstate(estate: EstateSpec) {
  const target = path.join(root, estate.fixtureDir);
  const first = await scanPath(target, {
    project: estate.label,
    policyDir: path.join(root, 'policies/default'),
  });
  const second = await scanPath(target, {
    project: estate.label,
    policyDir: path.join(root, 'policies/default'),
  });

  const scanOk = first.graph.resources.length >= estate.minResources;
  const graphOk = danglingEdgeCount(first.graph) === 0;
  const detOk =
    first.graph.resources.length === second.graph.resources.length &&
    first.graph.edges.length === second.graph.edges.length;

  enrichArchitectureIntelligence(first.graph);
  const hasIntents = first.graph.resources.some((r) => r.kind === 'intent');
  const completenessOk =
    first.graph.completeness.dimensions.length > 0 ||
    /inferred|unknown|unresolved|missing|incomplete/i.test(first.graph.completeness.summary);

  const html = renderHtmlReport(first);
  const reportOk = html.includes('InfraLens') && html.length > 200;
  const secretFree = !SECRETISH.some((re) => re.test(JSON.stringify(first)) || re.test(html));

  const expected = loadExpected(estate.fixtureDir);
  if (expected) {
    if (typeof expected.minResources === 'number') {
      expect(first.graph.resources.length).toBeGreaterThanOrEqual(expected.minResources as number);
    }
    if (typeof expected.minEdges === 'number') {
      expect(first.graph.edges.length).toBeGreaterThanOrEqual(expected.minEdges as number);
    }
    if (Array.isArray(expected.keyRelations)) {
      for (const rel of expected.keyRelations as string[]) {
        expect(
          first.graph.edges.some((e) => e.relation === rel),
          `${estate.label} missing relation ${rel}`,
        ).toBe(true);
      }
    }
  }

  const kinds = new Set(first.graph.resources.map((r) => r.kind.toLowerCase()));
  for (const k of estate.expectKinds) {
    expect(kinds.has(k.toLowerCase()), `${estate.label} missing kind ${k}`).toBe(true);
  }

  if (estate.id === 'k8s-microservices') {
    const byNs = first.graph.resources.filter(
      (r) =>
        (r.name === 'payments-api' || r.name === 'billing-api') &&
        (r.kind === 'workload' || r.kind === 'service'),
    );
    expect(byNs.length).toBeGreaterThanOrEqual(2);
  }

  expect(scanOk).toBe(true);
  expect(graphOk).toBe(true);
  expect(detOk).toBe(true);
  expect(hasIntents).toBe(true);
  expect(completenessOk).toBe(true);
  expect(reportOk).toBe(true);
  expect(secretFree).toBe(true);

  return {
    estate: estate.label,
    scan: scanOk ? 'PASS' : 'FAIL',
    graph: graphOk && detOk ? 'PASS' : 'FAIL',
    projections: first.graph.intelligence ? 'PASS' : 'FAIL',
    governance: hasIntents ? 'PASS' : 'FAIL',
    report: reportOk && secretFree ? 'PASS' : 'FAIL',
  };
}

describe('reference estate generality campaign', () => {
  it('validates all estates and prints matrix', async () => {
    const matrix = [];
    for (const estate of ESTATES) {
      matrix.push(await assessEstate(estate));
    }

    const header =
      'Estate'.padEnd(24) +
      'Scan'.padEnd(8) +
      'Graph'.padEnd(8) +
      'Projections'.padEnd(14) +
      'Governance'.padEnd(14) +
      'Report';
    const rows = matrix.map(
      (r) =>
        r.estate.padEnd(24) +
        r.scan.padEnd(8) +
        r.graph.padEnd(8) +
        r.projections.padEnd(14) +
        r.governance.padEnd(14) +
        r.report,
    );
    // eslint-disable-next-line no-console
    console.log(['', header, ...rows].join('\n'));

    expect(matrix).toHaveLength(ESTATES.length);
    expect(matrix.every((r) => r.scan === 'PASS' && r.graph === 'PASS' && r.report === 'PASS')).toBe(
      true,
    );
  }, 120_000);
});
