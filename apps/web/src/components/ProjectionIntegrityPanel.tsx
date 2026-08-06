import { useState, type ReactNode } from 'react';
import type { ProjectionIntegrityReport } from '../projection';

/** Development-facing projection integrity diagnostics. */
export function ProjectionIntegrityPanel({
  report,
  onClose,
}: {
  report: ProjectionIntegrityReport | null;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<string | null>('errors');
  if (!report) return null;

  const rows: Array<{ key: string; label: string; count: number; detail?: ReactNode }> = [
    { key: 'eligible', label: 'Eligible canonical edges', count: report.eligibleCanonicalEdges },
    {
      key: 'direct',
      label: 'Direct rendered',
      count: report.directRendered,
      detail: <IdList ids={report.categories.direct} />,
    },
    {
      key: 'aggregate',
      label: 'Aggregated rendered',
      count: report.aggregatedRendered,
      detail: <IdList ids={report.categories.aggregate} />,
    },
    {
      key: 'containment',
      label: 'Containment represented',
      count: report.containmentRepresented,
      detail: <IdList ids={report.categories.containment} />,
    },
    {
      key: 'suppressed',
      label: 'Suppressed intentionally',
      count: report.suppressedIntentionally,
      detail: (
        <ul className="integrity-list">
          {report.categories.suppressed.map((s) => (
            <li key={s.edgeId}>
              <code>{shortId(s.edgeId)}</code> — {s.reason}
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'errors',
      label: 'Projection errors',
      count: report.projectionErrors,
      detail: (
        <ul className="integrity-list">
          {report.categories.errors.map((s) => (
            <li key={s.edgeId}>
              <code>{shortId(s.edgeId)}</code> — {s.reason}
            </li>
          ))}
        </ul>
      ),
    },
    { key: 'routing', label: 'Routing fallbacks', count: report.routingFallbacks },
    { key: 'rendered', label: 'Rendered edges', count: report.renderedEdges },
  ];

  return (
    <aside className="projection-integrity-panel" aria-label="Projection integrity">
      <header>
        <strong>Projection integrity · {report.view}</strong>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p className="integrity-zoom">Zoom band: {report.zoomBand}</p>
      <ul className="integrity-rows">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              className={open === row.key ? 'active' : ''}
              onClick={() => setOpen(open === row.key ? null : row.key)}
              disabled={!row.detail}
            >
              <span>{row.label}</span>
              <strong className={row.key === 'errors' && row.count > 0 ? 'bad' : ''}>{row.count}</strong>
            </button>
            {open === row.key && row.detail ? <div className="integrity-detail">{row.detail}</div> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function IdList({ ids }: { ids: string[] }) {
  if (!ids.length) return <p className="muted">None</p>;
  return (
    <ul className="integrity-list">
      {ids.slice(0, 40).map((id) => (
        <li key={id}>
          <code>{shortId(id)}</code>
        </li>
      ))}
      {ids.length > 40 ? <li>…{ids.length - 40} more</li> : null}
    </ul>
  );
}

function shortId(id: string): string {
  return id.length > 64 ? `${id.slice(0, 32)}…${id.slice(-16)}` : id;
}
