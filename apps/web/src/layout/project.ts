import type { Edge, Node } from '@xyflow/react';
import type { EvidenceGraph } from '@infralens/graph-model';
import { edgeStyle } from '../lib/edges';
import { inferTechStack } from '../lib/techStack';
import { kindLabel, scopeLabel } from '../lib/architectureLayoutLabels';
import type { SemanticProjectionResult } from '../projection/types';
import type { LayoutContainer, LayoutGraph, LayoutLeaf, RoutedEdge } from './types';
import type { ZoomBand } from '../lib/edges';

/**
 * Project Layout Graph → React Flow scene.
 * Containers become boundary parents; leaves are children (containment enforced).
 * Semantic edges are preserved even when routing used fallbacks.
 */
export function projectToReactFlow(
  layout: LayoutGraph,
  graph: EvidenceGraph,
  projection?: SemanticProjectionResult,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const zoomBand = layout.zoomBand;
  const far = zoomBand === 'far';

  // Emit containers first (parents before children)
  for (const child of layout.root.children) {
    if (child.kind === 'container') {
      emitContainer(child, null, nodes, graph, zoomBand, projection);
    } else if (!far) {
      emitLeaf(child, null, nodes, graph, zoomBand);
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Never drop semantic edges: remap missing endpoints to their parent container when needed
  const edges: Edge[] = far
    ? projectFarEdges(layout)
    : layout.edges.map((e) => {
        const source = nodeIds.has(e.sourceId)
          ? e.sourceId
          : parentContainerId(layout, e.sourceId) ?? e.sourceId;
        const target = nodeIds.has(e.targetId)
          ? e.targetId
          : parentContainerId(layout, e.targetId) ?? e.targetId;
        if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) {
          // Keep edge record with original ids — React Flow may hide until fit; still counted
          return projectEdge({ ...e, sourceId: source, targetId: target }, true);
        }
        return projectEdge({ ...e, sourceId: source, targetId: target });
      });

  return { nodes, edges };
}

function parentContainerId(layout: LayoutGraph, leafId: string): string | null {
  for (const n of layout.byId.values()) {
    if (n.kind === 'container' && n.memberIds.includes(leafId) && n.id !== '__root__') return n.id;
  }
  return null;
}

/** Bundle leaf edges into container↔container corridors at far zoom. */
function projectFarEdges(layout: LayoutGraph): Edge[] {
  const byLeaf = new Map<string, string>();
  for (const n of layout.byId.values()) {
    if (n.kind !== 'container' || n.id === '__root__') continue;
    for (const id of n.memberIds) byLeaf.set(id, n.id);
  }
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const e of layout.edges) {
    const s = byLeaf.get(e.sourceId);
    const t = byLeaf.get(e.targetId);
    if (!s || !t || s === t) continue;
    const id = `far:${[s, t].sort().join('→')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const sc = layout.byId.get(s);
    const tc = layout.byId.get(t);
    if (!sc || sc.kind !== 'container' || !tc || tc.kind !== 'container') continue;
    const points = [
      { x: sc.abs.x + sc.abs.width / 2, y: sc.abs.y + sc.abs.height / 2 },
      { x: tc.abs.x + tc.abs.width / 2, y: tc.abs.y + tc.abs.height / 2 },
    ];
    out.push({
      id,
      source: s,
      target: t,
      type: 'corridor',
      zIndex: 1,
      data: { points, corridorId: id },
      style: edgeStyle(e.relation),
    });
  }
  return out;
}

function emitContainer(
  c: LayoutContainer,
  parentId: string | null,
  nodes: Node[],
  graph: EvidenceGraph,
  zoomBand: ZoomBand,
  projection?: SemanticProjectionResult,
): void {
  // Prevent duplicate trust-zone group + same-id node
  if (projection?.containerOnlyIds.has(c.id) && nodes.some((n) => n.id === c.id && n.type === 'infra')) {
    return;
  }
  const summary = zoomBand === 'far';
  const width = summary ? Math.max(220, Math.min(c.measured.width, 280)) : c.measured.width;
  const height = summary ? 88 : c.measured.height;
  nodes.push({
    id: c.id,
    type: 'boundary',
    position: parentId
      ? { x: c.rel.x, y: c.rel.y }
      : { x: c.abs.x, y: c.abs.y },
    parentId: parentId ?? undefined,
    style: { width, height },
    zIndex: 0,
    draggable: false,
    selectable: true,
    data: {
      boundary: {
        id: c.id,
        label: c.label,
        kind: c.dimension,
        subtitle: c.badges.join(' · ') || undefined,
        badges: c.badges,
        memberIds: c.memberIds,
        findingHigh: c.meta.findingHigh,
        findingCritical: c.meta.findingCritical,
        hasDrift: c.meta.hasDrift,
        completeness: 1,
        collapsedSummary: zoomBand === 'far',
      },
      layoutBox: c.abs,
      ports: c.ports,
    },
  });

  // Semantic zoom: at far band, collapse to container summary (no internal leaves)
  if (zoomBand === 'far') return;

  for (const child of c.children) {
    if (child.kind === 'container') emitContainer(child, c.id, nodes, graph, zoomBand, projection);
    else if (!projection?.containerOnlyIds.has(child.id)) emitLeaf(child, c.id, nodes, graph, zoomBand);
  }
}

function emitLeaf(
  leaf: LayoutLeaf,
  parentId: string | null,
  nodes: Node[],
  graph: EvidenceGraph,
  zoomBand: ZoomBand,
): void {
  const tech = inferTechStack(leaf.resource, graph);
  const findings = graph.findings.filter((f) => f.affectedResources.includes(leaf.id));
  nodes.push({
    id: leaf.id,
    type: 'infra',
    position: parentId
      ? { x: leaf.rel.x, y: leaf.rel.y }
      : { x: leaf.abs.x, y: leaf.abs.y },
    parentId: parentId ?? undefined,
    extent: parentId ? 'parent' : undefined,
    zIndex: 10,
    data: {
      resource: leaf.resource,
      zoomBand,
      findingSeverity: highestSeverity(findings.map((f) => f.severity)),
      drifted: graph.drifts.some((d) => d.resourceId === leaf.id),
      scopeLabel: scopeLabel(leaf.resource),
      kindLabel: kindLabel(leaf.resource),
      techLabel: tech?.label,
      techKey: tech?.techKey,
      layoutBox: leaf.abs,
    },
    ariaLabel: `${leaf.resource.displayName}, ${kindLabel(leaf.resource)}`,
  });
}

function projectEdge(e: RoutedEdge, fallback = false): Edge {
  const pts = e.points;
  const sourceHandle = pickHandle(pts, true);
  const targetHandle = pickHandle(pts, false);
  const base = edgeStyle(e.relation);
  const boundary =
    Boolean(e.label && /boundary/i.test(e.label)) ||
    e.relation.effectiveState === 'blocked' ||
    e.relation.relation === 'network-blocked';
  return {
    id: e.id,
    source: e.sourceId,
    target: e.targetId,
    sourceHandle,
    targetHandle,
    type: 'corridor',
    zIndex: boundary ? 3 : 1,
    data: {
      relation: e.relation,
      points: e.points,
      label: e.label,
      corridorId: e.corridorId,
      routingFallback: fallback || e.corridorId?.startsWith('fallback:'),
    },
    label: e.label,
    labelStyle: { fontSize: 9, fill: boundary ? '#9f1239' : '#4c3a6e', fontWeight: boundary ? 650 : 500 },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
    labelBgPadding: [3, 5] as [number, number],
    labelBgBorderRadius: 4,
    style: {
      ...base,
      strokeWidth: boundary ? Math.max(Number(base.strokeWidth ?? 1.5), 2.25) : base.strokeWidth,
      stroke: boundary ? '#be123c' : base.stroke,
    },
  };
}

function pickHandle(points: Array<{ x: number; y: number }>, isSource: boolean): string {
  if (points.length < 2) return isSource ? 'right' : 'left';
  const a = isSource ? points[0] : points[points.length - 2];
  const b = isSource ? points[1] : points[points.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? (isSource ? 'right' : 'left') : isSource ? 'left' : 'right';
  return dy >= 0 ? (isSource ? 'bottom' : 'top') : isSource ? 'top' : 'bottom';
}

function highestSeverity(sevs: string[]): string | undefined {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  return order.find((s) => sevs.includes(s));
}
