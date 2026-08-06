import type { EvidenceGraph, ScanBundle } from '@infralens/graph-model';
import { exposureAnalysis, ensureInternetNode } from '@infralens/reachability';
import type { compareBundles } from '@infralens/reconciliation';

export function computeCompleteness(graph: EvidenceGraph) {
  const dims = [
    {
      id: 'source-discovery',
      label: 'Source discovery',
      score: clamp(graph.resources.filter((r) => r.truthStates.includes('declared') || r.truthStates.includes('rendered')).length / Math.max(graph.resources.length, 1)),
      missing: graph.unsupported.map((u) => u.construct).slice(0, 5),
    },
    {
      id: 'configuration-resolution',
      label: 'Configuration resolution',
      score: clamp(1 - graph.unsupported.filter((u) => /expression|module/i.test(u.reason)).length / 10),
      missing: graph.unsupported.filter((u) => /expression|module/i.test(u.reason)).map((u) => u.construct),
    },
    {
      id: 'rendered-deployment',
      label: 'Rendered deployment coverage',
      score: clamp(graph.resources.filter((r) => r.truthStates.includes('rendered')).length / Math.max(1, graph.resources.filter((r) => r.platform === 'kubernetes' || r.platform === 'openshift').length || 1)),
      missing: [],
    },
    {
      id: 'planned-state',
      label: 'Planned-state coverage',
      score: clamp(graph.resources.filter((r) => r.truthStates.includes('planned') || r.truthStates.includes('evaluated')).length > 0 ? 0.8 : 0.2),
      missing: graph.resources.some((r) => r.truthStates.includes('planned')) ? [] : ['terraform plan/state snapshot'],
    },
    {
      id: 'live-inventory',
      label: 'Live inventory coverage',
      score: clamp(graph.resources.filter((r) => r.truthStates.includes('observed')).length > 0 ? 0.75 : 0.15),
      missing: graph.resources.some((r) => r.truthStates.includes('observed')) ? [] : ['cloud/cluster inventory snapshot'],
    },
    {
      id: 'network-evidence',
      label: 'Network evidence',
      score: clamp(
        (graph.resources.some((r) => r.kind === 'network-policy') ? 0.4 : 0) +
          (graph.resources.some((r) => r.kind === 'security-group') ? 0.4 : 0) +
          0.1,
      ),
      missing: [
        ...(graph.resources.some((r) => r.kind === 'security-group') ? [] : ['security group inventory']),
        ...(graph.resources.some((r) => r.kind === 'network-policy') ? [] : ['network policy']),
      ],
    },
    {
      id: 'identity-evidence',
      label: 'Identity evidence',
      score: clamp(graph.resources.filter((r) => r.kind === 'iam-role' || r.kind === 'service-account').length > 0 ? 0.7 : 0.25),
      missing: graph.resources.some((r) => r.kind === 'iam-role') ? [] : ['IAM role inventory'],
    },
    {
      id: 'ownership-evidence',
      label: 'Ownership evidence',
      score: clamp(graph.resources.filter((r) => (r.ownership?.length ?? 0) > 0).length / Math.max(graph.resources.length, 1)),
      missing: ['ownership annotations for unowned resources'],
    },
    {
      id: 'policy-evidence',
      label: 'Policy evidence',
      score: clamp(graph.findings.length > 0 ? 0.85 : 0.5),
      missing: [],
    },
  ];
  const overall = dims.reduce((s, d) => s + d.score, 0) / dims.length;
  const missing = dims.flatMap((d) => d.missing).slice(0, 12);
  graph.completeness = {
    overall,
    dimensions: dims,
    summary: `Evidence completeness ${(overall * 100).toFixed(0)}%. Missing: ${missing.join('; ') || 'none critical'}.`,
  };
  return graph.completeness;
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function generateNarrative(graph: EvidenceGraph): string {
  ensureInternetNode(graph);
  const exposure = exposureAnalysis(graph);
  const routes = exposure.publicEndpoints.map((r) => r.displayName);
  const workloads = graph.resources.filter((r) => r.kind === 'workload');
  const dataStores = graph.resources.filter((r) =>
    ['relational-database', 'bucket', 'queue', 'cache'].includes(r.kind),
  );
  const highFindings = graph.findings.filter((f) => f.severity === 'high' || f.severity === 'critical');
  const sentences: string[] = [];

  sentences.push(
    routes.length
      ? `${graph.scan.project} exposes ${routes.length} public entry point(s) (${routes.slice(0, 3).join(', ')}).`
      : `${graph.scan.project} has no discovered public ingress in the current evidence set.`,
  );

  if (workloads.length) {
    sentences.push(
      `It includes ${workloads.length} workloads and ${dataStores.length} data/messaging stores discovered from ${graph.scan.adapters.join(', ')}.`,
    );
  }

  const dbEdges = graph.edges.filter((e) => {
    const t = graph.resources.find((r) => r.id === e.target);
    return t?.kind === 'relational-database';
  });
  if (dbEdges.length) {
    const src = graph.resources.find((r) => r.id === dbEdges[0].source);
    const db = graph.resources.find((r) => r.id === dbEdges[0].target);
    sentences.push(
      `${src?.displayName ?? 'A workload'} connects to ${db?.displayName ?? 'a database'} (${dbEdges[0].label ?? dbEdges[0].relation}).`,
    );
  }

  const ext = exposure.externalDependencies;
  if (ext.length) {
    sentences.push(`External dependencies include ${ext.map((e) => e.displayName).slice(0, 4).join(', ')}.`);
  }

  if (highFindings.length) {
    sentences.push(`Material concerns found:`);
    for (const f of highFindings.slice(0, 5)) {
      sentences.push(`${highFindings.indexOf(f) + 1}. ${f.title}`);
    }
  }

  sentences.push(graph.completeness.summary);
  graph.narrative = sentences.join('\n');
  return graph.narrative;
}

export function renderHtmlReport(bundle: ScanBundle): string {
  const g = bundle.graph;
  const exposure = exposureAnalysis(g);
  const signOff = g.signOffs[g.signOffs.length - 1];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>InfraLens Sign-off Report — ${escape(g.scan.project)}</title>
  <style>
    body{font-family:Georgia,serif;margin:40px;color:#122;line-height:1.45;background:#f7f4ee}
    h1,h2{font-family:Helvetica,Arial,sans-serif} h1{font-size:28px} h2{margin-top:32px;border-bottom:1px solid #ccc;padding-bottom:6px}
    .meta{color:#456;font-size:14px} table{border-collapse:collapse;width:100%;margin:12px 0}
    th,td{border:1px solid #cfc8b8;padding:8px;text-align:left;font-size:13px;vertical-align:top}
    th{background:#ebe4d6} .sev-high,.sev-critical{color:#9b1c1c;font-weight:700} .sev-medium{color:#8a5a00}
    code{font-size:12px;background:#efe9dc;padding:1px 4px}
  </style>
</head>
<body>
  <h1>InfraLens Architecture Sign-off Report</h1>
  <p class="meta">Project <strong>${escape(g.scan.project)}</strong> · Scan <code>${escape(g.scan.id)}</code> · Generated ${escape(g.scan.generatedAt)} · Hash <code>${escape(g.scan.contentHash)}</code></p>

  <h2>Executive summary</h2>
  <pre style="white-space:pre-wrap;font-family:inherit">${escape(g.narrative ?? '')}</pre>

  <h2>Environment scope</h2>
  <p>Edition: ${escape(g.scan.edition)}. Adapters: ${escape(g.scan.adapters.join(', '))}. Revision: ${escape(g.scan.repositoryRevision ?? 'n/a')}</p>

  <h2>Evidence sources</h2>
  <ul>${g.evidence.slice(0, 40).map((e) => `<li><code>${escape(e.sourceUri)}</code> · ${escape(e.sourceType)} · ${escape(e.truthState)} · conf ${(e.confidence * 100).toFixed(0)}%</li>`).join('')}</ul>

  <h2>Resource inventory</h2>
  <table><tr><th>Name</th><th>Kind</th><th>Truth</th><th>Env</th><th>Confidence</th></tr>
  ${g.resources.map((r) => `<tr><td>${escape(r.displayName)}</td><td>${escape(r.kind)}${r.subtype ? ` / ${escape(r.subtype)}` : ''}</td><td>${escape(r.truthStates.join(', '))}</td><td>${escape(r.environment ?? '')}</td><td>${r.confidence.band}</td></tr>`).join('')}
  </table>

  <h2>Public exposure</h2>
  <ul>${exposure.publicEndpoints.map((r) => `<li>${escape(r.displayName)} (${escape(r.kind)})</li>`).join('') || '<li>None</li>'}</ul>

  <h2>Cross-boundary / external dependencies</h2>
  <ul>${exposure.externalDependencies.map((r) => `<li>${escape(r.displayName)}</li>`).join('') || '<li>None</li>'}</ul>

  <h2>Drift</h2>
  <table><tr><th>Category</th><th>Severity</th><th>Explanation</th></tr>
  ${g.drifts.map((d) => `<tr><td>${escape(d.category)}</td><td class="sev-${d.severity}">${d.severity}</td><td>${escape(d.explanation)}</td></tr>`).join('') || '<tr><td colspan="3">No drift records</td></tr>'}
  </table>

  <h2>Policy findings</h2>
  <table><tr><th>Severity</th><th>Title</th><th>Status</th><th>Blocks sign-off</th></tr>
  ${g.findings.map((f) => `<tr><td class="sev-${f.severity}">${f.severity}</td><td>${escape(f.title)}<br/><small>${escape(f.rationale)}</small></td><td>${f.status}</td><td>${f.blocksSignOff}</td></tr>`).join('')}
  </table>

  <h2>Unknowns</h2>
  <ul>${g.unsupported.map((u) => `<li>${escape(u.construct)} — ${escape(u.reason)}</li>`).join('') || '<li>None recorded</li>'}</ul>

  <h2>Waivers</h2>
  <ul>${g.waivers.map((w) => `<li>${escape(w.id)} · ${escape(w.status)} · expires ${escape(w.expiresAt)} · ${escape(w.reason)}</li>`).join('') || '<li>None</li>'}</ul>

  <h2>Reviewer decision</h2>
  ${signOff ? `<p><strong>${escape(signOff.decision)}</strong> by ${escape(signOff.reviewer)} at ${escape(signOff.timestamp)}</p><ul>${signOff.comments.map((c) => `<li>${escape(c)}</li>`).join('')}</ul>` : '<p>No sign-off recorded.</p>'}

  <h2>Evidence hashes</h2>
  <p>Bundle content hash: <code>${escape(g.scan.contentHash)}</code></p>
</body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDiffMarkdown(comparison: ReturnType<typeof compareBundles>): string {
  const lines = ['# Architecture diff', '', '## ADDED'];
  for (const r of comparison.added) lines.push(`+ ${r.displayName} (${r.kind})`);
  if (!comparison.added.length) lines.push('(none)');
  lines.push('', '## REMOVED');
  for (const r of comparison.removed) lines.push(`- ${r.displayName} (${r.kind})`);
  if (!comparison.removed.length) lines.push('(none)');
  lines.push('', '## CHANGED');
  for (const m of comparison.modified) {
    lines.push(`~ ${m.after.displayName}: ${m.fields.join(', ')}`);
  }
  if (!comparison.modified.length) lines.push('(none)');
  lines.push('', '## IMPACT');
  for (const r of comparison.newlyExposed) lines.push(`! New public exposure: ${r.displayName}`);
  for (const f of comparison.policyRegression) lines.push(`! Policy regression: ${f.title}`);
  if (comparison.materialChange) lines.push('! Existing architecture approval is invalid.');
  if (!comparison.newlyExposed.length && !comparison.policyRegression.length && !comparison.materialChange) {
    lines.push('(no material impact detected)');
  }
  return lines.join('\n');
}

export type ArchitectureQuery =
  | { type: 'public-ingress' }
  | { type: 'data-stores' }
  | { type: 'reachable-from-internet' }
  | { type: 'unknown-ownership' }
  | { type: 'single-points-of-failure' }
  | { type: 'external-dependencies' }
  | { type: 'unencrypted-data-paths' }
  | { type: 'observed-not-declared' }
  | { type: 'changed-since-approved' }
  | { type: 'blast-radius'; resourceId: string }
  | { type: 'evidence-for-edge'; edgeId: string };

export function runQuery(graph: EvidenceGraph, query: ArchitectureQuery) {
  ensureInternetNode(graph);
  switch (query.type) {
    case 'public-ingress':
      return graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress' || r.kind === 'dns');
    case 'data-stores':
      return graph.resources.filter((r) =>
        ['relational-database', 'bucket', 'queue', 'cache', 'storage'].includes(r.kind),
      );
    case 'reachable-from-internet':
      return exposureAnalysis(graph).publiclyRoutable;
    case 'unknown-ownership':
      return graph.resources.filter((r) => !r.ownership?.length && r.kind !== 'internet');
    case 'single-points-of-failure':
      return graph.resources.filter(
        (r) =>
          (r.kind === 'workload' && Number(r.metadata.replicas ?? 2) <= 1) ||
          (r.kind === 'relational-database' &&
            (r.metadata.multi_az === false || r.metadata.multiAz === false)),
      );
    case 'external-dependencies':
      return graph.resources.filter((r) => r.kind === 'external-system' || r.provider === 'external');
    case 'unencrypted-data-paths':
      return graph.edges.filter((e) => e.encryption === 'none' || e.encryption === 'unknown');
    case 'observed-not-declared':
      return graph.drifts.filter((d) => d.category === 'observed-not-declared');
    case 'changed-since-approved':
      return graph.signOffs.filter((s) => s.decision === 'Invalidated by Change');
    case 'blast-radius':
      return graph.resources.find((r) => r.id === query.resourceId) ?? null;
    case 'evidence-for-edge': {
      const edge = graph.edges.find((e) => e.id === query.edgeId);
      return edge ? graph.evidence.filter((ev) => edge.evidence.includes(ev.id)) : [];
    }
    default:
      return [];
  }
}
