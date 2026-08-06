import type { ArchitectureView, ResourceEdge, ResourceNode } from '@infralens/graph-model';
import type { ZoomBand } from '../lib/edges';
import type { ProjectionContract } from './contracts';

export interface ProjectionRepresentativeMap {
  canonicalNodeToProjectedNode: Map<string, string>;
  projectedNodeToVisibleRepresentative: Map<string, string>;
  canonicalNodeToVisibleRepresentative: Map<string, string>;
}

export type EdgeProjectionOutcome =
  | { kind: 'rendered-direct'; edgeId: string }
  | { kind: 'rendered-aggregate'; edgeId: string; sourceEdgeIds: string[] }
  | { kind: 'represented-by-containment'; groupId: string; edgeId: string }
  | { kind: 'suppressed-intentionally'; reason: string; edgeId: string }
  | { kind: 'projection-error'; reason: string; edgeId: string };

export interface ProjectedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  /** Normalised semantic family for the view */
  family: string;
  relation: ResourceEdge;
  sourceEdgeIds: string[];
  label?: string;
  protocol?: string;
  port?: number;
  /** Cross trust-zone / application boundary */
  crossesBoundary?: boolean;
  effectiveState?: ResourceEdge['effectiveState'];
}

export interface ProjectionIntegrityReport {
  view: ArchitectureView;
  zoomBand: ZoomBand;
  eligibleCanonicalEdges: number;
  directRendered: number;
  aggregatedRendered: number;
  containmentRepresented: number;
  suppressedIntentionally: number;
  projectionErrors: number;
  routingFallbacks: number;
  renderedEdges: number;
  outcomes: EdgeProjectionOutcome[];
  /** Stable for debug panel */
  categories: {
    direct: string[];
    aggregate: string[];
    containment: string[];
    suppressed: Array<{ edgeId: string; reason: string }>;
    errors: Array<{ edgeId: string; reason: string }>;
  };
}

export interface SemanticProjectionResult {
  view: ArchitectureView;
  zoomBand: ZoomBand;
  resources: ResourceNode[];
  visibleIds: Set<string>;
  representativeMap: ProjectionRepresentativeMap;
  edges: ProjectedEdge[];
  outcomes: EdgeProjectionOutcome[];
  integrity: ProjectionIntegrityReport;
  /** Container ids that must not also appear as leaf nodes */
  containerOnlyIds: Set<string>;
  contract: ProjectionContract;
  /** Evidence-backed one-line answer to the projection question */
  summary: string;
}
