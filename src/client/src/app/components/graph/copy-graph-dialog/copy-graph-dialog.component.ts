import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiGraph } from '../../../api/models';
import { GraphsService } from '../../../api/services';
import { TranslateService } from '../../../i18n/translate.service';
import { DialogComponent } from '../../ui/dialog/dialog.component';

/** Copies the whole graph to a new graph and opens it. */
@Component({
  selector: 'app-copy-graph-dialog',
  imports: [DialogComponent],
  templateUrl: './copy-graph-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyGraphDialogComponent {
  private readonly _graphsService = inject(GraphsService);
  private readonly _router = inject(Router);
  protected readonly translate = inject(TranslateService);

  public readonly graph = input.required<ApiGraph>();

  protected readonly visible = signal(false);
  protected readonly name = signal('');
  protected readonly resetStatus = signal(true);
  protected readonly submitted = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly hasFailed = signal(false);

  public open() {
    this.name.set(this.translate.translations.copyGraph_defaultName({ name: this.graph().name }));
    this.resetStatus.set(true);
    this.submitted.set(false);
    this.hasFailed.set(false);
    this.visible.set(true);
  }

  protected async submit() {
    this.submitted.set(true);
    const name = this.name().trim();
    if (!name || this.isLoading()) return;

    this.isLoading.set(true);
    this.hasFailed.set(false);
    try {
      const response = await this._graphsService.copyGraph({
        graphId: this.graph().id,
        body: { name, resetStatus: this.resetStatus() },
      });
      const copy = response.ok ? response.body?.graph : undefined;
      if (!copy) {
        this.hasFailed.set(true);
        return;
      }
      this.visible.set(false);
      await this._router.navigate(['/graph', copy.id]);
    } catch {
      this.hasFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
