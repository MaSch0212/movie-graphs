import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslateService } from '../../../i18n/translate.service';
import { ThemeService } from '../../../theme/theme.service';
import { MenuComponent } from '../menu/menu.component';
import { currentThemeName, ThemeOptionsComponent } from './theme-options.component';

/** Dropdown to choose light or dark mode: "System" or a fixed one. */
@Component({
  selector: 'app-theme-switcher',
  imports: [MenuComponent, ThemeOptionsComponent],
  template: `
    <app-menu
      icon="icon-[mdi--theme-light-dark]"
      [label]="translate.translations.theme_title() + ': ' + currentName()"
      [text]="currentName()"
      [placement]="placement()"
      [align]="align()">
      <app-theme-options />
    </app-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSwitcherComponent {
  protected readonly translate = inject(TranslateService);
  private readonly _theme = inject(ThemeService);

  /** Whether the menu opens below or above the button. */
  public readonly placement = input<'below' | 'above'>('below');
  /** How the menu is aligned to the button horizontally. */
  public readonly align = input<'end' | 'center'>('end');

  protected readonly currentName = computed(() => currentThemeName(this.translate, this._theme));
}
