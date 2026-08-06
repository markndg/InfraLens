import { Handle, Position, type NodeProps } from '@xyflow/react';
import { resolveEntityVisual } from '@infralens/icons';
import type { ResourceNode } from '@infralens/graph-model';
import type { CSSProperties } from 'react';

export type FocusRole = 'selected' | 'upstream' | 'downstream' | 'path' | 'dimmed' | 'normal';

interface InfraNodeData {
  resource: ResourceNode;
  zoomBand?: 'far' | 'medium' | 'near';
  scopeLabel?: string;
  kindLabel?: string;
  findingSeverity?: string;
  drifted?: boolean;
  inCycle?: boolean;
  focusRole?: FocusRole;
  techLabel?: string;
  techKey?: string;
}

export function InfraNode({ data, selected }: NodeProps) {
  const d = data as unknown as InfraNodeData;
  const resource = d.resource;
  const zoomBand = d.zoomBand ?? 'medium';
  const focusRole = d.focusRole ?? (selected ? 'selected' : 'normal');
  const techLabel = d.techLabel;
  const techKey = d.techKey;
  const visual = resolveEntityVisual({
    kind: resource.kind,
    provider: resource.provider,
    subtype: resource.subtype,
    platform: resource.platform,
    name: resource.name,
    techKey,
    techLabel,
  });
  const kindLabel = d.kindLabel ?? resource.kind;
  const scope = d.scopeLabel ?? resource.namespace ?? resource.environment ?? 'unscoped';
  const truth = summarizeTruth(resource.truthStates);

  const style = {
    '--node-accent': visual.theme.accent,
    '--node-tint': visual.theme.tint,
    '--node-icon-bg': visual.theme.iconBg,
  } as CSSProperties;

  return (
    <div
      className={[
        'infra-node',
        `zoom-${zoomBand}`,
        `focus-${focusRole}`,
        `family-${visual.theme.family}`,
        d.drifted ? 'is-drifted' : '',
        d.inCycle ? 'in-cycle' : '',
        resource.truthStates.includes('inferred') ? 'is-inferred' : '',
        resource.truthStates.includes('historical') ? 'is-historical' : '',
        d.findingSeverity ? `sev-${d.findingSeverity}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-provider={resource.provider}
      data-kind={resource.kind}
      data-icon={visual.icon}
      data-family={visual.theme.family}
      aria-label={`${resource.displayName}, ${kindLabel}, ${scope}`}
    >
      <Handle id="left" type="target" position={Position.Left} />
      <Handle id="top" type="target" position={Position.Top} />
      <div
        className="node-icon"
        title={visual.icon}
        dangerouslySetInnerHTML={{ __html: visual.svg }}
        aria-hidden
      />
      <div className="node-copy">
        <strong>{resource.displayName}</strong>
        <span className="node-kind">
          {kindLabel} · {scope}
        </span>
        {techLabel && zoomBand !== 'far' && <span className="node-tech">{techLabel}</span>}
        {zoomBand !== 'far' && (
          <small>
            {resource.provider ?? 'unknown'}
            {resource.environment ? ` · ${resource.environment}` : ''}
            {` · ${truth}`}
            {` · ${resource.confidence.band}`}
          </small>
        )}
        {zoomBand === 'near' && (
          <small className="node-meta">
            {[
              resource.metadata.replicas != null ? `replicas ${String(resource.metadata.replicas)}` : null,
              Array.isArray(resource.metadata.images) && resource.metadata.images[0]
                ? `image ${String(resource.metadata.images[0])}`
                : null,
              resource.namespace ? `ns ${resource.namespace}` : null,
              resource.region ? resource.region : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        )}
      </div>
      <div className="node-badges" aria-hidden>
        {d.findingSeverity && ['critical', 'high'].includes(d.findingSeverity) && (
          <span className={`badge sev ${d.findingSeverity}`} title={`${d.findingSeverity} finding`}>
            !
          </span>
        )}
        {d.drifted && (
          <span className="badge drift" title="Drift detected">
            Δ
          </span>
        )}
        {resource.truthStates.includes('inferred') && (
          <span className="badge inferred" title="Inferred">
            ~
          </span>
        )}
      </div>
      <Handle id="right" type="source" position={Position.Right} />
      <Handle id="bottom" type="source" position={Position.Bottom} />
    </div>
  );
}

function summarizeTruth(states: string[]): string {
  if (!states.length) return 'unknown';
  if (states.length === 1) return states[0];
  const priority = ['observed', 'rendered', 'planned', 'declared', 'inferred'];
  const present = priority.filter((p) => states.includes(p));
  return present.slice(0, 2).join('+') || states.slice(0, 2).join('+');
}
