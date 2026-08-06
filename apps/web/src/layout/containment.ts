import type { ArchitectureView, EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import { inferBoundaryKeyForKind, type BoundaryGroup } from '../lib/boundaries';
import type { ZoomBand } from '../lib/edges';
import { assignLane, LANE_ORDER_LTR } from '../lib/lanes';
import { getProjectionContract, SECURITY_ZONE_ORDER } from '../projection/contracts';
import { inferTechStack, platformLabel } from '../lib/techStack';
import type { ContainmentDimension, LayoutContainer, LayoutLeaf, LayoutNode } from './types';
import { leafSize } from './types';

/** Only one dimension owns containment for a given projection (from ProjectionContract). */
export function primaryDimension(view: ArchitectureView): ContainmentDimension {
  const c = getProjectionContract(view).primaryContainment;
  if (c === 'logical-application') return 'logical-application';
  if (c === 'data-domain') return 'data-domain';
  if (c === 'team') return 'team';
  if (c === 'risk-domain') return 'risk-domain';
  if (c === 'cost-domain') return 'cost-domain';
  if (c === 'review-period') return 'review-period';
  if (c === 'review') return 'review';
  if (
    c === 'capability' ||
    c === 'application' ||
    c === 'platform' ||
    c === 'network' ||
    c === 'environment' ||
    c === 'trust' ||
    c === 'lane' ||
    c === 'app-stack'
  ) {
    return c;
  }
  return 'lane';
}

function dimensionToBoundaryKind(dim: ContainmentDimension): string {
  if (dim === 'capability') return 'application'; // reused key path via custom
  if (dim === 'lane') return 'application';
  return dim;
}

export function buildContainmentTree(
  graph: EvidenceGraph,
  resources: ResourceNode[],
  view: ArchitectureView,
  zoomBand: ZoomBand,
): LayoutContainer {
  const dim = primaryDimension(view);
  const size = leafSize(zoomBand);
  const groups = new Map<string, { key: { id: string; label: string; kind: string }; members: ResourceNode[] }>();

  for (const r of resources) {
    const key = resolveContainmentKey(r, dim, graph, view);
    if (!key) {
      const id = '__ungrouped__';
      const g = groups.get(id) ?? {
        key: { id, label: 'Ungrouped', kind: 'ungrouped' },
        members: [],
      };
      g.members.push(r);
      groups.set(id, g);
      continue;
    }
    const g = groups.get(key.id) ?? { key, members: [] };
    g.members.push(r);
    groups.set(key.id, g);
  }

  const containers: LayoutContainer[] = [];
  for (const g of groups.values()) {
    if (g.members.length === 0) continue;
    // Singleton groups still get a container only if ≥1 — wrap all for consistency
    const children: LayoutNode[] = g.members
      .slice()
      .sort(stableLeafOrder(graph))
      .map((resource) => leafOf(resource, size));

    const badges = summarizeBadges(g.members, graph);
    const findings = graph.findings.filter((f) => g.members.some((m) => f.affectedResources.includes(m.id)));
    containers.push({
      kind: 'container',
      id: g.key.id,
      dimension: g.key.kind,
      label: g.key.label,
      badges,
      children,
      measured: { width: 0, height: 0 },
      rel: { x: 0, y: 0 },
      abs: { x: 0, y: 0, width: 0, height: 0 },
      ports: [],
      memberIds: g.members.map((m) => m.id),
      meta: {
        findingHigh: findings.filter((f) => f.severity === 'high').length,
        findingCritical: findings.filter((f) => f.severity === 'critical').length,
        hasDrift: graph.drifts.some((d) => g.members.some((m) => m.id === d.resourceId)),
      },
    });
  }

  containers.sort(stableContainerOrder(graph));

  // Root is an invisible layout container holding top-level groups
  return {
    kind: 'container',
    id: '__root__',
    dimension: 'root',
    label: 'root',
    badges: [],
    children: containers.length
      ? containers
      : resources.map((r) => leafOf(r, size)).sort((a, b) =>
          stableLeafOrder(graph)(a.resource, b.resource),
        ),
    measured: { width: 0, height: 0 },
    rel: { x: 0, y: 0 },
    abs: { x: 0, y: 0, width: 0, height: 0 },
    ports: [],
    memberIds: resources.map((r) => r.id),
    meta: { findingHigh: 0, findingCritical: 0, hasDrift: false },
  };
}

function resolveContainmentKey(
  resource: ResourceNode,
  dim: ContainmentDimension,
  graph: EvidenceGraph,
  view: ArchitectureView,
): { id: string; label: string; kind: string } | null {
  if (dim === 'logical-application') {
    return logicalApplicationKey(resource, graph);
  }

  if (dim === 'data-domain') {
    if (resource.kind === 'data-asset') {
      return { id: `b-data-${resource.id}`, label: resource.displayName, kind: 'data-domain' };
    }
    const linked = graph.edges.find(
      (e) =>
        (e.source === resource.id || e.target === resource.id) &&
        ['stores', 'creates', 'data-read', 'data-write', 'consumes-data'].includes(e.relation),
    );
    if (linked) {
      const otherId = linked.source === resource.id ? linked.target : linked.source;
      const asset = graph.resources.find((r) => r.id === otherId && r.kind === 'data-asset');
      if (asset) return { id: `b-data-${asset.id}`, label: asset.displayName, kind: 'data-domain' };
    }
    if (['relational-database', 'bucket', 'queue', 'cache', 'storage'].includes(resource.kind)) {
      return { id: `b-data-store-${resource.kind}`, label: `${resource.kind} stores`, kind: 'data-domain' };
    }
    return { id: 'b-data-flow', label: 'Data flow', kind: 'data-domain' };
  }

  if (dim === 'team') {
    if (resource.kind === 'team') {
      return { id: resource.id, label: resource.displayName, kind: 'team' };
    }
    const owned = graph.edges.find((e) => e.relation === 'owned-by' && e.source === resource.id);
    if (owned) {
      const team = graph.resources.find((r) => r.id === owned.target);
      if (team) return { id: team.id, label: team.displayName, kind: 'team' };
    }
    if (resource.ownership?.[0]?.team) {
      return {
        id: `b-team-${resource.ownership[0].team}`,
        label: resource.ownership[0].team,
        kind: 'team',
      };
    }
    return { id: 'b-team-orphaned', label: 'Unowned', kind: 'team' };
  }

  if (dim === 'risk-domain') {
    const sev = graph.findings
      .filter((f) => f.affectedResources.includes(resource.id) && f.status === 'open')
      .map((f) => f.severity);
    const band = sev.includes('critical')
      ? 'critical'
      : sev.includes('high')
        ? 'high'
        : sev.includes('medium')
          ? 'medium'
          : resource.kind === 'internet' || resource.kind === 'route'
            ? 'exposure'
            : 'baseline';
    return {
      id: `b-risk-${band}`,
      label: band === 'exposure' ? 'Public exposure' : `Risk · ${band}`,
      kind: 'risk-domain',
    };
  }

  if (dim === 'cost-domain') {
    const domain = resource.environment || resource.provider || 'shared';
    return { id: `b-cost-${domain}`, label: `Cost · ${domain}`, kind: 'cost-domain' };
  }

  if (dim === 'review-period' || dim === 'review') {
    if (['architectural-decision', 'adr', 'intent', 'assumption', 'review-record', 'obligation'].includes(resource.kind)) {
      return { id: `b-review-${resource.kind}`, label: resource.kind.replace(/-/g, ' '), kind: 'review' };
    }
    return { id: 'b-review-estate', label: 'Estate under review', kind: 'review' };
  }

  if (dim === 'capability') {
    if (resource.kind === 'business-capability') {
      return { id: `b-cap-${resource.id}`, label: resource.displayName, kind: 'capability' };
    }
    const edge = graph.edges.find(
      (e) =>
        e.relation === 'supports-capability' &&
        (e.source === resource.id || e.target === resource.id),
    );
    if (edge) {
      const capId = edge.source === resource.id ? edge.target : edge.source;
      const cap = graph.resources.find((r) => r.id === capId);
      if (cap) return { id: `b-cap-${cap.id}`, label: cap.displayName, kind: 'capability' };
    }
    return null;
  }

  if (dim === 'lane') {
    const lane = assignLane(resource, graph);
    return { id: `b-lane-${lane}`, label: lane, kind: 'lane' };
  }

  if (dim === 'app-stack') {
    const stack = inferTechStack(resource, graph);
    if (!stack || stack.role === 'platform' || stack.role === 'network') {
      return inferBoundaryKeyForKind(resource, 'application', graph);
    }
    return {
      id: `b-stack-${stack.role}-${stack.techKey}`,
      label: stack.label,
      kind: 'app-stack',
    };
  }

  // Security: controls are a dedicated layer — never Unknown Zone
  if (dim === 'trust') {
    if (isSecurityControl(resource)) {
      return { id: 'security-controls', label: 'Security Controls', kind: 'security-controls' };
    }
    const key = inferBoundaryKeyForKind(resource, 'trust', graph);
    if (key?.id === 'trust:unknown' && isSecurityControl(resource)) {
      return { id: 'security-controls', label: 'Security Controls', kind: 'security-controls' };
    }
    return key;
  }

  const kind = dimensionToBoundaryKind(dim);
  // Application (namespace) view for architecture/executive — never fall back to environment
  if (dim === 'application') {
    return (
      logicalApplicationKey(resource, graph) ??
      inferBoundaryKeyForKind(resource, 'application', graph)
    );
  }
  return inferBoundaryKeyForKind(resource, kind, graph);
}

const CONTROL_KINDS = new Set([
  'security-group',
  'network-policy',
  'iam-role',
  'iam-policy',
  'secret-ref',
]);

function isSecurityControl(r: ResourceNode): boolean {
  return CONTROL_KINDS.has(r.kind);
}

/** Logical application by component name — environment is never containment. */
function logicalApplicationKey(
  resource: ResourceNode,
  graph: EvidenceGraph,
): { id: string; label: string; kind: string } | null {
  if (['internet', 'dns', 'vpc', 'subnet', 'network'].includes(resource.kind)) {
    return { id: 'b-app-edge', label: 'Edge & network', kind: 'logical-application' };
  }
  if (['relational-database', 'bucket', 'queue', 'cache', 'external-system'].includes(resource.kind)) {
    // Attach shared infra to the app that uses it most; else Shared services
    const consumers = graph.edges
      .filter((e) => e.target === resource.id)
      .map((e) => graph.resources.find((r) => r.id === e.source))
      .filter((r): r is ResourceNode => Boolean(r && ['workload', 'service', 'application'].includes(r.kind)));
    if (consumers[0]) {
      return {
        id: `b-app-${consumers[0].name}`,
        label: consumers[0].name,
        kind: 'logical-application',
      };
    }
    return { id: 'b-app-shared', label: 'Shared services', kind: 'logical-application' };
  }
  if (resource.kind === 'route' || resource.kind === 'ingress') {
    const to = graph.edges.find(
      (e) => e.source === resource.id && (e.relation === 'routes-to' || e.relation === 'ingress-route'),
    );
    const svc = to ? graph.resources.find((r) => r.id === to.target) : undefined;
    if (svc) return { id: `b-app-${svc.name}`, label: svc.name, kind: 'logical-application' };
  }
  if (['workload', 'service', 'application', 'function'].includes(resource.kind)) {
    return { id: `b-app-${resource.name}`, label: resource.name, kind: 'logical-application' };
  }
  return null;
}

function leafOf(resource: ResourceNode, size: { width: number; height: number }): LayoutLeaf {
  return {
    kind: 'leaf',
    id: resource.id,
    resource,
    measured: { ...size },
    rel: { x: 0, y: 0 },
    abs: { x: 0, y: 0, width: size.width, height: size.height },
  };
}

function summarizeBadges(members: ResourceNode[], graph: EvidenceGraph): string[] {
  const badges = new Set<string>();
  for (const m of members) {
    if (m.environment && m.environment !== 'shared') badges.add(m.environment);
    const stack = inferTechStack(m, graph);
    if (stack && ['frontend', 'backend', 'worker'].includes(stack.role)) {
      badges.add(stack.label);
    }
    if (m.provider === 'openshift' || m.platform === 'openshift') badges.add('OpenShift');
    else if (m.provider === 'kubernetes') badges.add('Kubernetes');
    else if (m.provider === 'aws') badges.add(platformLabel(m));
  }
  return [...badges].slice(0, 5);
}

function stableLeafOrder(graph: EvidenceGraph) {
  const degree = new Map<string, number>();
  for (const e of graph.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  return (a: ResourceNode, b: ResourceNode) => {
    // dependency depth proxy via lane, then centrality, then name
    const la = LANE_ORDER_LTR.indexOf(assignLane(a, graph));
    const lb = LANE_ORDER_LTR.indexOf(assignLane(b, graph));
    if (la !== lb) return la - lb;
    const da = degree.get(a.id) ?? 0;
    const db = degree.get(b.id) ?? 0;
    if (da !== db) return db - da;
    const ea = (a.environment ?? '').localeCompare(b.environment ?? '');
    if (ea) return ea;
    return a.displayName.localeCompare(b.displayName);
  };
}

/** Stable order: security zone flow L→R, else mean lane, then name. */
function stableContainerOrder(graph: EvidenceGraph) {
  return (a: LayoutContainer, b: LayoutContainer): number => {
    if (a.dimension === 'ungrouped') return 1;
    if (b.dimension === 'ungrouped') return -1;

    // Security: Internet → Public → Application → Data → External → Controls
    if (a.dimension === 'trust' || a.dimension === 'security-controls' || b.dimension === 'trust' || b.dimension === 'security-controls') {
      const zi = (id: string) => {
        const idx = SECURITY_ZONE_ORDER.indexOf(id as (typeof SECURITY_ZONE_ORDER)[number]);
        return idx >= 0 ? idx : 50;
      };
      const zd = zi(a.id) - zi(b.id);
      if (zd) return zd;
    }

    const meanLane = (c: LayoutContainer) => {
      const leaves = c.children.filter((ch): ch is LayoutLeaf => ch.kind === 'leaf');
      if (!leaves.length) return 99;
      const sum = leaves.reduce((acc, leaf) => acc + LANE_ORDER_LTR.indexOf(assignLane(leaf.resource, graph)), 0);
      return sum / leaves.length;
    };
    const laneDiff = meanLane(a) - meanLane(b);
    if (Math.abs(laneDiff) > 0.01) return laneDiff;
    return a.label.localeCompare(b.label);
  };
}

/** Overlay hints (non-owning dimensions) for debug / future coloured overlays. */
export function overlayMembership(
  resource: ResourceNode,
  graph: EvidenceGraph,
  view: ArchitectureView,
): BoundaryGroup[] {
  void resource;
  void graph;
  void view;
  return [];
}
