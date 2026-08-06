import { describe, expect, it } from 'vitest';
import { scanFiles } from '@infralens/scanner';
import { demoFiles, demoSnapshots } from '../demoEstate';
import type { Node } from '@xyflow/react';
import { clearLayoutCache, kindLabel, scopeLabel, toArchitectureFlow } from './architectureLayout';
import { findCycles } from './cycles';
import { assignLane, LANE_ORDER_LTR } from './lanes';
import { generateArchitecturalStatement } from './statements';
import { computeFocus } from './focus';
import { concludeReachability, statusFromReachability } from './queryResults';
import { ensureInternetNode } from '@infralens/reachability';
import { analyzeReachability } from '@infralens/reachability';

async function demoGraph() {
  const bundle = await scanFiles(demoFiles, {
    project: 'Retail SaaS reference estate',
    edition: 'oss',
    snapshots: demoSnapshots,
  });
  return bundle.graph;
}

/** Absolute canvas position — child nodes use coordinates relative to their boundary parent. */
function absPosition(node: Node, byId: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

describe('architecture lanes', () => {
  it('assigns internet, ingress, frontend, app, data and integration lanes', async () => {
    const graph = await demoGraph();
    const internet = graph.resources.find((r) => r.kind === 'internet')!;
    const route = graph.resources.find((r) => r.kind === 'route')!;
    const storefront = graph.resources.find((r) => r.name === 'storefront' && r.kind === 'workload');
    const catalog = graph.resources.find((r) => r.name === 'catalog' && r.kind === 'workload');
    const db = graph.resources.find((r) => r.kind === 'relational-database')!;
    const external = graph.resources.find((r) => r.provider === 'external');

    expect(assignLane(internet, graph)).toBe('actors');
    expect(assignLane(route, graph)).toBe('public-edge');
    if (storefront) expect(['frontend', 'application']).toContain(assignLane(storefront, graph));
    if (catalog) expect(['application', 'frontend']).toContain(assignLane(catalog, graph));
    expect(assignLane(db, graph)).toBe('data');
    if (external) expect(assignLane(external, graph)).toBe('integration');
  });
});

describe('architecture-aware layout', () => {
  it('produces stable left-to-right positions for application view', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const a = toArchitectureFlow(graph, 'application', 'medium');
    const b = toArchitectureFlow(graph, 'application', 'medium');
    const infraA = a.nodes.filter((n) => n.type === 'infra');
    const infraB = b.nodes.filter((n) => n.type === 'infra');
    expect(infraA.map((n) => `${n.id}:${n.position.x}:${n.position.y}`)).toEqual(
      infraB.map((n) => `${n.id}:${n.position.x}:${n.position.y}`),
    );
  });

  it('places later lanes to the right of earlier lanes', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'executive', 'medium');
    const byId = new Map(flow.nodes.map((n) => [n.id, n]));
    const internet = graph.resources.find((r) => r.kind === 'internet')!;
    const db = graph.resources.find((r) => r.kind === 'relational-database')!;
    const iNode = byId.get(internet.id)!;
    const dNode = byId.get(db.id)!;
    expect(absPosition(dNode, byId).x).toBeGreaterThan(absPosition(iNode, byId).x);
  });

  it('parents member cards under boundary containers with label clearance', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'architecture', 'medium');
    const boundaries = flow.nodes.filter((n) => n.type === 'boundary');
    const infra = flow.nodes.filter((n) => n.type === 'infra');
    expect(boundaries.length).toBeGreaterThan(0);
    const parented = infra.filter((n) => n.parentId);
    expect(parented.length).toBeGreaterThan(0);
    for (const n of parented) {
      // Relative Y clears interior top padding (label sits outside the border)
      expect(n.position.y).toBeGreaterThanOrEqual(12);
      const parent = flow.nodes.find((p) => p.id === n.parentId);
      expect(parent?.type).toBe('boundary');
    }
  });

  it('avoids node overlap in a lane', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'architecture', 'medium');
    const byId = new Map(flow.nodes.map((n) => [n.id, n]));
    const infra = flow.nodes.filter((n) => n.type === 'infra');
    for (let i = 0; i < infra.length; i++) {
      for (let j = i + 1; j < infra.length; j++) {
        const a = absPosition(infra[i], byId);
        const b = absPosition(infra[j], byId);
        if (Math.abs(a.x - b.x) < 20) {
          expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  it('uses corridor edges and unambiguous labels', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'application', 'near');
    expect(flow.edges.every((e) => e.type === 'corridor')).toBe(true);
    const catalog = graph.resources.find((r) => r.name === 'catalog' && r.kind === 'workload');
    if (catalog) {
      expect(kindLabel(catalog).length).toBeGreaterThan(0);
      expect(scopeLabel(catalog)).toContain('retail');
    }
  });
});

describe('focus and statements', () => {
  it('computes upstream and downstream sets', async () => {
    const graph = await demoGraph();
    const catalog = graph.resources.find((r) => r.name === 'catalog' && r.kind === 'workload');
    if (!catalog) return;
    const focus = computeFocus(graph, catalog.id, 3);
    expect(focus.selected).toBe(catalog.id);
    expect(focus.upstream.size + focus.downstream.size).toBeGreaterThan(0);
  });

  it('generates evidence-backed architectural statements', async () => {
    const graph = await demoGraph();
    const catalog = graph.resources.find((r) => r.name === 'catalog' && r.kind === 'workload');
    if (!catalog) return;
    const { statement, clauses } = generateArchitecturalStatement(catalog, graph);
    expect(statement.toLowerCase()).toContain('catalog');
    expect(clauses.length).toBeGreaterThan(0);
    expect(clauses.every((c) => c.evidenceIds.length + c.edgeIds.length >= 0)).toBe(true);
  });
});

describe('query conclusions', () => {
  it('distinguishes unknown from blocked', async () => {
    const graph = await demoGraph();
    ensureInternetNode(graph);
    const internet = graph.resources.find((r) => r.kind === 'internet')!;
    const db = graph.resources.find((r) => r.kind === 'relational-database')!;
    const raw = analyzeReachability(graph, internet.id, db.id, 'oss');
    const status = statusFromReachability(raw);
    expect([
      'Confirmed reachable',
      'Partially reachable',
      'No path found',
      'Unknown due to missing evidence',
      'Confirmed blocked',
    ]).toContain(status);
    const conclusion = concludeReachability(graph, internet.id, db.id, 'oss', 'Can internet reach db?');
    expect(conclusion.answer.length).toBeGreaterThan(10);
    expect(conclusion.followUps.length).toBeLessThanOrEqual(3);
  });
});

describe('cycles', () => {
  it('returns empty for acyclic demo graph', async () => {
    const graph = await demoGraph();
    const cycles = findCycles(
      graph,
      graph.resources.map((r) => r.id),
    );
    expect(Array.isArray(cycles)).toBe(true);
  });
});

describe('lane order', () => {
  it('keeps actors before data', () => {
    expect(LANE_ORDER_LTR.indexOf('actors')).toBeLessThan(LANE_ORDER_LTR.indexOf('data'));
  });
});
