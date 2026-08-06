export {
  runLayoutPipeline,
  clearHierarchicalLayoutCache,
  getLastSemanticProjection,
  getLastProjectionIntegrity,
} from './pipeline';
export { verifyLayout, type LayoutViolation } from './verify';
export { primaryDimension } from './containment';
export type { LayoutGraph, LayoutDebugInfo, ContainmentDimension } from './types';
export { CONTAINER_CONSTRAINTS } from './types';
