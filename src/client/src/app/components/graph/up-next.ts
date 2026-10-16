import { ApiGraphEdge, ApiGraphNode } from '../../api/models';

export type UpNext<T extends Pick<ApiGraphNode, 'id' | 'status'>> = {
  /** The titles being watched. */
  watching: T[];
  /** Unwatched titles whose dependencies, also the ones before them, are watched or skipped. */
  ready: T[];
};

/**
 * What can be watched next. The nodes keep their order, so callers can pass them sorted, e.g. by
 * their position in the graph.
 */
export function findUpNext<T extends Pick<ApiGraphNode, 'id' | 'status'>>(
  nodes: readonly T[],
  edges: readonly ApiGraphEdge[]
): UpNext<T> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const parents = new Map<string, string[]>();
  for (const edge of edges) {
    parents.set(edge.targetNodeId, [...(parents.get(edge.targetNodeId) ?? []), edge.sourceNodeId]);
  }

  // Whether a node and everything before it is watched or skipped. Cycles count as not done.
  const done = new Map<string, boolean>();
  const isDone = (id: string): boolean => {
    const known = done.get(id);
    if (known !== undefined) return known;
    done.set(id, false);
    const node = byId.get(id);
    const result =
      !node || ((node.status === 'watched' || node.status === 'ignored') && allParentsDone(id));
    done.set(id, result);
    return result;
  };
  const allParentsDone = (id: string) => (parents.get(id) ?? []).every(isDone);

  return {
    watching: nodes.filter(node => node.status === 'watching'),
    ready: nodes.filter(node => node.status === 'unwatched' && allParentsDone(node.id)),
  };
}
