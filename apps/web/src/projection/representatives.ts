import type { ArchitectureView, EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import type { ProjectionRepresentativeMap } from './types';

/**
 * Build stable representative maps for the current projection.
 * Orphan edge targets are repaired by name/kind/namespace when possible.
 */
export function buildRepresentativeMap(
  graph: EvidenceGraph,
  visibleResources: ResourceNode[],
  view: ArchitectureView,
  containerOnlyIds: Set<string>,
): ProjectionRepresentativeMap {
  const visibleIds = new Set(visibleResources.map((r) => r.id));
  const byId = new Map(graph.resources.map((r) => [r.id, r]));
  const canonicalNodeToProjectedNode = new Map<string, string>();
  const projectedNodeToVisibleRepresentative = new Map<string, string>();
  const canonicalNodeToVisibleRepresentative = new Map<string, string>();

  for (const r of visibleResources) {
    // Trust-zone entities are containers in security view — not leaf representatives
    if (containerOnlyIds.has(r.id)) {
      canonicalNodeToProjectedNode.set(r.id, r.id);
      continue;
    }
    canonicalNodeToProjectedNode.set(r.id, r.id);
    projectedNodeToVisibleRepresentative.set(r.id, r.id);
    canonicalNodeToVisibleRepresentative.set(r.id, r.id);
  }

  // Orphan / hidden endpoints → best visible representative
  for (const edge of graph.edges) {
    for (const endpoint of [edge.source, edge.target]) {
      if (canonicalNodeToVisibleRepresentative.has(endpoint)) continue;
      const repaired = repairEndpoint(graph, byId, endpoint, visibleIds, visibleResources, view);
      if (repaired) {
        canonicalNodeToProjectedNode.set(endpoint, repaired);
        projectedNodeToVisibleRepresentative.set(repaired, repaired);
        canonicalNodeToVisibleRepresentative.set(endpoint, repaired);
      }
    }
  }

  // Logical application ↔ workload/service aliases for collapsed abstraction
  if (view === 'application') {
    for (const app of visibleResources.filter((r) => r.kind === 'application')) {
      const twins = visibleResources.filter(
        (r) =>
          (r.kind === 'workload' || r.kind === 'service') &&
          r.name === app.name &&
          r.id !== app.id,
      );
      // Keep distinct identities — map only for missing endpoints, not collapsing visible twins
      void twins;
    }
  }

  return {
    canonicalNodeToProjectedNode,
    projectedNodeToVisibleRepresentative,
    canonicalNodeToVisibleRepresentative,
  };
}

function repairEndpoint(
  graph: EvidenceGraph,
  byId: Map<string, ResourceNode>,
  endpoint: string,
  visibleIds: Set<string>,
  visible: ResourceNode[],
  view: ArchitectureView,
): string | null {
  // Already a known resource but filtered from view → try same-name visible twin
  const existing = byId.get(endpoint);
  if (existing) {
    if (visibleIds.has(existing.id)) return existing.id;
    const twin = visible.find(
      (r) =>
        r.name === existing.name &&
        (r.kind === existing.kind ||
          (['service', 'workload', 'application'].includes(r.kind) &&
            ['service', 'workload', 'application'].includes(existing.kind))),
    );
    if (twin) return twin.id;
    // VPC-bound noise: never remap VPC as a visible app endpoint
    if (['vpc', 'subnet', 'network'].includes(existing.kind)) return null;
    return null;
  }

  // Dangling ID e.g. kubernetes:retail-prod:service:storefront (missing platform segment)
  const parts = endpoint.split(':');
  const name = parts[parts.length - 1];
  const kindHint = parts.includes('service')
    ? 'service'
    : parts.includes('workload')
      ? 'workload'
      : undefined;
  if (name) {
    const hit = visible.find(
      (r) =>
        r.name === name &&
        (!kindHint || r.kind === kindHint) &&
        (view !== 'security' || !['vpc', 'subnet'].includes(r.kind)),
    );
    if (hit) return hit.id;
    // Broader: any service/workload with that name in full graph that is visible
    const any = graph.resources.find(
      (r) => r.name === name && (!kindHint || r.kind === kindHint) && visibleIds.has(r.id),
    );
    if (any) return any.id;
  }
  return null;
}

/** Trust-zone resource ids that should only appear as containers. */
export function trustZoneContainerIds(graph: EvidenceGraph, view: ArchitectureView): Set<string> {
  if (view !== 'security') return new Set();
  return new Set(graph.resources.filter((r) => r.kind === 'trust-zone').map((r) => r.id));
}
