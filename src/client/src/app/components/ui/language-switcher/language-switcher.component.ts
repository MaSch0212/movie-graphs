import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslateService } from '../../../i18n/translate.service';
import { MenuComponent } from '../menu/menu.component';
import { currentLanguageName, LanguageOptionsComponent } from './language-options.component';

/** Dropdown to choose the language of the app: "System" (the browser language) or a fixed one. */
@Component({
  selector: 'app-language-switcher',
  imports: [LanguageOptionsComponent, MenuComponent],
  template: `
    <app-menu
      icon="icon-[mdi--translate]"
      [label]="translate.translations.common_language() + ': ' + currentName()"
      [text]="currentName()"
      [placement]="placement()"
      [align]="align()">
      <app-language-options />
    </app-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent {
  protected readonly translate = inject(TranslateService);

  /** Whether the menu opens below or above the button. */
  public readonly placement = input<'below' | 'above'>('below');
  /** How the menu is aligned to the button horizontally. */
  public readonly align = input<'end' | 'center'>('end');

  protected readonly currentName = computed(() => currentLanguageName(this.translate));
}
