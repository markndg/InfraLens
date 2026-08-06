import yaml from 'js-yaml';
import type { InfraLensEdition } from '@infralens/edition-capabilities';
import {
  stableId,
  type EvidenceGraph,
  type Finding,
  type FindingSeverity,
  type ResourceNode,
  type SignOff,
  type Waiver,
} from '@infralens/graph-model';

export interface PolicyCondition {
  field?: string;
  equals?: unknown;
  notEquals?: unknown;
  lessThan?: number;
  greaterThan?: number;
  matches?: string;
  exists?: boolean;
  any?: PolicyCondition[];
  all?: PolicyCondition[];
}

export interface ArchitecturePolicy {
  id: string;
  title: string;
  scope?: {
    environment?: string | string[];
    kinds?: string[];
    providers?: string[];
  };
  condition: PolicyCondition;
  severity: FindingSeverity;
  rationale: string;
  remediation: string;
  impact?: string;
  signoff?: { blocksApproval?: boolean };
}

export function parsePolicyYaml(content: string): ArchitecturePolicy {
  const doc = yaml.load(content) as ArchitecturePolicy;
  if (!doc?.id || !doc.title || !doc.condition) throw new Error('Invalid policy document');
  return doc;
}

export function evaluatePolicies(
  graph: EvidenceGraph,
  policies: ArchitecturePolicy[],
  now = new Date().toISOString(),
): Finding[] {
  const findings: Finding[] = [];
  for (const policy of policies) {
    for (const resource of graph.resources) {
      if (!inScope(resource, policy)) continue;
      if (!matchesCondition(resource, policy.condition)) continue;
      const id = stableId('finding', policy.id, resource.id);
      findings.push({
        id,
        policyId: policy.id,
        severity: policy.severity,
        title: policy.title,
        rationale: policy.rationale,
        impact: policy.impact ?? policy.rationale,
        remediation: policy.remediation,
        affectedResources: [resource.id],
        evidence: resource.evidence,
        owner: resource.ownership?.[0]?.owner,
        status: 'open',
        firstSeen: now,
        lastSeen: now,
        blocksSignOff: !!policy.signoff?.blocksApproval || policy.severity === 'critical',
      });
    }
  }
  return findings;
}

function inScope(resource: ResourceNode, policy: ArchitecturePolicy): boolean {
  const scope = policy.scope;
  if (!scope) return true;
  if (scope.environment) {
    const envs = Array.isArray(scope.environment) ? scope.environment : [scope.environment];
    if (!envs.includes(resource.environment ?? '')) return false;
  }
  if (scope.kinds?.length && !scope.kinds.includes(resource.kind) && !scope.kinds.includes(String(resource.subtype))) {
    return false;
  }
  if (scope.providers?.length && !scope.providers.includes(resource.provider ?? '')) return false;
  return true;
}

function matchesCondition(resource: ResourceNode, condition: PolicyCondition): boolean {
  if (condition.any) return condition.any.some((c) => matchesCondition(resource, c));
  if (condition.all) return condition.all.every((c) => matchesCondition(resource, c));
  if (!condition.field) return false;
  const value = getField(resource, condition.field);
  if (condition.exists != null) return condition.exists ? value !== undefined && value !== null : value === undefined || value === null;
  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.notEquals !== undefined) return value !== condition.notEquals;
  if (condition.lessThan !== undefined) return typeof value === 'number' && value < condition.lessThan;
  if (condition.greaterThan !== undefined) return typeof value === 'number' && value > condition.greaterThan;
  if (condition.matches) {
    return typeof value === 'string' && new RegExp(condition.matches).test(value);
  }
  return false;
}

function getField(resource: ResourceNode, field: string): unknown {
  if (field.startsWith('metadata.')) {
    const path = field.slice('metadata.'.length).split('.');
    let cur: unknown = resource.metadata;
    for (const part of path) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    if (Array.isArray(cur)) return cur.map(String).join(',');
    return cur;
  }
  if (field === 'ownership') return resource.ownership;
  if (field === 'kind') return resource.kind;
  if (field === 'tags') return resource.tags.join(',');
  return (resource as unknown as Record<string, unknown>)[field];
}

export const DEFAULT_POLICIES: ArchitecturePolicy[] = [
  {
    id: 'PROD-DATA-004',
    title: 'Production relational databases must be resilient',
    scope: { environment: 'production', kinds: ['relational-database'] },
    condition: {
      any: [
        { field: 'metadata.multiAz', equals: false },
        { field: 'metadata.multi_az', equals: false },
        { field: 'metadata.replicaCount', lessThan: 2 },
      ],
    },
    severity: 'high',
    rationale: 'Production relational data stores must tolerate an availability-zone failure.',
    remediation: 'Enable multi-AZ or provide documented equivalent resilience.',
    impact: 'AZ failure may cause complete database outage.',
    signoff: { blocksApproval: true },
  },
  {
    id: 'SEC-EXPOSE-001',
    title: 'Public ingress must be intentional',
    scope: { kinds: ['route', 'ingress'] },
    condition: { field: 'kind', matches: 'route|ingress' },
    severity: 'info',
    rationale: 'Public entry points require architecture review of downstream trust boundaries.',
    remediation: 'Trace ingress to workloads and confirm exposure is required.',
    signoff: { blocksApproval: false },
  },
  {
    id: 'SEC-IMAGE-002',
    title: 'Workloads must not use mutable latest tags',
    scope: { kinds: ['workload'] },
    condition: { field: 'metadata.images', matches: '.*:latest' },
    severity: 'medium',
    rationale: 'Mutable image tags undermine reproducible deployments.',
    remediation: 'Pin images to digest or immutable version tags.',
  },
  {
    id: 'REL-REPLICA-003',
    title: 'Production workloads should run multiple replicas',
    scope: { environment: 'production', kinds: ['workload'] },
    condition: {
      any: [
        { field: 'metadata.replicas', equals: 1 },
        { field: 'metadata.replicas', equals: '1' },
      ],
    },
    severity: 'medium',
    rationale: 'Single-replica production workloads are single points of failure.',
    remediation: 'Increase replicas or document accepted risk with a waiver.',
  },
  {
    id: 'SEC-OWN-005',
    title: 'External dependencies must have ownership',
    scope: { kinds: ['external-system'] },
    condition: { field: 'ownership', exists: false },
    severity: 'low',
    rationale: 'Unowned external dependencies create operational and security ambiguity.',
    remediation: 'Assign an owning team and document the dependency contract.',
  },
  {
    id: 'SEC-EGRESS-006',
    title: 'Catalog-like workloads should not have unrestricted egress',
    scope: { kinds: ['workload'] },
    condition: { field: 'metadata.env.PAYMENT_URL', exists: true },
    severity: 'medium',
    rationale: 'Workloads with broad external egress increase exfiltration risk.',
    remediation: 'Restrict egress with NetworkPolicy and explicit allow-lists.',
  },
  {
    id: 'DATA-ENCRYPT-007',
    title: 'Relational databases should enable storage encryption',
    scope: { kinds: ['relational-database'] },
    condition: {
      any: [
        { field: 'metadata.storage_encrypted', equals: false },
        { field: 'metadata.storageEncrypted', equals: false },
      ],
    },
    severity: 'high',
    rationale: 'Database storage encryption protects data at rest.',
    remediation: 'Enable storage encryption.',
    signoff: { blocksApproval: true },
  },
  {
    id: 'OWN-UNKNOWN-008',
    title: 'Resources should not remain ownership-unknown in production',
    scope: { environment: 'production' },
    condition: { field: 'ownership', exists: false },
    severity: 'info',
    rationale: 'Production resources without ownership hinder incident response.',
    remediation: 'Attach ownership metadata or catalogue annotations.',
  },
  {
    id: 'DRIFT-UNRESOLVED-009',
    title: 'Critical drift must be resolved',
    scope: {},
    condition: { field: 'tags', matches: 'never-match-directly' },
    severity: 'critical',
    rationale: 'Placeholder — drift findings are emitted by reconciliation.',
    remediation: 'Resolve drift.',
  },
  {
    id: 'NET-SG-010',
    title: 'Overly broad security group ingress is prohibited',
    scope: { kinds: ['security-group'] },
    condition: {
      any: [
        { field: 'metadata.cidrIngress', matches: '0\\.0\\.0\\.0/0' },
        { field: 'metadata.allowsWorld', equals: true },
      ],
    },
    severity: 'critical',
    rationale: 'Security groups must not permit unrestricted world ingress unless explicitly approved.',
    remediation: 'Restrict CIDR ranges to required sources.',
    signoff: { blocksApproval: true },
  },
];

export function applyWaivers(graph: EvidenceGraph, now = new Date().toISOString()): void {
  for (const waiver of graph.waivers) {
    if (new Date(waiver.expiresAt).getTime() < new Date(now).getTime()) {
      waiver.status = 'expired';
    }
    const finding = graph.findings.find((f) => f.id === waiver.findingId);
    if (!finding) continue;
    if (waiver.status === 'active') {
      finding.status = 'waived';
      finding.waiverId = waiver.id;
      finding.blocksSignOff = false;
    } else if (waiver.status === 'expired') {
      finding.status = 'open';
      finding.waiverId = undefined;
      finding.blocksSignOff = finding.severity === 'critical' || finding.severity === 'high';
    }
  }
}

export function evaluateSignOffGate(
  graph: EvidenceGraph,
  _edition?: InfraLensEdition,
): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const openBlocking = graph.findings.filter(
    (f) => f.blocksSignOff && f.status === 'open',
  );
  for (const f of openBlocking) {
    blockers.push(`${f.severity.toUpperCase()}: ${f.title}`);
  }
  if (graph.completeness.overall < 0.4) {
    blockers.push('Required evidence completeness below threshold');
  }
  const criticalDrift = graph.drifts.filter((d) => d.severity === 'critical');
  if (criticalDrift.length) blockers.push(`${criticalDrift.length} critical drift records`);
  const expiredWaivers = graph.waivers.filter((w) => w.status === 'expired');
  if (expiredWaivers.length) blockers.push(`${expiredWaivers.length} expired waivers`);
  return { allowed: blockers.length === 0, blockers };
}

export function createSignOff(
  graph: EvidenceGraph,
  input: {
    reviewer: string;
    environment: string;
    scope: string;
    decision: SignOff['decision'];
    comments?: string[];
    expiry?: string;
  },
): SignOff {
  const gate = evaluateSignOffGate(graph, graph.scan.edition);
  let decision = input.decision;
  if ((decision === 'Approved' || decision === 'Approved with Waivers') && !gate.allowed) {
    decision = 'Changes Required';
  }
  const summary = {
    critical: graph.findings.filter((f) => f.severity === 'critical').length,
    high: graph.findings.filter((f) => f.severity === 'high').length,
    medium: graph.findings.filter((f) => f.severity === 'medium').length,
    low: graph.findings.filter((f) => f.severity === 'low').length,
    info: graph.findings.filter((f) => f.severity === 'info').length,
    openBlocking: graph.findings.filter((f) => f.blocksSignOff && f.status === 'open').length,
  };
  return {
    id: stableId('signoff', graph.scan.id, input.reviewer, input.decision),
    scanBundleId: graph.scan.id,
    project: graph.scan.project,
    repositoryRevision: graph.scan.repositoryRevision,
    planStateHashes: [],
    liveInventoryTimestamps: graph.evidence
      .filter((e) => e.observedAt)
      .map((e) => e.observedAt!)
      .slice(0, 10),
    environment: input.environment,
    scope: input.scope,
    reviewer: input.reviewer,
    findingsSummary: summary,
    unresolvedUnknowns: graph.unsupported.map((u) => u.construct).slice(0, 50),
    acceptedWaivers: graph.waivers.filter((w) => w.status === 'active').map((w) => w.id),
    comments: [
      ...(input.comments ?? []),
      ...(gate.allowed ? [] : [`Blocked: ${gate.blockers.join('; ')}`]),
    ],
    decision,
    timestamp: new Date().toISOString(),
    expiry: input.expiry,
    materialChangeRules: [
      'new public ingress',
      'encryption regression',
      'multi-az regression',
      'critical/high policy regression',
    ],
    evidenceHashes: [graph.scan.contentHash],
  };
}

export function createWaiver(input: Omit<Waiver, 'id' | 'status'> & { id?: string }): Waiver {
  return {
    id: input.id ?? stableId('waiver', input.findingId, input.approver),
    findingId: input.findingId,
    policyId: input.policyId,
    affectedResources: input.affectedResources,
    owner: input.owner,
    reason: input.reason,
    approver: input.approver,
    compensatingControl: input.compensatingControl,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    reviewDate: input.reviewDate,
    linkedDecision: input.linkedDecision,
    status: new Date(input.expiresAt).getTime() < Date.now() ? 'expired' : 'active',
  };
}
