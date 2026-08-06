import type { EvidenceRecord } from '@infralens/evidence-model';
import type {
  Finding,
  ResourceEdge,
  ResourceNode,
  UnsupportedConstruct,
} from '@infralens/graph-model';

export interface ProjectFile {
  path: string;
  content: string;
  size?: number;
}

export interface DiscoveryInput {
  project: string;
  rootPath?: string;
  files: ProjectFile[];
  repositoryRevision?: string;
  snapshots?: {
    terraformPlan?: unknown;
    terraformState?: unknown;
    awsInventory?: unknown;
    clusterInventory?: unknown;
  };
  options?: {
    includeLive?: boolean;
    edition?: 'oss' | 'commercial';
  };
}

export interface DiscoveryContext {
  now: string;
  repositoryRevision?: string;
  edition: 'oss' | 'commercial';
  signal?: AbortSignal;
}

export interface SupportAssessment {
  supported: boolean;
  confidence: number;
  reason: string;
  matchedFiles: string[];
}

export interface DiscoveryResult {
  adapter: string;
  resources: ResourceNode[];
  relationships: ResourceEdge[];
  evidence: EvidenceRecord[];
  findings: Finding[];
  unsupported: UnsupportedConstruct[];
  warnings: string[];
  errors: string[];
  durationMs: number;
  redactionSummary: { keysRedacted: number; valuesRedacted: number };
  metadata: Record<string, unknown>;
}

export interface DiscoveryAdapter {
  id: string;
  supports(input: DiscoveryInput): Promise<SupportAssessment>;
  discover(input: DiscoveryInput, context: DiscoveryContext): Promise<DiscoveryResult>;
}

export function emptyResult(adapter: string, started: number): DiscoveryResult {
  return {
    adapter,
    resources: [],
    relationships: [],
    evidence: [],
    findings: [],
    unsupported: [],
    warnings: [],
    errors: [],
    durationMs: Date.now() - started,
    redactionSummary: { keysRedacted: 0, valuesRedacted: 0 },
    metadata: {},
  };
}
