import type { EvidenceGraph, ResourceEdge, ResourceNode } from '@infralens/graph-model';

export type ArchitectureLane =
  | 'actors'
  | 'public-edge'
  | 'routing'
  | 'frontend'
  | 'capability'
  | 'application'
  | 'processing'
  | 'data'
  | 'ownership'
  | 'security-zone'
  | 'integration'
  | 'observability'
  | 'platform'
  | 'unknown';

export const LANE_ORDER_LTR: ArchitectureLane[] = [
  'actors',
  'public-edge',
  'routing',
  'frontend',
  'capability',
  'application',
  'processing',
  'data',
  'ownership',
  'security-zone',
  'integration',
  'observability',
  'platform',
  'unknown',
];

export const LANE_LABELS: Record<ArchitectureLane, string> = {
  actors: 'Users / Internet',
  'public-edge': 'DNS / public ingress',
  routing: 'Routing',
  frontend: 'Frontend',
  capability: 'Business capabilities',
  application: 'Application services',
  processing: 'Workers / async',
  data: 'Data',
  ownership: 'Ownership',
  'security-zone': 'Trust zones',
  integration: 'External systems',
  observability: 'Observability',
  platform: 'Platform',
  unknown: 'Unclassified',
};

export function assignLane(resource: ResourceNode, graph: EvidenceGraph): ArchitectureLane {
  const kind = resource.kind;
  const subtype = String(resource.subtype ?? '').toLowerCase();
  const name = resource.name.toLowerCase();

  if (kind === 'internet' || kind === 'user') return 'actors';
  if (kind === 'business-capability' || kind === 'platform-system') return 'capability';
  if (kind === 'data-asset') return 'data';
  if (kind === 'team') return 'ownership';
  if (kind === 'trust-zone') return 'security-zone';
  if (kind === 'dns') return 'public-edge';
  if (kind === 'route' || kind === 'ingress' || kind === 'load-balancer' || kind === 'gateway') {
    return 'public-edge';
  }
  if (kind === 'external-system' || resource.provider === 'external') return 'integration';
  if (
    kind === 'relational-database' ||
    kind === 'bucket' ||
    kind === 'queue' ||
    kind === 'topic' ||
    kind === 'cache' ||
    kind === 'storage' ||
    kind === 'volume'
  ) {
    return 'data';
  }
  if (kind === 'monitoring') return 'observability';
  if (
    kind === 'vpc' ||
    kind === 'subnet' ||
    kind === 'network' ||
    kind === 'security-group' ||
    kind === 'network-policy' ||
    kind === 'iam-role' ||
    kind === 'iam-policy' ||
    kind === 'service-account' ||
    kind === 'namespace' ||
    kind === 'cluster' ||
    kind === 'account'
  ) {
    return 'platform';
  }
  if (kind === 'config' || kind === 'secret-ref' || kind === 'policy' || kind === 'build') {
    return 'platform';
  }

  const inbound = graph.edges.filter((e) => e.target === resource.id);
  const outbound = graph.edges.filter((e) => e.source === resource.id);
  const hasPublicIngress = inbound.some((e) => {
    const src = graph.resources.find((r) => r.id === e.source);
    return (
      src &&
      (src.kind === 'route' ||
        src.kind === 'ingress' ||
        src.kind === 'internet' ||
        e.relation === 'routes-to' ||
        e.relation === 'ingress-route' ||
        e.relation === 'exposes')
    );
  });
  const consumesEvents = outbound.some((e) => e.relation === 'event-consume') ||
    inbound.some((e) => e.relation === 'event-consume');
  const isWorker =
    kind === 'workload' &&
    (subtype.includes('job') ||
      /worker|consumer|processor/i.test(name) ||
      (consumesEvents && !hasPublicIngress && !graph.edges.some((e) => e.target === resource.id && e.relation === 'service-to-workload')));

  if (kind === 'service') {
    // Service selected by a public route → routing lane adjacent to frontend
    const routed = inbound.some((e) => {
      const src = graph.resources.find((r) => r.id === e.source);
      return src?.kind === 'route' || src?.kind === 'ingress';
    });
    return routed ? 'routing' : 'application';
  }

  if (kind === 'workload' || kind === 'application' || kind === 'function') {
    if (isWorker) return 'processing';
    if (hasPublicIngress || isFrontendWorkload(resource, graph, inbound)) return 'frontend';
    return 'application';
  }

  return 'unknown';
}

function isFrontendWorkload(
  resource: ResourceNode,
  graph: EvidenceGraph,
  inbound: ResourceEdge[],
): boolean {
  // Selected by a service that is itself routed publicly
  for (const edge of inbound) {
    if (edge.relation !== 'service-to-workload' && edge.relation !== 'selector-relationship') continue;
    const service = graph.resources.find((r) => r.id === edge.source);
    if (!service) continue;
    const serviceInbound = graph.edges.filter((e) => e.target === service.id);
    if (
      serviceInbound.some((e) => {
        const src = graph.resources.find((r) => r.id === e.source);
        return src?.kind === 'route' || src?.kind === 'ingress' || src?.kind === 'internet';
      })
    ) {
      return true;
    }
  }
  const images = JSON.stringify(resource.metadata.images ?? '').toLowerCase();
  if (/storefront|frontend|web|ui|portal/.test(resource.name) || /storefront|frontend/.test(images)) {
    return true;
  }
  return false;
}

export function laneIndex(lane: ArchitectureLane): number {
  return LANE_ORDER_LTR.indexOf(lane);
}
