import ELK, { ElkNode, ElkPoint, LayoutOptions } from 'elkjs/lib/elk.bundled.js';

import { ApiGraphEdge, ApiGraphNode } from '../../api/models';

export const NODE_WIDTH = 90;
export const NODE_HEIGHT = 135;

export type LayoutNode = {
  id: string;
  label: string;
  data: ApiGraphNode;
  position: { x: number; y: number };
  dimension: { width: number; height: number };
};

export type LayoutEdge = {
  id: string;
  path: string;
};

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
        label: node.name,
        data: node,
        position: { x: child.x ?? 0, y: child.y ?? 0 },
        dimension: { width: NODE_WIDTH, height: NODE_HEIGHT },
      };
    }),
    edges: (result.edges ?? []).map(edge => ({
      id: edge.id,
      path: (edge.sections ?? [])
        .map(section =>
          toSvgPath([section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
        )
        .join(' '),
    })),
    bounds: { x: 0, y: 0, width: result.width ?? 0, height: result.height ?? 0 },
  };
}

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
