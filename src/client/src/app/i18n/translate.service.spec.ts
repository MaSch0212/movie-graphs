import { TestBed } from '@angular/core/testing';

import de from './de.json';
import en from './en.json';
import { TranslateService } from './translate.service';

/** Creates the service and waits until the translations of its language are loaded. */
async function createService(browserLanguages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(browserLanguages);
  TestBed.resetTestingModule();
  const service = TestBed.inject(TranslateService);
  await settle();
  return service;
}

async function settle() {
  TestBed.tick();
  await Promise.resolve();
}

describe('TranslateService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('follows the browser language by default', async () => {
    const service = await createService(['de-DE', 'en-US']);
    expect(service.choice()).toBeNull();
    expect(service.currentLanguage()).toBe('de');
    expect(service.translations.common_save()).toBe('Speichern');
  });

  it('uses the first supported browser language and falls back to English', async () => {
    expect((await createService(['fr-FR', 'de-AT'])).currentLanguage()).toBe('de');
    const fallback = await createService(['fr-FR', 'es']);
    expect(fallback.currentLanguage()).toBe('en');
    expect(fallback.translations.common_save()).toBe('Save');
  });

  it('remembers a chosen language and can go back to the browser language', async () => {
    const service = await createService(['de-DE']);
    service.setLanguage('en');
    await settle();
    expect(service.translations.common_save()).toBe('Save');
    expect((await createService(['de-DE'])).currentLanguage()).toBe('en');

    service.setLanguage(null);
    expect((await createService(['de-DE'])).currentLanguage()).toBe('de');
  });

  it('interpolates parameters', async () => {
    const service = await createService(['en-US']);
    expect(service.translations.graph_watchedCount({ watched: 3, total: 10 })).toBe(
      '3 / 10 watched'
    );
    expect(service.translations.status_ignored()).toBe('Skip');
  });

  it('sets the document language', async () => {
    const service = await createService(['en-US']);
    service.setLanguage('de');
    await settle();
    expect(document.documentElement.lang).toBe('de');
  });
});

describe('translations', () => {
  const collect = (value: unknown, path = ''): [string, unknown][] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => collect(child, `${path}.${key}`))
      : [[path, value]];
  const placeholders = (text: unknown) =>
    String(text)
      .match(/{{\s*\w+\s*}}/g)
      ?.sort() ?? [];

  it.each([
    ['en', en],
    ['de', de],
  ])('has a non-empty text for every key in "%s"', (_, translations) => {
    for (const [key, value] of collect(translations)) {
      expect(typeof value, key).toBe('string');
      expect(String(value).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('uses the same placeholders in every language', () => {
    const german = new Map(collect(de));
    for (const [key, value] of collect(en)) {
      expect(placeholders(german.get(key)), key).toEqual(placeholders(value));
    }
  });
});
