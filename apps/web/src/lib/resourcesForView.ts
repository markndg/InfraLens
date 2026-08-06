import type { ArchitectureView, EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import type { ZoomBand } from './edges';

const VIEW_KINDS: Record<ArchitectureView, Set<string> | 'all'> = {
  executive: new Set([
    'internet',
    'route',
    'ingress',
    'workload',
    'relational-database',
    'bucket',
    'queue',
    'external-system',
    'dns',
  ]),
  architecture: new Set([
    'internet',
    'route',
    'ingress',
    'service',
    'workload',
    'relational-database',
    'bucket',
    'queue',
    'external-system',
    'dns',
    'cache',
  ]),
  application: new Set([
    'internet',
    'route',
    'ingress',
    'service',
    'workload',
    'application',
    'queue',
    'relational-database',
    'bucket',
    'cache',
    'external-system',
  ]),
  platform: new Set([
    'route',
    'ingress',
    'service',
    'workload',
    'config',
    'secret-ref',
    'network-policy',
    'service-account',
    'volume',
  ]),
  network: new Set([
    'internet',
    'dns',
    'load-balancer',
    'route',
    'ingress',
    'service',
    'workload',
    'security-group',
    'network-policy',
    'vpc',
    'subnet',
    'network',
    'relational-database',
  ]),
  data: new Set([
    'data-asset',
    'workload',
    'relational-database',
    'bucket',
    'queue',
    'cache',
    'storage',
    'topic',
    'external-system',
  ]),
  security: new Set([
    'trust-zone',
    'route',
    'ingress',
    'security-group',
    'network-policy',
    'iam-role',
    'iam-policy',
    'secret-ref',
    'external-system',
    'internet',
    'workload',
    'service',
    'relational-database',
    'bucket',
    'queue',
    'cache',
    'dns',
    'load-balancer',
  ]),
  evidence: 'all',
  drift: 'all',
  signoff: new Set(['route', 'ingress', 'workload', 'relational-database', 'bucket', 'queue', 'external-system']),
  physical: new Set([
    'internet',
    'dns',
    'load-balancer',
    'route',
    'ingress',
    'service',
    'workload',
    'vpc',
    'subnet',
    'network',
    'security-group',
    'network-policy',
    'relational-database',
    'bucket',
    'queue',
    'cache',
    'external-system',
  ]),
  capability: new Set([
    'business-capability',
    'platform-system',
    'workload',
    'service',
    'queue',
    'relational-database',
    'bucket',
    'route',
    'ingress',
  ]),
  ownership: new Set(['team', 'workload', 'service', 'relational-database', 'bucket', 'queue', 'route', 'external-system']),
  risk: new Set([
    'business-capability',
    'route',
    'ingress',
    'relational-database',
    'external-system',
    'workload',
    'queue',
    'internet',
  ]),
  cost: new Set(['relational-database', 'bucket', 'workload', 'queue', 'cache', 'load-balancer', 'business-capability']),
  time: 'all',
  dna: new Set(['business-capability', 'team', 'trust-zone', 'data-asset']),
  decision: new Set([
    'architectural-decision',
    'adr',
    'intent',
    'assumption',
    'business-capability',
    'relational-database',
    'queue',
    'bucket',
    'workload',
    'review-record',
  ]),
  governance: new Set([
    'architectural-decision',
    'intent',
    'assumption',
    'architecture-contract',
    'obligation',
    'adr',
    'review-record',
    'business-capability',
    'team',
  ]),
};

export function resourcesForView(
  graph: EvidenceGraph,
  view: ArchitectureView,
  zoomBand: ZoomBand,
): ResourceNode[] {
  const filter = VIEW_KINDS[view];
  let resources = filter === 'all' ? [...graph.resources] : graph.resources.filter((r) => filter.has(r.kind));

  if (view === 'drift') {
    const drifted = new Set(graph.drifts.map((d) => d.resourceId).filter(Boolean) as string[]);
    const newlyRelated = graph.resources.filter(
      (r) => drifted.has(r.id) || r.tags.includes('reconciled') || r.kind === 'route' || r.kind === 'ingress',
    );
    if (newlyRelated.length) resources = newlyRelated;
  }

  if (view === 'signoff') {
    const blocking = new Set(
      graph.findings.filter((f) => f.blocksSignOff && f.status === 'open').flatMap((f) => f.affectedResources),
    );
    resources = resources.filter(
      (r) =>
        blocking.has(r.id) ||
        r.kind === 'route' ||
        r.kind === 'ingress' ||
        r.kind === 'relational-database' ||
        graph.unsupported.some(() => false),
    );
    if (resources.length < 3) {
      resources = graph.resources.filter((r) =>
        ['route', 'ingress', 'workload', 'relational-database', 'external-system', 'internet'].includes(r.kind),
      );
    }
  }

  if (view === 'capability' && zoomBand === 'far') {
    resources = resources.filter((r) => r.kind === 'business-capability' || r.kind === 'platform-system');
  } else if (view === 'data' && zoomBand !== 'near') {
    const assets = resources.filter((r) => r.kind === 'data-asset');
    if (assets.length) resources = resources.filter((r) => r.kind === 'data-asset' || ['workload', 'external-system'].includes(r.kind));
  } else if (zoomBand === 'far') {
    resources = resources.filter((r) =>
      [
        'internet',
        'route',
        'ingress',
        'dns',
        'workload',
        'relational-database',
        'bucket',
        'queue',
        'external-system',
        'load-balancer',
        'business-capability',
        'data-asset',
        'team',
      ].includes(r.kind),
    );
  } else if (zoomBand === 'medium') {
    resources = resources.filter(
      (r) => !['config', 'secret-ref', 'service-account', 'policy', 'build'].includes(r.kind),
    );
  }

  return resources;
}
