import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import { stableId, type EvidenceGraph, type ResourceNode } from '@infralens/graph-model';

export interface ParsedAdr {
  number: string;
  title: string;
  status: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives: string[];
  sourceUri: string;
  raw: string;
}

export interface ProjectFileLike {
  path: string;
  content: string;
}

const ADR_PATH = /(^|\/)(docs\/)?adr\/|ADR[-_]?\d+/i;

export function isAdrPath(path: string): boolean {
  return ADR_PATH.test(path) && /\.md$/i.test(path);
}

export function parseAdrMarkdown(path: string, content: string): ParsedAdr | null {
  if (!content.trim()) return null;
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const statusMatch = content.match(/##\s*Status\s*\n+([^\n#]+)/i);
  const contextMatch = content.match(/##\s*Context\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  const decisionMatch = content.match(/##\s*Decision\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  const consequencesMatch = content.match(/##\s*Consequences\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  const alternativesMatch = content.match(/##\s*Alternatives\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  const numMatch = path.match(/(\d{3,4})/) ?? content.match(/ADR[- ]?(\d+)/i);
  const title = (titleMatch?.[1] ?? path).replace(/^ADR[- ]?\d+\s*[.:-]?\s*/i, '').trim();

  return {
    number: numMatch?.[1] ?? '000',
    title,
    status: (statusMatch?.[1] ?? 'Accepted').trim(),
    context: (contextMatch?.[1] ?? '').trim(),
    decision: (decisionMatch?.[1] ?? '').trim(),
    consequences: (consequencesMatch?.[1] ?? '').trim(),
    alternatives: (alternativesMatch?.[1] ?? '')
      .split(/\n+/)
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean),
    sourceUri: path,
    raw: content,
  };
}

export function ingestAdrs(graph: EvidenceGraph, files: ProjectFileLike[]): string[] {
  const ids: string[] = [];
  for (const file of files.filter((f) => isAdrPath(f.path))) {
    const parsed = parseAdrMarkdown(file.path, file.content);
    if (!parsed) continue;
    const adrId = stableId('adr', parsed.number, parsed.title);
    if (graph.resources.some((r) => r.id === adrId)) {
      ids.push(adrId);
      continue;
    }
    const ev = createEvidence({
      adapter: 'governance-adr',
      sourceType: 'source-file',
      sourceUri: file.path,
      confidence: 0.92,
      truthState: 'declared',
      rationale: `Parsed ADR-${parsed.number}: ${parsed.title}`,
      extractedValue: {
        status: parsed.status,
        decision: parsed.decision.slice(0, 400),
      },
    });
    graph.evidence.push(ev);

    const adrNode: ResourceNode = {
      id: adrId,
      logicalId: adrId,
      kind: 'adr',
      subtype: `ADR-${parsed.number}`,
      name: `ADR-${parsed.number}`,
      displayName: `ADR-${parsed.number}: ${parsed.title}`,
      lifecycle: /super/i.test(parsed.status) ? 'deprecated' : 'active',
      truthStates: ['declared'],
      instances: [],
      metadata: {
        adrNumber: parsed.number,
        adrStatus: parsed.status,
        context: parsed.context,
        decisionText: parsed.decision,
        consequences: parsed.consequences,
        alternatives: parsed.alternatives,
        sourceUri: file.path,
      },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({
        score: 0.92,
        reasons: [`Declared ADR in ${file.path}`],
        inferenceMethod: 'adr-markdown-parse',
      }),
      tags: ['adr', 'governance'],
      layers: ['governance', 'decision', 'evidence'],
      ownership: [{ team: 'Architecture' }],
    };
    graph.resources.push(adrNode);
    ids.push(adrId);

    const decisionId = stableId('decision', 'adr', parsed.number);
    if (!graph.resources.some((r) => r.id === decisionId)) {
      graph.resources.push({
        id: decisionId,
        logicalId: decisionId,
        kind: 'architectural-decision',
        subtype: 'adr-linked',
        name: parsed.title,
        displayName: parsed.title,
        lifecycle: 'active',
        truthStates: ['declared'],
        instances: [],
        metadata: {
          status: mapAdrStatus(parsed.status),
          intent: parsed.decision.slice(0, 240),
          rationale: parsed.context.slice(0, 400),
          alternatives: parsed.alternatives,
          adrId,
          owner: 'Architecture',
        },
        interfaces: [],
        evidence: [ev.id],
        findings: [],
        confidence: assessConfidence({
          score: 0.9,
          reasons: [`Decision recorded in ADR-${parsed.number}`],
        }),
        tags: ['decision', 'adr'],
        layers: ['governance', 'decision'],
      });
      graph.edges.push({
        id: stableId(adrId, 'documents-decision', decisionId),
        source: adrId,
        target: decisionId,
        relation: 'documents-decision',
        direction: 'directed',
        truthStates: ['declared'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.95, reasons: ['ADR documents decision'] }),
        findings: [],
        label: 'documents',
      });
    }
  }
  return ids;
}

function mapAdrStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('super')) return 'superseded';
  if (s.includes('reject') || s.includes('deprecated')) return 'deprecated';
  if (s.includes('propos')) return 'proposed';
  return 'accepted';
}

/** Evaluate whether ADR-linked decisions still hold against graph evidence. */
export function evaluateAdrSatisfaction(graph: EvidenceGraph): void {
  for (const adr of graph.resources.filter((r) => r.kind === 'adr')) {
    const decision = graph.edges
      .filter((e) => e.source === adr.id && e.relation === 'documents-decision')
      .map((e) => graph.resources.find((r) => r.id === e.target))
      .find(Boolean);
    if (!decision) continue;

    let status: 'satisfied' | 'possibly-invalid' | 'invalid' | 'unknown' = 'satisfied';
    const reasons: string[] = [];
    const text = [
      decision.displayName,
      String(decision.metadata.decisionText ?? ''),
      String(decision.metadata.intent ?? ''),
      String(adr.metadata.context ?? ''),
      String(adr.metadata.consequences ?? ''),
      String(adr.metadata.decisionText ?? ''),
    ].join(' ');

    if (/postgres|postgresql|rds|database/i.test(text)) {
      const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
      const singleAz = dbs.filter((d) => d.metadata.multi_az === false || d.metadata.multiAz === false);
      if (!dbs.length) {
        status = 'unknown';
        reasons.push('No database implementation found for database ADR');
      } else if (singleAz.length) {
        status = 'invalid';
        reasons.push(
          `${singleAz.map((d) => d.displayName).join(', ')} not multi-AZ — database ADR expectations broken`,
        );
      } else {
        reasons.push('Database decision still mapped to observed stores');
      }
    }

    if (/openshift|kubernetes/i.test(text)) {
      const workloads = graph.resources.filter((r) => r.platform === 'openshift' || r.platform === 'kubernetes');
      if (!workloads.length) {
        status = status === 'invalid' ? status : 'possibly-invalid';
        reasons.push('No OpenShift/Kubernetes workloads observed');
      }
    }

    if (/sqs|queue|event/i.test(text)) {
      if (!graph.resources.some((r) => r.kind === 'queue')) {
        status = status === 'invalid' ? status : 'possibly-invalid';
        reasons.push('Event/queue decision lacks queue resources');
      }
    }

    if (/payment|external/i.test(text)) {
      if (!graph.resources.some((r) => r.provider === 'external' || r.kind === 'external-system')) {
        status = status === 'invalid' ? status : 'unknown';
        reasons.push('External payment dependency not found in graph');
      }
    }

    decision.metadata.adrSatisfaction = status;
    decision.metadata.adrSatisfactionReasons = reasons;
    adr.metadata.satisfaction = status;
    adr.metadata.satisfactionReasons = reasons;
    if (status === 'invalid') {
      decision.metadata.status = 'invalid';
      adr.tags = [...new Set([...(adr.tags ?? []), 'adr-invalid'])];
    } else if (status === 'possibly-invalid') {
      decision.metadata.status = 'possibly-invalid';
      adr.tags = [...new Set([...(adr.tags ?? []), 'adr-possibly-invalid'])];
    } else if (status === 'satisfied') {
      decision.metadata.status = decision.metadata.status === 'accepted' ? 'satisfied' : decision.metadata.status;
    }
  }
}
