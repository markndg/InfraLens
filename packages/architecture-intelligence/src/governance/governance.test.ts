import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanPath } from '@infralens/scanner';
import {
  generateGovernanceReport,
  parseAdrMarkdown,
  projectGraph,
  replayHistoricalReview,
  simulateAssumptionFailure,
  validateIntents,
} from '../index.js';

const demoRoot = path.resolve('fixtures/demo-estate');

async function scanDemo() {
  return scanPath(demoRoot, {
    project: 'Retail SaaS reference estate',
    edition: 'commercial',
    policyDir: path.resolve('policies/default'),
  });
}

describe('architecture governance v2.0', () => {
  it('parses ADRs into structured decisions', () => {
    const parsed = parseAdrMarkdown(
      'docs/adr/0001-use-postgresql.md',
      `# ADR-0001: Use PostgreSQL\n\n## Status\n\nAccepted\n\n## Context\n\nNeed HA DB\n\n## Decision\n\nUse PostgreSQL\n\n## Alternatives\n\n- DynamoDB\n`,
    );
    expect(parsed?.number).toBe('0001');
    expect(parsed?.title).toMatch(/PostgreSQL/i);
    expect(parsed?.status).toMatch(/Accepted/i);
    expect(parsed?.alternatives.length).toBeGreaterThan(0);
  });

  it('builds governance graph with decisions, intents, assumptions, contracts', async () => {
    const { graph } = await scanDemo();
    expect(graph.version).toBe('2.0');
    expect(graph.intelligence?.governance).toBeTruthy();
    expect(graph.resources.some((r) => r.kind === 'adr')).toBe(true);
    expect(graph.resources.some((r) => r.kind === 'architectural-decision')).toBe(true);
    expect(graph.resources.some((r) => r.kind === 'intent')).toBe(true);
    expect(graph.resources.some((r) => r.kind === 'assumption')).toBe(true);
    expect(graph.resources.some((r) => r.kind === 'architecture-contract')).toBe(true);
    expect(graph.intelligence!.governance!.dashboard.brokenAssumptions).toBeGreaterThan(0);
  });

  it('validates intents and detects HA drift', async () => {
    const { graph } = await scanDemo();
    const results = validateIntents(graph);
    const ha = results.find((r) =>
      graph.resources.find((x) => x.id === r.intentId)?.subtype === 'highly-available',
    );
    expect(ha?.satisfaction).toBe('violated');
  });

  it('projects a decision graph from the same evidence graph', async () => {
    const { graph } = await scanDemo();
    const projection = projectGraph(graph, 'decision');
    expect(projection.resources.some((r) => r.kind === 'architectural-decision')).toBe(true);
    expect(projection.resourceIds.every((id) => graph.resources.some((r) => r.id === id))).toBe(true);
  });

  it('simulates consequences of a failed assumption', async () => {
    const { graph } = await scanDemo();
    const failed = graph.resources.find(
      (r) => r.kind === 'assumption' && (r.metadata.status === 'failed' || r.metadata.status === 'unsupported'),
    );
    expect(failed).toBeTruthy();
    const chain = simulateAssumptionFailure(graph, failed!.id);
    expect(chain.steps.length).toBeGreaterThan(2);
    expect(chain.summary).toMatch(/Assumption false|degraded|Approval/i);
  });

  it('replays a historical review using only that evidence', async () => {
    const historical = await scanDemo();
    const result = replayHistoricalReview(historical);
    expect(result.usedOnlyHistoricalEvidence).toBe(true);
    expect(result.evidenceHash).toBe(historical.graph.scan.contentHash);
    expect(result.review.stages.length).toBeGreaterThan(3);
  });

  it('generates an executive governance report', async () => {
    const { graph } = await scanDemo();
    const report = generateGovernanceReport(graph);
    expect(report.markdown).toMatch(/Executive Summary/);
    expect(report.markdown).toMatch(/Decision Register/);
    expect(report.sections.length).toBeGreaterThan(8);
  });

  it('marks HA ADR invalid when database is single-AZ', async () => {
    const { graph } = await scanDemo();
    const adr = graph.resources.find((r) => r.kind === 'adr' && /postgres/i.test(r.displayName));
    expect(adr).toBeTruthy();
    expect(adr!.metadata.satisfaction).toBe('invalid');
  });
});
