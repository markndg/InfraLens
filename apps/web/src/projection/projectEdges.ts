import type { ArchitectureView, EvidenceGraph, ResourceEdge, ResourceNode } from '@infralens/graph-model';
import { stableId } from '@infralens/graph-model';
import type { ZoomBand } from '../lib/edges';
import { resourcesForView } from '../lib/resourcesForView';
import { getProjectionContract } from './contracts';
import { architecturalEdgeLabel } from './labels';
import {
  aggregateKey,
  familyForEdge,
  isEligibleCanonicalEdge,
} from './specs';
import { buildRepresentativeMap, trustZoneContainerIds } from './representatives';
import type {
  EdgeProjectionOutcome,
  ProjectedEdge,
  ProjectionIntegrityReport,
  SemanticProjectionResult,
} from './types';

let lastIntegrity: ProjectionIntegrityReport | null = null;

export function getLastProjectionIntegrity(): ProjectionIntegrityReport | null {
  return lastIntegrity;
}

/**
 * Semantic projection for a view — independent of layout geometry.
 * Every eligible canonical edge receives exactly one outcome.
 */
export function projectSemanticEdges(
  graph: EvidenceGraph,
  view: ArchitectureView,
  zoomBand: ZoomBand,
): SemanticProjectionResult {
  const containerOnlyIds = trustZoneContainerIds(graph, view);
  let resources = resourcesForView(graph, view, zoomBand).filter((r) => !containerOnlyIds.has(r.id));

  // Security: include data stores so zone-crossing flows are visible
  if (view === 'security') {
    const extra = graph.resources.filter((r) =>
      ['relational-database', 'bucket', 'queue', 'cache'].includes(r.kind),
    );
    const seen = new Set(resources.map((r) => r.id));
    for (const r of extra) {
      if (!seen.has(r.id) && !containerOnlyIds.has(r.id)) {
        resources.push(r);
        seen.add(r.id);
      }
    }
  }

  const visibleIds = new Set(resources.map((r) => r.id));
  const byId = new Map(graph.resources.map((r) => [r.id, r]));
  const representativeMap = buildRepresentativeMap(graph, resources, view, containerOnlyIds);

  const eligible = graph.edges.filter((e) => isEligibleCanonicalEdge(view, e));
  const outcomes: EdgeProjectionOutcome[] = [];
  const pending: Array<{
    edge: ResourceEdge;
    sourceId: string;
    targetId: string;
    family: string;
    crossesBoundary: boolean;
  }> = [];

  const zoneOf = (id: string): string | null => trustZoneFor(graph, id);

  for (const edge of eligible) {
    // Containment: member → trust-zone
    if (
      view === 'security' &&
      edge.relation === 'protected-by' &&
      byId.get(edge.target)?.kind === 'trust-zone'
    ) {
      outcomes.push({
        kind: 'represented-by-containment',
        groupId: edge.target,
        edgeId: edge.id,
      });
      continue;
    }

    let sourceId =
      representativeMap.canonicalNodeToVisibleRepresentative.get(edge.source) ?? null;
    let targetId =
      representativeMap.canonicalNodeToVisibleRepresentative.get(edge.target) ?? null;

    // Mis-resolved infrastructure refs (VPC catch-all) → remap by label/kind hint
    if (!targetId || isNetworkNoise(byId.get(targetId) ?? byId.get(edge.target))) {
      const remapped = remapByEvidenceHint(graph, resources, edge);
      if (remapped) {
        targetId = remapped;
        representativeMap.canonicalNodeToVisibleRepresentative.set(edge.target, remapped);
      }
    }
    if (!sourceId || isNetworkNoise(byId.get(sourceId) ?? byId.get(edge.source))) {
      const remapped = remapByEvidenceHint(graph, resources, { ...edge, source: edge.target, target: edge.source }, true);
      if (remapped) {
        sourceId = remapped;
        representativeMap.canonicalNodeToVisibleRepresentative.set(edge.source, remapped);
      }
    }

    if (!sourceId || !targetId) {
      const missing = !sourceId ? edge.source : edge.target;
      const missingNode = byId.get(missing);
      if (
        zoomBand === 'far' ||
        hiddenAtZoom(missingNode) ||
        (view === 'application' && missingNode && ['dns', 'vpc', 'subnet', 'business-capability', 'data-asset', 'team', 'trust-zone', 'config'].includes(missingNode.kind))
      ) {
        outcomes.push({
          kind: 'suppressed-intentionally',
          reason: 'The endpoint is hidden at the current abstraction level.',
          edgeId: edge.id,
        });
        continue;
      }
      outcomes.push({
        kind: 'projection-error',
        reason: `Missing visible representative for ${missing}`,
        edgeId: edge.id,
      });
      continue;
    }

    if (sourceId === targetId) {
      outcomes.push({
        kind: 'suppressed-intentionally',
        reason: 'Self-edge after representative collapse.',
        edgeId: edge.id,
      });
      continue;
    }

    const crossesBoundary =
      view === 'security' &&
      Boolean(zoneOf(sourceId) && zoneOf(targetId) && zoneOf(sourceId) !== zoneOf(targetId));

    const family = familyForEdge(
      view,
      edge,
      byId.get(edge.source) ?? byId.get(sourceId),
      byId.get(edge.target) ?? byId.get(targetId),
      crossesBoundary,
    );

    pending.push({ edge, sourceId, targetId, family, crossesBoundary });
  }

  // Aggregate parallel physical edges into one logical edge
  const buckets = new Map<string, typeof pending>();
  for (const p of pending) {
    const key = aggregateKey(p.sourceId, p.targetId, p.family);
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }

  const edges: ProjectedEdge[] = [];
  for (const [, list] of buckets) {
    const first = list[0];
    const sourceEdgeIds = list.map((p) => p.edge.id);
    const id =
      list.length === 1
        ? first.edge.id
        : stableId('agg', first.sourceId, first.targetId, first.family);

    const target = byId.get(first.targetId);
    const label = architecturalEdgeLabel(graph, first.edge, first.family, target, {
      crossesBoundary: first.crossesBoundary,
      aggregateCount: list.length,
    });
    edges.push({
      id,
      sourceId: first.sourceId,
      targetId: first.targetId,
      family: first.family,
      relation: first.edge,
      sourceEdgeIds,
      label,
      protocol: first.edge.protocol,
      port: first.edge.port,
      crossesBoundary: first.crossesBoundary,
      effectiveState: first.edge.effectiveState,
    });

    if (list.length === 1) {
      outcomes.push({ kind: 'rendered-direct', edgeId: first.edge.id });
    } else {
      outcomes.push({
        kind: 'rendered-aggregate',
        edgeId: id,
        sourceEdgeIds,
      });
      // Account remaining physical edges as part of aggregate (not errors)
      for (const extra of list.slice(1)) {
        outcomes.push({
          kind: 'rendered-aggregate',
          edgeId: id,
          sourceEdgeIds: [extra.edge.id],
        });
      }
    }
  }

  // Ensure every eligible edge has an outcome
  const accounted = new Set(outcomes.map((o) => ('sourceEdgeIds' in o && o.sourceEdgeIds?.length
    ? o.sourceEdgeIds[0]
    : 'edgeId' in o
      ? o.edgeId
      : '')));
  // Fix accounting: track by original edge ids
  const accountedEdges = new Set<string>();
  for (const o of outcomes) {
    if (o.kind === 'rendered-aggregate') o.sourceEdgeIds.forEach((id) => accountedEdges.add(id));
    else accountedEdges.add(o.edgeId);
  }
  for (const edge of eligible) {
    if (!accountedEdges.has(edge.id)) {
      outcomes.push({
        kind: 'projection-error',
        reason: 'Unaccounted eligible edge',
        edgeId: edge.id,
      });
    }
  }
  void accounted;

  const integrity = buildIntegrity(view, zoomBand, eligible.length, edges, outcomes);
  lastIntegrity = integrity;

  const contract = getProjectionContract(view);
  const summary = contract.summaryGenerator(
    graph,
    resources,
    edges.map((e) => e.relation),
  );

  return {
    view,
    zoomBand,
    resources,
    visibleIds,
    representativeMap,
    edges,
    outcomes,
    integrity,
    containerOnlyIds,
    contract,
    summary,
  };
}

function buildIntegrity(
  view: ArchitectureView,
  zoomBand: ZoomBand,
  eligible: number,
  edges: ProjectedEdge[],
  outcomes: EdgeProjectionOutcome[],
): ProjectionIntegrityReport {
  const categories: ProjectionIntegrityReport['categories'] = {
    direct: [],
    aggregate: [],
    containment: [],
    suppressed: [],
    errors: [],
  };
  let direct = 0;
  let aggregate = 0;
  let containment = 0;
  let suppressed = 0;
  let errors = 0;
  const seenAgg = new Set<string>();

  for (const o of outcomes) {
    switch (o.kind) {
      case 'rendered-direct':
        direct++;
        categories.direct.push(o.edgeId);
        break;
      case 'rendered-aggregate':
        if (!seenAgg.has(o.edgeId)) {
          aggregate++;
          seenAgg.add(o.edgeId);
          categories.aggregate.push(o.edgeId);
        }
        break;
      case 'represented-by-containment':
        containment++;
        categories.containment.push(o.edgeId);
        break;
      case 'suppressed-intentionally':
        suppressed++;
        categories.suppressed.push({ edgeId: o.edgeId, reason: o.reason });
        break;
      case 'projection-error':
        errors++;
        categories.errors.push({ edgeId: o.edgeId, reason: o.reason });
        break;
    }
  }

  return {
    view,
    zoomBand,
    eligibleCanonicalEdges: eligible,
    directRendered: direct,
    aggregatedRendered: aggregate,
    containmentRepresented: containment,
    suppressedIntentionally: suppressed,
    projectionErrors: errors,
    routingFallbacks: 0,
    renderedEdges: edges.length,
    outcomes,
    categories,
  };
}

function isNetworkNoise(r?: ResourceNode): boolean {
  return Boolean(r && ['vpc', 'subnet', 'network'].includes(r.kind));
}

function hiddenAtZoom(r?: ResourceNode): boolean {
  return Boolean(r && ['config', 'secret-ref', 'service-account', 'policy', 'build'].includes(r.kind));
}

function remapByEvidenceHint(
  graph: EvidenceGraph,
  visible: ResourceNode[],
  edge: ResourceEdge,
  reverse = false,
): string | null {
  const label = String(edge.label ?? '');
  const prefer = /BUCKET|ASSET/i.test(label)
    ? 'bucket'
    : /QUEUE|SQS|ORDER_QUEUE/i.test(label)
      ? 'queue'
      : /DB_|DATABASE|JDBC|HOST/i.test(label)
        ? 'relational-database'
        : /REDIS|CACHE/i.test(label)
          ? 'cache'
          : null;
  if (!prefer) return null;
  const fromId = reverse ? edge.target : edge.source;
  const from = graph.resources.find((r) => r.id === fromId);
  const env = (from?.metadata?.env as Record<string, string> | undefined) ?? {};
  const val = String(env[label] ?? label);
  const candidates = visible.filter((r) => r.kind === prefer);
  const scored = candidates
    .map((r) => {
      let score = 0;
      if (r.name === val) score += 200;
      else if (val.includes(r.name)) {
        const slack = Math.abs(val.length - r.name.length);
        score += Math.max(0, 40 - slack * 4) + Math.min(r.name.length, 12);
      }
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length);
  return (scored[0]?.r ?? candidates[0])?.id ?? null;
}

function trustZoneFor(graph: EvidenceGraph, resourceId: string): string | null {
  const edge = graph.edges.find(
    (e) =>
      e.relation === 'protected-by' &&
      e.source === resourceId &&
      graph.resources.find((r) => r.id === e.target)?.kind === 'trust-zone',
  );
  return edge?.target ?? null;
}

/** Explain why a visible entity has no rendered links. */
export function isolationExplanation(
  resourceId: string,
  graph: EvidenceGraph,
  projection: SemanticProjectionResult,
): string | null {
  const related = graph.edges.filter((e) => e.source === resourceId || e.target === resourceId);
  const eligible = related.filter((e) => isEligibleCanonicalEdge(projection.view, e));
  if (!eligible.length) {
    return projection.view === 'application'
      ? 'No application relationships were discovered for this entity.'
      : 'No security relationships were discovered for this entity.';
  }

  const outcomes = projection.outcomes.filter((o) => {
    const id = o.kind === 'rendered-aggregate' ? o.sourceEdgeIds[0] : o.edgeId;
    return eligible.some((e) => e.id === id || (o.kind === 'rendered-aggregate' && o.sourceEdgeIds.includes(e.id)));
  });

  const containment = outcomes.filter((o) => o.kind === 'represented-by-containment');
  if (containment.length && containment.length === eligible.length) {
    return 'This security concept is represented by its enclosing trust-zone boundary.';
  }

  const suppressed = outcomes.filter((o) => o.kind === 'suppressed-intentionally');
  if (suppressed.length === eligible.length) {
    const reason = suppressed[0]?.kind === 'suppressed-intentionally' ? suppressed[0].reason : '';
    if (/hidden at the current/i.test(reason)) {
      return 'The endpoint is hidden at the current abstraction level.';
    }
    if (/internal|self-edge|collapse/i.test(reason)) {
      return `All ${eligible.length} relationships are internal to this collapsed application.`;
    }
    return reason || 'Relationship evidence is incomplete.';
  }

  const rendered = projection.edges.filter(
    (e) => e.sourceId === resourceId || e.targetId === resourceId,
  );
  if (rendered.length) return null;

  const errors = outcomes.filter((o) => o.kind === 'projection-error');
  if (errors.length) return 'Relationship evidence is incomplete.';

  return 'No application relationships were discovered for this entity.';
}
