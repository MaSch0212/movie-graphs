import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { I18nService } from '../../../i18n/i18n.service';
import { DialogComponent } from '../dialog/dialog.component';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [DialogComponent],
  template: `
    <app-dialog
      [open]="!!request()"
      (openChange)="!$event && confirmService.resolve(false)"
      [title]="request()?.title ?? ''">
      <p class="text-muted">{{ request()?.message }}</p>
      <ng-container dialogFooter>
        <div class="grow"></div>
        <button type="button" class="btn btn-ghost" (click)="confirmService.resolve(false)">
          {{ i18n.t().common.cancel }}
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-primary]="!request()?.destructive"
          [class.bg-danger]="request()?.destructive"
          [class.text-white]="request()?.destructive"
          (click)="confirmService.resolve(true)">
          {{ request()?.confirmLabel ?? i18n.t().common.confirm }}
        </button>
      </ng-container>
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly confirmService = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly request = computed(() => this.confirmService.pending());
}
