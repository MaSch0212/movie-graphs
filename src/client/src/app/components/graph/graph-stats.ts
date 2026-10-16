import { ApiGraphNode, ApiGraphNodeStatus, ApiGraphNodeType } from '../../api/models';
import { fromTimeSpan } from '../../utils/time-span';

/** A number of titles and their runtime. */
export type TitleTotals = { count: number; minutes: number };

/** A place to watch the titles that are left; bought titles also sum up their prices. */
export type WatchSource = TitleTotals & { name: string; price?: number };

export type GraphStats = {
  /** All titles that are not skipped. */
  all: TitleTotals;
  watched: TitleTotals;
  /** The titles that are not watched yet, also the ones being watched. */
  left: TitleTotals;
  byStatus: Record<ApiGraphNodeStatus, TitleTotals>;
  /** Watched and all of each type; skipped titles don't count. */
  byType: Record<ApiGraphNodeType, { watched: TitleTotals; all: TitleTotals }>;
  /** Where the titles that are left can be watched, most titles first. */
  sources: WatchSource[];
  /** Titles that are not skipped but have no runtime, so the hours are incomplete. */
  withoutDuration: ApiGraphNode[];
};

// E.g. "Kaufen: Apple TV 4,99 €" or "Buy: Amazon 3.99 €".
const PRICE = /^(.*?)\s*(\d+(?:[.,]\d{1,2})?)\s*€$/;

/** Statistics about the titles of a graph and how much of it is watched. */
export function graphStats(nodes: readonly ApiGraphNode[]): GraphStats {
  const totals = (): TitleTotals => ({ count: 0, minutes: 0 });
  const stats: GraphStats = {
    all: totals(),
    watched: totals(),
    left: totals(),
    byStatus: { unwatched: totals(), watching: totals(), watched: totals(), ignored: totals() },
    byType: {
      movie: { watched: totals(), all: totals() },
      series: { watched: totals(), all: totals() },
    },
    sources: [],
    withoutDuration: [],
  };
  const sources = new Map<string, WatchSource>();

  for (const node of nodes) {
    const minutes = node.duration ? fromTimeSpan(node.duration) : 0;
    const add = (target: TitleTotals) => {
      target.count++;
      target.minutes += minutes;
    };

    add(stats.byStatus[node.status]);
    if (node.status === 'ignored') continue;

    add(stats.all);
    add(stats.byType[node.type].all);
    if (!node.duration) stats.withoutDuration.push(node);
    if (node.status === 'watched') {
      add(stats.watched);
      add(stats.byType[node.type].watched);
      continue;
    }

    add(stats.left);
    const where = node.whereToWatch?.trim() ?? '';
    const price = PRICE.exec(where);
    const name = price ? price[1].trim() : where;
    let source = sources.get(name);
    if (!source) {
      source = { name, ...totals(), ...(price ? { price: 0 } : {}) };
      sources.set(name, source);
    }
    add(source);
    if (price) {
      const cents = Math.round(Number(price[2].replace(',', '.')) * 100);
      source.price = Math.round((source.price ?? 0) * 100 + cents) / 100;
    }
  }

  stats.sources = [...sources.values()].sort(
    (a, b) => Number(!a.name) - Number(!b.name) || b.count - a.count || b.minutes - a.minutes
  );
  return stats;
}
