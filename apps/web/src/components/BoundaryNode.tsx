import type { NodeProps } from '@xyflow/react';
import type { BoundaryGroup } from '../lib/boundaries';

export function BoundaryNode({ data }: NodeProps) {
  const boundary = (data as unknown as {
    boundary: BoundaryGroup & { collapsedSummary?: boolean };
  }).boundary;
  const badges = (boundary.badges ?? []).filter((b) => !/^application$/i.test(b)).slice(0, 4);
  const findings = (boundary.findingCritical ?? 0) + (boundary.findingHigh ?? 0);
  const summary = Boolean(boundary.collapsedSummary);
  return (
    <div
      className={`boundary-node boundary-${boundary.kind}${summary ? ' boundary-summary' : ''}`}
      aria-label={`Boundary ${boundary.kind}: ${boundary.label}`}
    >
      <header className="boundary-label">
        <span className="boundary-kind">{formatKind(boundary.kind)}</span>
        <strong>{boundary.label}</strong>
        {!summary && (
          <span className="boundary-count" title="Members in this group">
            {boundary.memberIds.length}
          </span>
        )}
        {badges.map((badge) => (
          <span key={badge} className="boundary-badge">
            {badge}
          </span>
        ))}
        {findings > 0 && !summary && (
          <span className="boundary-findings">{findings} risk</span>
        )}
        {boundary.hasDrift && !summary && <span className="boundary-drift">drift</span>}
      </header>
      {summary && (
        <div className="boundary-summary-body">
          <span>{boundary.memberIds.length} resources</span>
          {findings > 0 && <span>{findings} findings</span>}
          {boundary.hasDrift && <span>drift</span>}
        </div>
      )}
    </div>
  );
}

export function LaneLabelNode({ data }: NodeProps) {
  const label = (data as unknown as { label: string }).label;
  return (
    <div className="lane-label" aria-hidden>
      {label}
    </div>
  );
}

function formatKind(kind: string): string {
  if (kind === 'app-stack') return 'app type';
  if (kind === 'logical-application') return 'application';
  if (kind === 'security-controls') return 'controls';
  if (kind === 'data-domain') return 'data';
  if (kind === 'risk-domain') return 'risk';
  if (kind === 'cost-domain') return 'cost';
  return kind.replace(/-/g, ' ');
}
