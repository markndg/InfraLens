import type { ArchitectureView, EvidenceGraph } from '@infralens/graph-model';
import type { Edge, Node } from '@xyflow/react';
import { LANE_ORDER_LTR } from '../lib/lanes';
import type { ZoomBand } from '../lib/edges';
import {
  getLastProjectionIntegrity,
  projectSemanticEdges,
  type ProjectionIntegrityReport,
  type SemanticProjectionResult,
} from '../projection';
import { resolveCollisions } from './collide';
import { buildContainmentTree, primaryDimension } from './containment';
import { assignPorts, indexTree, layoutTree } from './pack';
import { projectToReactFlow } from './project';
import { collectDebug, reserveCorridors, routeProjectedEdges } from './route';
import type { LayoutGraph } from './types';

const cache = new Map<
  string,
  {
    nodes: Node[];
    edges: Edge[];
    layout: LayoutGraph;
    integrity: ProjectionIntegrityReport;
    projection: SemanticProjectionResult;
  }
>();

let lastProjection: SemanticProjectionResult | null = null;

export function clearHierarchicalLayoutCache() {
  cache.clear();
  lastProjection = null;
}

export function getLastSemanticProjection(): SemanticProjectionResult | null {
  return lastProjection;
}

export { getLastProjectionIntegrity };

/**
 * Staged pipeline:
 * canonical → semantic projection (nodes+edges) → containment → pack →
 * corridors → route projected edges → collide → scene
 *
 * Layout never owns or discards semantic relationships.
 */
export function runLayoutPipeline(
  graph: EvidenceGraph,
  view: ArchitectureView,
  zoomBand: ZoomBand,
  opts?: { debug?: boolean },
): {
  nodes: Node[];
  edges: Edge[];
  lanes: typeof LANE_ORDER_LTR;
  layout: LayoutGraph;
  integrity: ProjectionIntegrityReport;
} {
  const cacheKey = `hier:v2:${view}:${zoomBand}:${graph.scan.contentHash}:${graph.resources.length}:${graph.edges.length}:${opts?.debug ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit) {
    lastProjection = hit.projection;
    return {
      nodes: hit.nodes.map((n) => ({ ...n, data: { ...n.data } })),
      edges: hit.edges.map((e) => ({ ...e, data: e.data ? { ...e.data } : e.data })),
      lanes: LANE_ORDER_LTR,
      layout: hit.layout,
      integrity: hit.integrity,
    };
  }

  // 1–3. Semantic projection (nodes + edges + representative map + outcomes)
  const projection = projectSemanticEdges(graph, view, zoomBand);
  lastProjection = projection;
  const resources = projection.resources;

  // 4. Containment tree (single owning dimension) — uses projected resources only
  const root = buildContainmentTree(graph, resources, view, zoomBand);
  const dimension = primaryDimension(view);

  // 5–6. Measure + recursive pack
  layoutTree(root, 40, 40);

  // 7. Edge corridors
  const corridors = reserveCorridors(root);

  // 8. Route semantic edges (independent of group-local packing decisions)
  let { routed: edges, diagnostics } = routeProjectedEdges(
    projection.edges,
    root,
    corridors,
    zoomBand,
  );

  // 9–10. Collision resolution
  resolveCollisions(root, edges);

  assignPorts(root);
  const corridors2 = reserveCorridors(root);
  ({ routed: edges, diagnostics } = routeProjectedEdges(projection.edges, root, corridors2, zoomBand));

  const integrity: ProjectionIntegrityReport = {
    ...projection.integrity,
    routingFallbacks: diagnostics.routingFallbacks,
  };

  const byId = indexTree(root);
  const layout: LayoutGraph = {
    view,
    zoomBand,
    dimension,
    root,
    corridors: corridors2,
    edges,
    byId,
    debug: {
      enabled: Boolean(opts?.debug),
      containers: [],
      paddingBoxes: [],
      corridors: [],
      labelBoxes: [],
      collisionBoxes: [],
      ports: [],
    },
  };
  if (opts?.debug) {
    layout.debug = collectDebug(layout);
  }

  // 11. Project to rendered scene — never filter semantic edges by local layout
  const scene = projectToReactFlow(layout, graph, projection);

  cache.set(cacheKey, {
    nodes: scene.nodes,
    edges: scene.edges,
    layout,
    integrity,
    projection,
  });
  if (cache.size > 40) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }

  return { ...scene, lanes: LANE_ORDER_LTR, layout, integrity };
}
