/**
 * InfraLens capability registry.
 *
 * Product edition (OSS vs commercial) is obsolete. All capabilities that exist
 * in the codebase are available in the full product; availability describes
 * runtime readiness (credentials, external tools, experimental status), not
 * licensing. Use INFRALENS_FEATURE_* env vars as operational kill switches.
 */

/** @deprecated Product editions are obsolete. Kept only for parsing legacy labels. */
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

/**
 * Runtime readiness of a capability in this build.
 * - available: ready to use
 * - experimental: present but not yet stable
 * - unavailable-in-build: compiled out / not shipped
 * - requires-external-tool: needs a tool outside InfraLens
 * - requires-credentials: needs credentials or an inventory snapshot
 */
export type CapabilityAvailability =
  | 'available'
  | 'experimental'
  | 'unavailable-in-build'
  | 'requires-external-tool'
  | 'requires-credentials';

export interface CapabilityDefinition {
  id: InfraLensCapability;
  availability: CapabilityAvailability;
  label: string;
  description: string;
  dependencies: InfraLensCapability[];
  uiExposure: boolean;
  notes?: string;
  /** @deprecated Optional audit hint; prefer product-level audit config. */
  auditBehaviour?: 'none' | 'log';
}

const AVAILABLE = 'available' as const;

export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = [
  {
    id: 'repositoryScan',
    availability: AVAILABLE,
    label: 'Repository scan',
    description: 'Scan local repositories and imported file trees.',
    dependencies: [],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'terraformEvaluation',
    availability: AVAILABLE,
    label: 'Terraform evaluation',
    description: 'Parse Terraform HCL/JSON and optional plan/state snapshots.',
    dependencies: ['repositoryScan'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'renderedManifestAnalysis',
    availability: AVAILABLE,
    label: 'Rendered manifest analysis',
    description: 'Analyse Kubernetes/OpenShift YAML and rendered Helm/Kustomize output.',
    dependencies: ['repositoryScan'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'localEvidenceGraph',
    availability: AVAILABLE,
    label: 'Local evidence graph',
    description: 'Build a normalized evidence-backed infrastructure graph.',
    dependencies: ['repositoryScan'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'basicPolicyEngine',
    availability: AVAILABLE,
    label: 'Basic policy engine',
    description: 'Evaluate declarative architecture policies against the graph.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'staticReportExport',
    availability: AVAILABLE,
    label: 'Static report export',
    description: 'Generate HTML/JSON architecture reports from scan bundles.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureNarrative',
    availability: AVAILABLE,
    label: 'Architecture narrative',
    description: 'Deterministic evidence-backed estate explanation.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'blastRadiusAnalysis',
    availability: AVAILABLE,
    label: 'Blast radius analysis',
    description: 'Calculate direct and transitive impact of component failure.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'liveCloudReconciliation',
    availability: 'requires-credentials',
    label: 'Live cloud reconciliation',
    description: 'Reconcile declared resources with read-only AWS/Azure/GCP inventory.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    notes: 'AWS credentials or inventory snapshot',
    auditBehaviour: 'log',
  },
  {
    id: 'liveClusterReconciliation',
    availability: 'requires-credentials',
    label: 'Live cluster reconciliation',
    description: 'Reconcile with read-only Kubernetes/OpenShift inventory.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    notes: 'Cluster credentials or inventory snapshot',
    auditBehaviour: 'log',
  },
  {
    id: 'effectiveNetworkAnalysis',
    availability: AVAILABLE,
    label: 'Effective network analysis',
    description: 'Compute effective reachability across security groups and NetworkPolicy.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'iamAnalysis',
    availability: AVAILABLE,
    label: 'IAM analysis',
    description: 'Analyse IAM authorisation relationships between identities and resources.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'historicalDrift',
    availability: AVAILABLE,
    label: 'Historical drift',
    description: 'Compare scan bundles over time and detect material change.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'organisationPolicyPacks',
    availability: AVAILABLE,
    label: 'Organisation policy packs',
    description: 'Load organisation-specific declarative policy packs.',
    dependencies: ['basicPolicyEngine'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'waiverWorkflow',
    availability: AVAILABLE,
    label: 'Waiver workflow',
    description: 'Create time-bounded waivers with approver and compensating control.',
    dependencies: ['basicPolicyEngine'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectSignOff',
    availability: AVAILABLE,
    label: 'Architect sign-off',
    description: 'Evidence-bound architecture approval workflow with invalidation.',
    dependencies: ['basicPolicyEngine', 'localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'multiProjectEstate',
    availability: AVAILABLE,
    label: 'Multi-project estate',
    description: 'Aggregate multiple projects into estate-level views.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'ciEnforcement',
    availability: 'experimental',
    label: 'CI enforcement',
    description: 'Fail CI pipelines on blocking policy findings.',
    dependencies: ['basicPolicyEngine'],
    uiExposure: false,
    notes: 'Experimental — API surface may change',
    auditBehaviour: 'log',
  },
  {
    id: 'teamCollaboration',
    availability: AVAILABLE,
    label: 'Team collaboration',
    description: 'Comments, review assignment and shared sign-off state.',
    dependencies: ['architectSignOff'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'counterfactualSimulation',
    availability: AVAILABLE,
    label: 'Counterfactual simulation',
    description: 'Safe graph-only simulation of architecture changes.',
    dependencies: ['localEvidenceGraph', 'basicPolicyEngine'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'capabilityInference',
    availability: AVAILABLE,
    label: 'Capability inference',
    description: 'Deterministic inference of business capabilities from evidence.',
    dependencies: ['localEvidenceGraph'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureProjections',
    availability: AVAILABLE,
    label: 'Architecture projections',
    description: 'Derive physical, application, capability, data and ownership projections from one graph.',
    dependencies: ['localEvidenceGraph', 'capabilityInference'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'missionMode',
    availability: AVAILABLE,
    label: 'Mission mode',
    description: 'Guided architectural investigations over the evidence graph.',
    dependencies: ['architectureProjections', 'blastRadiusAnalysis'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureDNA',
    availability: AVAILABLE,
    label: 'Architecture DNA',
    description: 'Semantic architectural fingerprint for estate comparison.',
    dependencies: ['capabilityInference'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'temporalTimeline',
    availability: AVAILABLE,
    label: 'Temporal timeline',
    description: 'Slide through historical scan bundles as one evolving architecture.',
    dependencies: ['historicalDrift', 'architectureProjections'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureReview',
    availability: AVAILABLE,
    label: 'Architecture review engine',
    description: 'Deterministic step-by-step architecture review with notebook and recommendations.',
    dependencies: ['localEvidenceGraph', 'capabilityInference', 'basicPolicyEngine'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectPersonas',
    availability: AVAILABLE,
    label: 'Architect personas',
    description: 'Deterministic review lenses across enterprise and specialised packs.',
    dependencies: ['architectureReview'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'reviewPlaybooks',
    availability: AVAILABLE,
    label: 'Review playbooks',
    description: 'Saved review templates (PCI, SOC2, production readiness, DR, release).',
    dependencies: ['architectureReview'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'collaborativeReviews',
    availability: AVAILABLE,
    label: 'Collaborative reviews',
    description: 'Multi-reviewer comments, assignments and decision audit.',
    dependencies: ['architectureReview', 'teamCollaboration'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'historicalReviews',
    availability: AVAILABLE,
    label: 'Historical reviews',
    description: 'Persist and compare architecture reviews over time.',
    dependencies: ['architectureReview', 'historicalDrift'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'reviewAnalytics',
    availability: AVAILABLE,
    label: 'Review analytics',
    description: 'Pass rates, risk evolution and reviewer metrics.',
    dependencies: ['historicalReviews'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'architectureGovernance',
    availability: AVAILABLE,
    label: 'Architecture governance',
    description: 'Intent, decisions, assumptions, contracts and governance dashboard for a single project.',
    dependencies: ['architectureReview', 'capabilityInference'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'adrIntegration',
    availability: AVAILABLE,
    label: 'ADR integration',
    description: 'Parse ADRs and evaluate whether decisions remain satisfied.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'intentValidation',
    availability: AVAILABLE,
    label: 'Intent validation',
    description: 'Continuously measure declared architecture intent against observed reality.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'assumptionEngine',
    availability: AVAILABLE,
    label: 'Assumption engine',
    description: 'Infer, represent and evaluate architectural assumptions.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'contractEngine',
    availability: AVAILABLE,
    label: 'Contract engine',
    description: 'Evaluate architecture contracts and obligations against the evidence graph.',
    dependencies: ['architectureGovernance'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'decisionGraph',
    availability: AVAILABLE,
    label: 'Decision graph',
    description: 'Project decisions, intents, implementations, evidence and reviews.',
    dependencies: ['architectureGovernance', 'architectureProjections'],
    uiExposure: true,
    auditBehaviour: 'none',
  },
  {
    id: 'reviewReplay',
    availability: AVAILABLE,
    label: 'Review replay',
    description: 'Replay historical reviews using only contemporaneous evidence.',
    dependencies: ['historicalReviews', 'architectureGovernance'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'portfolioGovernance',
    availability: AVAILABLE,
    label: 'Portfolio governance',
    description: 'Govern multiple repositories, environments and shared capabilities.',
    dependencies: ['architectureGovernance', 'multiProjectEstate'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'governanceAnalytics',
    availability: AVAILABLE,
    label: 'Governance analytics',
    description: 'Executive governance metrics across the organisation.',
    dependencies: ['portfolioGovernance'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
  {
    id: 'organisationalGraph',
    availability: AVAILABLE,
    label: 'Organisational graph',
    description: 'Teams, products, systems, business units and cross-system dependencies.',
    dependencies: ['portfolioGovernance'],
    uiExposure: true,
    auditBehaviour: 'log',
  },
] as const;

const FEATURE_ENV_PREFIX = 'INFRALENS_FEATURE_';

const ENABLED_AVAILABILITIES: ReadonlySet<CapabilityAvailability> = new Set([
  'available',
  'experimental',
  'requires-credentials',
  'requires-external-tool',
]);

const OPERATIONAL_REQUIREMENTS: ReadonlySet<CapabilityAvailability> = new Set([
  'requires-credentials',
  'requires-external-tool',
]);

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

function featureEnvKey(capability: InfraLensCapability): string {
  return `${FEATURE_ENV_PREFIX}${capability.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
}

function getDefinition(capability: InfraLensCapability): CapabilityDefinition | undefined {
  return CAPABILITY_REGISTRY.find((c) => c.id === capability);
}

/**
 * @deprecated Prefer not calling this. Product editions are removed; capabilities
 * are not gated by edition. Returns `'commercial'` only so legacy callers that
 * still compare against that label continue to work. Ignores `INFRALENS_EDITION`
 * and any override.
 */
export function resolveEdition(_override?: InfraLensEdition): InfraLensEdition {
  return 'commercial';
}

/**
 * Ignore legacy edition values during migration. Edition no longer gates features.
 */
export function deprecateEdition(_value: unknown): void {
  /* no-op — edition is obsolete */
}

/**
 * True when the capability needs credentials or an external tool at runtime
 * (not a build/licensing gate).
 */
export function isOperationalRequirement(capability: InfraLensCapability): boolean {
  const def = getDefinition(capability);
  if (!def) return false;
  return OPERATIONAL_REQUIREMENTS.has(def.availability);
}

/**
 * Whether a capability is enabled for use.
 * True for available / experimental / requires-credentials / requires-external-tool.
 * False only for unavailable-in-build (or an INFRALENS_FEATURE_* kill switch).
 *
 * @param _edition Deprecated; ignored. Kept for API compatibility.
 */
export function isCapabilityEnabled(
  capability: InfraLensCapability,
  _edition?: InfraLensEdition,
): boolean {
  const def = getDefinition(capability);
  if (!def) return false;

  const override = envFlag(featureEnvKey(capability));
  if (override !== undefined) return override;

  return ENABLED_AVAILABILITIES.has(def.availability);
}

export function listCapabilities(_edition?: InfraLensEdition) {
  return CAPABILITY_REGISTRY.map((def) => ({
    ...def,
    enabled: isCapabilityEnabled(def.id),
  }));
}

export class CapabilityDeniedError extends Error {
  readonly capability: InfraLensCapability;
  readonly availability: CapabilityAvailability | 'unknown';
  /** @deprecated Unused; edition no longer gates capabilities and is not set. */
  readonly edition?: InfraLensEdition;

  constructor(capability: InfraLensCapability, availability: CapabilityAvailability | 'unknown' = 'unknown') {
    super(
      availability === 'unavailable-in-build'
        ? `Capability "${capability}" is unavailable in this build.`
        : `Capability "${capability}" is not available (${availability}).`,
    );
    this.name = 'CapabilityDeniedError';
    this.capability = capability;
    this.availability = availability;
  }
}

/**
 * Assert a capability may be used. Throws only when availability is
 * `unavailable-in-build` (or the capability is unknown). Never throws for edition.
 *
 * @param _edition Deprecated; ignored.
 * @param _layer Deprecated; ignored — enforcement layers were edition-era.
 */
export function assertCapability(
  capability: InfraLensCapability,
  _edition?: InfraLensEdition,
  _layer?: 'server' | 'scanner' | 'api' | 'ui',
): void {
  const def = getDefinition(capability);
  if (!def) throw new CapabilityDeniedError(capability, 'unknown');
  if (def.availability === 'unavailable-in-build') {
    throw new CapabilityDeniedError(capability, 'unavailable-in-build');
  }
}

export function capabilityMatrix() {
  return CAPABILITY_REGISTRY.map((c) => ({
    id: c.id,
    label: c.label,
    availability: c.availability,
    enabled: isCapabilityEnabled(c.id),
  }));
}
