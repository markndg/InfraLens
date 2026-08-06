import type { ArchitectPersona, ReviewStageId } from '@infralens/graph-model';

export interface ReviewPlaybookDef {
  id: string;
  name: string;
  description: string;
  stages: ReviewStageId[];
  persona: ArchitectPersona;
  blockingPolicyHints: string[];
}

export const REVIEW_PLAYBOOKS: ReviewPlaybookDef[] = [
  {
    id: 'architecture-board',
    name: 'Architecture Board',
    description: 'Full board review across scope, architecture, security, data, availability, ownership, evidence, compliance and approval.',
    persona: 'enterprise',
    stages: [
      'scope',
      'architecture',
      'security',
      'data',
      'availability',
      'ownership',
      'evidence',
      'compliance',
      'recommendations',
      'approval',
    ],
    blockingPolicyHints: ['public-ingress', 'multi-az', 'sign-off'],
  },
  {
    id: 'production-readiness',
    name: 'Production Readiness',
    description: 'Ops-focused readiness for production release.',
    persona: 'operations',
    stages: ['scope', 'availability', 'security', 'ownership', 'evidence', 'recommendations', 'approval'],
    blockingPolicyHints: ['multi-az', 'replicas', 'observability'],
  },
  {
    id: 'pci',
    name: 'PCI',
    description: 'Payment and trust-boundary focused review.',
    persona: 'security',
    stages: ['scope', 'security', 'data', 'compliance', 'recommendations', 'approval'],
    blockingPolicyHints: ['payment', 'external', 'encryption'],
  },
  {
    id: 'soc2',
    name: 'SOC2',
    description: 'Evidence, ownership and control-oriented review.',
    persona: 'security',
    stages: ['scope', 'ownership', 'security', 'evidence', 'compliance', 'approval'],
    blockingPolicyHints: ['ownership', 'audit'],
  },
  {
    id: 'openshift',
    name: 'OpenShift',
    description: 'Platform topology, routes and workload readiness.',
    persona: 'platform',
    stages: ['scope', 'architecture', 'security', 'availability', 'evidence', 'approval'],
    blockingPolicyHints: ['route', 'network-policy'],
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Cloud topology, data stores and cost concentration.',
    persona: 'platform',
    stages: ['scope', 'architecture', 'data', 'availability', 'recommendations', 'approval'],
    blockingPolicyHints: ['multi-az', 'bucket'],
  },
  {
    id: 'disaster-recovery',
    name: 'Disaster Recovery',
    description: 'Resilience and recovery path review.',
    persona: 'operations',
    stages: ['scope', 'availability', 'data', 'recommendations', 'approval'],
    blockingPolicyHints: ['multi-az', 'backup'],
  },
  {
    id: 'enterprise-release',
    name: 'Enterprise Release',
    description: 'Release gate with security, compliance and approval.',
    persona: 'enterprise',
    stages: [
      'scope',
      'architecture',
      'security',
      'data',
      'availability',
      'compliance',
      'recommendations',
      'approval',
    ],
    blockingPolicyHints: ['sign-off', 'public-ingress'],
  },
];

/** @param _opts Kept for API compatibility; commercial filtering is removed. */
export function listPlaybooks(_opts?: { commercial?: boolean }): ReviewPlaybookDef[] {
  return REVIEW_PLAYBOOKS;
}

export function getPlaybook(id: string): ReviewPlaybookDef {
  return REVIEW_PLAYBOOKS.find((p) => p.id === id) ?? REVIEW_PLAYBOOKS[0]!;
}
