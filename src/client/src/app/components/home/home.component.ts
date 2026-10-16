import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { GraphsService } from '../../api/services';
import { environment } from '../../environments/environment';
import { TranslateService } from '../../i18n/translate.service';
import { forgetRecentGraph, getRecentGraphs } from '../../utils/recent-graphs';
import { LanguageSwitcherComponent } from '../ui/language-switcher/language-switcher.component';
import { ThemeSwitcherComponent } from '../ui/theme-switcher/theme-switcher.component';

@Component({
  selector: 'app-home',
  imports: [LanguageSwitcherComponent, RouterLink, ThemeSwitcherComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-full' },
})
export class HomeComponent {
  private readonly _router = inject(Router);
  private readonly _graphsService = inject(GraphsService);

  protected readonly translate = inject(TranslateService);
  protected readonly version = environment.version;
  protected readonly recentGraphs = signal(getRecentGraphs());
  protected readonly isCreating = signal(false);
  protected readonly createFailed = signal(false);

  protected async newGraph(name: string): Promise<void> {
    name = name.trim();
    if (!name) return;

    this.isCreating.set(true);
    this.createFailed.set(false);
    try {
      const response = await this._graphsService.createGraph({ body: { name } });
      if (response.ok && response.body?.graph) {
        await this._router.navigate(['/graph', response.body.graph.id]);
      } else {
        this.createFailed.set(true);
      }
    } finally {
      this.isCreating.set(false);
    }
  }

  protected openGraph(graphIdOrUrl: string): void {
    // Accept both a plain id and a pasted link to a graph.
    const graphId = graphIdOrUrl.trim().split('/graph/').at(-1)?.split(/[/?#]/)[0];
    if (graphId) {
      this._router.navigate(['/graph', graphId]);
    }
  }

  protected forget(id: string) {
    forgetRecentGraph(id);
    this.recentGraphs.set(getRecentGraphs());
  }
}
