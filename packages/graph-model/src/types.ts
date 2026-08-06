import type {
  ConfidenceAssessment,
  EvidenceRecord,
  TruthState,
} from '@infralens/evidence-model';
import type {
  DriftCategory,
  FindingSeverity,
  FindingStatus,
  ArchitectPersona,
  ArchitectureProjection,
  GraphLayer,
  LifecycleState,
  RelationKind,
  ResourceKind,
  ReviewOutcome,
  ReviewStageId,
  ReviewStageOutcome,
  SensitivityClassification,
  SignOffState,
} from './kinds.js';

export interface OwnershipRef {
  team?: string;
  owner?: string;
  email?: string;
  system?: string;
}

export interface PortRange {
  protocol?: string;
  from: number;
  to?: number;
  name?: string;
}

export interface ResourceInterface {
  id: string;
  name: string;
  protocol?: string;
  ports?: PortRange[];
  address?: string;
  direction: 'inbound' | 'outbound' | 'both';
}

export interface ResourceInstance {
  id: string;
  truthState: TruthState;
  providerId?: string;
  address?: string;
  attributes: Record<string, unknown>;
  evidenceIds: string[];
}

export interface ResourceNode {
  id: string;
  logicalId: string;
  kind: ResourceKind;
  subtype?: string;
  provider?: string;
  platform?: string;
  name: string;
  displayName: string;
  environment?: string;
  account?: string;
  region?: string;
  cluster?: string;
  namespace?: string;
  ownership?: OwnershipRef[];
  lifecycle?: LifecycleState;
  truthStates: TruthState[];
  instances: ResourceInstance[];
  metadata: Record<string, unknown>;
  interfaces: ResourceInterface[];
  evidence: string[];
  findings: string[];
  confidence: ConfidenceAssessment;
  tags: string[];
  sensitivity?: SensitivityClassification;
  boundary?: string;
  /** Semantic layers this node participates in. */
  layers?: GraphLayer[];
}

export interface ResourceEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationKind;
  direction: 'directed' | 'bidirectional';
  protocol?: string;
  ports?: PortRange[];
  path?: string;
  dataClassifications?: string[];
  authentication?: string;
  encryption?: string;
  effectiveState?: 'allowed' | 'blocked' | 'partial' | 'unknown';
  truthStates: TruthState[];
  evidence: string[];
  confidence: ConfidenceAssessment;
  findings: string[];
  label?: string;
}

export interface Finding {
  id: string;
  policyId?: string;
  severity: FindingSeverity;
  title: string;
  rationale: string;
  impact: string;
  remediation: string;
  affectedResources: string[];
  evidence: string[];
  owner?: string;
  status: FindingStatus;
  firstSeen: string;
  lastSeen: string;
  blocksSignOff: boolean;
  waiverId?: string;
}

export interface DriftRecord {
  id: string;
  category: DriftCategory;
  severity: FindingSeverity;
  resourceId?: string;
  logicalId?: string;
  field?: string;
  declared?: unknown;
  planned?: unknown;
  observed?: unknown;
  explanation: string;
  evidence: string[];
  impact: string;
}

export interface UnsupportedConstruct {
  id: string;
  adapter: string;
  sourceUri: string;
  construct: string;
  reason: string;
  evidence: string[];
}

export interface CompletenessDimension {
  id: string;
  label: string;
  score: number;
  missing: string[];
}

export interface EvidenceCompleteness {
  overall: number;
  dimensions: CompletenessDimension[];
  summary: string;
}

export interface Waiver {
  id: string;
  findingId: string;
  policyId?: string;
  affectedResources: string[];
  owner: string;
  reason: string;
  approver: string;
  compensatingControl: string;
  createdAt: string;
  expiresAt: string;
  reviewDate: string;
  linkedDecision?: string;
  status: 'active' | 'expired' | 'revoked';
}

export interface SignOff {
  id: string;
  scanBundleId: string;
  project: string;
  repositoryRevision?: string;
  planStateHashes: string[];
  liveInventoryTimestamps: string[];
  environment: string;
  scope: string;
  reviewer: string;
  findingsSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    openBlocking: number;
  };
  unresolvedUnknowns: string[];
  acceptedWaivers: string[];
  comments: string[];
  decision: SignOffState;
  timestamp: string;
  expiry?: string;
  materialChangeRules: string[];
  evidenceHashes: string[];
}

export interface ScanMeta {
  id: string;
  project: string;
  generatedAt: string;
  repositoryRevision?: string;
  adapters: string[];
  /**
   * @deprecated Legacy OSS/commercial product label from pre-0.1.0 bundles.
   * Accepted when present for backward-compatible parsing; not used for gating.
   */
  edition?: 'oss' | 'commercial';
  warnings: string[];
  errors: string[];
  durationMs: number;
  contentHash: string;
  signature?: string;
}

export interface ExplainedScore {
  id: string;
  label: string;
  score: number;
  band: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  reasons: string[];
  evidenceIds: string[];
  missing: string[];
}

export interface ArchitectureDNA {
  capabilities: ExplainedScore;
  coupling: ExplainedScore;
  resilience: ExplainedScore;
  evidence: ExplainedScore;
  ownership: ExplainedScore;
  security: ExplainedScore;
  operationalComplexity: ExplainedScore;
  fingerprint: string;
}

export interface ArchitectureHealth {
  architectureCompleteness: ExplainedScore;
  ownershipMaturity: ExplainedScore;
  evidenceMaturity: ExplainedScore;
  resilienceMaturity: ExplainedScore;
  deploymentMaturity: ExplainedScore;
  securityMaturity: ExplainedScore;
  approvalReadiness: ExplainedScore;
}

export interface RiskProfile {
  operational: ExplainedScore;
  security: ExplainedScore;
  availability: ExplainedScore;
  business: ExplainedScore;
  evidence: ExplainedScore;
  ownership: ExplainedScore;
}

export interface GovernanceMetric {
  id: string;
  label: string;
  score: number;
  band: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  reasons: string[];
  evidenceIds: string[];
  missing: string[];
}

export interface GovernanceDashboard {
  architectureHealth: number;
  currentReviews: number;
  expiringApprovals: number;
  invalidAdrs: number;
  brokenAssumptions: number;
  intentDrift: number;
  outstandingObligations: number;
  unknownOwnership: number;
  status: 'GOVERNED' | 'AT RISK' | 'NON-COMPLIANT';
  reasons: string[];
  coachNotes: string[];
}

export interface GovernanceSnapshot {
  version: '2.0';
  dashboard: GovernanceDashboard;
  metrics: GovernanceMetric[];
  decisionIds: string[];
  intentIds: string[];
  assumptionIds: string[];
  contractIds: string[];
  obligationIds: string[];
  adrIds: string[];
  reviewRecordIds: string[];
}

export interface ArchitectureIntelligence {
  version: '1.3' | '1.4' | '2.0';
  story: string;
  storyClauses: Array<{ text: string; evidenceIds: string[]; edgeIds: string[]; resourceIds: string[] }>;
  dna: ArchitectureDNA;
  health: ArchitectureHealth;
  risk: RiskProfile;
  capabilityIds: string[];
  dataAssetIds: string[];
  teamIds: string[];
  trustZoneIds: string[];
  /** Latest computed review summary for the dashboard (v1.4). */
  reviewDashboard?: ReviewDashboard;
  activeReviewId?: string;
  /** Architecture governance snapshot (v2.0). */
  governance?: GovernanceSnapshot;
}

export interface RecommendationOption {
  id: string;
  title: string;
  pros: string[];
  cons: string[];
  impact: string;
  risk: string;
  cost: 'low' | 'medium' | 'high' | 'unknown';
  complexity: 'low' | 'medium' | 'high';
  confidence: 'high' | 'medium' | 'low';
  evidenceIds: string[];
  sideEffects: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

export interface FindingRecommendation {
  id: string;
  findingId?: string;
  problem: string;
  why: string;
  capabilityImpact: string[];
  businessImpact: string;
  technicalImpact: string;
  approvalImpact: string;
  options: RecommendationOption[];
  evidenceIds: string[];
  unknowns: string[];
  resourceIds: string[];
}

export interface ReviewStageResult {
  id: ReviewStageId;
  title: string;
  outcome: ReviewStageOutcome;
  importance: string;
  conclusion: string;
  evidenceIds: string[];
  resourceIds: string[];
  unknowns: string[];
  confidenceImprovements: string[];
  recommendation: string;
  continueApproval: boolean;
  projection: ArchitectureProjection | 'all';
  findingIds: string[];
  decision: string;
  risk: string;
  comments: string[];
}

export interface ReviewConfidence {
  overall: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  summary: string;
  dimensions: Array<{ label: string; level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'; reason: string }>;
}

export interface ArchitecturalScorecard {
  availability: ExplainedScore;
  security: ExplainedScore;
  evidence: ExplainedScore;
  ownership: ExplainedScore;
  resilience: ExplainedScore;
  scalability: ExplainedScore;
  maintainability: ExplainedScore;
  cost: ExplainedScore;
  operationalRisk: ExplainedScore;
  businessRisk: ExplainedScore;
}

export interface ReviewDashboard {
  architectureReady: number;
  criticalBlockers: number;
  architecturalConcerns: number;
  evidenceGaps: number;
  unknowns: number;
  waivers: number;
  reviewTimeMinutes: number;
  lastApprovalDaysAgo?: number;
  trend: 'improving' | 'stable' | 'regressing' | 'unknown';
  status: 'READY' | 'NOT READY' | 'READY WITH WAIVERS';
  reasons: string[];
}

export interface ReviewNotebookSection {
  stageId: ReviewStageId;
  title: string;
  evidence: string[];
  decision: string;
  reason: string;
  risk: string;
  recommendation: string;
  comments: string[];
  unknowns: string[];
  outcome: ReviewStageOutcome;
}

export interface ArchitectureReview {
  id: string;
  version: '1.4';
  playbookId: string;
  persona: ArchitectPersona;
  date: string;
  reviewer: string;
  repository?: string;
  scanBundleId: string;
  evidenceHash: string;
  status: 'in-progress' | 'completed';
  outcome: ReviewOutcome;
  stages: ReviewStageResult[];
  recommendations: FindingRecommendation[];
  scorecard: ArchitecturalScorecard;
  confidence: ReviewConfidence;
  dashboard: ReviewDashboard;
  notebook: ReviewNotebookSection[];
  coachNotes: string[];
  estimatedMinutes: number;
  completedStageIds: ReviewStageId[];
}

export interface EvidenceGraph {
  version: '1.2' | '1.3' | '1.4' | '2.0';
  scan: ScanMeta;
  resources: ResourceNode[];
  edges: ResourceEdge[];
  evidence: EvidenceRecord[];
  findings: Finding[];
  drifts: DriftRecord[];
  unsupported: UnsupportedConstruct[];
  waivers: Waiver[];
  signOffs: SignOff[];
  completeness: EvidenceCompleteness;
  narrative?: string;
  indices?: GraphIndices;
  /** Derived architecture intelligence — always computable from the graph. */
  intelligence?: ArchitectureIntelligence;
  /** Persistent architectural reviews (memory). */
  reviews?: ArchitectureReview[];
  /** Declared intents (also mirrored as graph nodes). */
  declaredIntents?: string[];
}

export interface GraphIndices {
  byLogicalId: Record<string, string[]>;
  byKind: Record<string, string[]>;
  byEnvironment: Record<string, string[]>;
  adjacencyOut: Record<string, string[]>;
  adjacencyIn: Record<string, string[]>;
}

export interface ScanBundle {
  format: 'infralens.scan.bundle';
  version: '1.2' | '1.3' | '1.4' | '2.0';
  graph: EvidenceGraph;
  rawSnapshots?: Record<string, unknown>;
}
