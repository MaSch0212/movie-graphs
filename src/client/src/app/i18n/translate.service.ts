import { computed, Injectable, signal } from '@angular/core';
import { BaseTranslateService } from '@ngneers/signal-translate';

import de from './de.json';
import en from './en.json';

export type Translations = typeof en;

export const LANGUAGES = ['en', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
};

// Typed, so a missing German text is a compile error.
const TRANSLATIONS: Record<Language, Translations> = { en, de };

const STORAGE_KEY = 'language';

/**
 * Provides the texts of the app in the selected language, e.g. `translations.home_tagline()`.
 * By default the language follows the browser; a fixed choice is remembered on this device.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService extends BaseTranslateService<Translations> {
  /** The first supported of the browser's preferred languages (not only the first one). */
  protected override readonly browserLanguage = preferredLanguage();
  private readonly _choice = signal<Language | null>(storedLanguage());

  /** The fixed language chosen by the user, or `null` to follow the browser. */
  public readonly choice = this._choice.asReadonly();
  /** The language the browser resolves to (English if it is not supported). */
  public readonly systemLanguage = resolveLanguage(this.browserLanguage);
  /** The language the texts are currently shown in. */
  public readonly currentLanguage = computed(() => this._choice() ?? this.systemLanguage);

  constructor() {
    // Both languages are bundled (they are small), so no untranslated keys flash up on start.
    super(LANGUAGES, storedLanguage());
  }

  /** Switches to a fixed language, or back to the browser language with `null`. */
  public override setLanguage(language: Language | null) {
    super.setLanguage(language);
    this._choice.set(language);
    try {
      if (language) {
        localStorage.setItem(STORAGE_KEY, language);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable (e.g. private mode); the choice is then not remembered.
    }
  }

  protected loadTranslations(language: string): Promise<Translations> {
    return Promise.resolve(TRANSLATIONS[resolveLanguage(language)]);
  }
}

function preferredLanguage(): string {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.find(tag => resolveTag(tag)) ?? preferred[0] ?? LANGUAGES[0];
}

function storedLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** A supported language for a language tag like "de-AT", the same way the base service does. */
function resolveLanguage(tag: string): Language {
  return resolveTag(tag) ?? LANGUAGES[0];
}

function resolveTag(tag: string): Language | undefined {
  const language = tag.toLowerCase();
  if (isLanguage(language)) return language;
  const parent = language.split('-')[0];
  return isLanguage(parent) ? parent : undefined;
}

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}
