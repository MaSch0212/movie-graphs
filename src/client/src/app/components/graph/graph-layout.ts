import ELK, { ElkNode, ElkPoint, LayoutOptions } from 'elkjs/lib/elk.bundled.js';

import { ApiGraphEdge, ApiGraphNode } from '../../api/models';

export const NODE_WIDTH = 90;
export const NODE_HEIGHT = 135;

export type LayoutNode = {
  id: string;
  data: ApiGraphNode;
  position: { x: number; y: number };
  dimension: { width: number; height: number };
};

export type LayoutEdge = {
  id: string;
  /** The line of the edge, ending where the arrow head starts. */
  path: string;
  /** The arrow head at the end of the edge (a closed triangle). */
  arrow: string;
};

/** Size of the arrow heads in world units. */
export const ARROW_LENGTH = 11;
export const ARROW_WIDTH = 10;
/** Space between the ends of an edge and the posters it connects. */
export const ARROW_GAP = 4;

export type GraphLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  bounds: { x: number; y: number; width: number; height: number };
};

export const EMPTY_LAYOUT: GraphLayout = {
  nodes: [],
  edges: [],
  bounds: { x: 0, y: 0, width: 0, height: 0 },
};

// ELK's "layered" algorithm (Sugiyama-style) with spline edge routing. Compared to dagre it
// minimizes edge crossings much better and routes edges around nodes instead of through them.
const layoutOptions: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'SPLINES',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.spacing.edgeNode': '15',
  'elk.spacing.edgeEdge': '10',
  'elk.padding': '[top=20,left=20,bottom=20,right=20]',
};

const elk = new ELK();

export async function computeGraphLayout(
  nodes: readonly ApiGraphNode[],
  edges: readonly ApiGraphEdge[]
): Promise<GraphLayout> {
  const nodeIds = new Set(nodes.map(node => node.id));
  const validEdges = edges.filter(
    edge => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
  );

  const result = await elk.layout<ElkNode>({
    id: 'root',
    layoutOptions,
    children: nodes.map(node => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: validEdges.map(edge => ({
      id: `${edge.sourceNodeId}->${edge.targetNodeId}`,
      sources: [edge.sourceNodeId],
      targets: [edge.targetNodeId],
    })),
  });

  const nodesById = new Map(nodes.map(node => [node.id, node]));
  return {
    nodes: (result.children ?? []).flatMap(child => {
      const node = nodesById.get(child.id);
      if (!node) return [];
      return {
        id: node.id,
        data: node,
        position: { x: child.x ?? 0, y: child.y ?? 0 },
        dimension: { width: NODE_WIDTH, height: NODE_HEIGHT },
      };
    }),
    edges: (result.edges ?? []).map(edge => ({
      id: edge.id,
      ...edgeGeometry(
        (edge.sections ?? []).map(section => [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ])
      ),
    })),
    bounds: { x: 0, y: 0, width: result.width ?? 0, height: result.height ?? 0 },
  };
}

/**
 * Builds the SVG paths of an edge from its sections' points (as returned by ELK).
 *
 * - Curves leave their source and enter their target horizontally, so arrow heads never point
 *   steeply into a poster (where their corners would be covered by it).
 * - Both ends keep a small gap to the posters.
 * - The line stops where the arrow head begins, so the arrow head keeps a sharp tip.
 */
export function edgeGeometry(sections: ElkPoint[][]): { path: string; arrow: string } {
  const parts = sections.map(section => section.map(p => ({ x: p.x, y: p.y })));
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first || !last || first.length < 2 || last.length < 2) {
    return { path: parts.map(toSvgPath).join(' '), arrow: '' };
  }

  // Start: leave the source horizontally, a little away from it.
  const source = first[0];
  if (isCurve(first)) {
    const sign = Math.sign(first[1].x - source.x) || 1;
    first[1] = { x: source.x + sign * curveReach(source, first[1]), y: source.y };
  }
  const startDir = direction(source, first[1]);
  first[0] = { x: source.x + startDir.x * ARROW_GAP, y: source.y + startDir.y * ARROW_GAP };

  // End: enter the target horizontally; the arrow head points along that direction.
  const target = last[last.length - 1];
  let dir: ElkPoint;
  if (isCurve(last)) {
    const control = last[last.length - 2];
    const sign = Math.sign(target.x - control.x) || 1;
    last[last.length - 2] = { x: target.x - sign * curveReach(target, control), y: target.y };
    dir = { x: sign, y: 0 };
  } else {
    const before = [...last].reverse().find(p => p.x !== target.x || p.y !== target.y) ?? target;
    dir = direction(before, target);
  }

  // The tip stays a little away from the poster; the line ends just inside the arrow head (1 unit
  // overlap avoids a visible seam). The last control point moves along so the curve keeps its shape.
  const tip = { x: target.x - dir.x * ARROW_GAP, y: target.y - dir.y * ARROW_GAP };
  const shorten = ARROW_GAP + ARROW_LENGTH - 1;
  const shifted = (p: ElkPoint) => ({ x: p.x - dir.x * shorten, y: p.y - dir.y * shorten });
  last[last.length - 1] = shifted(target);
  if (isCurve(last)) last[last.length - 2] = shifted(last[last.length - 2]);

  const base = { x: tip.x - dir.x * ARROW_LENGTH, y: tip.y - dir.y * ARROW_LENGTH };
  const normal = { x: -dir.y, y: dir.x };
  const half = ARROW_WIDTH / 2;
  const point = (p: ElkPoint) => `${round(p.x)},${round(p.y)}`;
  const arrow =
    `M${point(tip)}` +
    ` L${point({ x: base.x + normal.x * half, y: base.y + normal.y * half })}` +
    ` L${point({ x: base.x - normal.x * half, y: base.y - normal.y * half })} Z`;

  return { path: parts.map(toSvgPath).join(' '), arrow };
}

/** Whether the points describe cubic Bézier curves: start, (c1, c2, end)+. */
const isCurve = (points: ElkPoint[]) => points.length >= 4 && (points.length - 1) % 3 === 0;

/** Distance of a curve's control point from its end point, so the curve ends smoothly. */
const curveReach = (end: ElkPoint, control: ElkPoint) =>
  Math.min(40, Math.max(24, Math.hypot(control.x - end.x, control.y - end.y)));

function direction(from: ElkPoint, to: ElkPoint): ElkPoint {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

const round = (value: number) => Math.round(value * 100) / 100;

// With spline routing ELK returns the control points of a piecewise cubic Bézier curve:
// start, (c1, c2, end)+. Fall back to straight segments if the points don't fit that shape.
function toSvgPath(points: ElkPoint[]): string {
  const [start, ...rest] = points;
  const point = (p: ElkPoint) => `${p.x},${p.y}`;
  if (rest.length % 3 !== 0) {
    return `M${point(start)}${rest.map(p => ` L${point(p)}`).join('')}`;
  }
  let path = `M${point(start)}`;
  for (let i = 0; i < rest.length; i += 3) {
    path += ` C${point(rest[i])} ${point(rest[i + 1])} ${point(rest[i + 2])}`;
  }
  return path;
}
