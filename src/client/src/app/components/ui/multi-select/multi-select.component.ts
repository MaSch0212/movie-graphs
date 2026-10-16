import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * A searchable multi-select. Selected options are shown as removable chips; the option list
 * expands inline below the search field so it never gets clipped by scrolling containers.
 */
@Component({
  selector: 'app-multi-select',
  template: `
    <div
      class="rounded-xl border border-line bg-surface-raised transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/20"
      (focusout)="onFocusOut($event)">
      <div class="flex flex-wrap items-center gap-1.5 p-1.5">
        @for (option of selected(); track optionKey()(option)) {
          <span
            class="inline-flex max-w-full items-center gap-1 rounded-lg bg-accent/15 py-1 pr-1 pl-2.5 text-sm text-fg">
            <span class="truncate">{{ optionLabel()(option) }}</span>
            <button
              type="button"
              class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-fg/10 hover:text-fg"
              [attr.aria-label]="'Remove ' + optionLabel()(option)"
              [disabled]="disabled()"
              (click)="toggle(option)">
              <span class="icon-[mdi--close] text-xs"></span>
            </button>
          </span>
        }
        <input
          #searchInput
          type="text"
          role="combobox"
          autocomplete="off"
          class="h-8 min-w-32 flex-1 bg-transparent px-2 text-fg outline-none placeholder:text-muted/70"
          [id]="inputId()"
          [placeholder]="selected().length === 0 ? placeholder() : ''"
          [disabled]="disabled()"
          [value]="query()"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="listId()"
          [attr.aria-activedescendant]="expanded() ? optionId(activeIndex()) : null"
          (input)="onQueryInput($event)"
          (focus)="expanded.set(true)"
          (click)="expanded.set(true)"
          (keydown)="onKeyDown($event)" />
      </div>

      @if (expanded()) {
        <ul
          role="listbox"
          aria-multiselectable="true"
          class="max-h-56 overflow-y-auto overscroll-contain border-t border-line p-1.5"
          [id]="listId()"
          (mousedown)="$event.preventDefault()">
          @for (option of filteredOptions(); track optionKey()(option); let i = $index) {
            <li
              role="option"
              class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm"
              [id]="optionId(i)"
              [class.bg-fg/8]="i === activeIndex()"
              [attr.aria-selected]="isSelected(option)"
              (mouseenter)="activeIndex.set(i)"
              (click)="toggle(option)">
              <span
                class="grid size-4.5 shrink-0 place-items-center rounded-md border transition"
                [class]="
                  isSelected(option)
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-line bg-canvas'
                ">
                @if (isSelected(option)) {
                  <span class="icon-[mdi--check-bold] text-xs"></span>
                }
              </span>
              <span class="truncate">{{ optionLabel()(option) }}</span>
            </li>
          } @empty {
            <li class="px-2.5 py-2 text-sm text-muted">No matches</li>
          }
        </ul>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiSelectComponent<T> implements ControlValueAccessor {
  private readonly _searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  public readonly options = input.required<readonly T[]>();
  public readonly optionLabel = input.required<(option: T) => string>();
  public readonly optionKey = input.required<(option: T) => string>();
  public readonly placeholder = input('');
  public readonly inputId = input(`multi-select-${nextId++}`);

  protected readonly listId = computed(() => `${this.inputId()}-list`);
  protected readonly selected = signal<T[]>([]);
  protected readonly disabled = signal(false);
  protected readonly query = signal('');
  protected readonly expanded = signal(false);
  protected readonly activeIndex = signal(0);

  private readonly _selectedKeys = computed(
    () => new Set(this.selected().map(option => this.optionKey()(option)))
  );
  protected readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) return this.options();
    return this.options().filter(option =>
      this.optionLabel()(option).toLowerCase().includes(query)
    );
  });

  private _onChange: (value: T[]) => void = () => undefined;
  private _onTouched: () => void = () => undefined;

  public writeValue(value: T[] | null): void {
    this.selected.set(value ?? []);
  }
  public registerOnChange(fn: (value: T[]) => void): void {
    this._onChange = fn;
  }
  public registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }
  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected optionId(index: number) {
    return `${this.listId()}-${index}`;
  }

  protected isSelected(option: T) {
    return this._selectedKeys().has(this.optionKey()(option));
  }

  protected toggle(option: T) {
    const key = this.optionKey()(option);
    const selected = this.isSelected(option)
      ? this.selected().filter(x => this.optionKey()(x) !== key)
      : [...this.selected(), option];
    this.selected.set(selected);
    this._onChange(selected);
    this._searchInput().nativeElement.focus();
  }

  protected onQueryInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.expanded.set(true);
  }

  protected onKeyDown(event: KeyboardEvent) {
    const options = this.filteredOptions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.expanded.set(true);
        this.activeIndex.update(i => Math.min(i + 1, options.length - 1));
        this.scrollActiveIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, 0));
        this.scrollActiveIntoView();
        break;
      case 'Enter': {
        event.preventDefault();
        const option = options[this.activeIndex()];
        if (this.expanded() && option) this.toggle(option);
        break;
      }
      case 'Escape':
        if (this.expanded()) {
          // Only close the list, not the surrounding dialog.
          event.preventDefault();
          event.stopPropagation();
          this.expanded.set(false);
        }
        break;
      case 'Backspace': {
        const last = this.selected().at(-1);
        if (!this.query() && last) this.toggle(last);
        break;
      }
    }
  }

  protected onFocusOut(event: FocusEvent) {
    const host = event.currentTarget as HTMLElement;
    if (!host.contains(event.relatedTarget as Node | null)) {
      this.expanded.set(false);
      this.query.set('');
      this._onTouched();
    }
  }

  private scrollActiveIntoView() {
    queueMicrotask(() =>
      document
        .getElementById(this.optionId(this.activeIndex()))
        ?.scrollIntoView({ block: 'nearest' })
    );
  }
}
