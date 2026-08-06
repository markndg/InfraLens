import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanPath } from '@infralens/scanner';
import {
  buildMission,
  buildTimeline,
  computeBusinessBlastRadius,
  dnaBars,
  enrichArchitectureIntelligence,
  generateArchitectureStory,
  projectGraph,
  reasonAboutComponent,
  simulateArchitectureChange,
} from './index.js';

const demoRoot = path.resolve('fixtures/demo-estate');

async function scanDemo() {
  return scanPath(demoRoot, {
    project: 'Retail SaaS reference estate',
    edition: 'commercial',
    policyDir: path.resolve('policies/default'),
  });
}

describe('architecture intelligence v1.3', () => {
  it('infers capabilities and data assets onto one evidence graph', async () => {
    const bundle = await scanDemo();
    const graph = bundle.graph;
    expect(['1.3', '1.4', '2.0']).toContain(graph.version);
    expect(graph.intelligence).toBeTruthy();
    expect(graph.resources.some((r) => r.kind === 'business-capability')).toBe(true);
    expect(graph.resources.some((r) => r.kind === 'data-asset')).toBe(true);
    expect(graph.resources.some((r) => r.kind === 'team')).toBe(true);
    expect(graph.intelligence!.capabilityIds.length).toBeGreaterThan(1);
    expect(graph.intelligence!.story.length).toBeGreaterThan(40);
  });

  it('keeps projection consistency against the same graph', async () => {
    const { graph } = await scanDemo();
    const capability = projectGraph(graph, 'capability');
    const physical = projectGraph(graph, 'physical');
    const data = projectGraph(graph, 'data');
    expect(capability.resources.some((r) => r.kind === 'business-capability')).toBe(true);
    expect(physical.resources.every((r) => r.kind !== 'business-capability')).toBe(true);
    expect(physical.resourceIds.every((id) => graph.resources.some((r) => r.id === id))).toBe(true);
    expect(data.resources.some((r) => r.kind === 'data-asset')).toBe(true);
    expect(projectGraph(graph, 'capability')).toBe(capability);
  });

  it('generates evidence-backed story sentences', async () => {
    const { graph } = await scanDemo();
    const story = generateArchitectureStory(graph);
    expect(story.length).toBeGreaterThan(2);
    for (const s of story) {
      if (s.nodeIds.length) {
        expect(s.nodeIds.every((id) => graph.resources.some((r) => r.id === id))).toBe(true);
      }
    }
  });

  it('computes business blast radius with capabilities and data', async () => {
    const { graph } = await scanDemo();
    const route = graph.resources.find((r) => r.kind === 'route');
    expect(route).toBeTruthy();
    const blast = computeBusinessBlastRadius(graph, route!.id);
    expect(blast.reasons.length).toBeGreaterThan(2);
    expect(blast.confidence).toBeGreaterThan(0);
    expect(blast.publicUsersAffected).toBe(true);
  });

  it('reasons about a component from graph traversal only', async () => {
    const { graph } = await scanDemo();
    const workload = graph.resources.find((r) => r.kind === 'workload');
    expect(workload).toBeTruthy();
    const reasoning = reasonAboutComponent(graph, workload!.id);
    expect(reasoning.what).toContain(workload!.displayName);
    expect(reasoning.certainty.length).toBeGreaterThan(0);
    expect(reasoning.evidenceIds.length).toBeGreaterThan(0);
  });

  it('builds mission plans that highlight graph nodes', async () => {
    const { graph } = await scanDemo();
    const mission = buildMission(graph, 'public-exposure');
    expect(mission.steps.length).toBeGreaterThan(0);
    expect(mission.conclusion.length).toBeGreaterThan(10);
    const ids = mission.steps.flatMap((s) => s.highlightIds);
    expect(ids.every((id) => graph.resources.some((r) => r.id === id))).toBe(true);
  });

  it('builds a timeline across scan bundles', async () => {
    const current = await scanDemo();
    const baseline = structuredClone(current);
    baseline.graph.scan.id = 'baseline';
    baseline.graph.scan.generatedAt = '2026-01-01T00:00:00.000Z';
    const admin = baseline.graph.resources.find((r) => r.name === 'admin' && r.kind === 'route');
    if (admin) {
      baseline.graph.resources = baseline.graph.resources.filter((r) => r.id !== admin.id);
      baseline.graph.edges = baseline.graph.edges.filter((e) => e.source !== admin.id && e.target !== admin.id);
    }
    const timeline = buildTimeline([baseline, current]);
    expect(timeline.frames).toHaveLength(2);
    expect(timeline.frames[1].added.length + timeline.frames[1].removed.length).toBeGreaterThan(0);
  });

  it('exposes Architecture DNA bars', async () => {
    const { graph } = await scanDemo();
    const bars = dnaBars(graph.intelligence!.dna);
    expect(bars).toHaveLength(7);
    expect(bars.every((b) => b.bar.includes('█') || b.bar.includes('░'))).toBe(true);
  });

  it('recalculates policy/approvals under simulation', async () => {
    const { graph } = await scanDemo();
    const db = graph.resources.find((r) => r.kind === 'relational-database');
    expect(db).toBeTruthy();
    const result = simulateArchitectureChange(graph, { type: 'enable-multi-az', resourceId: db!.id });
    expect(result.note).toMatch(/Multi-AZ/i);
    expect(result.graph.resources.find((r) => r.id === db!.id)?.metadata.multi_az).toBe(true);
    expect(result.approvalImpact.length).toBeGreaterThan(5);
  });

  it('enrich is idempotent for semantic node kinds', async () => {
    const { graph } = await scanDemo();
    const before = graph.resources.filter((r) => r.kind === 'business-capability').length;
    enrichArchitectureIntelligence(graph);
    const after = graph.resources.filter((r) => r.kind === 'business-capability').length;
    expect(after).toBe(before);
  });
});
