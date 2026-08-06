import type { Edge, Node } from '@xyflow/react';
import type { ArchitectureView, EvidenceGraph } from '@infralens/graph-model';
import {
  clearHierarchicalLayoutCache,
  getLastProjectionIntegrity,
  getLastSemanticProjection,
  runLayoutPipeline,
  type LayoutGraph,
} from '../layout';
import type { ProjectionIntegrityReport } from '../projection';
import type { ArchitectureLane } from './lanes';
import { LANE_ORDER_LTR } from './lanes';
import type { ZoomBand } from './edges';

export type { ZoomBand };
export { resourcesForView } from './resourcesForView';
export { kindLabel, scopeLabel } from './architectureLayoutLabels';
export type { ProjectionIntegrityReport };

let lastLayout: LayoutGraph | null = null;
let lastIntegrity: ProjectionIntegrityReport | null = null;
let layoutDebug = false;

export function setLayoutDebug(enabled: boolean) {
  layoutDebug = enabled;
  clearLayoutCache();
}

export function getLastLayoutGraph(): LayoutGraph | null {
  return lastLayout;
}

export function getProjectionIntegrity(): ProjectionIntegrityReport | null {
  return lastIntegrity ?? getLastProjectionIntegrity();
}

export function getSemanticProjection() {
  return getLastSemanticProjection();
}

/**
 * Façade — hierarchical constraint-based layout pipeline.
 * Evidence Graph → Semantic Projection → Layout Graph → Scene
 */
export function toArchitectureFlow(
  graph: EvidenceGraph,
  view: ArchitectureView,
  zoomBand: ZoomBand,
): { nodes: Node[]; edges: Edge[]; lanes: ArchitectureLane[]; integrity: ProjectionIntegrityReport } {
  const result = runLayoutPipeline(graph, view, zoomBand, { debug: layoutDebug });
  lastLayout = result.layout;
  lastIntegrity = result.integrity;
  return {
    nodes: result.nodes,
    edges: result.edges,
    lanes: result.lanes ?? LANE_ORDER_LTR,
    integrity: result.integrity,
  };
}

export function clearLayoutCache() {
  clearHierarchicalLayoutCache();
  lastLayout = null;
  lastIntegrity = null;
}
