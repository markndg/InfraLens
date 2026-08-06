import type { EvidenceGraph } from '@infralens/graph-model';
import { computeBusinessBlastRadius } from './blast.js';
import { generateArchitectureStory } from './story.js';

export type MissionId =
  | 'public-exposure'
  | 'customer-data'
  | 'payment-flow'
  | 'availability'
  | 'security'
  | 'resilience'
  | 'drift'
  | 'ownership'
  | 'compliance'
  | 'payment-processing-review';

export interface MissionStep {
  title: string;
  detail: string;
  highlightIds: string[];
  evidenceIds: string[];
}

export interface MissionPlan {
  id: MissionId;
  title: string;
  objective: string;
  steps: MissionStep[];
  conclusion: string;
  findingIds: string[];
}

const MISSIONS: Array<{
  id: MissionId;
  title: string;
  objective: string;
  build: (graph: EvidenceGraph) => Omit<MissionPlan, 'id' | 'title' | 'objective'>;
}> = [
  {
    id: 'public-exposure',
    title: 'Review Public Exposure',
    objective: 'Trace internet-facing entry points and what they can reach.',
    build: (graph) => {
      const edge = graph.resources.filter((r) =>
        ['internet', 'route', 'ingress', 'dns', 'load-balancer'].includes(r.kind),
      );
      const steps: MissionStep[] = edge.map((r) => {
        const blast = computeBusinessBlastRadius(graph, r.id);
        return {
          title: `Edge: ${r.displayName}`,
          detail: blast.reasons.slice(0, 3).join(' · '),
          highlightIds: [r.id, ...blast.applications.slice(0, 6), ...blast.capabilities.slice(0, 4)],
          evidenceIds: r.evidence,
        };
      });
      return {
        steps: steps.length
          ? steps
          : [
              {
                title: 'No public edge discovered',
                detail: 'Evidence graph contains no route/ingress/internet nodes.',
                highlightIds: [],
                evidenceIds: [],
              },
            ],
        conclusion: `${edge.length} public exposure point(s) identified from evidence.`,
        findingIds: graph.findings
          .filter((f) => /public|internet|exposure|ingress/i.test(f.title + f.rationale))
          .map((f) => f.id),
      };
    },
  },
  {
    id: 'customer-data',
    title: 'Review Data Management',
    objective: 'Locate customer data assets, stores, producers and egress.',
    build: (graph) => {
      const assets = graph.resources.filter(
        (r) => r.kind === 'data-asset' && /customer|order|account|payment/i.test(r.name),
      );
      const steps = assets.map((a) => {
        const stores = graph.edges.filter((e) => e.source === a.id && e.relation === 'stores').map((e) => e.target);
        const creators = graph.edges.filter((e) => e.target === a.id && e.relation === 'creates').map((e) => e.source);
        return {
          title: a.displayName,
          detail: `Classification ${a.sensitivity ?? a.metadata.classification ?? 'unknown'} · ${stores.length} store(s) · ${creators.length} producer(s)`,
          highlightIds: [a.id, ...stores, ...creators],
          evidenceIds: a.evidence,
        };
      });
      return {
        steps: steps.length
          ? steps
          : [{ title: 'No customer data assets inferred', detail: 'Add naming/store evidence.', highlightIds: [], evidenceIds: [] }],
        conclusion: `${assets.length} customer-related data asset(s) inferred.`,
        findingIds: graph.findings.filter((f) => /data|pii|sensitive/i.test(f.title)).map((f) => f.id),
      };
    },
  },
  {
    id: 'payment-flow',
    title: 'Investigate Payment Flow',
    objective: 'Follow payment capability and external trust-boundary crossings.',
    build: (graph) => {
      const pay = graph.resources.filter(
        (r) => /payment/i.test(r.name) || r.tags.includes('capability:payments'),
      );
      const external = graph.resources.filter((r) => r.provider === 'external' || r.kind === 'external-system');
      const steps: MissionStep[] = [
        ...pay.slice(0, 6).map((r) => ({
          title: r.displayName,
          detail: `${r.kind} · truth ${r.truthStates.join(',')}`,
          highlightIds: [r.id],
          evidenceIds: r.evidence,
        })),
        ...external
          .filter((r) => /payment/i.test(r.name))
          .map((r) => ({
            title: `Leaves trust boundary: ${r.displayName}`,
            detail: 'External payment dependency',
            highlightIds: [r.id],
            evidenceIds: r.evidence,
          })),
      ];
      return {
        steps: steps.length
          ? steps
          : [{ title: 'No payment path found', detail: 'No payment-named resources in graph.', highlightIds: [], evidenceIds: [] }],
        conclusion: `Payment investigation covers ${pay.length} node(s) and ${external.filter((e) => /payment/i.test(e.name)).length} external payment dependenc${external.filter((e) => /payment/i.test(e.name)).length === 1 ? 'y' : 'ies'}.`,
        findingIds: graph.findings.filter((f) => /payment/i.test(f.title)).map((f) => f.id),
      };
    },
  },
  {
    id: 'availability',
    title: 'Investigate Availability',
    objective: 'Surface single points of failure and resilience gaps.',
    build: (graph) => {
      const singleReplica = graph.resources.filter(
        (r) => r.kind === 'workload' && Number(r.metadata.replicas ?? 2) <= 1,
      );
      const singleAz = graph.resources.filter(
        (r) => r.kind === 'relational-database' && (r.metadata.multi_az === false || r.metadata.multiAz === false),
      );
      const steps = [...singleReplica, ...singleAz].map((r) => ({
        title: r.displayName,
        detail: r.kind === 'relational-database' ? 'Database not multi-AZ' : 'Single-replica workload',
        highlightIds: [r.id],
        evidenceIds: r.evidence,
      }));
      return {
        steps: steps.length
          ? steps
          : [{ title: 'No single-point failures detected from available evidence', detail: '', highlightIds: [], evidenceIds: [] }],
        conclusion: `${singleReplica.length + singleAz.length} availability concern(s).`,
        findingIds: graph.findings.filter((f) => /multi-az|replica|availability/i.test(f.title)).map((f) => f.id),
      };
    },
  },
  {
    id: 'security',
    title: 'Investigate Security',
    objective: 'Review trust zones, exposure and identity boundaries.',
    build: (graph) => {
      const zones = graph.resources.filter((r) => r.kind === 'trust-zone');
      const secrets = graph.resources.filter((r) => r.kind === 'secret-ref');
      const steps = [
        ...zones.map((z) => ({
          title: z.displayName,
          detail: `${(z.metadata.memberIds as string[] | undefined)?.length ?? 0} members`,
          highlightIds: [z.id, ...((z.metadata.memberIds as string[]) ?? []).slice(0, 8)],
          evidenceIds: z.evidence,
        })),
        ...secrets.slice(0, 5).map((s) => ({
          title: `Secret: ${s.displayName}`,
          detail: 'Secret reference in graph',
          highlightIds: [s.id],
          evidenceIds: s.evidence,
        })),
      ];
      return {
        steps: steps.length ? steps : [{ title: 'Limited security evidence', detail: '', highlightIds: [], evidenceIds: [] }],
        conclusion: `${zones.length} trust zone(s), ${secrets.length} secret reference(s).`,
        findingIds: graph.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').map((f) => f.id),
      };
    },
  },
  {
    id: 'resilience',
    title: 'Review Operational Impact',
    objective: 'Focus on blast radius of critical path components.',
    build: (graph) => {
      const critical = graph.resources.filter((r) =>
        ['relational-database', 'queue', 'route', 'external-system'].includes(r.kind),
      );
      const steps = critical.slice(0, 8).map((r) => {
        const blast = computeBusinessBlastRadius(graph, r.id);
        return {
          title: r.displayName,
          detail: blast.reasons.slice(0, 2).join(' · '),
          highlightIds: [r.id, ...blast.capabilities, ...blast.applications.slice(0, 4)],
          evidenceIds: blast.evidenceIds.slice(0, 8),
        };
      });
      return {
        steps,
        conclusion: `Reviewed blast radius for ${steps.length} critical component(s).`,
        findingIds: [],
      };
    },
  },
  {
    id: 'drift',
    title: 'Investigate Drift',
    objective: 'Walk high-severity drift records and affected resources.',
    build: (graph) => {
      const drifts = graph.drifts.filter((d) => d.severity === 'high' || d.severity === 'critical' || d.severity === 'medium');
      const steps = drifts.map((d) => ({
        title: d.category,
        detail: d.explanation,
        highlightIds: d.resourceId ? [d.resourceId] : [],
        evidenceIds: d.evidence,
      }));
      return {
        steps: steps.length
          ? steps
          : [{ title: 'No drift records', detail: 'Compare against a baseline scan for temporal drift.', highlightIds: [], evidenceIds: [] }],
        conclusion: `${drifts.length} drift record(s) in current graph.`,
        findingIds: [],
      };
    },
  },
  {
    id: 'ownership',
    title: 'Review Team Responsibilities',
    objective: 'Highlight teams, orphans and cross-team dependencies.',
    build: (graph) => {
      const teams = graph.resources.filter((r) => r.kind === 'team');
      const orphans = graph.resources.filter((r) => r.tags.includes('orphaned-ownership'));
      const steps = [
        ...teams.map((t) => ({
          title: t.displayName,
          detail: `${(t.metadata.memberIds as string[] | undefined)?.length ?? 0} members`,
          highlightIds: [t.id, ...((t.metadata.memberIds as string[]) ?? []).slice(0, 10)],
          evidenceIds: t.evidence,
        })),
        ...orphans.slice(0, 8).map((o) => ({
          title: `Orphaned: ${o.displayName}`,
          detail: 'No ownership inferred',
          highlightIds: [o.id],
          evidenceIds: o.evidence,
        })),
      ];
      return {
        steps,
        conclusion: `${teams.length} team(s), ${orphans.length} orphaned resource(s).`,
        findingIds: [],
      };
    },
  },
  {
    id: 'compliance',
    title: 'Investigate Compliance',
    objective: 'Review blocking findings, waivers and approval readiness.',
    build: (graph) => {
      const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');
      const story = generateArchitectureStory(graph).filter((s) => s.kind === 'risk');
      const steps = [
        ...blocking.map((f) => ({
          title: f.title,
          detail: f.rationale,
          highlightIds: f.affectedResources,
          evidenceIds: f.evidence,
        })),
        ...story.map((s) => ({
          title: 'Narrative risk',
          detail: s.text,
          highlightIds: s.nodeIds,
          evidenceIds: s.evidenceIds,
        })),
      ];
      return {
        steps: steps.length
          ? steps
          : [{ title: 'No open blockers', detail: 'Approval path looks clear from current findings.', highlightIds: [], evidenceIds: [] }],
        conclusion: `${blocking.length} open blocking finding(s); ${graph.waivers.filter((w) => w.status === 'active').length} active waiver(s).`,
        findingIds: blocking.map((f) => f.id),
      };
    },
  },
  {
    id: 'payment-processing-review',
    title: 'Review Payment Processing',
    objective: 'Guided review: locate capability → trust boundaries → external providers → resilience → recommendation.',
    build: (graph) => {
      const payCaps = graph.resources.filter(
        (r) => r.kind === 'business-capability' && /payment/i.test(r.name),
      );
      const zones = graph.resources.filter((r) => r.kind === 'trust-zone');
      const external = graph.resources.filter(
        (r) => (r.provider === 'external' || r.kind === 'external-system') && /payment/i.test(r.name),
      );
      const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
      const steps = [
        {
          title: 'Step 1 — Locate capability',
          detail: payCaps.length
            ? payCaps.map((c) => c.displayName).join(', ')
            : 'Payments capability inferred from naming/relations',
          highlightIds: payCaps.map((c) => c.id),
          evidenceIds: payCaps.flatMap((c) => c.evidence),
        },
        {
          title: 'Step 2 — Inspect trust boundaries',
          detail: `${zones.length} trust zone(s)`,
          highlightIds: zones.map((z) => z.id),
          evidenceIds: zones.flatMap((z) => z.evidence),
        },
        {
          title: 'Step 3 — Inspect external providers',
          detail: external.length
            ? external.map((e) => e.displayName).join(', ')
            : 'No named payment external provider in graph',
          highlightIds: external.map((e) => e.id),
          evidenceIds: external.flatMap((e) => e.evidence),
        },
        {
          title: 'Step 4 — Inspect resilience',
          detail: `${dbs.filter((d) => d.metadata.multi_az === false).length} single-AZ database concern(s)`,
          highlightIds: dbs.map((d) => d.id),
          evidenceIds: dbs.flatMap((d) => d.evidence),
        },
        {
          title: 'Step 5 — Generate recommendation',
          detail: 'Compare hardening public edge vs accepting intentional payment egress with controls',
          highlightIds: [...payCaps, ...external].map((r) => r.id),
          evidenceIds: [],
        },
      ];
      return {
        steps,
        conclusion: 'Payment processing review completed from evidence graph traversal.',
        findingIds: graph.findings.filter((f) => /payment|public|multi-az/i.test(f.title)).map((f) => f.id),
      };
    },
  },
];

export function listMissions(): Array<{ id: MissionId; title: string; objective: string }> {
  return MISSIONS.map(({ id, title, objective }) => ({ id, title, objective }));
}

export function buildMission(graph: EvidenceGraph, id: MissionId): MissionPlan {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) {
    return {
      id,
      title: 'Unknown mission',
      objective: '',
      steps: [],
      conclusion: 'Mission not defined',
      findingIds: [],
    };
  }
  return { id: def.id, title: def.title, objective: def.objective, ...def.build(graph) };
}
