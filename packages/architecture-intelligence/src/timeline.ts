import type { EvidenceGraph, ScanBundle } from '@infralens/graph-model';
import { enrichArchitectureIntelligence } from './enrich.js';

export interface TimelineFrame {
  index: number;
  scanId: string;
  generatedAt: string;
  label: string;
  graph: EvidenceGraph;
  added: string[];
  removed: string[];
  changed: string[];
  publicExposure: string[];
  riskSummary: string;
}

export interface ArchitectureTimeline {
  frames: TimelineFrame[];
}

function logicalKey(graph: EvidenceGraph, id: string): string {
  const r = graph.resources.find((x) => x.id === id);
  return r?.logicalId ?? id;
}

export function buildTimeline(bundles: ScanBundle[]): ArchitectureTimeline {
  const enriched = bundles.map((b) => {
    const graph = structuredClone(b.graph);
    enrichArchitectureIntelligence(graph);
    return graph;
  });

  const frames: TimelineFrame[] = enriched.map((graph, index) => {
    const prev = index > 0 ? enriched[index - 1] : undefined;
    const currKeys = new Map(graph.resources.map((r) => [r.logicalId, r.id]));
    const prevKeys = new Map((prev?.resources ?? []).map((r) => [r.logicalId, r.id]));
    const added = [...currKeys.keys()].filter((k) => !prevKeys.has(k)).map((k) => currKeys.get(k)!);
    const removed = [...prevKeys.keys()].filter((k) => !currKeys.has(k)).map((k) => prevKeys.get(k)!);
    const changed: string[] = [];
    if (prev) {
      for (const [logicalId, id] of currKeys) {
        const prevId = prevKeys.get(logicalId);
        if (!prevId) continue;
        const a = graph.resources.find((r) => r.id === id);
        const b = prev.resources.find((r) => r.id === prevId);
        if (!a || !b) continue;
        if (
          JSON.stringify(a.ownership) !== JSON.stringify(b.ownership) ||
          a.lifecycle !== b.lifecycle ||
          a.findings.length !== b.findings.length
        ) {
          changed.push(id);
        }
      }
    }
    const publicExposure = graph.resources
      .filter((r) => ['route', 'ingress', 'internet', 'dns', 'load-balancer'].includes(r.kind))
      .map((r) => r.id);

    return {
      index,
      scanId: graph.scan.id,
      generatedAt: graph.scan.generatedAt,
      label: new Date(graph.scan.generatedAt).toLocaleString(),
      graph,
      added,
      removed,
      changed,
      publicExposure,
      riskSummary: graph.intelligence
        ? `Op ${(graph.intelligence.risk.operational.score * 100).toFixed(0)}% · Sec ${(graph.intelligence.risk.security.score * 100).toFixed(0)}% · Biz ${(graph.intelligence.risk.business.score * 100).toFixed(0)}%`
        : 'n/a',
    };
  });

  return { frames };
}

export function animateDiff(prev: EvidenceGraph, next: EvidenceGraph): {
  appear: string[];
  disappear: string[];
  emphasize: string[];
} {
  const prevSet = new Set(prev.resources.map((r) => r.logicalId));
  const nextSet = new Set(next.resources.map((r) => r.logicalId));
  return {
    appear: next.resources.filter((r) => !prevSet.has(r.logicalId)).map((r) => r.id),
    disappear: prev.resources.filter((r) => !nextSet.has(r.logicalId)).map((r) => r.id),
    emphasize: next.resources
      .filter((r) => ['route', 'ingress'].includes(r.kind) || r.findings.length)
      .map((r) => r.id),
  };
}

void logicalKey;
