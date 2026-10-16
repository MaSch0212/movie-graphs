import { TestBed } from '@angular/core/testing';

import { TranslateService } from '../i18n/translate.service';
import { episodeInfo, fullTitle, shortTitle } from './node-title';

const shield = {
  name: 'Agents of S.H.I.E.L.D.',
  type: 'series' as const,
  year: 2013,
  season: 1,
  episodeFrom: 1,
  episodeTo: 7,
};
const movie = {
  name: 'Shang-Chi and the Legend of the Ten Rings',
  shortName: 'Shang-Chi',
  type: 'movie' as const,
  year: 2021,
};

// Wrapped: the translations proxy has every property, also `then`, so awaiting it would hang.
async function translations(language: 'en' | 'de') {
  localStorage.setItem('language', language);
  TestBed.resetTestingModule();
  const service = TestBed.inject(TranslateService);
  TestBed.tick();
  await Promise.resolve();
  return { t: service.translations };
}

describe('node titles', () => {
  afterEach(() => localStorage.clear());

  it('describes seasons and episodes of series', async () => {
    const { t } = await translations('en');
    expect(episodeInfo(shield, t)).toBe('Season 1, Episodes 1–7');
    expect(episodeInfo(shield, t, true)).toBe('S1 · E1–7');
    expect(episodeInfo({ ...shield, episodeTo: null }, t)).toBe('Season 1, Episode 1');
    expect(episodeInfo({ ...shield, episodeFrom: null, episodeTo: null }, t, true)).toBe('S1');
    expect(episodeInfo(movie, t)).toBe('');
  });

  it('builds the full title in the current language', async () => {
    expect(fullTitle(shield, (await translations('en')).t)).toBe(
      'Agents of S.H.I.E.L.D. – Season 1, Episodes 1–7 (2013)'
    );
    expect(fullTitle(shield, (await translations('de')).t)).toBe(
      'Agents of S.H.I.E.L.D. – Staffel 1, Folgen 1–7 (2013)'
    );
    expect(fullTitle(movie, (await translations('en')).t)).toBe(
      'Shang-Chi and the Legend of the Ten Rings (2021)'
    );
  });

  it('prefers the short title where space is tight', () => {
    expect(shortTitle(movie)).toBe('Shang-Chi');
    expect(shortTitle({ ...movie, shortName: '  ' })).toBe(movie.name);
    expect(shortTitle(shield)).toBe(shield.name);
  });
});
