import type { ArchitectPersona, ReviewStageId } from '@infralens/graph-model';
import { getPlaybook, type ReviewPlaybookDef } from './playbooks.js';

export interface PersonaLens {
  id: ArchitectPersona;
  label: string;
  focus: string;
  defaultPlaybookId: string;
  stageOrder: ReviewStageId[];
  metricEmphasis: string[];
  commercialPack: boolean;
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
    commercialPack: false,
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
    commercialPack: true,
  },
  {
    id: 'security',
    label: 'Security Architect',
    focus: 'Trust boundaries, exposure, identity, encryption',
    defaultPlaybookId: 'pci',
    stageOrder: ['scope', 'security', 'data', 'compliance', 'evidence', 'recommendations', 'approval'],
    metricEmphasis: ['security', 'exposure', 'trust zones'],
    commercialPack: true,
  },
  {
    id: 'data',
    label: 'Data Architect',
    focus: 'Lineage, ownership, classification, residency',
    defaultPlaybookId: 'architecture-board',
    stageOrder: ['scope', 'data', 'ownership', 'security', 'evidence', 'recommendations', 'approval'],
    metricEmphasis: ['data assets', 'classification', 'egress'],
    commercialPack: true,
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
    commercialPack: true,
  },
  {
    id: 'finops',
    label: 'FinOps Reviewer',
    focus: 'Cost concentration, waste, optimisation opportunities',
    defaultPlaybookId: 'aws',
    stageOrder: ['scope', 'architecture', 'data', 'recommendations', 'approval'],
    metricEmphasis: ['cost', 'duplicate capability', 'concentration'],
    commercialPack: true,
  },
];

export function getPersona(id: ArchitectPersona): PersonaLens {
  return PERSONA_LENSES.find((p) => p.id === id) ?? PERSONA_LENSES[0]!;
}

export function listPersonas(opts?: { commercial?: boolean }): PersonaLens[] {
  if (opts?.commercial === false) return PERSONA_LENSES.filter((p) => !p.commercialPack);
  return PERSONA_LENSES;
}

export function playbookForPersona(persona: ArchitectPersona): ReviewPlaybookDef {
  const lens = getPersona(persona);
  return getPlaybook(lens.defaultPlaybookId);
}
