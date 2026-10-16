import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { TranslateService } from '../../../i18n/translate.service';
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
      @if (request()?.confirmText; as confirmText) {
        <form id="confirm-form" class="pt-4 pb-3" (submit)="$event.preventDefault(); confirm()">
          <!-- Not uppercase like other labels, the text has to be typed exactly. -->
          <label for="confirmText" class="mb-1.5 block text-sm text-muted">
            {{ typeToConfirm()[0] }}
            <strong class="font-semibold text-fg select-all">{{ confirmText }}</strong>
            {{ typeToConfirm()[1] }}
          </label>
          <input
            id="confirmText"
            type="text"
            class="input"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [value]="typedText()"
            (input)="typedText.set($any($event.target).value)" />
        </form>
      }
      <ng-container dialogFooter>
        <div class="grow"></div>
        <button type="button" class="btn btn-ghost" (click)="confirmService.resolve(false)">
          {{ translate.translations.common_cancel() }}
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-primary]="!request()?.destructive"
          [class.bg-danger]="request()?.destructive"
          [class.text-white]="request()?.destructive"
          [disabled]="!canConfirm()"
          (click)="confirm()">
          {{ request()?.confirmLabel ?? translate.translations.common_confirm() }}
        </button>
      </ng-container>
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly confirmService = inject(ConfirmService);
  protected readonly translate = inject(TranslateService);
  protected readonly request = computed(() => this.confirmService.pending());
  protected readonly typedText = signal('');
  /** The instruction before and after the text that has to be typed. */
  protected readonly typeToConfirm = computed(() =>
    this.translate.translations.common_typeToConfirm().split(/{{\s*text\s*}}/)
  );
  protected readonly canConfirm = computed(() => {
    const confirmText = this.request()?.confirmText;
    return !confirmText || this.typedText().trim() === confirmText.trim();
  });

  constructor() {
    effect(() => {
      this.request();
      this.typedText.set('');
    });
  }

  protected confirm() {
    if (this.canConfirm()) this.confirmService.resolve(true);
  }
}
