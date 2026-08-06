import { assertCapability, type InfraLensEdition } from '@infralens/edition-capabilities';
import {
  emptyGraph,
  finalizeGraph,
  toBundle,
  upsertEdge,
  upsertEvidence,
  upsertResource,
  type EvidenceGraph,
  type ScanBundle,
} from '@infralens/graph-model';
import type { DiscoveryAdapter, DiscoveryInput, DiscoveryResult } from './types.js';

export interface OrchestratorOptions {
  adapters: DiscoveryAdapter[];
  /** @deprecated Ignored; edition is no longer stamped or used for gating. */
  edition?: InfraLensEdition;
  postProcessors?: Array<(graph: EvidenceGraph, input: DiscoveryInput) => Promise<void> | void>;
}

export async function runDiscovery(
  input: DiscoveryInput,
  options: OrchestratorOptions,
): Promise<{ bundle: ScanBundle; adapterResults: DiscoveryResult[] }> {
  const started = Date.now();
  assertCapability('repositoryScan');
  assertCapability('localEvidenceGraph');

  const graph = emptyGraph({
    project: input.project,
    repositoryRevision: input.repositoryRevision,
    adapters: [],
  });
  const adapterResults: DiscoveryResult[] = [];
  const context = {
    now: new Date().toISOString(),
    repositoryRevision: input.repositoryRevision,
  };

  for (const adapter of options.adapters) {
    const support = await adapter.supports(input);
    if (!support.supported) continue;
    const resultStarted = Date.now();
    try {
      const result = await adapter.discover(input, context);
      result.durationMs = Date.now() - resultStarted;
      adapterResults.push(result);
      graph.scan.adapters.push(adapter.id);
      for (const ev of result.evidence) upsertEvidence(graph, ev);
      for (const r of result.resources) upsertResource(graph, r);
      for (const e of result.relationships) upsertEdge(graph, e);
      graph.findings.push(...result.findings);
      graph.unsupported.push(...result.unsupported);
      graph.scan.warnings.push(...result.warnings);
      graph.scan.errors.push(...result.errors);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      graph.scan.warnings.push(`Adapter ${adapter.id} failed: ${message}`);
      adapterResults.push({
        adapter: adapter.id,
        resources: [],
        relationships: [],
        evidence: [],
        findings: [],
        unsupported: [],
        warnings: [],
        errors: [message],
        durationMs: Date.now() - resultStarted,
        redactionSummary: { keysRedacted: 0, valuesRedacted: 0 },
        metadata: { failed: true },
      });
    }
  }

  for (const processor of options.postProcessors ?? []) {
    await processor(graph, input);
  }

  graph.scan.durationMs = Date.now() - started;
  const finalized = finalizeGraph(graph);
  return { bundle: toBundle(finalized, input.snapshots as Record<string, unknown> | undefined), adapterResults };
}
