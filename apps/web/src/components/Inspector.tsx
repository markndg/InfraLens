import { useState, type ReactNode } from 'react';
import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import { blastRadius } from '@infralens/reachability';
import { architecturalRole, generateArchitecturalStatement } from '../lib/statements';
import { kindLabel, scopeLabel } from '../lib/architectureLayout';
import { isolationExplanation, type SemanticProjectionResult } from '../projection';

export function Inspector({
  graph,
  resource,
  statement,
  projection,
}: {
  graph: EvidenceGraph;
  resource: ResourceNode;
  statement: string;
  projection?: SemanticProjectionResult | null;
}) {
  const inbound = graph.edges.filter((e) => e.target === resource.id);
  const outbound = graph.edges.filter((e) => e.source === resource.id);
  const isolation =
    projection && (projection.view === 'application' || projection.view === 'security')
      ? isolationExplanation(resource.id, graph, projection)
      : null;
  const blocked = [...inbound, ...outbound].filter(
    (e) => e.effectiveState === 'blocked' || e.relation === 'network-blocked',
  );
  const uncertain = [...inbound, ...outbound].filter(
    (e) => e.effectiveState === 'unknown' || e.effectiveState === 'partial' || e.truthStates.includes('inferred'),
  );
  const findings = graph.findings
    .filter((f) => f.affectedResources.includes(resource.id))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const drifts = graph.drifts.filter((d) => d.resourceId === resource.id);
  const evidence = graph.evidence.filter((e) => resource.evidence.includes(e.id));
  const evidenceBySource = groupBy(evidence, (e) => e.sourceType);
  const br = blastRadius(graph, resource.id);
  const role = architecturalRole(resource, graph);

  return (
    <div className="inspector">
      <div className="panel-title">
        <span className="provider-chip">{resource.provider ?? 'unknown'}</span>
        <h2>{resource.displayName}</h2>
        <p>
          {kindLabel(resource)} · {scopeLabel(resource)}
        </p>
      </div>

      <p className="arch-statement" aria-live="polite">
        {statement}
      </p>

      {isolation && (
        <p className="isolation-note" role="status">
          {isolation}
        </p>
      )}

      <Collapsible title="Summary" defaultOpen>
        <dl className="summary-grid">
          <div>
            <dt>Role</dt>
            <dd>{role}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{resource.environment ?? 'n/a'}</dd>
          </div>
          <div>
            <dt>Exposure</dt>
            <dd>{exposureLabel(resource, graph)}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{resource.ownership?.[0]?.owner ?? resource.ownership?.[0]?.team ?? 'unknown'}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              {resource.confidence.band} ({Math.round(resource.confidence.score * 100)}%)
            </dd>
          </div>
          <div>
            <dt>Criticality</dt>
            <dd>
              {br.publicRoutesAffected.length ? 'Public-path critical' : br.directDependants.length > 3 ? 'High fan-in' : 'Standard'}
            </dd>
          </div>
          <div>
            <dt>Drift</dt>
            <dd>{drifts.length ? `${drifts.length} record(s)` : 'None'}</dd>
          </div>
        </dl>
        <ul className="reasons">
          {resource.confidence.reasons.slice(0, 4).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Collapsible>

      <Collapsible title="Findings and sign-off impact" defaultOpen={findings.length > 0}>
        {findings.length ? (
          findings.map((f) => (
            <article key={f.id} className={`finding ${f.severity}`}>
              <span>
                {f.severity}
                {f.blocksSignOff ? ' · blocks sign-off' : ''}
                {f.status === 'waived' ? ' · waived' : ''}
              </span>
              <b>{f.title}</b>
              <p>{f.rationale}</p>
              <p className="muted">Impact: {f.impact}</p>
              <p className="muted">Remediation: {f.remediation}</p>
            </article>
          ))
        ) : (
          <p className="muted">No findings attached.</p>
        )}
        {drifts.map((d) => (
          <article key={d.id} className={`finding ${d.severity}`}>
            <span>{d.category}</span>
            <b>Drift</b>
            <p>{d.explanation}</p>
          </article>
        ))}
      </Collapsible>

      <Collapsible title="Connectivity" defaultOpen>
        <h4>Inbound ({inbound.length})</h4>
        <ConnList graph={graph} edges={inbound} direction="in" />
        <h4>Outbound ({outbound.length})</h4>
        <ConnList graph={graph} edges={outbound} direction="out" />
        <h4>Blocked ({blocked.length})</h4>
        <ConnList graph={graph} edges={blocked} direction="any" />
        <h4>Uncertain ({uncertain.length})</h4>
        <ConnList graph={graph} edges={uncertain} direction="any" />
      </Collapsible>

      <Collapsible title="Truth reconciliation" defaultOpen>
        <table className="truth-matrix">
          <thead>
            <tr>
              <th>Truth layer</th>
              <th>Resource</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(['declared', 'rendered', 'planned', 'observed', 'inferred'] as const).map((layer) => {
              const inst = resource.instances.find((i) => i.truthState === layer);
              const has = resource.truthStates.includes(layer);
              return (
                <tr key={layer} className={has ? 'present' : 'missing'}>
                  <td>{layer}</td>
                  <td>
                    {inst
                      ? String(inst.address ?? inst.attributes.address ?? resource.metadata.address ?? resource.displayName)
                      : '—'}
                  </td>
                  <td>{has ? 'Matched' : 'Missing'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Collapsible>

      <Collapsible title="Evidence" defaultOpen>
        {Object.entries(evidenceBySource).map(([source, rows]) => (
          <div key={source} className="evidence-group">
            <h4>{source}</h4>
            {rows.map((e) => (
              <div className="evidence" key={e.id}>
                <code>{e.sourceUri}</code>
                <span>
                  {e.truthState}
                  {e.location?.yamlPath || e.location?.jsonPath || e.location?.lineStart
                    ? ` · ${e.location.yamlPath ?? e.location.jsonPath ?? `L${e.location.lineStart}`}`
                    : ''}
                  {e.rationale ? ` · ${e.rationale}` : ''}
                  {e.contentHash ? ` · ${e.contentHash.slice(0, 10)}` : ''}
                  {e.redacted ? ' · redacted' : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </Collapsible>

      <Collapsible title="Raw metadata" defaultOpen={false}>
        <dl>
          {Object.entries(resource.metadata)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
        </dl>
      </Collapsible>
    </div>
  );
}

function ConnList({
  graph,
  edges,
  direction,
}: {
  graph: EvidenceGraph;
  edges: EvidenceGraph['edges'];
  direction: 'in' | 'out' | 'any';
}) {
  if (!edges.length) return <p className="muted">None</p>;
  return (
    <>
      {edges.map((l) => {
        const otherId = direction === 'in' ? l.source : direction === 'out' ? l.target : l.source;
        const other = graph.resources.find((r) => r.id === otherId || r.id === l.target || r.id === l.source);
        return (
          <div className="relation" key={l.id}>
            <b>
              {direction === 'in' ? '←' : direction === 'out' ? '→' : '·'} {l.label ?? l.relation}
            </b>
            <span>
              {other?.displayName} · {l.truthStates.join(',')} · {l.confidence.band}
              {l.effectiveState ? ` · ${l.effectiveState}` : ''}
            </span>
          </div>
        );
      })}
    </>
  );
}

function Collapsible({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="collapsible">
      <button
        type="button"
        className="collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  );
}

function severityRank(s: string) {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] ?? 0;
}

function exposureLabel(resource: ResourceNode, graph: EvidenceGraph): string {
  const publicPath = graph.edges.some((e) => {
    if (e.target !== resource.id && e.source !== resource.id) return false;
    const other = graph.resources.find((r) => r.id === (e.source === resource.id ? e.target : e.source));
    return other?.kind === 'route' || other?.kind === 'ingress' || other?.kind === 'internet';
  });
  if (resource.kind === 'route' || resource.kind === 'ingress') return 'Public ingress';
  if (publicPath) return 'Reachable from public edge';
  if (resource.provider === 'external') return 'External';
  return 'Internal';
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

// re-export helper for App statement generation
export { generateArchitecturalStatement };
