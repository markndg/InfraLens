import type { ConfidenceAssessment, EvidenceRecord } from '@infralens/evidence-model';
import { assessConfidence } from '@infralens/evidence-model';
import { contentHash, stableId } from './ids.js';
import type {
  EvidenceGraph,
  GraphIndices,
  ResourceEdge,
  ResourceNode,
  ScanBundle,
  ScanMeta,
} from './types.js';

export function emptyGraph(partial: Partial<ScanMeta> & { project: string }): EvidenceGraph {
  const generatedAt = partial.generatedAt ?? new Date().toISOString();
  return {
    version: '2.0',
    scan: {
      id: partial.id ?? stableId('scan', partial.project, generatedAt),
      project: partial.project,
      generatedAt,
      repositoryRevision: partial.repositoryRevision,
      adapters: partial.adapters ?? [],
      ...(partial.edition !== undefined ? { edition: partial.edition } : {}),
      warnings: partial.warnings ?? [],
      errors: partial.errors ?? [],
      durationMs: partial.durationMs ?? 0,
      contentHash: partial.contentHash ?? '',
      signature: partial.signature,
    },
    resources: [],
    edges: [],
    evidence: [],
    findings: [],
    drifts: [],
    unsupported: [],
    waivers: [],
    signOffs: [],
    reviews: [],
    completeness: {
      overall: 0,
      dimensions: [],
      summary: 'Scan not complete.',
    },
  };
}

export function buildIndices(graph: EvidenceGraph): GraphIndices {
  const byLogicalId: Record<string, string[]> = {};
  const byKind: Record<string, string[]> = {};
  const byEnvironment: Record<string, string[]> = {};
  const adjacencyOut: Record<string, string[]> = {};
  const adjacencyIn: Record<string, string[]> = {};

  for (const r of graph.resources) {
    (byLogicalId[r.logicalId] ??= []).push(r.id);
    (byKind[r.kind] ??= []).push(r.id);
    (byEnvironment[r.environment ?? 'unknown'] ??= []).push(r.id);
    adjacencyOut[r.id] ??= [];
    adjacencyIn[r.id] ??= [];
  }
  for (const e of graph.edges) {
    (adjacencyOut[e.source] ??= []).push(e.target);
    (adjacencyIn[e.target] ??= []).push(e.source);
  }
  return { byLogicalId, byKind, byEnvironment, adjacencyOut, adjacencyIn };
}

export function finalizeGraph(graph: EvidenceGraph): EvidenceGraph {
  const indices = buildIndices(graph);
  const serialized = stableSerialize({
    resources: graph.resources,
    edges: graph.edges,
    findings: graph.findings,
    drifts: graph.drifts,
  });
  return {
    ...graph,
    indices,
    scan: {
      ...graph.scan,
      contentHash: contentHash(serialized),
    },
  };
}

export function toBundle(graph: EvidenceGraph, rawSnapshots?: Record<string, unknown>): ScanBundle {
  return {
    format: 'infralens.scan.bundle',
    version: '2.0',
    graph: finalizeGraph(graph),
    rawSnapshots,
  };
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
    return out;
  }
  return value;
}

export function mergeResource(existing: ResourceNode, incoming: ResourceNode): ResourceNode {
  const truthStates = [...new Set([...existing.truthStates, ...incoming.truthStates])];
  const evidence = [...new Set([...existing.evidence, ...incoming.evidence])];
  const findings = [...new Set([...existing.findings, ...incoming.findings])];
  const tags = [...new Set([...existing.tags, ...incoming.tags])];
  const score = Math.max(existing.confidence.score, incoming.confidence.score);
  const confidence: ConfidenceAssessment = assessConfidence({
    score,
    reasons: [...existing.confidence.reasons, ...incoming.confidence.reasons],
    missingEvidence: [
      ...new Set([...existing.confidence.missingEvidence, ...incoming.confidence.missingEvidence]),
    ],
    conflicts: [...new Set([...existing.confidence.conflicts, ...incoming.confidence.conflicts])],
    wouldIncreaseConfidence: [
      ...new Set([
        ...existing.confidence.wouldIncreaseConfidence,
        ...incoming.confidence.wouldIncreaseConfidence,
      ]),
    ],
  });
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    logicalId: existing.logicalId || incoming.logicalId,
    truthStates,
    instances: dedupeById([...existing.instances, ...incoming.instances]),
    metadata: { ...existing.metadata, ...incoming.metadata },
    interfaces: dedupeById([...existing.interfaces, ...incoming.interfaces]),
    evidence,
    findings,
    confidence,
    tags,
    ownership: [...(existing.ownership ?? []), ...(incoming.ownership ?? [])],
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, { ...map.get(item.id), ...item });
  return [...map.values()];
}

export function upsertResource(graph: EvidenceGraph, resource: ResourceNode): void {
  const idx = graph.resources.findIndex((r) => r.id === resource.id);
  if (idx >= 0) graph.resources[idx] = mergeResource(graph.resources[idx], resource);
  else graph.resources.push(resource);
}

export function upsertEdge(graph: EvidenceGraph, edge: ResourceEdge): void {
  const idx = graph.edges.findIndex((e) => e.id === edge.id);
  if (idx >= 0) {
    const existing = graph.edges[idx];
    graph.edges[idx] = {
      ...existing,
      ...edge,
      truthStates: [...new Set([...existing.truthStates, ...edge.truthStates])],
      evidence: [...new Set([...existing.evidence, ...edge.evidence])],
      findings: [...new Set([...existing.findings, ...edge.findings])],
      confidence: assessConfidence({
        score: Math.max(existing.confidence.score, edge.confidence.score),
        reasons: [...existing.confidence.reasons, ...edge.confidence.reasons],
        missingEvidence: [
          ...new Set([...existing.confidence.missingEvidence, ...edge.confidence.missingEvidence]),
        ],
        wouldIncreaseConfidence: [
          ...new Set([
            ...existing.confidence.wouldIncreaseConfidence,
            ...edge.confidence.wouldIncreaseConfidence,
          ]),
        ],
      }),
    };
  } else graph.edges.push(edge);
}

export function upsertEvidence(graph: EvidenceGraph, record: EvidenceRecord): void {
  if (!graph.evidence.some((e) => e.id === record.id)) graph.evidence.push(record);
}

export function getEvidence(graph: EvidenceGraph, ids: string[]): EvidenceRecord[] {
  const set = new Set(ids);
  return graph.evidence.filter((e) => set.has(e.id));
}

export function neighbourhood(
  graph: EvidenceGraph,
  rootId: string,
  depth: number,
): Set<string> {
  const indices = graph.indices ?? buildIndices(graph);
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const t of indices.adjacencyOut[id] ?? []) {
        if (!seen.has(t)) {
          seen.add(t);
          next.push(t);
        }
      }
      for (const t of indices.adjacencyIn[id] ?? []) {
        if (!seen.has(t)) {
          seen.add(t);
          next.push(t);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

export function validateBundle(bundle: unknown): bundle is ScanBundle {
  if (!bundle || typeof bundle !== 'object') return false;
  const b = bundle as ScanBundle;
  return (
    b.format === 'infralens.scan.bundle' &&
    (b.version === '1.2' || b.version === '1.3' || b.version === '1.4' || b.version === '2.0') &&
    !!b.graph &&
    Array.isArray(b.graph.resources) &&
    Array.isArray(b.graph.edges) &&
    Array.isArray(b.graph.evidence)
  );
}
