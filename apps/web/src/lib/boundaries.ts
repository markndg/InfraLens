import type { ArchitectureView, EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import {
  inferTechStack,
  isNetworkResource,
  networkGroupKey,
  platformKey,
  platformLabel,
  type TechStackInfo,
} from './techStack';

export interface BoundaryGroup {
  id: string;
  label: string;
  kind: string;
  /** Longer clarifying line, e.g. tech mix inside the group */
  subtitle?: string;
  /** Compact chips: platform / network / tech */
  badges: string[];
  memberIds: string[];
  findingHigh: number;
  findingCritical: number;
  hasDrift: boolean;
  completeness: number;
}

export function boundaryPriority(view: ArchitectureView): string[] {
  switch (view) {
    case 'executive':
      return ['application', 'environment', 'platform'];
    case 'architecture':
      return ['application', 'app-stack', 'platform', 'environment'];
    case 'platform':
      return ['platform', 'cluster', 'namespace'];
    case 'network':
      return ['network', 'vpc', 'region', 'account'];
    case 'security':
      return ['trust', 'network', 'environment'];
    case 'evidence':
      return ['truth-source', 'platform'];
    case 'data':
      return ['environment', 'namespace', 'platform'];
    case 'application':
      return ['app-stack', 'application', 'environment'];
    case 'drift':
      return ['environment', 'platform'];
    case 'signoff':
      return ['environment', 'application'];
    case 'physical':
      return ['platform', 'network', 'environment'];
    default:
      return ['application', 'platform', 'environment'];
  }
}

export function inferBoundaryKey(
  resource: ResourceNode,
  view: ArchitectureView,
  graph: EvidenceGraph,
): { id: string; label: string; kind: string } | null {
  const priorities = boundaryPriority(view);
  for (const kind of priorities) {
    const key = inferBoundaryKeyForKind(resource, kind, graph);
    if (key) return key;
  }
  return null;
}

export function inferBoundaryKeyForKind(
  resource: ResourceNode,
  kind: string,
  graph: EvidenceGraph,
): { id: string; label: string; kind: string } | null {
  if (kind === 'environment' && resource.environment) {
    return {
      id: `b-env-${resource.environment}`,
      label: resource.environment,
      kind: 'environment',
    };
  }
  if (kind === 'namespace' && resource.namespace) {
    return {
      id: `b-ns-${resource.namespace}`,
      label: `ns:${resource.namespace}`,
      kind: 'namespace',
    };
  }
  if (kind === 'cluster' && (resource.cluster || resource.platform === 'openshift' || resource.platform === 'kubernetes')) {
    const cluster = resource.cluster || platformLabel(resource);
    return { id: `b-cluster-${cluster}`, label: String(cluster), kind: 'cluster' };
  }
  if (kind === 'account' && resource.account) {
    return { id: `b-acct-${resource.account}`, label: `Account ${resource.account}`, kind: 'account' };
  }
  if (kind === 'region' && resource.region) {
    return { id: `b-region-${resource.region}`, label: resource.region, kind: 'region' };
  }
  if (kind === 'vpc' && (resource.kind === 'vpc' || String(resource.metadata?.vpc_id ?? '').includes('vpc'))) {
    const net = networkGroupKey(resource);
    if (net) return { ...net, kind: 'vpc' };
    return {
      id: `b-vpc-${resource.boundary || resource.name}`,
      label: resource.boundary || resource.displayName,
      kind: 'vpc',
    };
  }
  if (kind === 'network') {
    const net = networkGroupKey(resource);
    if (net) return { ...net, kind: 'network' };
    return null;
  }
  if (kind === 'platform') {
    // Group runtime/platform estates — skip pure business/governance nodes
    if (
      ['business-capability', 'data-asset', 'team', 'trust-zone', 'adr', 'architectural-decision', 'intent', 'assumption', 'architecture-contract', 'obligation', 'internet', 'user'].includes(
        resource.kind,
      )
    ) {
      return null;
    }
    if (!resource.provider && !resource.platform) return null;
    if (resource.provider === 'external') {
      return { id: 'b-platform-external', label: 'External systems', kind: 'platform' };
    }
    const key = platformKey(resource);
    if (key === 'application') return null;
    // Treat OpenShift + Kubernetes cluster workloads as one platform estate when mixed
    const clusterPlatform =
      key === 'openshift' || key === 'kubernetes'
        ? resource.provider === 'openshift' || resource.tags?.includes('openshift')
          ? 'openshift'
          : 'kubernetes'
        : key;
    const label =
      clusterPlatform === 'openshift'
        ? 'OpenShift platform'
        : clusterPlatform === 'kubernetes'
          ? 'Kubernetes platform'
          : clusterPlatform === 'aws'
            ? resource.region
              ? `AWS platform · ${resource.region}`
              : 'AWS platform'
            : platformLabel(resource);
    return { id: `b-platform-${clusterPlatform}`, label, kind: 'platform' };
  }
  if (kind === 'application') {
    // Application / namespace estate for runtime workloads & adjacent services
    if (
      !resource.namespace &&
      !['workload', 'service', 'route', 'ingress', 'application', 'function'].includes(resource.kind)
    ) {
      return null;
    }
    if (resource.namespace) {
      const pretty = resource.namespace.replace(/^retail-/, '');
      return {
        id: `b-app-${resource.namespace}`,
        label: `App · ${pretty}`,
        kind: 'application',
      };
    }
    if (resource.kind === 'application') {
      return {
        id: `b-app-src-${resource.name}`,
        label: `App · ${resource.displayName}`,
        kind: 'application',
      };
    }
  }
  if (kind === 'app-stack') {
    if (!['workload', 'service', 'application', 'function', 'route', 'ingress'].includes(resource.kind)) {
      return null;
    }
    // Routes/services inherit stack from linked workloads when possible
    const stack = resolveStackForGrouping(resource, graph);
    if (!stack || stack.role === 'platform' || stack.role === 'network') return null;
    return {
      id: `b-stack-${stack.role}-${stack.techKey}`,
      label: stack.label,
      kind: 'app-stack',
    };
  }
  if (kind === 'trust') {
    // Trust-zone resources are containers only — never dual-rendered as members
    if (resource.kind === 'trust-zone') {
      return null;
    }
    // Security controls are a dedicated layer — not a trust zone / Unknown Zone
    if (
      ['security-group', 'network-policy', 'iam-role', 'iam-policy', 'secret-ref'].includes(resource.kind)
    ) {
      return { id: 'security-controls', label: 'Security Controls', kind: 'security-controls' };
    }
    if (resource.kind === 'internet') {
      return { id: 'trust:internet', label: 'Internet', kind: 'trust' };
    }
    // Prefer explicit protected-by → trust-zone membership from the evidence graph
    const zoneEdge = graph.edges.find(
      (e) =>
        e.relation === 'protected-by' &&
        e.source === resource.id &&
        graph.resources.find((r) => r.id === e.target)?.kind === 'trust-zone',
    );
    if (zoneEdge) {
      const zone = graph.resources.find((r) => r.id === zoneEdge.target)!;
      return {
        id: zone.id,
        label: zone.displayName,
        kind: 'trust',
      };
    }
    if (resource.provider === 'external' || resource.kind === 'external-system') {
      return { id: 'trust:external', label: 'External Trust Zone', kind: 'trust' };
    }
    if (resource.kind === 'route' || resource.kind === 'ingress' || resource.kind === 'dns' || resource.kind === 'load-balancer') {
      return { id: 'trust:public-edge', label: 'Public Edge', kind: 'trust' };
    }
    if (['relational-database', 'bucket', 'queue', 'cache', 'data-asset'].includes(resource.kind)) {
      return { id: 'trust:data', label: 'Data Trust Zone', kind: 'trust' };
    }
    if (['workload', 'service', 'application'].includes(resource.kind)) {
      return { id: 'trust:application', label: 'Application Trust Zone', kind: 'trust' };
    }
    // Non-control leftovers — keep out of a fake "Unknown Trust Zone"
    return { id: 'security-controls', label: 'Security Controls', kind: 'security-controls' };
  }
  if (kind === 'truth-source') {
    const truth = resource.truthStates[0] ?? 'unknown';
    return { id: `b-truth-${truth}`, label: truth, kind: 'truth-source' };
  }
  return null;
}

function resolveStackForGrouping(resource: ResourceNode, graph: EvidenceGraph): TechStackInfo | null {
  const direct = inferTechStack(resource, graph);
  if (direct && ['frontend', 'backend', 'worker', 'service'].includes(direct.role)) {
    return direct;
  }
  // Route/service → follow to workload
  if (resource.kind === 'route' || resource.kind === 'ingress' || resource.kind === 'service') {
    const outs = graph.edges.filter((e) => e.source === resource.id);
    for (const e of outs) {
      const target = graph.resources.find((r) => r.id === e.target);
      if (!target) continue;
      if (target.kind === 'service' || target.kind === 'workload') {
        const nested = resolveStackForGrouping(target, graph);
        if (nested) return nested;
      }
    }
  }
  return direct;
}

export function buildBoundaryGroups(
  graph: EvidenceGraph,
  resources: ResourceNode[],
  view: ArchitectureView,
): BoundaryGroup[] {
  const map = new Map<string, BoundaryGroup & { _stacks: TechStackInfo[]; _platforms: Set<string> }>();
  for (const r of resources) {
    const key = inferBoundaryKey(r, view, graph);
    if (!key) continue;
    let g = map.get(key.id);
    if (!g) {
      g = {
        id: key.id,
        label: key.label,
        kind: key.kind,
        badges: [],
        memberIds: [],
        findingHigh: 0,
        findingCritical: 0,
        hasDrift: false,
        completeness: 0,
        _stacks: [],
        _platforms: new Set(),
      };
      map.set(key.id, g);
    }
    g.memberIds.push(r.id);
    const findings = graph.findings.filter((f) => f.affectedResources.includes(r.id));
    g.findingHigh += findings.filter((f) => f.severity === 'high').length;
    g.findingCritical += findings.filter((f) => f.severity === 'critical').length;
    if (graph.drifts.some((d) => d.resourceId === r.id)) g.hasDrift = true;
    g.completeness += r.confidence.score;

    const stack = inferTechStack(r, graph);
    if (stack && ['frontend', 'backend', 'worker', 'service'].includes(stack.role)) {
      g._stacks.push(stack);
    }
    if (r.provider || r.platform) {
      g._platforms.add(platformLabel(r));
    }
    if (isNetworkResource(r)) {
      const net = networkGroupKey(r);
      if (net) g._platforms.add(net.label);
    }
  }

  const groups: BoundaryGroup[] = [];
  for (const g of map.values()) {
    if (g.memberIds.length < 2) continue;
    g.completeness = g.memberIds.length ? g.completeness / g.memberIds.length : 0;
    const { subtitle, badges } = summarizeGroup(g.kind, g.label, g._stacks, g._platforms);
    groups.push({
      id: g.id,
      label: g.label,
      kind: g.kind,
      subtitle,
      badges,
      memberIds: g.memberIds,
      findingHigh: g.findingHigh,
      findingCritical: g.findingCritical,
      hasDrift: g.hasDrift,
      completeness: g.completeness,
    });
  }
  return groups;
}

function summarizeGroup(
  kind: string,
  label: string,
  stacks: TechStackInfo[],
  platforms: Set<string>,
): { subtitle?: string; badges: string[] } {
  const badges: string[] = [];
  const roleTech = new Map<string, string>();
  for (const s of stacks) {
    const key = `${s.role}:${s.techKey}`;
    if (!roleTech.has(key)) roleTech.set(key, s.label);
  }
  const stackLabels = [...roleTech.values()];

  if (kind === 'app-stack') {
    badges.push(kindLabel(kind));
    for (const p of platforms) {
      if (!/application config/i.test(p)) badges.push(p);
    }
    return {
      subtitle: stackLabels.length ? undefined : 'Application workload group',
      badges: unique(badges).slice(0, 4),
    };
  }

  if (kind === 'application' || kind === 'namespace' || kind === 'environment') {
    if (stackLabels.length) {
      badges.push(...stackLabels.slice(0, 4));
    }
    for (const p of platforms) {
      if (!/application config/i.test(p)) badges.push(p);
    }
    return {
      subtitle: stackLabels.length
        ? stackLabels.join(' · ')
        : platforms.size
          ? [...platforms].slice(0, 3).join(' · ')
          : undefined,
      badges: unique([kindLabel(kind), ...badges]).slice(0, 5),
    };
  }

  if (kind === 'platform' || kind === 'cluster') {
    if (stackLabels.length) badges.push(...stackLabels.slice(0, 3));
    return {
      subtitle: stackLabels.length ? `Hosts ${stackLabels.join(', ')}` : label,
      badges: unique([kindLabel(kind), ...badges]).slice(0, 5),
    };
  }

  if (kind === 'network' || kind === 'vpc' || kind === 'region') {
    badges.push(kindLabel(kind));
    for (const p of platforms) badges.push(p);
    return {
      subtitle: 'Network boundary',
      badges: unique(badges).slice(0, 4),
    };
  }

  if (stackLabels.length) {
    return {
      subtitle: stackLabels.join(' · '),
      badges: unique([kindLabel(kind), ...stackLabels]).slice(0, 5),
    };
  }

  return {
    badges: unique([kindLabel(kind), ...platforms]).slice(0, 4),
  };
}

function kindLabel(kind: string): string {
  if (kind === 'app-stack') return 'App type';
  if (kind === 'application') return 'Application';
  if (kind === 'platform') return 'Platform';
  if (kind === 'network') return 'Network';
  if (kind === 'vpc') return 'VPC';
  if (kind === 'environment') return 'Environment';
  if (kind === 'cluster') return 'Cluster';
  if (kind === 'namespace') return 'Namespace';
  if (kind === 'trust') return 'Trust';
  return kind.replace(/-/g, ' ');
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (!i || seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}
