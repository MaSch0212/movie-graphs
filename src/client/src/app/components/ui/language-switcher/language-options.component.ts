import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import {
  Language,
  LANGUAGE_NAMES,
  LANGUAGES,
  TranslateService,
} from '../../../i18n/translate.service';

/** The language choices ("System", English, Deutsch) as radio items for an `app-menu`. */
@Component({
  selector: 'app-language-options',
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="menuitemradio"
        class="menu-item"
        [attr.aria-checked]="option.value === translate.choice()"
        [attr.lang]="option.value"
        (click)="translate.setLanguage(option.value)">
        <span
          class="icon-[mdi--check] text-accent"
          [class.invisible]="option.value !== translate.choice()"></span>
        {{ option.label }}
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class LanguageOptionsComponent {
  protected readonly translate = inject(TranslateService);

  protected readonly options = computed(() => [
    { value: null as Language | null, label: systemLabel(this.translate) },
    ...LANGUAGES.map(language => ({
      value: language as Language | null,
      label: LANGUAGE_NAMES[language],
    })),
  ]);
}

/** "System (Deutsch)": the system option including the language it currently resolves to. */
export function systemLabel(translate: TranslateService) {
  return `${translate.translations.common_systemLanguage()} (${LANGUAGE_NAMES[translate.systemLanguage]})`;
}

/** The name of the current language choice, e.g. "Deutsch" or "System (English)". */
export function currentLanguageName(translate: TranslateService) {
  const choice = translate.choice();
  return choice ? LANGUAGE_NAMES[choice] : systemLabel(translate);
}
