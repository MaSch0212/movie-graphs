import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { I18nService, LanguagePreference } from '../../../i18n/i18n.service';
import { LANGUAGE_NAMES, LANGUAGES } from '../../../i18n/translations';

/** The language choices ("System", English, Deutsch) as radio items for an `app-menu`. */
@Component({
  selector: 'app-language-options',
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="menuitemradio"
        class="menu-item"
        [attr.aria-checked]="option.value === i18n.preference()"
        [attr.lang]="option.lang"
        (click)="i18n.setPreference(option.value)">
        <span
          class="icon-[mdi--check] text-accent"
          [class.invisible]="option.value !== i18n.preference()"></span>
        {{ option.label }}
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class LanguageOptionsComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly options = computed(() => [
    {
      value: 'system' as LanguagePreference,
      label: systemLabel(this.i18n),
      lang: undefined as string | undefined,
    },
    ...LANGUAGES.map(language => ({
      value: language as LanguagePreference,
      label: LANGUAGE_NAMES[language],
      lang: language as string | undefined,
    })),
  ]);
}

/** "System (Deutsch)": the system option including the language it currently resolves to. */
export function systemLabel(i18n: I18nService) {
  return `${i18n.t().common.systemLanguage} (${LANGUAGE_NAMES[i18n.systemLanguage]})`;
}

/** The name of the current language preference, e.g. "Deutsch" or "System (English)". */
export function currentLanguageName(i18n: I18nService) {
  const preference = i18n.preference();
  return preference === 'system' ? systemLabel(i18n) : LANGUAGE_NAMES[preference];
}
