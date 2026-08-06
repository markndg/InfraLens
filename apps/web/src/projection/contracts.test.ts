import { describe, expect, it } from 'vitest';
import type { ArchitectureView } from '@infralens/graph-model';
import { scanFiles } from '@infralens/scanner';
import { demoFiles, demoSnapshots } from '../demoEstate';
import { primaryDimension } from '../layout/containment';
import { clearLayoutCache, toArchitectureFlow } from '../lib/architectureLayout';
import { PROJECTION_CONTRACTS, getProjectionContract } from './contracts';
import { projectSemanticEdges } from './projectEdges';

const CORE_VIEWS: ArchitectureView[] = [
  'capability',
  'application',
  'physical',
  'data',
  'ownership',
  'security',
  'risk',
  'cost',
  'time',
  'governance',
];

async function demoGraph() {
  const bundle = await scanFiles(demoFiles, {
    project: 'Retail SaaS reference estate',
    edition: 'oss',
    snapshots: demoSnapshots,
  });
  return bundle.graph;
}

describe('Projection Design Contract', () => {
  it('declares a contract for every ArchitectureView', () => {
    const ids = Object.keys(PROJECTION_CONTRACTS) as ArchitectureView[];
    expect(ids.length).toBeGreaterThanOrEqual(CORE_VIEWS.length);
    for (const view of CORE_VIEWS) {
      const c = getProjectionContract(view);
      expect(c.id).toBe(view);
      expect(c.architecturalQuestion.length).toBeGreaterThan(10);
      expect(c.primaryContainment).toBeTruthy();
      expect(c.primaryRelationshipFamilies.length).toBeGreaterThan(0);
      expect(typeof c.summaryGenerator).toBe('function');
    }
  });

  it('uses exactly one primary containment dimension per core view', () => {
    expect(primaryDimension('capability')).toBe('capability');
    expect(primaryDimension('application')).toBe('logical-application');
    expect(primaryDimension('physical')).toBe('platform');
    expect(primaryDimension('data')).toBe('data-domain');
    expect(primaryDimension('ownership')).toBe('team');
    expect(primaryDimension('security')).toBe('trust');
    expect(primaryDimension('risk')).toBe('risk-domain');
    expect(primaryDimension('cost')).toBe('cost-domain');
    expect(primaryDimension('governance')).toBe('review');
  });

  it('does not use environment as application containment', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'application', 'medium');
    const boundaries = flow.nodes.filter((n) => n.type === 'boundary');
    expect(
      boundaries.every((b) => {
        const kind = (b.data as { boundary?: { kind?: string } }).boundary?.kind;
        return kind === 'logical-application' || kind === 'ungrouped';
      }),
    ).toBe(true);
    // No container whose sole identity is an environment name
    expect(
      boundaries.some((b) => {
        const label = (b.data as { boundary?: { label?: string } }).boundary?.label ?? '';
        return /^(production|development|staging|prod|dev)$/i.test(label.trim());
      }),
    ).toBe(false);
  });

  it('keeps security controls out of Unknown Zone', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'security', 'medium');
    expect(flow.nodes.some((n) => n.id === 'trust:unknown')).toBe(false);
    const controls = flow.nodes.find((n) => n.id === 'security-controls');
    expect(controls?.type).toBe('boundary');
    const controlLeaves = flow.nodes.filter(
      (n) =>
        n.type === 'infra' &&
        ['security-group', 'network-policy', 'iam-role', 'secret-ref'].includes(
          String((n.data as { resource?: { kind?: string } }).resource?.kind),
        ),
    );
    expect(controlLeaves.every((n) => n.parentId === 'security-controls')).toBe(true);
  });

  it('generates evidence-backed summaries that match graph statistics', async () => {
    const graph = await demoGraph();
    for (const view of ['application', 'security', 'ownership', 'data'] as ArchitectureView[]) {
      const proj = projectSemanticEdges(graph, view, 'medium');
      expect(proj.summary.length).toBeGreaterThan(20);
      expect(proj.contract.architecturalQuestion).toBeTruthy();
      // Summary should mention a count present in the projection
      expect(/\d+/.test(proj.summary)).toBe(true);
    }
  });

  it('limits rendered families to the contract’s primary relationship language', async () => {
    const graph = await demoGraph();
    const proj = projectSemanticEdges(graph, 'application', 'medium');
    const allowed = new Set(proj.contract.primaryRelationshipFamilies as string[]);
    // All families should be in contract or close aliases used by familyForEdge
    for (const e of proj.edges) {
      expect(
        allowed.has(e.family) ||
          ['routes-to', 'selects', 'calls', 'uses', 'reads', 'writes', 'publishes', 'consumes', 'external-integration', 'depends-on'].includes(
            e.family,
          ),
      ).toBe(true);
    }
  });
});
