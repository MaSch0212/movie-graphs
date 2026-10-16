import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { Language, LANGUAGES, TRANSLATIONS } from './translations';

/** The language chosen by the user: a fixed language or the one of the browser/system. */
export type LanguagePreference = Language | 'system';

const STORAGE_KEY = 'language';

/**
 * Provides the texts of the app in the selected language. By default the language follows the
 * browser language; it can be changed at runtime and the choice is remembered on this device.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _document = inject(DOCUMENT);
  private readonly _preference = signal<LanguagePreference>(this.storedPreference());

  /** The language of the browser (falls back to English if it is not supported). */
  public readonly systemLanguage: Language = this.detectSystemLanguage();
  public readonly preference = this._preference.asReadonly();
  public readonly language = computed(() => {
    const preference = this._preference();
    return preference === 'system' ? this.systemLanguage : preference;
  });
  /** The texts in the current language, e.g. `i18n.t().home.tagline`. */
  public readonly t = computed(() => TRANSLATIONS[this.language()]);

  constructor() {
    effect(() => {
      this._document.documentElement.lang = this.language();
    });
  }

  public setPreference(preference: LanguagePreference) {
    this._preference.set(preference);
    try {
      if (preference === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      // Storage may be unavailable (e.g. private mode); the choice is then not remembered.
    }
  }

  private storedPreference(): LanguagePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) return stored;
    } catch {
      // See above.
    }
    return 'system';
  }

  private detectSystemLanguage(): Language {
    const preferred = this._document.defaultView?.navigator.languages ?? [];
    for (const tag of preferred) {
      const language = tag.toLowerCase().split('-')[0];
      if (isLanguage(language)) return language;
    }
    return 'en';
  }
}

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}
