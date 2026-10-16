import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

/**
 * A dropdown menu with a trigger button. Items are projected and need `role="menuitem"` or
 * `role="menuitemradio"` (use the `menu-item` class for the styling). Clicking an item closes the
 * menu unless it has the `data-keep-open` attribute.
 */
@Component({
  selector: 'app-menu',
  template: `
    <div class="relative" (focusout)="onFocusOut($event)" (keydown.escape)="close(true)">
      <button
        #trigger
        type="button"
        class="btn btn-ghost"
        [class.btn-icon]="!text()"
        [class.px-3]="!!text()"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="label()"
        [title]="label()"
        (click)="toggle()"
        (keydown.arrowDown)="$event.preventDefault(); openAndFocus('first')"
        (keydown.arrowUp)="$event.preventDefault(); openAndFocus('last')">
        <span class="text-lg" [class]="icon()"></span>
        @if (text(); as text) {
          <span>{{ text }}</span>
          <span class="icon-[mdi--chevron-down] text-base"></span>
        }
      </button>

      @if (open()) {
        <div
          #panel
          role="menu"
          class="glass absolute z-20 min-w-56 rounded-2xl bg-surface-raised p-1.5"
          [class]="placement() === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'"
          [class.right-0]="align() === 'end'"
          [class.left-1/2]="align() === 'center'"
          [class.-translate-x-1/2]="align() === 'center'"
          [attr.aria-label]="label()"
          (keydown)="onMenuKeyDown($event)"
          (click)="onMenuClick($event)">
          <ng-content />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'onDocumentPointerDown($event)' },
})
export class MenuComponent {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly _panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Accessible name and tooltip of the trigger button. */
  public readonly label = input.required<string>();
  /** Icon class of the trigger button, e.g. `icon-[mdi--dots-vertical]`. */
  public readonly icon = input.required<string>();
  /** Optional visible text next to the icon. */
  public readonly text = input<string>();
  /** Whether the menu opens below or above the button. */
  public readonly placement = input<'below' | 'above'>('below');
  /** How the menu is aligned to the button horizontally. */
  public readonly align = input<'end' | 'center'>('end');

  protected readonly open = signal(false);

  /** Emits when the menu is opened or closed. */
  public readonly openChange = output<boolean>();

  public close(focusTrigger = false) {
    if (!this.open()) return;
    this.open.set(false);
    this.openChange.emit(false);
    if (focusTrigger) this._trigger().nativeElement.focus();
  }

  protected toggle() {
    if (this.open()) {
      this.close();
    } else {
      this.openAndFocus('checked');
    }
  }

  /** Focuses the first item, e.g. after the items changed (like when showing a sub menu). */
  public focusFirst() {
    requestAnimationFrame(() => this.items()[0]?.focus());
  }

  protected openAndFocus(target: 'first' | 'last' | 'checked') {
    if (!this.open()) {
      this.open.set(true);
      this.openChange.emit(true);
    }
    // The menu is rendered with the next change detection.
    requestAnimationFrame(() => {
      const items = this.items();
      const item =
        target === 'last'
          ? items.at(-1)
          : target === 'checked'
            ? (items.find(x => x.getAttribute('aria-checked') === 'true') ?? items[0])
            : items[0];
      item?.focus();
    });
  }

  protected onMenuClick(event: MouseEvent) {
    const item = (event.target as HTMLElement).closest(ITEM_SELECTOR);
    if (item && !item.hasAttribute('data-keep-open')) this.close(true);
  }

  protected onMenuKeyDown(event: KeyboardEvent) {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focus(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focus(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focus(0);
        break;
      case 'End':
        event.preventDefault();
        focus(items.length - 1);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  // Safari doesn't focus buttons when they are tapped, so focus alone can't detect outside taps.
  protected onDocumentPointerDown(event: PointerEvent) {
    if (this.open() && !this._host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onFocusOut(event: FocusEvent) {
    const container = event.currentTarget as HTMLElement;
    if (!container.contains(event.relatedTarget as Node | null)) {
      this.close();
    }
  }

  private items(): HTMLElement[] {
    return [...(this._panel()?.nativeElement.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];
  }
}
