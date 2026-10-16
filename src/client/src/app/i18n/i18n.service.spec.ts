import { TestBed } from '@angular/core/testing';

import { I18nService } from './i18n.service';
import { TRANSLATIONS, Translations } from './translations';

function createService(browserLanguages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(browserLanguages);
  TestBed.resetTestingModule();
  return TestBed.inject(I18nService);
}

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('follows the browser language by default', () => {
    const service = createService(['de-DE', 'en-US']);
    expect(service.preference()).toBe('system');
    expect(service.language()).toBe('de');
    expect(service.t().common.save).toBe('Speichern');
  });

  it('uses the first supported browser language and falls back to English', () => {
    expect(createService(['fr-FR', 'de-AT']).language()).toBe('de');
    expect(createService(['fr-FR', 'es']).language()).toBe('en');
  });

  it('remembers a chosen language and can go back to the system language', () => {
    const service = createService(['de-DE']);
    service.setPreference('en');
    expect(service.language()).toBe('en');
    expect(createService(['de-DE']).language()).toBe('en');

    service.setPreference('system');
    expect(createService(['de-DE']).language()).toBe('de');
  });

  it('sets the document language', () => {
    const service = createService(['en-US']);
    service.setPreference('de');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('de');
  });
});

describe('translations', () => {
  const collect = (value: unknown, path = ''): [string, unknown][] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => collect(child, `${path}.${key}`))
      : [[path, value]];

  it.each(Object.keys(TRANSLATIONS) as (keyof typeof TRANSLATIONS)[])(
    'has a non-empty text for every key in "%s"',
    language => {
      const translations: Translations = TRANSLATIONS[language];
      for (const [key, value] of collect(translations)) {
        const text = typeof value === 'function' ? value('X', 1) : value;
        expect(typeof text, key).toBe('string');
        expect((text as string).trim().length, key).toBeGreaterThan(0);
      }
    }
  );
});
