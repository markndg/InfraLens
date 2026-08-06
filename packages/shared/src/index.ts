import { assessConfidence, createEvidence, type TruthState } from '@infralens/evidence-model';
import {
  contentHash,
  stableId,
  type ResourceEdge,
  type ResourceKind,
  type ResourceNode,
  type RelationKind,
} from '@infralens/graph-model';

/** Deterministic non-cryptographic content fingerprint (browser + Node safe). */
export function sha256(content: string): string {
  return contentHash(content);
}

export function inferEnvironment(value: string | undefined): string {
  if (!value) return 'shared';
  if (/prod/i.test(value)) return 'production';
  if (/stage|staging|uat/i.test(value)) return 'staging';
  if (/dev|local|test/i.test(value)) return 'development';
  return 'shared';
}

export function makeResource(input: {
  provider?: string;
  kind: ResourceKind;
  name: string;
  logicalId?: string;
  subtype?: string;
  platform?: string;
  environment?: string;
  account?: string;
  region?: string;
  cluster?: string;
  namespace?: string;
  boundary?: string;
  truthState: TruthState;
  metadata?: Record<string, unknown>;
  tags?: string[];
  confidence?: number;
  reasons?: string[];
  missingEvidence?: string[];
  adapter: string;
  sourceUri: string;
  sourceType?: Parameters<typeof createEvidence>[0]['sourceType'];
  location?: Parameters<typeof createEvidence>[0]['location'];
  rationale?: string;
}): { resource: ResourceNode; evidenceId: string } {
  const evidence = createEvidence({
    adapter: input.adapter,
    sourceType: input.sourceType ?? 'source-file',
    sourceUri: input.sourceUri,
    location: input.location,
    contentHash: sha256(`${input.sourceUri}:${input.name}`),
    extractedValue: { name: input.name, kind: input.kind },
    confidence: input.confidence ?? 0.9,
    rationale: input.rationale,
    truthState: input.truthState,
  });
  const id = stableId(
    input.provider ?? 'unknown',
    input.platform,
    input.namespace,
    input.kind,
    input.name,
  );
  const resource: ResourceNode = {
    id,
    logicalId: input.logicalId ?? id,
    kind: input.kind,
    subtype: input.subtype,
    provider: input.provider,
    platform: input.platform,
    name: input.name,
    displayName: input.name,
    environment: input.environment ?? inferEnvironment(input.name + (input.namespace ?? '')),
    account: input.account,
    region: input.region,
    cluster: input.cluster,
    namespace: input.namespace,
    lifecycle: 'active',
    truthStates: [input.truthState],
    instances: [
      {
        id: stableId(id, input.truthState),
        truthState: input.truthState,
        attributes: input.metadata ?? {},
        evidenceIds: [evidence.id],
      },
    ],
    metadata: input.metadata ?? {},
    interfaces: [],
    evidence: [evidence.id],
    findings: [],
    confidence: assessConfidence({
      score: input.confidence ?? 0.9,
      reasons: input.reasons ?? [`Discovered by ${input.adapter}`],
      missingEvidence: input.missingEvidence ?? [],
      wouldIncreaseConfidence: input.missingEvidence?.length
        ? input.missingEvidence.map((m) => `Provide ${m}`)
        : [],
    }),
    tags: input.tags ?? [],
    boundary: input.boundary,
  };
  return { resource, evidenceId: evidence.id };
}

export function makeEdge(input: {
  source: string;
  target: string;
  relation: RelationKind;
  label?: string;
  protocol?: string;
  port?: number;
  truthState: TruthState;
  confidence?: number;
  reasons?: string[];
  missingEvidence?: string[];
  effectiveState?: ResourceEdge['effectiveState'];
  evidenceIds: string[];
}): ResourceEdge {
  return {
    id: stableId(input.source, input.target, input.relation, input.label ?? ''),
    source: input.source,
    target: input.target,
    relation: input.relation,
    direction: 'directed',
    protocol: input.protocol,
    ports: input.port != null ? [{ from: input.port, protocol: input.protocol }] : undefined,
    label: input.label,
    effectiveState: input.effectiveState ?? 'unknown',
    truthStates: [input.truthState],
    evidence: input.evidenceIds,
    confidence: assessConfidence({
      score: input.confidence ?? 0.8,
      reasons: input.reasons ?? [],
      missingEvidence: input.missingEvidence ?? [],
      wouldIncreaseConfidence: input.missingEvidence?.map((m) => `Resolve ${m}`) ?? [],
    }),
    findings: [],
  };
}

export const SCANNER_LIMITS = {
  maxFileBytes: 2_000_000,
  maxFiles: 20_000,
  maxDepth: 24,
  timeoutMs: 120_000,
  maxYamlDocuments: 500,
} as const;

export const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.terraform',
  'vendor',
  '.next',
  'coverage',
]);
