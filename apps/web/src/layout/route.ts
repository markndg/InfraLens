import type { EvidenceGraph } from '@infralens/graph-model';
import type { ZoomBand } from '../lib/edges';
import type { ProjectedEdge } from '../projection/types';
import type { Corridor, LayoutContainer, LayoutGraph, LayoutLeaf, RoutedEdge } from './types';
import { CONTAINER_CONSTRAINTS } from './types';
import { findContainerOf, indexTree } from './pack';

/**
 * Reserve corridors between sibling containers, then route edges orthogonally:
 * node → exit port → corridor → enter port → node
 */
export function reserveCorridors(root: LayoutContainer): Corridor[] {
  const corridors: Corridor[] = [];
  const siblings = root.children.filter((c) => c.kind === 'container') as LayoutContainer[];
  const C = CONTAINER_CONSTRAINTS;

  for (let i = 0; i < siblings.length - 1; i++) {
    const a = siblings[i];
    const b = siblings[i + 1];
    if (a.abs.x + a.abs.width <= b.abs.x) {
      const x = a.abs.x + a.abs.width;
      const width = Math.max(C.corridorWidth, b.abs.x - x);
      const y = Math.min(a.abs.y, b.abs.y);
      const height = Math.max(a.abs.y + a.abs.height, b.abs.y + b.abs.height) - y;
      corridors.push({
        id: `corr:${a.id}:${b.id}`,
        box: { x, y, width, height },
        direction: 'vertical',
        fromContainerId: a.id,
        toContainerId: b.id,
      });
    } else if (a.abs.y + a.abs.height <= b.abs.y) {
      const y = a.abs.y + a.abs.height;
      const height = Math.max(C.corridorWidth, b.abs.y - y);
      const x = Math.min(a.abs.x, b.abs.x);
      const width = Math.max(a.abs.x + a.abs.width, b.abs.x + b.abs.width) - x;
      corridors.push({
        id: `corr:${a.id}:${b.id}`,
        box: { x, y, width, height },
        direction: 'horizontal',
        fromContainerId: a.id,
        toContainerId: b.id,
      });
    }
  }
  return corridors;
}

export interface RouteDiagnostics {
  routingFallbacks: number;
  skippedMissingLeaf: number;
}

/**
 * Route semantic projected edges. Layout never decides whether a relationship exists —
 * routing failure yields a fallback orthogonal path and increments diagnostics.
 */
export function routeProjectedEdges(
  projected: ProjectedEdge[],
  root: LayoutContainer,
  corridors: Corridor[],
  zoomBand: ZoomBand,
): { routed: RoutedEdge[]; diagnostics: RouteDiagnostics } {
  const byId = indexTree(root);
  const diagnostics: RouteDiagnostics = { routingFallbacks: 0, skippedMissingLeaf: 0 };

  type BundleKey = string;
  const bundles = new Map<BundleKey, ProjectedEdge[]>();
  for (const e of projected) {
    const sc = findContainerOf(root, e.sourceId);
    const tc = findContainerOf(root, e.targetId);
    const key =
      sc && tc && sc.id !== tc.id
        ? [sc.id, tc.id].sort().join('→')
        : `local:${sc?.id ?? 'root'}`;
    const list = bundles.get(key) ?? [];
    list.push(e);
    bundles.set(key, list);
  }

  const routed: RoutedEdge[] = [];
  let bundleSlot = 0;

  for (const [key, list] of bundles) {
    const slot = bundleSlot++;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      let src = byId.get(e.sourceId);
      let tgt = byId.get(e.targetId);

      // Far-zoom / container representatives: route between containers when leaves absent
      if (!src || src.kind !== 'leaf') {
        const sc = findContainerOf(root, e.sourceId) ?? (byId.get(e.sourceId)?.kind === 'container' ? (byId.get(e.sourceId) as LayoutContainer) : null);
        if (sc) {
          src = syntheticLeafFromContainer(sc);
        }
      }
      if (!tgt || tgt.kind !== 'leaf') {
        const tc = findContainerOf(root, e.targetId) ?? (byId.get(e.targetId)?.kind === 'container' ? (byId.get(e.targetId) as LayoutContainer) : null);
        if (tc) {
          tgt = syntheticLeafFromContainer(tc);
        }
      }

      if (!src || src.kind !== 'leaf' || !tgt || tgt.kind !== 'leaf') {
        // Still emit a fallback so semantic edges never vanish
        diagnostics.routingFallbacks++;
        diagnostics.skippedMissingLeaf++;
        const fallback = [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
        ];
        routed.push({
          id: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
          relation: e.relation,
          points: fallback,
          label: e.label,
          labelBox: e.label ? labelBoxFor(fallback) : undefined,
          corridorId: `fallback:${e.id}`,
        });
        continue;
      }

      const sc = findContainerOf(root, e.sourceId);
      const tc = findContainerOf(root, e.targetId);
      let points = orthogonalRoute(src, tgt, sc, tc, corridors, slot + i * 0.15);
      if (points.length < 2) {
        diagnostics.routingFallbacks++;
        points = hvh(center(src), center(tgt), 0);
      }

      const label =
        e.label ||
        (zoomBand === 'near' ? e.family : e.crossesBoundary ? 'boundary' : undefined);

      routed.push({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        relation: e.relation,
        points,
        label,
        labelBox: label ? labelBoxFor(points) : undefined,
        corridorId: key.startsWith('local:') ? undefined : `corr-bundle:${key}`,
      });
    }
  }

  return { routed, diagnostics };
}

/** @deprecated use routeProjectedEdges — kept for transitional call sites */
export function routeEdges(
  _graph: EvidenceGraph,
  root: LayoutContainer,
  corridors: Corridor[],
  visibleIds: Set<string>,
  zoomBand: ZoomBand,
  projected?: ProjectedEdge[],
): RoutedEdge[] {
  if (projected) {
    return routeProjectedEdges(projected, root, corridors, zoomBand).routed;
  }
  // Legacy: should not be used for application/security
  const byId = indexTree(root);
  const routed: RoutedEdge[] = [];
  void visibleIds;
  void byId;
  void corridors;
  void zoomBand;
  void root;
  return routed;
}

function syntheticLeafFromContainer(c: LayoutContainer): LayoutLeaf {
  return {
    kind: 'leaf',
    id: c.id,
    resource: {
      id: c.id,
      logicalId: c.id,
      kind: 'unknown',
      name: c.label,
      displayName: c.label,
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [],
      metadata: {},
      interfaces: [],
      evidence: [],
      findings: [],
      confidence: {
        band: 'low',
        score: 0.5,
        reasons: [],
        missingEvidence: [],
        conflicts: [],
        wouldIncreaseConfidence: [],
      },
      tags: [],
    },
    measured: { width: c.measured.width, height: c.measured.height },
    rel: { x: 0, y: 0 },
    abs: { ...c.abs },
  };
}

function orthogonalRoute(
  src: LayoutLeaf,
  tgt: LayoutLeaf,
  sc: LayoutContainer | null,
  tc: LayoutContainer | null,
  corridors: Corridor[],
  nudge: number,
): Array<{ x: number; y: number }> {
  const s = center(src);
  const t = center(tgt);
  const offset = Math.round(nudge * 12);

  if (!sc || !tc || sc.id === tc.id) {
    if (sc) {
      const bandY = sc.abs.y + CONTAINER_CONSTRAINTS.paddingTop / 2 + offset;
      return [
        { x: s.x, y: s.y },
        { x: s.x, y: bandY },
        { x: t.x, y: bandY },
        { x: t.x, y: t.y },
      ];
    }
    return hvh(s, t, offset);
  }

  const exit = sc.ports.find((p) => p.side === (s.x <= t.x ? 'right' : 'left')) ?? sc.ports[1];
  const enter = tc.ports.find((p) => p.side === (s.x <= t.x ? 'left' : 'right')) ?? tc.ports[0];
  const corridor =
    corridors.find(
      (c) =>
        (c.fromContainerId === sc.id && c.toContainerId === tc.id) ||
        (c.fromContainerId === tc.id && c.toContainerId === sc.id),
    ) ?? null;

  const midY = corridor
    ? corridor.box.y + corridor.box.height / 2 + offset
    : (exit.y + enter.y) / 2 + offset;
  const midX = corridor
    ? corridor.box.x + corridor.box.width / 2 + offset
    : (exit.x + enter.x) / 2 + offset;

  if (corridor?.direction === 'vertical') {
    return [
      { x: s.x, y: s.y },
      { x: exit.x, y: s.y },
      { x: exit.x, y: midY },
      { x: enter.x, y: midY },
      { x: enter.x, y: t.y },
      { x: t.x, y: t.y },
    ];
  }

  return [
    { x: s.x, y: s.y },
    { x: s.x, y: exit.y },
    { x: midX, y: exit.y },
    { x: midX, y: enter.y },
    { x: t.x, y: enter.y },
    { x: t.x, y: t.y },
  ];
}

function hvh(
  s: { x: number; y: number },
  t: { x: number; y: number },
  offset: number,
): Array<{ x: number; y: number }> {
  const midX = (s.x + t.x) / 2 + offset;
  if (Math.abs(s.y - t.y) < 4) {
    return [s, t];
  }
  return [s, { x: midX, y: s.y }, { x: midX, y: t.y }, t];
}

function center(leaf: LayoutLeaf): { x: number; y: number } {
  return {
    x: leaf.abs.x + leaf.abs.width / 2,
    y: leaf.abs.y + leaf.abs.height / 2,
  };
}

function labelBoxFor(points: Array<{ x: number; y: number }>) {
  const mid = points[Math.floor(points.length / 2)];
  return { x: mid.x - 40, y: mid.y - 10, width: 80, height: 18 };
}

export function collectDebug(graph: LayoutGraph) {
  const containers = [...graph.byId.values()]
    .filter((n) => n.kind === 'container' && n.id !== '__root__')
    .map((n) => n.abs);
  const ports = [...graph.byId.values()]
    .filter((n) => n.kind === 'container')
    .flatMap((n) => (n.kind === 'container' ? n.ports : []));
  return {
    enabled: true,
    containers,
    paddingBoxes: containers,
    corridors: graph.corridors.map((c) => c.box),
    labelBoxes: graph.edges.map((e) => e.labelBox).filter(Boolean) as LayoutGraph['debug']['labelBoxes'],
    collisionBoxes: [...graph.byId.values()]
      .filter((n) => n.kind === 'leaf')
      .map((n) => n.abs),
    ports,
  };
}
