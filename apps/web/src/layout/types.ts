import type { ArchitectureView, ResourceEdge, ResourceNode } from '@infralens/graph-model';
import type { ZoomBand } from '../lib/edges';

/** Primary containment dimension — only one owns layout at a time. */
export type ContainmentDimension =
  | 'application'
  | 'logical-application'
  | 'app-stack'
  | 'platform'
  | 'network'
  | 'environment'
  | 'capability'
  | 'trust'
  | 'lane'
  | 'data-domain'
  | 'team'
  | 'risk-domain'
  | 'cost-domain'
  | 'review-period'
  | 'review'
  | 'security-controls';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Port {
  id: string;
  side: 'left' | 'right' | 'top' | 'bottom';
  /** Offset along the side, 0–1 */
  t: number;
  /** Absolute canvas position after layout */
  x: number;
  y: number;
}

export interface LayoutLeaf {
  kind: 'leaf';
  id: string;
  resource: ResourceNode;
  /** Intrinsic size before placement */
  measured: { width: number; height: number };
  /** Position relative to parent container */
  rel: { x: number; y: number };
  /** Absolute canvas box after layout */
  abs: Box;
}

export interface LayoutContainer {
  kind: 'container';
  id: string;
  /** Grouping kind: application, platform, network, … */
  dimension: string;
  label: string;
  badges: string[];
  children: LayoutNode[];
  measured: { width: number; height: number };
  rel: { x: number; y: number };
  abs: Box;
  ports: Port[];
  /** Member resource ids (leaves under this container, recursive) */
  memberIds: string[];
  meta: {
    findingHigh: number;
    findingCritical: number;
    hasDrift: boolean;
  };
}

export type LayoutNode = LayoutLeaf | LayoutContainer;

export interface Corridor {
  id: string;
  /** Axis-aligned channel between containers */
  box: Box;
  direction: 'horizontal' | 'vertical';
  fromContainerId: string;
  toContainerId: string;
}

export interface RoutedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: ResourceEdge;
  /** Absolute polyline points (orthogonal) */
  points: Array<{ x: number; y: number }>;
  label?: string;
  labelBox?: Box;
  corridorId?: string;
}

export interface LayoutGraph {
  view: ArchitectureView;
  zoomBand: ZoomBand;
  dimension: ContainmentDimension;
  root: LayoutContainer;
  corridors: Corridor[];
  edges: RoutedEdge[];
  /** Flat lookup */
  byId: Map<string, LayoutNode>;
  debug: LayoutDebugInfo;
}

export interface LayoutDebugInfo {
  enabled: boolean;
  containers: Box[];
  paddingBoxes: Box[];
  corridors: Box[];
  labelBoxes: Box[];
  collisionBoxes: Box[];
  ports: Port[];
}

/** Structural container constraints — not ad-hoc spacing tweaks. */
export const CONTAINER_CONSTRAINTS = {
  /* Interior pad only — group title sits on the outside top edge */
  paddingTop: 16,
  paddingRight: 20,
  paddingBottom: 20,
  paddingLeft: 20,
  labelBand: 0,
  childGapX: 28,
  childGapY: 24,
  minWidth: 220,
  minHeight: 100,
  /** Gap between sibling containers at the same level */
  siblingGap: 48,
  /** Reserved channel width between containers for inter-group edges */
  corridorWidth: 40,
  portInset: 0,
  leafWidth: { far: 200, medium: 236, near: 250 },
  leafHeight: { far: 64, medium: 96, near: 112 },
} as const;

export function leafSize(zoom: ZoomBand): { width: number; height: number } {
  return {
    width: CONTAINER_CONSTRAINTS.leafWidth[zoom],
    height: CONTAINER_CONSTRAINTS.leafHeight[zoom],
  };
}
