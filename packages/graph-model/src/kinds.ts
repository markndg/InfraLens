export type ResourceKind =
  | 'application'
  | 'workload'
  | 'service'
  | 'ingress'
  | 'route'
  | 'gateway'
  | 'config'
  | 'secret-ref'
  | 'storage'
  | 'volume'
  | 'queue'
  | 'topic'
  | 'relational-database'
  | 'cache'
  | 'bucket'
  | 'function'
  | 'network'
  | 'subnet'
  | 'security-group'
  | 'load-balancer'
  | 'dns'
  | 'iam-role'
  | 'iam-policy'
  | 'monitoring'
  | 'external-system'
  | 'internet'
  | 'user'
  | 'namespace'
  | 'cluster'
  | 'account'
  | 'vpc'
  | 'unknown'
  | 'network-policy'
  | 'service-account'
  | 'policy'
  | 'build'
  | 'image-stream'
  | 'business-capability'
  | 'data-asset'
  | 'team'
  | 'trust-zone'
  | 'platform-system'
  | 'architectural-decision'
  | 'intent'
  | 'assumption'
  | 'architecture-contract'
  | 'obligation'
  | 'review-record'
  | 'adr';

export type GraphLayer =
  | 'infrastructure'
  | 'application'
  | 'business-capability'
  | 'data'
  | 'ownership'
  | 'security'
  | 'deployment'
  | 'evidence'
  | 'time'
  | 'risk'
  | 'cost'
  | 'governance'
  | 'decision'
  | 'intent'
  | 'assumption'
  | 'contract';

export type RelationKind =
  | 'declared-dependency'
  | 'configuration-reference'
  | 'dns-resolution'
  | 'selector-relationship'
  | 'ingress-route'
  | 'service-to-workload'
  | 'network-reachable'
  | 'network-blocked'
  | 'iam-authorised'
  | 'iam-denied'
  | 'data-read'
  | 'data-write'
  | 'event-publish'
  | 'event-consume'
  | 'secret-reference'
  | 'deployment-dependency'
  | 'build-dependency'
  | 'monitoring-relation'
  | 'ownership-relation'
  | 'inferred-relation'
  | 'drift-relation'
  | 'routes-to'
  | 'exposes'
  | 'connects'
  | 'contains'
  | 'implemented-by'
  | 'implements'
  | 'stores'
  | 'creates'
  | 'transforms'
  | 'consumes-data'
  | 'owned-by'
  | 'runs-in'
  | 'protected-by'
  | 'supports-capability'
  | 'classified-as'
  | 'decides'
  | 'realizes-intent'
  | 'depends-on-assumption'
  | 'satisfies-contract'
  | 'violates-contract'
  | 'produces-obligation'
  | 'supersedes'
  | 'documents-decision'
  | 'invalidates'
  | 'evaluated-by';

export type ArchitectureProjection =
  | 'physical'
  | 'application'
  | 'capability'
  | 'ownership'
  | 'data'
  | 'security'
  | 'risk'
  | 'cost'
  | 'time'
  | 'dna'
  | 'decision'
  | 'governance';

export type DecisionStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'deprecated'
  | 'superseded'
  | 'satisfied'
  | 'possibly-invalid'
  | 'invalid'
  | 'unknown';

export type AssumptionStatus = 'supported' | 'unsupported' | 'failed' | 'unknown' | 'waived';

export type IntentSatisfaction = 'satisfied' | 'partial' | 'drifted' | 'violated' | 'unknown';

export type ContractEvaluation = 'satisfied' | 'violated' | 'unknown' | 'partial';

export type ReviewStageId =
  | 'scope'
  | 'architecture'
  | 'security'
  | 'data'
  | 'availability'
  | 'ownership'
  | 'evidence'
  | 'compliance'
  | 'recommendations'
  | 'approval';

export type ReviewStageOutcome = 'PASS' | 'WARNING' | 'FAIL' | 'UNKNOWN' | 'SKIPPED';

export type ArchitectPersona =
  | 'enterprise'
  | 'platform'
  | 'security'
  | 'data'
  | 'operations'
  | 'finops';

export type ReviewOutcome =
  | 'Approved'
  | 'Rejected'
  | 'Approved with Waiver'
  | 'Not Ready'
  | 'Changes Required'
  | 'In Progress';

export type LifecycleState =
  | 'active'
  | 'planned'
  | 'deprecated'
  | 'deleted'
  | 'unknown';

export type SensitivityClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'unknown';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type FindingStatus =
  | 'open'
  | 'waived'
  | 'resolved'
  | 'accepted'
  | 'suppressed';

export type DriftCategory =
  | 'declared-not-planned'
  | 'planned-not-observed'
  | 'observed-not-declared'
  | 'attribute-drift'
  | 'topology-drift'
  | 'policy-drift'
  | 'ownership-drift'
  | 'version-drift'
  | 'network-drift'
  | 'identity-drift'
  | 'deleted-historical'
  | 'renamed'
  | 'unresolved-match';

export type SignOffState =
  | 'Draft'
  | 'Ready for Review'
  | 'Review in Progress'
  | 'Changes Required'
  | 'Approved'
  | 'Approved with Waivers'
  | 'Rejected'
  | 'Expired'
  | 'Invalidated by Change';

export type ArchitectureView =
  | 'executive'
  | 'architecture'
  | 'application'
  | 'platform'
  | 'network'
  | 'data'
  | 'security'
  | 'evidence'
  | 'drift'
  | 'signoff'
  | 'physical'
  | 'capability'
  | 'ownership'
  | 'risk'
  | 'cost'
  | 'time'
  | 'dna'
  | 'decision'
  | 'governance';
