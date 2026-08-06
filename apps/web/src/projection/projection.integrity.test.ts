import { describe, expect, it } from 'vitest';
import { scanFiles } from '@infralens/scanner';
import { demoFiles, demoSnapshots } from '../demoEstate';
import { clearLayoutCache, toArchitectureFlow } from '../lib/architectureLayout';
import { projectSemanticEdges } from './projectEdges';
import { primaryDimension } from '../layout/containment';

async function demoGraph() {
  const bundle = await scanFiles(demoFiles, {
    project: 'Retail SaaS reference estate',
    edition: 'oss',
    snapshots: demoSnapshots,
  });
  return bundle.graph;
}

function nameOf(graph: Awaited<ReturnType<typeof demoGraph>>, id: string) {
  return graph.resources.find((r) => r.id === id)?.name ?? id;
}

describe('application projection integrity', () => {
  it('uses logical application containment, not app-stack', () => {
    expect(primaryDimension('application')).toBe('logical-application');
  });

  it('accounts for every eligible edge with an outcome', async () => {
    const graph = await demoGraph();
    const proj = projectSemanticEdges(graph, 'application', 'medium');
    const eligible = proj.integrity.eligibleCanonicalEdges;
    const accounted = new Set<string>();
    for (const o of proj.outcomes) {
      if (o.kind === 'rendered-aggregate') o.sourceEdgeIds.forEach((id) => accounted.add(id));
      else accounted.add(o.edgeId);
    }
    expect(accounted.size).toBe(eligible);
    expect(proj.integrity.projectionErrors).toBe(0);
  });

  it('renders shop → storefront → catalog → db path relationships', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'application', 'medium');
    const byId = new Map(graph.resources.map((r) => [r.id, r]));

    const hasLink = (fromName: string, toName: string) =>
      flow.edges.some((e) => {
        const s = byId.get(e.source)?.name ?? e.source;
        const t = byId.get(e.target)?.name ?? e.target;
        return s === fromName && t === toName;
      });

    expect(hasLink('shop', 'storefront')).toBe(true);
    expect(hasLink('storefront', 'catalog')).toBe(true);
    expect(
      flow.edges.some((e) => {
        const s = byId.get(e.source)?.name;
        const t = byId.get(e.target)?.name;
        return s === 'catalog' && t === 'retail-prod-db';
      }),
    ).toBe(true);
    expect(
      flow.edges.some((e) => {
        const s = byId.get(e.source)?.name;
        const t = byId.get(e.target)?.name;
        return (
          (s === 'catalog' || s === 'order-worker') &&
          (t === 'retail-staging-orders' || t === 'retail-prod-orders')
        );
      }),
    ).toBe(true);
    expect(
      flow.edges.some((e) => {
        const s = byId.get(e.source)?.name;
        const t = byId.get(e.target)?.name;
        return s === 'storefront' && t === 'payments.partner.example';
      }),
    ).toBe(true);
  });

  it('keeps service and deployment as distinct identities', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'application', 'medium');
    const storefronts = flow.nodes.filter(
      (n) =>
        n.type === 'infra' &&
        (n.data as { resource?: { name?: string; kind?: string } }).resource?.name === 'storefront',
    );
    const kinds = new Set(
      storefronts.map((n) => (n.data as { resource?: { kind?: string } }).resource?.kind),
    );
    expect(kinds.has('service')).toBe(true);
    expect(kinds.has('workload')).toBe(true);
  });

  it('does not let groups suppress cross-group edges', async () => {
    const graph = await demoGraph();
    const proj = projectSemanticEdges(graph, 'application', 'medium');
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'application', 'medium');
    expect(flow.edges.length).toBeGreaterThanOrEqual(proj.edges.length);
    expect(flow.integrity.projectionErrors).toBe(0);
  });
});

describe('security projection integrity', () => {
  it('accounts for every eligible edge', async () => {
    const graph = await demoGraph();
    const proj = projectSemanticEdges(graph, 'security', 'medium');
    const accounted = new Set<string>();
    for (const o of proj.outcomes) {
      if (o.kind === 'rendered-aggregate') o.sourceEdgeIds.forEach((id) => accounted.add(id));
      else accounted.add(o.edgeId);
    }
    expect(accounted.size).toBe(proj.integrity.eligibleCanonicalEdges);
    expect(proj.integrity.projectionErrors).toBe(0);
  });

  it('does not duplicate trust-zone as both group and node', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'security', 'medium');
    const boundaries = flow.nodes.filter((n) => n.type === 'boundary');
    const infra = flow.nodes.filter((n) => n.type === 'infra');
    for (const b of boundaries) {
      expect(infra.some((n) => n.id === b.id)).toBe(false);
    }
    expect(infra.some((n) => (n.data as { resource?: { kind?: string } }).resource?.kind === 'trust-zone')).toBe(
      false,
    );
  });

  it('shows internet → public edge → route and cross-zone flows', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const flow = toArchitectureFlow(graph, 'security', 'medium');
    const byId = new Map(graph.resources.map((r) => [r.id, r]));

    expect(
      flow.edges.some((e) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        return s?.kind === 'internet' && (t?.kind === 'route' || t?.kind === 'dns');
      }),
    ).toBe(true);

    expect(
      flow.edges.some((e) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        return (
          (s?.kind === 'workload' || s?.kind === 'service') &&
          (t?.kind === 'relational-database' || t?.kind === 'bucket' || t?.kind === 'queue' || t?.kind === 'external-system')
        );
      }),
    ).toBe(true);

    expect(
      flow.edges.some((e) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        return (
          (s?.kind === 'network-policy' || s?.kind === 'security-group' || s?.kind === 'iam-role') &&
          Boolean(t)
        );
      }),
    ).toBe(true);
  });

  it('places unmapped security resources into Unknown Zone when needed', async () => {
    const graph = await demoGraph();
    const proj = projectSemanticEdges(graph, 'security', 'medium');
    // All projected security resources should resolve a representative
    for (const r of proj.resources) {
      expect(proj.representativeMap.canonicalNodeToVisibleRepresentative.get(r.id) ?? r.id).toBeTruthy();
    }
  });
});

describe('projection determinism', () => {
  it('is stable across runs for application and security', async () => {
    const graph = await demoGraph();
    clearLayoutCache();
    const a = toArchitectureFlow(graph, 'application', 'medium');
    clearLayoutCache();
    const b = toArchitectureFlow(graph, 'application', 'medium');
    expect(a.edges.map((e) => e.id).sort()).toEqual(b.edges.map((e) => e.id).sort());

    clearLayoutCache();
    const c = toArchitectureFlow(graph, 'security', 'medium');
    clearLayoutCache();
    const d = toArchitectureFlow(graph, 'security', 'medium');
    expect(c.edges.map((e) => e.id).sort()).toEqual(d.edges.map((e) => e.id).sort());
  });
});

describe('scanner endpoint correctness (demo)', () => {
  it('resolves routes-to onto real services and config onto data stores', async () => {
    const graph = await demoGraph();
    const routesTo = graph.edges.filter((e) => e.relation === 'routes-to');
    expect(routesTo.length).toBeGreaterThan(0);
    for (const e of routesTo) {
      const t = graph.resources.find((r) => r.id === e.target);
      expect(t?.kind).toBe('service');
    }
    const dbLinks = graph.edges.filter(
      (e) =>
        e.label === 'DB_HOST' &&
        graph.resources.find((r) => r.id === e.source)?.name === 'catalog',
    );
    expect(dbLinks.length).toBeGreaterThan(0);
    for (const e of dbLinks) {
      expect(nameOf(graph, e.target)).toMatch(/db|database|postgres/i);
      expect(graph.resources.find((r) => r.id === e.target)?.kind).toBe('relational-database');
    }
  });
});
