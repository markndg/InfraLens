import type { ArchitectPersona, ReviewStageId } from '@infralens/graph-model';
import { getPlaybook, type ReviewPlaybookDef } from './playbooks.js';

export interface PersonaLens {
  id: ArchitectPersona;
  label: string;
  focus: string;
  defaultPlaybookId: string;
  stageOrder: ReviewStageId[];
  metricEmphasis: string[];
}

export const PERSONA_LENSES: PersonaLens[] = [
  {
    id: 'enterprise',
    label: 'Enterprise Architect',
    focus: 'Capabilities, dependencies, strategic alignment',
    defaultPlaybookId: 'architecture-board',
    stageOrder: [
      'scope',
      'architecture',
      'data',
      'ownership',
      'security',
      'availability',
      'evidence',
      'compliance',
      'recommendations',
      'approval',
    ],
    metricEmphasis: ['capabilities', 'coupling', 'business risk'],
  },
  {
    id: 'platform',
    label: 'Platform Architect',
    focus: 'Kubernetes, cloud, deployment topology, scalability',
    defaultPlaybookId: 'openshift',
    stageOrder: [
      'scope',
      'architecture',
      'availability',
      'security',
      'evidence',
      'recommendations',
      'approval',
    ],
    metricEmphasis: ['deployment', 'scalability', 'resilience'],
  },
  {
    id: 'security',
    label: 'Security Architect',
    focus: 'Trust boundaries, exposure, identity, encryption',
    defaultPlaybookId: 'pci',
    stageOrder: ['scope', 'security', 'data', 'compliance', 'evidence', 'recommendations', 'approval'],
    metricEmphasis: ['security', 'exposure', 'trust zones'],
  },
  {
    id: 'data',
    label: 'Data Architect',
    focus: 'Lineage, ownership, classification, residency',
    defaultPlaybookId: 'architecture-board',
    stageOrder: ['scope', 'data', 'ownership', 'security', 'evidence', 'recommendations', 'approval'],
    metricEmphasis: ['data assets', 'classification', 'egress'],
  },
  {
    id: 'operations',
    label: 'Operations Architect',
    focus: 'Resilience, observability, recovery, operability',
    defaultPlaybookId: 'production-readiness',
    stageOrder: [
      'scope',
      'availability',
      'architecture',
      'ownership',
      'evidence',
      'recommendations',
      'approval',
    ],
    metricEmphasis: ['availability', 'resilience', 'operational risk'],
  },
  {
    id: 'finops',
    label: 'FinOps Reviewer',
    focus: 'Cost concentration, waste, optimisation opportunities',
    defaultPlaybookId: 'aws',
    stageOrder: ['scope', 'architecture', 'data', 'recommendations', 'approval'],
    metricEmphasis: ['cost', 'duplicate capability', 'concentration'],
  },
];

export function getPersona(id: ArchitectPersona): PersonaLens {
  return PERSONA_LENSES.find((p) => p.id === id) ?? PERSONA_LENSES[0]!;
}

/** @param _opts Kept for API compatibility; commercial filtering is removed. */
export function listPersonas(_opts?: { commercial?: boolean }): PersonaLens[] {
  return PERSONA_LENSES;
}

export function playbookForPersona(persona: ArchitectPersona): ReviewPlaybookDef {
  const lens = getPersona(persona);
  return getPlaybook(lens.defaultPlaybookId);
}
