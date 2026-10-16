import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { ApiGraphNode, ApiGraphNodeStatus } from '../../../api/models';
import { TranslateService } from '../../../i18n/translate.service';
import { formatMinutes } from '../../../utils/duration';
import { fullTitle } from '../../../utils/node-title';
import { DialogComponent } from '../../ui/dialog/dialog.component';
import { graphStats, TitleTotals } from '../graph-stats';

const STATUSES: { status: ApiGraphNodeStatus; color: string }[] = [
  { status: 'watched', color: 'bg-watched' },
  { status: 'watching', color: 'bg-watching' },
  { status: 'unwatched', color: 'bg-fg/25' },
  { status: 'ignored', color: 'bg-ignored' },
];

/** Statistics about the titles of the graph: how much is watched, what is left and where. */
@Component({
  selector: 'app-stats-dialog',
  imports: [DialogComponent],
  templateUrl: './stats-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDialogComponent {
  protected readonly translate = inject(TranslateService);

  public readonly nodes = input.required<readonly ApiGraphNode[]>();

  protected readonly byOptions = ['count', 'minutes'] as const;
  protected readonly visible = signal(false);
  protected readonly stats = computed(() => graphStats(this.nodes()));
  protected readonly statuses = computed(() => {
    const stats = this.stats();
    return STATUSES.map(({ status, color }) => ({ status, color, ...stats.byStatus[status] }));
  });
  protected readonly types = computed(() => {
    const { movie, series } = this.stats().byType;
    return [
      { type: 'movie', icon: 'icon-[mdi--movie-open-outline]', ...movie },
      { type: 'series', icon: 'icon-[mdi--television-classic]', ...series },
    ] as const;
  });

  public open() {
    this.visible.set(true);
  }

  protected duration(minutes: number) {
    return minutes ? formatMinutes(minutes, this.translate.translations) : '–';
  }

  /** Whole hours, for the large totals. */
  protected hours(minutes: number) {
    return this.translate.translations.duration_hours({ hours: Math.round(minutes / 60) });
  }

  protected statusColor(status: ApiGraphNodeStatus) {
    return STATUSES.find(entry => entry.status === status)?.color;
  }

  protected title(node: ApiGraphNode) {
    return fullTitle(node, this.translate.translations);
  }

  protected percent(part: TitleTotals, all: TitleTotals, by: keyof TitleTotals) {
    return all[by] ? Math.round((part[by] / all[by]) * 100) : 0;
  }

  protected price(price: number) {
    return new Intl.NumberFormat(this.translate.currentLanguage(), {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  }
}
