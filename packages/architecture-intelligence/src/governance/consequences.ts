import type { EvidenceGraph } from '@infralens/graph-model';
import { computeBusinessBlastRadius } from '../blast.js';

export interface ConsequenceChain {
  originAssumptionId: string;
  originTitle: string;
  steps: Array<{ kind: string; text: string; resourceIds: string[] }>;
  summary: string;
}

/** What happens if this assumption is false? Deterministic consequence walk. */
export function simulateAssumptionFailure(
  graph: EvidenceGraph,
  assumptionId: string,
): ConsequenceChain {
  const assumption = graph.resources.find((r) => r.id === assumptionId && r.kind === 'assumption');
  if (!assumption) {
    return {
      originAssumptionId: assumptionId,
      originTitle: 'Unknown assumption',
      steps: [{ kind: 'error', text: 'Assumption not found', resourceIds: [] }],
      summary: 'Cannot simulate — assumption missing',
    };
  }

  const steps: ConsequenceChain['steps'] = [
    {
      kind: 'assumption',
      text: `Assumption false: ${assumption.displayName}`,
      resourceIds: [assumption.id],
    },
  ];

  const related = (assumption.metadata.relatedResourceIds as string[] | undefined) ?? [];
  for (const rid of related.slice(0, 3)) {
    const r = graph.resources.find((x) => x.id === rid);
    if (!r) continue;
    steps.push({
      kind: 'implementation',
      text: `${r.displayName} availability/protection degraded`,
      resourceIds: [r.id],
    });
    const blast = computeBusinessBlastRadius(graph, r.id);
    if (blast.capabilities.length) {
      steps.push({
        kind: 'capability',
        text: `Business capability degraded: ${blast.capabilities
          .map((id) => graph.resources.find((c) => c.id === id)?.displayName)
          .filter(Boolean)
          .join(', ')}`,
        resourceIds: blast.capabilities,
      });
    }
    if (blast.publicUsersAffected) {
      steps.push({
        kind: 'business',
        text: 'Public users / checkout path may be affected',
        resourceIds: blast.applications.slice(0, 5),
      });
    }
  }

  const intents = graph.edges
    .filter((e) => e.target === assumptionId && e.relation === 'depends-on-assumption')
    .map((e) => graph.resources.find((r) => r.id === e.source))
    .filter((r) => r?.kind === 'intent');
  for (const intent of intents) {
    if (!intent) continue;
    steps.push({
      kind: 'intent',
      text: `Intent invalidated: ${intent.displayName}`,
      resourceIds: [intent.id],
    });
  }

  const adrs = graph.resources.filter(
    (r) => r.kind === 'adr' && (r.metadata.satisfaction === 'invalid' || /resilien|multi.?az|database/i.test(r.displayName)),
  );
  for (const adr of adrs.slice(0, 2)) {
    steps.push({
      kind: 'adr',
      text: `ADR invalidated: ${adr.displayName}`,
      resourceIds: [adr.id],
    });
  }

  const contracts = graph.resources.filter(
    (r) => r.kind === 'architecture-contract' && r.metadata.evaluation !== 'satisfied',
  );
  for (const c of contracts.slice(0, 2)) {
    steps.push({
      kind: 'contract',
      text: `Contract violated: ${c.displayName}`,
      resourceIds: [c.id],
    });
  }

  steps.push({
    kind: 'approval',
    text: 'Approval revoked / review replay required',
    resourceIds: [],
  });

  return {
    originAssumptionId: assumptionId,
    originTitle: assumption.displayName,
    steps,
    summary: steps.map((s) => s.text).join(' → '),
  };
}
