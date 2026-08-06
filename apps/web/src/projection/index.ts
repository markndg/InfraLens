export {
  projectSemanticEdges,
  getLastProjectionIntegrity,
  isolationExplanation,
} from './projectEdges';
export {
  PROJECTION_CONTRACTS,
  getProjectionContract,
  type ProjectionContract,
  type RelationFamily,
} from './contracts';
export { APPLICATION_RELATIONS, SECURITY_RELATIONS } from './specs';
export type {
  EdgeProjectionOutcome,
  ProjectedEdge,
  ProjectionIntegrityReport,
  ProjectionRepresentativeMap,
  SemanticProjectionResult,
} from './types';
