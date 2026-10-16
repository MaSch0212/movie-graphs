import { ApiGraphNode } from '../../api/models';
import { graphStats } from './graph-stats';

function node(parts: Partial<ApiGraphNode>): ApiGraphNode {
  return { id: '', name: '', type: 'movie', imageUrl: '', status: 'unwatched', ...parts };
}

describe('graphStats', () => {
  const stats = graphStats([
    node({ status: 'watched', duration: '02:00:00', whereToWatch: 'Disney+' }),
    node({ status: 'watching', type: 'series', duration: '05:30:00', whereToWatch: 'Disney+' }),
    node({ duration: '01:00:00', whereToWatch: 'Disney+' }),
    node({ duration: '02:10:00', whereToWatch: 'Kaufen: Apple TV 4,99 €' }),
    node({ duration: '02:00:00', whereToWatch: 'Kaufen: Apple TV 9,99 €' }),
    node({ name: 'Blade' }),
    node({ status: 'ignored', duration: '03:00:00', whereToWatch: 'Netflix' }),
  ]);

  it('sums up the titles that are not skipped', () => {
    expect(stats.all).toEqual({ count: 6, minutes: 760 });
    expect(stats.watched).toEqual({ count: 1, minutes: 120 });
    expect(stats.left).toEqual({ count: 5, minutes: 640 });
    expect(stats.withoutDuration.map(title => title.name)).toEqual(['Blade']);
    expect(stats.byStatus.ignored).toEqual({ count: 1, minutes: 180 });
    expect(stats.byType.series).toEqual({
      watched: { count: 0, minutes: 0 },
      all: { count: 1, minutes: 330 },
    });
  });

  it('groups the titles that are left by where to watch them', () => {
    expect(stats.sources).toEqual([
      { name: 'Disney+', count: 2, minutes: 390 },
      { name: 'Kaufen: Apple TV', count: 2, minutes: 250, price: 14.98 },
      { name: '', count: 1, minutes: 0 },
    ]);
  });
});
