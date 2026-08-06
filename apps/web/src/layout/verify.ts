import type { LayoutGraph } from './types';

export interface LayoutViolation {
  code: string;
  message: string;
  ids?: string[];
}

/**
 * Automated layout invariants (Definition of Done checks).
 */
export function verifyLayout(layout: LayoutGraph): LayoutViolation[] {
  const violations: LayoutViolation[] = [];
  const leaves = [...layout.byId.values()].filter((n) => n.kind === 'leaf');
  const containers = [...layout.byId.values()].filter(
    (n) => n.kind === 'container' && n.id !== '__root__',
  );

  // No node outside parent container
  for (const leaf of leaves) {
    if (leaf.kind !== 'leaf') continue;
    const parent = containers.find(
      (c) => c.kind === 'container' && c.memberIds.includes(leaf.id),
    );
    if (!parent || parent.kind !== 'container') continue;
    const l = leaf.abs;
    const p = parent.abs;
    const inside =
      l.x >= p.x - 0.5 &&
      l.y >= p.y - 0.5 &&
      l.x + l.width <= p.x + p.width + 0.5 &&
      l.y + l.height <= p.y + p.height + 0.5;
    if (!inside) {
      violations.push({
        code: 'node-outside-parent',
        message: `${leaf.id} escapes ${parent.id}`,
        ids: [leaf.id, parent.id],
      });
    }
  }

  // No group overlap
  for (let i = 0; i < containers.length; i++) {
    for (let j = i + 1; j < containers.length; j++) {
      const a = containers[i];
      const b = containers[j];
      if (a.kind !== 'container' || b.kind !== 'container') continue;
      if (boxesOverlap(a.abs, b.abs)) {
        violations.push({
          code: 'group-overlap',
          message: `${a.id} overlaps ${b.id}`,
          ids: [a.id, b.id],
        });
      }
    }
  }

  // Container sized from children
  for (const c of containers) {
    if (c.kind !== 'container') continue;
    for (const child of c.children) {
      const box = child.kind === 'leaf' ? child.abs : child.abs;
      if (box.x + box.width > c.abs.x + c.abs.width + 1 || box.y + box.height > c.abs.y + c.abs.height + 1) {
        violations.push({
          code: 'container-too-small',
          message: `${c.id} does not enclose ${child.id}`,
          ids: [c.id, child.id],
        });
      }
    }
  }

  // Edge through unrelated leaf (coarse segment vs box test)
  for (const e of layout.edges) {
    for (const leaf of leaves) {
      if (leaf.kind !== 'leaf') continue;
      if (leaf.id === e.sourceId || leaf.id === e.targetId) continue;
      if (polylineHitsBox(e.points, leaf.abs, 4)) {
        violations.push({
          code: 'edge-through-node',
          message: `edge ${e.id} crosses ${leaf.id}`,
          ids: [e.id, leaf.id],
        });
      }
    }
  }

  return violations;
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function polylineHitsBox(
  points: Array<{ x: number; y: number }>,
  box: { x: number; y: number; width: number; height: number },
  pad: number,
): boolean {
  const b = {
    x: box.x + pad,
    y: box.y + pad,
    width: Math.max(0, box.width - pad * 2),
    height: Math.max(0, box.height - pad * 2),
  };
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentHitsBox(points[i], points[i + 1], b)) return true;
  }
  return false;
}

function segmentHitsBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
): boolean {
  // Sample midpoints for orthogonal segments
  const samples = 8;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
      return true;
    }
  }
  return false;
}
