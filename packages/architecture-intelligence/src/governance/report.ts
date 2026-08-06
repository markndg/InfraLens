import type { EvidenceGraph } from '@infralens/graph-model';
import { generateRecommendations } from '../review/recommendations.js';

export interface GovernanceReport {
  title: string;
  generatedAt: string;
  project: string;
  sections: Array<{ heading: string; body: string }>;
  markdown: string;
}

export function generateGovernanceReport(graph: EvidenceGraph): GovernanceReport {
  const gov = graph.intelligence?.governance;
  const dash = gov?.dashboard;
  const intents = graph.resources.filter((r) => r.kind === 'intent');
  const decisions = graph.resources.filter((r) => r.kind === 'architectural-decision');
  const assumptions = graph.resources.filter((r) => r.kind === 'assumption');
  const contracts = graph.resources.filter((r) => r.kind === 'architecture-contract');
  const adrs = graph.resources.filter((r) => r.kind === 'adr');
  const recs = generateRecommendations(graph).slice(0, 8);

  const sections = [
    {
      heading: 'Executive Summary',
      body: dash
        ? `Status ${dash.status}. Architecture health ${Math.round(dash.architectureHealth * 100)}%. ${dash.reasons.join('; ')}.`
        : 'Governance snapshot unavailable.',
    },
    {
      heading: 'Architecture Intent',
      body: intents
        .map((i) => `- ${i.displayName}: ${i.metadata.satisfaction ?? 'unknown'} — ${(i.metadata.satisfactionReasons as string[] | undefined)?.[0] ?? ''}`)
        .join('\n') || 'No intents declared.',
    },
    {
      heading: 'Decision Register',
      body: decisions
        .map((d) => `- ${d.displayName} [${d.metadata.status}] — ${d.metadata.rationale ?? ''}`)
        .join('\n') || 'No decisions recorded.',
    },
    {
      heading: 'Assumptions',
      body: assumptions
        .map((a) => `- ${a.displayName}: ${a.metadata.status} — ${(a.metadata.reasons as string[] | undefined)?.[0] ?? ''}`)
        .join('\n') || 'No assumptions evaluated.',
    },
    {
      heading: 'Intent Drift',
      body: intents
        .filter((i) => i.metadata.satisfaction === 'drifted' || i.metadata.satisfaction === 'violated')
        .map((i) => `- ${i.displayName}: ${i.metadata.satisfaction}`)
        .join('\n') || 'No intent drift detected.',
    },
    {
      heading: 'Architecture Health',
      body: (gov?.metrics ?? [])
        .map((m) => `- ${m.label}: ${Math.round(m.score * 100)}% — ${m.reasons[0] ?? ''}`)
        .join('\n'),
    },
    {
      heading: 'Review History',
      body:
        (graph.reviews ?? [])
          .map((r) => `- ${r.date.slice(0, 10)} · ${r.outcome} · ${r.playbookId} · ${r.persona}`)
          .join('\n') || 'No persisted reviews.',
    },
    {
      heading: 'Outstanding Risks',
      body: graph.findings
        .filter((f) => f.status === 'open' && (f.severity === 'high' || f.severity === 'critical' || f.blocksSignOff))
        .slice(0, 12)
        .map((f) => `- ${f.severity}: ${f.title}`)
        .join('\n') || 'No open high/critical findings.',
    },
    {
      heading: 'Contracts',
      body: contracts
        .map((c) => `- ${c.displayName}: ${c.metadata.evaluation}`)
        .join('\n') || 'No contracts.',
    },
    {
      heading: 'ADRs',
      body: adrs
        .map((a) => `- ${a.displayName}: ${a.metadata.satisfaction ?? a.metadata.adrStatus}`)
        .join('\n') || 'No ADRs.',
    },
    {
      heading: 'Recommendations',
      body: recs.map((r) => `- ${r.problem}: ${r.options[0]?.title ?? 'See options'}`).join('\n') || 'None.',
    },
    {
      heading: 'Portfolio Impact',
      body: 'Single-project governance scope (OSS). Commercial portfolio mode aggregates multiple systems.',
    },
    {
      heading: 'Future Review Dates',
      body: `Next architecture board review recommended within ${dash?.brokenAssumptions ? 14 : 30} days based on current governance posture.`,
    },
  ];

  const markdown = [
    `# Architecture Governance Report`,
    ``,
    `Project: ${graph.scan.project}`,
    `Generated: ${new Date().toISOString()}`,
    `Evidence hash: ${graph.scan.contentHash}`,
    ``,
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.body, '']),
  ].join('\n');

  return {
    title: `Architecture Governance — ${graph.scan.project}`,
    generatedAt: new Date().toISOString(),
    project: graph.scan.project,
    sections,
    markdown,
  };
}
