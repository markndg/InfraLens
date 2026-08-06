import type { EvidenceGraph, Finding } from '@infralens/graph-model';
import { evaluatePolicies, DEFAULT_POLICIES } from '@infralens/policy-engine';
import { computeBusinessBlastRadius } from './blast.js';
import { enrichArchitectureIntelligence } from './enrich.js';

export type SimulationAction =
  | { type: 'remove'; resourceId: string }
  | { type: 'move-namespace'; resourceId: string; namespace: string }
  | { type: 'enable-multi-az'; resourceId: string }
  | { type: 'split-service'; resourceId: string; newName: string }
  | { type: 'set-public'; resourceId: string; public: boolean }
  | { type: 'move-database'; resourceId: string; region: string };

export interface SimulationResult {
  graph: EvidenceGraph;
  action: SimulationAction;
  note: string;
  affectedIds: string[];
  blast: ReturnType<typeof computeBusinessBlastRadius>;
  newFindings: Finding[];
  removedFindings: string[];
  approvalImpact: string;
}

export function simulateArchitectureChange(
  source: EvidenceGraph,
  action: SimulationAction,
): SimulationResult {
  const graph = structuredClone(source);
  // Drop previous intelligence so enrich recalculates
  delete graph.intelligence;
  const affectedIds: string[] = [];
  let note = '';

  switch (action.type) {
    case 'remove': {
      const node = graph.resources.find((r) => r.id === action.resourceId);
      note = `Simulated removal of ${node?.displayName ?? action.resourceId}`;
      affectedIds.push(action.resourceId);
      graph.resources = graph.resources.filter((r) => r.id !== action.resourceId);
      graph.edges = graph.edges.filter((e) => e.source !== action.resourceId && e.target !== action.resourceId);
      break;
    }
    case 'move-namespace': {
      const node = graph.resources.find((r) => r.id === action.resourceId);
      if (node) {
        note = `Simulated move of ${node.displayName} to namespace ${action.namespace}`;
        node.namespace = action.namespace;
        node.metadata = { ...node.metadata, simulatedNamespace: action.namespace };
        affectedIds.push(node.id);
      }
      break;
    }
    case 'enable-multi-az': {
      const node = graph.resources.find((r) => r.id === action.resourceId);
      if (node) {
        note = `Simulated enable Multi-AZ on ${node.displayName}`;
        node.metadata = { ...node.metadata, multi_az: true, multiAz: true, simulated: true };
        affectedIds.push(node.id);
      }
      break;
    }
    case 'split-service': {
      const node = graph.resources.find((r) => r.id === action.resourceId);
      if (node) {
        const clone = structuredClone(node);
        clone.id = `${node.id}:split`;
        clone.logicalId = `${node.logicalId}:split`;
        clone.name = action.newName;
        clone.displayName = action.newName;
        clone.metadata = { ...clone.metadata, simulatedSplitFrom: node.id };
        graph.resources.push(clone);
        affectedIds.push(node.id, clone.id);
        note = `Simulated split of ${node.displayName} into ${action.newName}`;
      }
      break;
    }
    case 'set-public': {
      const node = graph.resources.find((r) => r.id === action.resourceId);
      if (node) {
        note = action.public
          ? `Simulated making ${node.displayName} public`
          : `Simulated making ${node.displayName} private`;
        node.metadata = { ...node.metadata, public: action.public, simulatedPublic: action.public };
        if (action.public && node.kind !== 'route' && node.kind !== 'ingress') {
          node.tags = [...new Set([...(node.tags ?? []), 'simulated-public'])];
        }
        affectedIds.push(node.id);
      }
      break;
    }
    case 'move-database': {
      const node = graph.resources.find((r) => r.id === action.resourceId);
      if (node) {
        note = `Simulated move of ${node.displayName} to region ${action.region}`;
        node.region = action.region;
        node.metadata = { ...node.metadata, simulatedRegion: action.region };
        affectedIds.push(node.id);
      }
      break;
    }
  }

  const beforeFindings = new Set(source.findings.map((f) => f.id));
  graph.findings = graph.findings.filter((f) =>
    f.affectedResources.every((id) => graph.resources.some((r) => r.id === id)),
  );
  const evaluated = evaluatePolicies(graph, DEFAULT_POLICIES, graph.scan.generatedAt);
  for (const f of evaluated) {
    if (!graph.findings.some((x) => x.id === f.id)) graph.findings.push(f);
  }

  enrichArchitectureIntelligence(graph);

  const fallbackOrigin =
    'resourceId' in action ? action.resourceId : graph.resources[0]?.id ?? '';
  const blastOrigin =
    affectedIds.find((id) => graph.resources.some((r) => r.id === id)) ??
    (graph.resources.some((r) => r.id === fallbackOrigin) ? fallbackOrigin : graph.resources[0]?.id ?? '');
  const blast = blastOrigin
    ? computeBusinessBlastRadius(graph, blastOrigin)
    : {
        originId: '',
        infrastructure: [],
        applications: [],
        capabilities: [],
        dataAssets: [],
        teams: [],
        publicUsersAffected: false,
        signoffsInvalidated: [],
        confidence: 0,
        reasons: ['No origin for blast radius'],
        evidenceIds: [],
      };

  const newFindings = graph.findings.filter((f) => !beforeFindings.has(f.id));
  const removedFindings = [...beforeFindings].filter((id) => !graph.findings.some((f) => f.id === id));
  const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open').length;

  return {
    graph,
    action,
    note,
    affectedIds,
    blast,
    newFindings,
    removedFindings,
    approvalImpact: blocking
      ? `${blocking} open blocking finding(s) after simulation — approvals should be revalidated`
      : 'No open blocking findings after simulation',
  };
}
