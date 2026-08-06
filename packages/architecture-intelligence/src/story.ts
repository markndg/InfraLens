import type { EvidenceGraph } from '@infralens/graph-model';

export interface StorySentence {
  text: string;
  evidenceIds: string[];
  nodeIds: string[];
  kind: 'exposure' | 'flow' | 'data' | 'risk' | 'ownership' | 'capability' | 'summary';
}

export function generateArchitectureStory(graph: EvidenceGraph): StorySentence[] {
  const sentences: StorySentence[] = [];
  const routes = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
  const caps = graph.resources.filter((r) => r.kind === 'business-capability' && r.subtype !== 'platform');
  const platform = graph.resources.find(
    (r) => r.kind === 'platform-system' || (r.kind === 'business-capability' && r.subtype === 'platform'),
  );
  const dataAssets = graph.resources.filter((r) => r.kind === 'data-asset');
  const queues = graph.resources.filter((r) => r.kind === 'queue');
  const buckets = graph.resources.filter((r) => r.kind === 'bucket');
  const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
  const external = graph.resources.filter((r) => r.provider === 'external' || r.kind === 'external-system');
  const singleAz = dbs.filter((d) => d.metadata.multi_az === false || d.metadata.multiAz === false);
  const teams = graph.resources.filter((r) => r.kind === 'team');

  if (platform || caps.length) {
    sentences.push({
      kind: 'summary',
      text: `${platform?.displayName ?? 'This estate'} exposes ${routes.length} public service path${routes.length === 1 ? '' : 's'} and organises ${caps.length} business ${caps.length === 1 ? 'capability' : 'capabilities'}.`,
      evidenceIds: [...(platform?.evidence ?? []), ...routes.flatMap((r) => r.evidence)].slice(0, 12),
      nodeIds: [platform?.id, ...routes.map((r) => r.id), ...caps.map((c) => c.id)].filter(Boolean) as string[],
    });
  }

  if (routes.length) {
    sentences.push({
      kind: 'exposure',
      text: `Customer requests enter through ${routes.map((r) => r.displayName).join(', ')}.`,
      evidenceIds: routes.flatMap((r) => r.evidence),
      nodeIds: routes.map((r) => r.id),
    });
  }

  const catalogCap = caps.find((c) => /catalog|order/i.test(c.name));
  if (catalogCap && dbs.length) {
    sentences.push({
      kind: 'flow',
      text: `Orders flow through the ${catalogCap.displayName} capability before reaching ${dbs.map((d) => d.displayName).join(', ')}.`,
      evidenceIds: [...catalogCap.evidence, ...dbs.flatMap((d) => d.evidence)],
      nodeIds: [catalogCap.id, ...dbs.map((d) => d.id)],
    });
  }

  if (queues.length) {
    sentences.push({
      kind: 'flow',
      text: `Order events are published to ${queues.map((q) => q.displayName).join(', ')}.`,
      evidenceIds: queues.flatMap((q) => q.evidence),
      nodeIds: queues.map((q) => q.id),
    });
  }

  if (buckets.length) {
    const images = dataAssets.find((d) => /image/i.test(d.name));
    sentences.push({
      kind: 'data',
      text: images
        ? `${images.displayName} are written to ${buckets.map((b) => b.displayName).join(', ')}.`
        : `Object storage destinations include ${buckets.map((b) => b.displayName).join(', ')}.`,
      evidenceIds: [...(images?.evidence ?? []), ...buckets.flatMap((b) => b.evidence)],
      nodeIds: [images?.id, ...buckets.map((b) => b.id)].filter(Boolean) as string[],
    });
  }

  if (external.length) {
    sentences.push({
      kind: 'risk',
      text: `${external.map((e) => e.displayName).join(', ')} processing leaves organisational trust boundaries.`,
      evidenceIds: external.flatMap((e) => e.evidence),
      nodeIds: external.map((e) => e.id),
    });
  }

  if (teams.length) {
    sentences.push({
      kind: 'ownership',
      text: `Ownership is distributed across ${teams.map((t) => t.displayName).join(', ')}.`,
      evidenceIds: teams.flatMap((t) => t.evidence),
      nodeIds: teams.map((t) => t.id),
    });
  }

  if (singleAz.length) {
    sentences.push({
      kind: 'risk',
      text: `One resilience concern remains: ${singleAz.map((d) => d.displayName).join(', ')} ${singleAz.length === 1 ? 'is' : 'are'} not multi-AZ.`,
      evidenceIds: singleAz.flatMap((d) => d.evidence),
      nodeIds: singleAz.map((d) => d.id),
    });
  } else if (graph.findings.some((f) => f.blocksSignOff && f.status === 'open')) {
    const blockers = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');
    sentences.push({
      kind: 'risk',
      text: `${blockers.length} approval blocker${blockers.length === 1 ? '' : 's'} remain open.`,
      evidenceIds: blockers.flatMap((f) => f.evidence),
      nodeIds: blockers.flatMap((f) => f.affectedResources),
    });
  }

  if (!sentences.length) {
    sentences.push({
      kind: 'summary',
      text: 'Insufficient evidence to generate an architecture narrative.',
      evidenceIds: [],
      nodeIds: [],
    });
  }

  return sentences;
}
