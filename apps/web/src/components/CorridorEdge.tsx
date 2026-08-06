import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from '@xyflow/react';

/**
 * Orthogonal corridor edge — prefers explicit layout waypoints when present,
 * otherwise falls back to smooth-step between handles.
 */
export function CorridorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  label,
}: EdgeProps) {
  const points = (data as { points?: Array<{ x: number; y: number }>; label?: string } | undefined)?.points;
  const text = label ?? (data as { label?: string } | undefined)?.label;

  if (points && points.length >= 2) {
    const d = pointsToPath(points);
    const mid = points[Math.floor(points.length / 2)];
    return (
      <>
        <BaseEdge id={id} path={d} style={style} markerEnd={markerEnd} />
        {text && (
          <EdgeLabelRenderer>
            <div
              className="corridor-edge-label"
              style={{
                transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              }}
            >
              {String(text)}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
    offset: 24,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {text && (
        <EdgeLabelRenderer>
          <div
            className="corridor-edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {String(text)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
}
