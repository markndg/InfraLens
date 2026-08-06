import { describe, expect, it } from 'vitest';
import { scanFiles } from '@infralens/scanner';
import { demoFiles, demoSnapshots } from '../demoEstate';
import { buildBoundaryGroups } from './boundaries';
import { inferTechStack } from './techStack';

async function demoBundle() {
  return scanFiles(demoFiles, {
    project: 'Retail SaaS reference estate',
    edition: 'oss',
    snapshots: demoSnapshots,
  });
}

describe('boundary grouping clarity', () => {
  it('infers React / Spring / Node tech stacks from demo estate', async () => {
    const bundle = await demoBundle();
    const graph = bundle.graph;
    const storefront = graph.resources.find((r) => r.name === 'storefront' && r.kind === 'workload');
    const catalog = graph.resources.find((r) => r.name === 'catalog' && r.kind === 'workload');
    const worker = graph.resources.find((r) => r.name === 'order-worker' && r.kind === 'workload');

    expect(storefront && inferTechStack(storefront, graph)?.techKey).toBe('react');
    expect(catalog && inferTechStack(catalog, graph)?.techKey).toBe('spring');
    expect(worker && inferTechStack(worker, graph)?.techKey).toBe('node');
  });

  it('labels application view groups by app type stacks', async () => {
    const bundle = await demoBundle();
    const groups = buildBoundaryGroups(bundle.graph, bundle.graph.resources, 'application');
    expect(groups.some((g) => g.kind === 'app-stack')).toBe(true);
    const frontend = groups.find((g) => /frontend/i.test(g.label) && /react/i.test(g.label));
    const backend = groups.find((g) => /backend/i.test(g.label) && /spring/i.test(g.label));
    expect(frontend?.memberIds.length).toBeGreaterThanOrEqual(2);
    expect(backend?.memberIds.length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces platform and network groups with clarifying badges', async () => {
    const bundle = await demoBundle();
    const platformGroups = buildBoundaryGroups(bundle.graph, bundle.graph.resources, 'platform');
    expect(platformGroups.some((g) => g.kind === 'platform' || g.kind === 'cluster')).toBe(true);
    expect(platformGroups.some((g) => g.badges.length > 0 || g.subtitle)).toBe(true);

    const networkGroups = buildBoundaryGroups(bundle.graph, bundle.graph.resources, 'network');
    expect(networkGroups.some((g) => g.kind === 'network' || g.kind === 'vpc' || g.kind === 'region')).toBe(
      true,
    );
    const net = networkGroups.find((g) => g.kind === 'network' || /network|vpc/i.test(g.label));
    expect(net?.memberIds.length).toBeGreaterThanOrEqual(2);
  });

  it('enriches architecture application groups with stack subtitle', async () => {
    const bundle = await demoBundle();
    const groups = buildBoundaryGroups(bundle.graph, bundle.graph.resources, 'architecture');
    const app = groups.find((g) => g.kind === 'application');
    expect(app).toBeTruthy();
    expect(app?.subtitle || app?.badges.join(' ')).toMatch(/React|Spring|Node|OpenShift|Kubernetes|AWS/i);
  });
});
