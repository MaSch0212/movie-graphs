import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TranslateService } from '../../../i18n/translate.service';
import { Theme, THEMES, ThemeService } from '../../../theme/theme.service';

const ICONS: Record<Theme, string> = {
  light: 'icon-[mdi--white-balance-sunny]',
  dark: 'icon-[mdi--weather-night]',
};

/** The theme choices ("System", Light, Dark) as radio items for an `app-menu`. */
@Component({
  selector: 'app-theme-options',
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="menuitemradio"
        class="menu-item"
        [attr.aria-checked]="option.value === theme.choice()"
        (click)="theme.setTheme(option.value)">
        <span
          class="icon-[mdi--check] text-accent"
          [class.invisible]="option.value !== theme.choice()"></span>
        <span class="grow">{{ option.label }}</span>
        <span class="text-muted" [class]="option.icon"></span>
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ThemeOptionsComponent {
  private readonly _translate = inject(TranslateService);
  protected readonly theme = inject(ThemeService);

  protected readonly options = computed(() => {
    const t = this._translate.translations;
    return [
      {
        value: null as Theme | null,
        label: systemThemeLabel(this._translate, this.theme),
        icon: 'icon-[mdi--theme-light-dark]',
      },
      ...THEMES.map(value => ({
        value: value as Theme | null,
        label: t[`theme_${value}`](),
        icon: ICONS[value],
      })),
    ];
  });
}

/** "System (Dark)": the system option including the theme it currently resolves to. */
export function systemThemeLabel(translate: TranslateService, theme: ThemeService) {
  const t = translate.translations;
  return `${t.theme_system()} (${t[`theme_${theme.systemTheme()}`]()})`;
}

/** The name of the current theme choice, e.g. "Dark" or "System (Light)". */
export function currentThemeName(translate: TranslateService, theme: ThemeService) {
  const choice = theme.choice();
  return choice ? translate.translations[`theme_${choice}`]() : systemThemeLabel(translate, theme);
}
