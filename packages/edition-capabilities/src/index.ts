export type InfraLensEdition = 'oss' | 'commercial';

export type InfraLensCapability =
  | 'repositoryScan'
  | 'terraformEvaluation'
  | 'renderedManifestAnalysis'
  | 'localEvidenceGraph'
  | 'basicPolicyEngine'
  | 'staticReportExport'
  | 'liveCloudReconciliation'
  | 'liveClusterReconciliation'
  | 'effectiveNetworkAnalysis'
  | 'iamAnalysis'
  | 'historicalDrift'
  | 'organisationPolicyPacks'
  | 'waiverWorkflow'
  | 'architectSignOff'
  | 'multiProjectEstate'
  | 'ciEnforcement'
  | 'teamCollaboration'
  | 'counterfactualSimulation'
  | 'architectureNarrative'
  | 'blastRadiusAnalysis'
  | 'capabilityInference'
  | 'architectureProjections'
  | 'missionMode'
  | 'architectureDNA'
  | 'temporalTimeline'
  | 'architectureReview'
  | 'reviewPlaybooks'
  | 'collaborativeReviews'
  | 'historicalReviews'
  | 'architectPersonas'
  | 'reviewAnalytics'
  | 'architectureGovernance'
  | 'adrIntegration'
  | 'intentValidation'
  | 'assumptionEngine'
  | 'contractEngine'
  | 'decisionGraph'
  | 'reviewReplay'
  | 'portfolioGovernance'
  | 'governanceAnalytics'
  | 'organisationalGraph';

export type CapabilityAvailability = 'enabled' | 'disabled' | 'edition-gated';

export interface CapabilityDefinition {
  id: InfraLensCapability;
  edition: InfraLensEdition | 'both';
  availability: CapabilityAvailability;
  label: string;
  description: string;
  dependencies: InfraLensCapability[];
  uiExposure: boolean;
  serverEnforcement: boolean;
  scannerEnforcement: boolean;
  apiEnforcement: boolean;
  auditBehaviour: 'none' | 'log' | 'require';
}

export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = [
  {
    id: 'repositoryScan',
    edition: 'both',
    availability: 'enabled',
    label: 'Repository scan',
    description: 'Scan local repositories and imported file trees.',
    dependencies: [],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'terraformEvaluation',
    edition: 'both',
    availability: 'enabled',
    label: 'Terraform evaluation',
    description: 'Parse Terraform HCL/JSON and optional plan/state snapshots.',
    dependencies: ['repositoryScan'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: false,
    auditBehaviour: 'log',
  },
  {
    id: 'renderedManifestAnalysis',
    edition: 'both',
    availability: 'enabled',
    label: 'Rendered manifest analysis',
    description: 'Analyse Kubernetes/OpenShift YAML and rendered Helm/Kustomize output.',
    dependencies: ['repositoryScan'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: false,
    auditBehaviour: 'log',
  },
  {
    id: 'localEvidenceGraph',
    edition: 'both',
    availability: 'enabled',
    label: 'Local evidence graph',
    description: 'Build a normalized evidence-backed infrastructure graph.',
    dependencies: ['repositoryScan'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'basicPolicyEngine',
    edition: 'both',
    availability: 'enabled',
    label: 'Basic policy engine',
    description: 'Evaluate declarative architecture policies against the graph.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'staticReportExport',
    edition: 'both',
    availability: 'enabled',
    label: 'Static report export',
    description: 'Generate HTML/JSON architecture reports from scan bundles.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureNarrative',
    edition: 'both',
    availability: 'enabled',
    label: 'Architecture narrative',
    description: 'Deterministic evidence-backed estate explanation.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'blastRadiusAnalysis',
    edition: 'both',
    availability: 'enabled',
    label: 'Blast radius analysis',
    description: 'Calculate direct and transitive impact of component failure.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'liveCloudReconciliation',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Live cloud reconciliation',
    description: 'Reconcile declared resources with read-only AWS/Azure/GCP inventory.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'liveClusterReconciliation',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Live cluster reconciliation',
    description: 'Reconcile with read-only Kubernetes/OpenShift inventory.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'effectiveNetworkAnalysis',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Effective network analysis',
    description: 'Compute effective reachability across security groups and NetworkPolicy.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'iamAnalysis',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'IAM analysis',
    description: 'Analyse IAM authorisation relationships between identities and resources.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'historicalDrift',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Historical drift',
    description: 'Compare scan bundles over time and detect material change.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'organisationPolicyPacks',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Organisation policy packs',
    description: 'Load organisation-specific declarative policy packs.',
    dependencies: ['basicPolicyEngine'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'waiverWorkflow',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Waiver workflow',
    description: 'Create time-bounded waivers with approver and compensating control.',
    dependencies: ['basicPolicyEngine'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'architectSignOff',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Architect sign-off',
    description: 'Evidence-bound architecture approval workflow with invalidation.',
    dependencies: ['basicPolicyEngine', 'localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'multiProjectEstate',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Multi-project estate',
    description: 'Aggregate multiple projects into estate-level views.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'ciEnforcement',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'CI enforcement',
    description: 'Fail CI pipelines on blocking policy findings.',
    dependencies: ['basicPolicyEngine'],
    uiExposure: false,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'teamCollaboration',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Team collaboration',
    description: 'Comments, review assignment and shared sign-off state.',
    dependencies: ['architectSignOff'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'counterfactualSimulation',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Counterfactual simulation',
    description: 'Safe graph-only simulation of architecture changes.',
    dependencies: ['localEvidenceGraph', 'basicPolicyEngine'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'capabilityInference',
    edition: 'both',
    availability: 'enabled',
    label: 'Capability inference',
    description: 'Deterministic inference of business capabilities from evidence.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureProjections',
    edition: 'both',
    availability: 'enabled',
    label: 'Architecture projections',
    description: 'Derive physical, application, capability, data and ownership projections from one graph.',
    dependencies: ['localEvidenceGraph', 'capabilityInference'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'missionMode',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Mission mode',
    description: 'Guided architectural investigations over the evidence graph.',
    dependencies: ['architectureProjections', 'blastRadiusAnalysis'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureDNA',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Architecture DNA',
    description: 'Semantic architectural fingerprint for estate comparison.',
    dependencies: ['capabilityInference'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'temporalTimeline',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Temporal timeline',
    description: 'Slide through historical scan bundles as one evolving architecture.',
    dependencies: ['historicalDrift', 'architectureProjections'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureReview',
    edition: 'both',
    availability: 'enabled',
    label: 'Architecture review engine',
    description: 'Deterministic step-by-step architecture review with notebook and recommendations.',
    dependencies: ['localEvidenceGraph', 'capabilityInference', 'basicPolicyEngine'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectPersonas',
    edition: 'both',
    availability: 'enabled',
    label: 'Architect personas',
    description: 'Deterministic review lenses (enterprise core in OSS; full packs in commercial).',
    dependencies: ['architectureReview'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'reviewPlaybooks',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Review playbooks',
    description: 'Saved review templates (PCI, SOC2, production readiness, DR, release).',
    dependencies: ['architectureReview'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'collaborativeReviews',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Collaborative reviews',
    description: 'Multi-reviewer comments, assignments and decision audit.',
    dependencies: ['architectureReview', 'teamCollaboration'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'historicalReviews',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Historical reviews',
    description: 'Persist and compare architecture reviews over time.',
    dependencies: ['architectureReview', 'historicalDrift'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'reviewAnalytics',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Review analytics',
    description: 'Pass rates, risk evolution and reviewer metrics.',
    dependencies: ['historicalReviews'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureGovernance',
    edition: 'both',
    availability: 'enabled',
    label: 'Architecture governance',
    description: 'Intent, decisions, assumptions, contracts and governance dashboard for a single project.',
    dependencies: ['architectureReview', 'capabilityInference'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'adrIntegration',
    edition: 'both',
    availability: 'enabled',
    label: 'ADR integration',
    description: 'Parse ADRs and evaluate whether decisions remain satisfied.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'intentValidation',
    edition: 'both',
    availability: 'enabled',
    label: 'Intent validation',
    description: 'Continuously measure declared architecture intent against observed reality.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'assumptionEngine',
    edition: 'both',
    availability: 'enabled',
    label: 'Assumption engine',
    description: 'Infer, represent and evaluate architectural assumptions.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'contractEngine',
    edition: 'both',
    availability: 'enabled',
    label: 'Contract engine',
    description: 'Evaluate architecture contracts and obligations against the evidence graph.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: true,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'decisionGraph',
    edition: 'both',
    availability: 'enabled',
    label: 'Decision graph',
    description: 'Project decisions, intents, implementations, evidence and reviews.',
    dependencies: ['architectureGovernance', 'architectureProjections'],
    uiExposure: true,
    serverEnforcement: false,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'none',
  },
  {
    id: 'reviewReplay',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Review replay',
    description: 'Replay historical reviews using only contemporaneous evidence.',
    dependencies: ['historicalReviews', 'architectureGovernance'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'portfolioGovernance',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Portfolio governance',
    description: 'Govern multiple repositories, environments and shared capabilities.',
    dependencies: ['architectureGovernance', 'multiProjectEstate'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'require',
  },
  {
    id: 'governanceAnalytics',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Governance analytics',
    description: 'Executive governance metrics across the organisation.',
    dependencies: ['portfolioGovernance'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
  {
    id: 'organisationalGraph',
    edition: 'commercial',
    availability: 'edition-gated',
    label: 'Organisational graph',
    description: 'Teams, products, systems, business units and cross-system dependencies.',
    dependencies: ['portfolioGovernance'],
    uiExposure: true,
    serverEnforcement: true,
    scannerEnforcement: false,
    apiEnforcement: true,
    auditBehaviour: 'log',
  },
] as const;

const FEATURE_ENV_PREFIX = 'INFRALENS_FEATURE_';

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc?.env && proc.env[name] != null) return proc.env[name];
  try {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
      return env?.[name] ?? env?.[`VITE_${name}`];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function envFlag(name: string): boolean | undefined {
  const raw = readEnv(name);
  if (raw === undefined) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function resolveEdition(override?: InfraLensEdition): InfraLensEdition {
  const fromEnv = (readEnv('INFRALENS_EDITION') || '').toLowerCase();
  if (override) return override;
  if (fromEnv === 'commercial') return 'commercial';
  return 'oss';
}

export function isCapabilityEnabled(
  capability: InfraLensCapability,
  edition: InfraLensEdition = resolveEdition(),
): boolean {
  const def = CAPABILITY_REGISTRY.find((c) => c.id === capability);
  if (!def) return false;

  const envKey = `${FEATURE_ENV_PREFIX}${capability
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()}`;
  const override = envFlag(envKey);
  if (override !== undefined) return override;

  if (def.availability === 'disabled') return false;
  if (def.edition === 'both') return true;
  if (def.edition === edition) return true;
  return false;
}

export function listCapabilities(edition: InfraLensEdition = resolveEdition()) {
  return CAPABILITY_REGISTRY.map((def) => ({
    ...def,
    enabled: isCapabilityEnabled(def.id, edition),
  }));
}

export class CapabilityDeniedError extends Error {
  readonly capability: InfraLensCapability;
  readonly edition: InfraLensEdition;

  constructor(capability: InfraLensCapability, edition: InfraLensEdition) {
    super(`Capability "${capability}" is not enabled for edition "${edition}".`);
    this.name = 'CapabilityDeniedError';
    this.capability = capability;
    this.edition = edition;
  }
}

export function assertCapability(
  capability: InfraLensCapability,
  edition: InfraLensEdition = resolveEdition(),
  layer: 'server' | 'scanner' | 'api' | 'ui' = 'api',
): void {
  const def = CAPABILITY_REGISTRY.find((c) => c.id === capability);
  if (!def) throw new CapabilityDeniedError(capability, edition);
  const enforce =
    (layer === 'server' && def.serverEnforcement) ||
    (layer === 'scanner' && def.scannerEnforcement) ||
    (layer === 'api' && def.apiEnforcement) ||
    layer === 'ui';
  if (enforce && !isCapabilityEnabled(capability, edition)) {
    throw new CapabilityDeniedError(capability, edition);
  }
}

export function capabilityMatrix() {
  return CAPABILITY_REGISTRY.map((c) => ({
    id: c.id,
    label: c.label,
    oss: isCapabilityEnabled(c.id, 'oss'),
    commercial: isCapabilityEnabled(c.id, 'commercial'),
    description: c.description,
  }));
}
