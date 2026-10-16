import { computed, effect, Injectable, signal } from '@angular/core';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Read before the app starts by the script in index.html, so the page doesn't flash. */
const STORAGE_KEY = 'theme';

/** Color of the browser's bars (see the theme-color meta tags in index.html). */
const BAR_COLORS: Record<Theme, string> = { light: '#f6f6fa', dark: '#141419' };

/**
 * Light or dark mode. By default it follows the system; a fixed choice is remembered on this
 * device. The choice is applied as `data-theme` on the root element (see styles.css).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _darkQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly _choice = signal<Theme | null>(storedTheme());
  private readonly _systemTheme = signal<Theme>(this._darkQuery.matches ? 'dark' : 'light');

  /** The fixed theme chosen by the user, or `null` to follow the system. */
  public readonly choice = this._choice.asReadonly();
  /** The theme of the system. */
  public readonly systemTheme = this._systemTheme.asReadonly();
  /** The theme the app is currently shown in. */
  public readonly currentTheme = computed(() => this._choice() ?? this._systemTheme());

  constructor() {
    this._darkQuery.addEventListener('change', event =>
      this._systemTheme.set(event.matches ? 'dark' : 'light')
    );

    effect(() => {
      const choice = this._choice();
      const root = document.documentElement;
      if (choice) {
        root.dataset['theme'] = choice;
      } else {
        delete root.dataset['theme'];
      }
      // The meta tags pick their color by the system theme, which a fixed choice overrides.
      for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
        meta.dataset['system'] ??= meta.content;
        meta.content = choice ? BAR_COLORS[choice] : meta.dataset['system'];
      }
    });
  }

  /** Switches to a fixed theme, or back to the system theme with `null`. */
  public setTheme(theme: Theme | null) {
    this._choice.set(theme);
    try {
      if (theme) {
        localStorage.setItem(STORAGE_KEY, theme);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable (e.g. private mode); the choice is then not remembered.
    }
  }
}

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored as Theme) ? (stored as Theme) : null;
  } catch {
    return null;
  }
}
