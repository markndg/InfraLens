import type {
  ArchitectureProjection,
  EvidenceGraph,
  ResourceEdge,
  ResourceNode,
} from '@infralens/graph-model';

export interface GraphProjection {
  projection: ArchitectureProjection;
  resourceIds: string[];
  edgeIds: string[];
  resources: ResourceNode[];
  edges: ResourceEdge[];
  collapsedUnder: Record<string, string[]>;
  summary: string;
}

const cache = new WeakMap<EvidenceGraph, Map<ArchitectureProjection, GraphProjection>>();

const PHYSICAL_KINDS = new Set([
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
  'cluster',
  'namespace',
  'external-system',
]);

const APPLICATION_KINDS = new Set([
  'internet',
  'route',
  'ingress',
  'application',
  'service',
  'workload',
  'queue',
  'relational-database',
  'bucket',
  'cache',
  'external-system',
  'config',
]);

function includeNode(projection: ArchitectureProjection, r: ResourceNode): boolean {
  switch (projection) {
    case 'physical':
      return PHYSICAL_KINDS.has(r.kind) || r.platform === 'terraform' || r.provider === 'aws';
    case 'application':
      return APPLICATION_KINDS.has(r.kind);
    case 'capability':
      return (
        r.kind === 'business-capability' ||
        r.kind === 'platform-system' ||
        r.tags.some((t) => t.startsWith('capability:')) ||
        ['workload', 'service', 'queue', 'relational-database', 'bucket', 'route'].includes(r.kind)
      );
    case 'ownership':
      return r.kind === 'team' || (r.ownership?.length ?? 0) > 0 || r.tags.includes('orphaned-ownership');
    case 'data':
      return (
        r.kind === 'data-asset' ||
        ['relational-database', 'bucket', 'queue', 'cache', 'workload', 'external-system'].includes(r.kind)
      );
    case 'security':
      return (
        r.kind === 'trust-zone' ||
        [
          'internet',
          'route',
          'ingress',
          'security-group',
          'network-policy',
          'iam-role',
          'iam-policy',
          'secret-ref',
          'external-system',
          'workload',
          'service',
          'relational-database',
          'bucket',
          'queue',
          'cache',
          'dns',
          'load-balancer',
        ].includes(r.kind)
      );
    case 'risk':
      return (
        r.findings.length > 0 ||
        r.tags.includes('risk') ||
        r.kind === 'business-capability' ||
        ['route', 'ingress', 'relational-database', 'external-system', 'workload', 'queue'].includes(r.kind)
      );
    case 'cost':
      return (
        r.metadata.estimatedMonthlyCost != null ||
        r.tags.includes('cost') ||
        ['relational-database', 'bucket', 'workload', 'queue', 'cache', 'load-balancer'].includes(r.kind)
      );
    case 'time':
      return true;
    case 'dna':
      return r.kind === 'business-capability' || r.kind === 'team' || r.kind === 'trust-zone';
    case 'decision':
      return [
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
      ].includes(r.kind);
    case 'governance':
      return (
        r.layers?.includes('governance') ||
        [
          'architectural-decision',
          'intent',
          'assumption',
          'architecture-contract',
          'obligation',
          'adr',
          'review-record',
          'business-capability',
          'team',
        ].includes(r.kind)
      );
    default:
      return true;
  }
}

function preferredEdges(projection: ArchitectureProjection, e: ResourceEdge): boolean {
  if (projection === 'capability') {
    return ['contains', 'implements', 'supports-capability', 'connects', 'routes-to', 'event-publish', 'data-write', 'data-read'].includes(
      e.relation,
    );
  }
  if (projection === 'data') {
    return ['stores', 'creates', 'transforms', 'consumes-data', 'data-read', 'data-write', 'event-publish'].includes(
      e.relation,
    );
  }
  if (projection === 'ownership') {
    return ['owned-by', 'ownership-relation', 'connects', 'routes-to'].includes(e.relation);
  }
  if (projection === 'security') {
    return [
      'protected-by',
      'exposes',
      'routes-to',
      'ingress-route',
      'network-reachable',
      'network-blocked',
      'iam-authorised',
      'iam-denied',
      'secret-reference',
      'connects',
      'data-read',
      'data-write',
      'event-publish',
      'event-consume',
      'service-to-workload',
      'configuration-reference',
    ].includes(e.relation);
  }
  if (projection === 'decision' || projection === 'governance') {
    return [
      'decides',
      'realizes-intent',
      'depends-on-assumption',
      'satisfies-contract',
      'violates-contract',
      'produces-obligation',
      'documents-decision',
      'implemented-by',
      'implements',
      'contains',
      'supersedes',
      'invalidates',
    ].includes(e.relation);
  }
  return true;
}

export function projectGraph(graph: EvidenceGraph, projection: ArchitectureProjection): GraphProjection {
  let graphCache = cache.get(graph);
  if (!graphCache) {
    graphCache = new Map();
    cache.set(graph, graphCache);
  }
  const hit = graphCache.get(projection);
  if (hit) return hit;

  const resources = graph.resources.filter((r) => includeNode(projection, r));
  const ids = new Set(resources.map((r) => r.id));
  const edges = graph.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target) && preferredEdges(projection, e),
  );

  const collapsedUnder: Record<string, string[]> = {};
  if (projection === 'capability') {
    for (const cap of resources.filter((r) => r.kind === 'business-capability')) {
      const members = (cap.metadata.memberIds as string[] | undefined) ?? [];
      collapsedUnder[cap.id] = members.filter((id) => ids.has(id));
    }
  }

  const result: GraphProjection = {
    projection,
    resourceIds: [...ids],
    edgeIds: edges.map((e) => e.id),
    resources,
    edges,
    collapsedUnder,
    summary: summarise(projection, resources, edges),
  };
  graphCache.set(projection, result);
  return result;
}

function summarise(projection: ArchitectureProjection, resources: ResourceNode[], edges: ResourceEdge[]): string {
  const caps = resources.filter((r) => r.kind === 'business-capability').length;
  const data = resources.filter((r) => r.kind === 'data-asset').length;
  const teams = resources.filter((r) => r.kind === 'team').length;
  switch (projection) {
    case 'capability':
      return `${caps} capabilities · ${resources.length} related components · ${edges.length} links`;
    case 'data':
      return `${data} data assets · ${resources.length} nodes in data flow`;
    case 'ownership':
      return `${teams} teams · ${resources.filter((r) => r.tags.includes('orphaned-ownership')).length} orphaned`;
    case 'physical':
      return `${resources.length} infrastructure nodes · ${edges.length} relations`;
    case 'dna':
      return 'Architecture DNA fingerprint derived from evidence graph';
    default:
      return `${resources.length} nodes · ${edges.length} edges in ${projection} projection`;
  }
}

export function clearProjectionCache(graph?: EvidenceGraph): void {
  if (graph) cache.delete(graph);
}
