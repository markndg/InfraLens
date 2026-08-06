import type { LayoutDebugInfo } from '../layout/types';

/** Visualises group bounds, corridors, ports, and collision boxes. */
export function LayoutDebugOverlay({ debug }: { debug: LayoutDebugInfo | null }) {
  if (!debug?.enabled) return null;
  return (
    <svg className="layout-debug-overlay" aria-hidden>
      {debug.containers.map((b, i) => (
        <rect
          key={`c-${i}`}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          className="layout-debug-container"
        />
      ))}
      {debug.corridors.map((b, i) => (
        <rect
          key={`corr-${i}`}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          className="layout-debug-corridor"
        />
      ))}
      {debug.collisionBoxes.map((b, i) => (
        <rect
          key={`leaf-${i}`}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          className="layout-debug-leaf"
        />
      ))}
      {debug.ports.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r={4} className="layout-debug-port" />
      ))}
      {debug.labelBoxes.map((b, i) => (
        <rect
          key={`lab-${i}`}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          className="layout-debug-label"
        />
      ))}
    </svg>
  );
}
