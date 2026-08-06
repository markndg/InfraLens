export type TruthState =
  | 'declared'
  | 'evaluated'
  | 'rendered'
  | 'planned'
  | 'observed'
  | 'inferred'
  | 'assumed'
  | 'historical';

export type EvidenceSourceType =
  | 'source-file'
  | 'terraform-json'
  | 'terraform-plan'
  | 'terraform-state'
  | 'rendered-manifest'
  | 'cloud-snapshot'
  | 'cluster-snapshot'
  | 'application-config'
  | 'source-code'
  | 'inference';

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'unknown';

export interface EvidenceLocation {
  lineStart?: number;
  lineEnd?: number;
  jsonPath?: string;
  yamlPath?: string;
}

export interface EvidenceRecord {
  id: string;
  adapter: string;
  sourceType: EvidenceSourceType;
  sourceUri: string;
  location?: EvidenceLocation;
  contentHash?: string;
  repositoryRevision?: string;
  observedAt?: string;
  extractedValue?: unknown;
  redacted: boolean;
  confidence: number;
  rationale?: string;
  truthState: TruthState;
}

export interface ConfidenceAssessment {
  band: ConfidenceBand;
  score: number;
  reasons: string[];
  missingEvidence: string[];
  conflicts: string[];
  inferenceMethod?: string;
  wouldIncreaseConfidence: string[];
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  if (score >= 0.35) return 'low';
  return 'unknown';
}

export function assessConfidence(input: {
  score: number;
  reasons?: string[];
  missingEvidence?: string[];
  conflicts?: string[];
  inferenceMethod?: string;
  wouldIncreaseConfidence?: string[];
}): ConfidenceAssessment {
  return {
    band: confidenceBand(input.score),
    score: Math.max(0, Math.min(1, input.score)),
    reasons: input.reasons ?? [],
    missingEvidence: input.missingEvidence ?? [],
    conflicts: input.conflicts ?? [],
    inferenceMethod: input.inferenceMethod,
    wouldIncreaseConfidence: input.wouldIncreaseConfidence ?? [],
  };
}

export function createEvidence(partial: Omit<EvidenceRecord, 'id' | 'redacted'> & {
  id?: string;
  redacted?: boolean;
}): EvidenceRecord {
  return {
    id: partial.id ?? evidenceId(partial.adapter, partial.sourceUri, partial.location),
    adapter: partial.adapter,
    sourceType: partial.sourceType,
    sourceUri: partial.sourceUri,
    location: partial.location,
    contentHash: partial.contentHash,
    repositoryRevision: partial.repositoryRevision,
    observedAt: partial.observedAt,
    extractedValue: partial.extractedValue,
    redacted: partial.redacted ?? false,
    confidence: partial.confidence,
    rationale: partial.rationale,
    truthState: partial.truthState,
  };
}

export function evidenceId(
  adapter: string,
  sourceUri: string,
  location?: EvidenceLocation,
): string {
  const loc =
    location?.jsonPath ||
    location?.yamlPath ||
    (location?.lineStart != null ? `L${location.lineStart}` : 'root');
  return `ev:${adapter}:${sourceUri}:${loc}`
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-');
}

export const SECRET_KEY_PATTERN =
  /(password|secret|token|api[_-]?key|private[_-]?key|credential|connectionstring|auth)/i;

export function redactValue(key: string, value: unknown): { value: unknown; redacted: boolean } {
  if (SECRET_KEY_PATTERN.test(key)) {
    return { value: '[REDACTED]', redacted: true };
  }
  if (typeof value === 'string') {
    if (
      /password\s*=\s*\S+/i.test(value) ||
      /secret\s*=\s*\S+/i.test(value) ||
      /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value) ||
      /AKIA[0-9A-Z]{16}/.test(value)
    ) {
      return {
        value: value
          .replace(/(password|secret)\s*=\s*\S+/gi, '$1=[REDACTED]')
          .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
          .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_ACCESS_KEY]'),
        redacted: true,
      };
    }
  }
  return { value, redacted: false };
}
