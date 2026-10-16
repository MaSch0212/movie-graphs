import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../i18n/i18n.service';
import { MenuComponent } from '../menu/menu.component';
import { currentLanguageName, LanguageOptionsComponent } from './language-options.component';

/** Dropdown to choose the language of the app: "System" (the browser language) or a fixed one. */
@Component({
  selector: 'app-language-switcher',
  imports: [LanguageOptionsComponent, MenuComponent],
  template: `
    <app-menu
      icon="icon-[mdi--translate]"
      [label]="i18n.t().common.language + ': ' + currentName()"
      [text]="currentName()"
      [placement]="placement()"
      [align]="align()">
      <app-language-options />
    </app-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent {
  protected readonly i18n = inject(I18nService);

  /** Whether the menu opens below or above the button. */
  public readonly placement = input<'below' | 'above'>('below');
  /** How the menu is aligned to the button horizontally. */
  public readonly align = input<'end' | 'center'>('end');

  protected readonly currentName = computed(() => currentLanguageName(this.i18n));
}
