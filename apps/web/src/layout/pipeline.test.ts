import { describe, expect, it } from 'vitest';
import { scanFiles } from '@infralens/scanner';
import { demoFiles, demoSnapshots } from '../demoEstate';
import { clearLayoutCache, toArchitectureFlow } from '../lib/architectureLayout';
import { runLayoutPipeline } from './pipeline';
import { verifyLayout } from './verify';
import { primaryDimension } from './containment';

async function demoGraph() {
  const bundle = await scanFiles(demoFiles, {
    project: 'Retail SaaS reference estate',
    edition: 'oss',
    snapshots: demoSnapshots,
  });
  return bundle.graph;
}

describe('hierarchical layout pipeline', () => {
  it('uses a single primary containment dimension per view', () => {
    expect(primaryDimension('application')).toBe('logical-application');
    expect(primaryDimension('architecture')).toBe('application');
    expect(primaryDimension('platform')).toBe('platform');
    expect(primaryDimension('network')).toBe('network');
    expect(primaryDimension('capability')).toBe('capability');
  });

  it('keeps every leaf inside its parent container', async () => {
    const graph = await demoGraph();
    const { layout } = runLayoutPipeline(graph, 'architecture', 'medium');
    const violations = verifyLayout(layout).filter((v) => v.code === 'node-outside-parent');
    expect(violations).toEqual([]);
  });

  it('prevents sibling group overlaps', async () => {
    const graph = await demoGraph();
    const { layout } = runLayoutPipeline(graph, 'application', 'medium');
    const violations = verifyLayout(layout).filter((v) => v.code === 'group-overlap');
    expect(violations).toEqual([]);
  });

  it('sizes containers from measured children', async () => {
    const graph = await demoGraph();
    const { layout } = runLayoutPipeline(graph, 'architecture', 'medium');
    const violations = verifyLayout(layout).filter((v) => v.code === 'container-too-small');
    expect(violations).toEqual([]);
  });

  it('is deterministic across runs', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const a = toArchitectureFlow(graph, 'architecture', 'medium');
    clearLayoutCache();
    const b = toArchitectureFlow(graph, 'architecture', 'medium');
    const pos = (nodes: typeof a.nodes) =>
      nodes
        .filter((n) => n.type === 'infra')
        .map((n) => `${n.id}:${n.position.x}:${n.position.y}:${n.parentId ?? ''}`)
        .sort();
    expect(pos(a.nodes)).toEqual(pos(b.nodes));
  });

  it('parents infra nodes under boundary containers', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'architecture', 'medium');
    const infra = flow.nodes.filter((n) => n.type === 'infra');
    const withParent = infra.filter((n) => n.parentId);
    expect(withParent.length).toBeGreaterThan(0);
    for (const n of withParent) {
      const parent = flow.nodes.find((p) => p.id === n.parentId);
      expect(parent?.type).toBe('boundary');
      // Child clears interior top padding (label is outside the border)
      expect(n.position.y).toBeGreaterThanOrEqual(12);
    }
  });

  it('emits corridor edges with orthogonal waypoints', async () => {
    const graph = await demoGraph();
    const { edges } = runLayoutPipeline(graph, 'architecture', 'medium');
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.type === 'corridor')).toBe(true);
    const withPoints = edges.filter((e) => Array.isArray((e.data as { points?: unknown })?.points));
    expect(withPoints.length).toBeGreaterThan(0);
  });

  it('collapses to container summaries at far zoom', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'architecture', 'far');
    const infra = flow.nodes.filter((n) => n.type === 'infra');
    const boundaries = flow.nodes.filter((n) => n.type === 'boundary');
    expect(infra).toHaveLength(0);
    expect(boundaries.length).toBeGreaterThan(0);
    expect(
      boundaries.every(
        (b) => (b.data as { boundary?: { collapsedSummary?: boolean } }).boundary?.collapsedSummary,
      ),
    ).toBe(true);
  });
});
