export type RecentGraph = { id: string; name: string };

const STORAGE_KEY = 'recent_graphs';
const MAX_RECENT_GRAPHS = 5;

/** Graphs the user opened recently on this device, most recent first. */
export function getRecentGraphs(): RecentGraph[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter(
          (x): x is RecentGraph => typeof x?.id === 'string' && typeof x?.name === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentGraph(graph: RecentGraph) {
  const graphs = [graph, ...getRecentGraphs().filter(x => x.id !== graph.id)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs.slice(0, MAX_RECENT_GRAPHS)));
  } catch {
    // Storage may be unavailable (e.g. private mode); the list is only a convenience.
  }
}

export function forgetRecentGraph(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getRecentGraphs().filter(x => x.id !== id)));
  } catch {
    // See above.
  }
}
