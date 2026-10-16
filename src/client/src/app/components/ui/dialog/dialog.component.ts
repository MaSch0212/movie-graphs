import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';

import { I18nService } from '../../../i18n/i18n.service';

/**
 * A modal dialog based on the native `<dialog>` element. It is centered on larger screens and
 * shown as a bottom sheet on small screens. Content for the footer can be projected using the
 * `dialogFooter` attribute.
 */
@Component({
  selector: 'app-dialog',
  template: `
    <dialog
      #dialog
      class="glass m-auto w-[min(32rem,calc(100vw-2rem))] max-w-none overflow-visible rounded-3xl bg-surface-raised p-0 text-fg opacity-100 transition-all transition-discrete duration-200 ease-out backdrop:bg-black/40 backdrop:backdrop-blur-sm backdrop:transition-all backdrop:transition-discrete backdrop:duration-200 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] starting:open:translate-y-4 starting:open:opacity-0 starting:open:backdrop:bg-transparent max-sm:starting:open:translate-y-full"
      [attr.aria-label]="title()"
      (close)="open.set(false)"
      (click)="onDialogClick($event)">
      <div class="flex max-h-[min(85dvh,48rem)] flex-col">
        <header class="flex items-center gap-2 px-6 pt-5 pb-3">
          <h2 class="grow text-lg font-semibold">{{ title() }}</h2>
          <button
            type="button"
            class="btn btn-ghost btn-icon -mr-2 size-9 text-lg text-muted"
            [attr.aria-label]="i18n.t().common.close"
            (click)="open.set(false)">
            <span class="icon-[mdi--close]"></span>
          </button>
        </header>
        <div class="min-h-0 grow overflow-y-auto px-6 pb-2">
          <ng-content />
        </div>
        <footer class="flex items-center gap-2 border-t border-line px-6 py-4">
          <ng-content select="[dialogFooter]" />
        </footer>
      </div>
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  private readonly _dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly i18n = inject(I18nService);

  public readonly open = model(false);
  public readonly title = input('');

  constructor() {
    effect(() => {
      const dialog = this._dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected onDialogClick(event: MouseEvent) {
    // Clicks on the backdrop are reported with the dialog element itself as the target.
    if (event.target === this._dialog().nativeElement) {
      this.open.set(false);
    }
  }
}
