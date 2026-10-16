import { TestBed } from '@angular/core/testing';

import { TranslateService } from '../i18n/translate.service';
import { formatDuration, formatMinutes } from './duration';

// Wrapped: the translations proxy has every property, also `then`, so awaiting it would hang.
async function translations(language: 'en' | 'de') {
  localStorage.setItem('language', language);
  TestBed.resetTestingModule();
  const service = TestBed.inject(TranslateService);
  TestBed.tick();
  await Promise.resolve();
  return { t: service.translations };
}

describe('durations', () => {
  afterEach(() => localStorage.clear());

  it('shows hours and minutes', async () => {
    const { t } = await translations('en');
    expect(formatMinutes(132, t)).toBe('2 h 12 min');
    expect(formatMinutes(45, t)).toBe('45 min');
    expect(formatMinutes(960, t)).toBe('16 h');
    expect(formatDuration('13:42:00', t)).toBe('13 h 42 min');
    expect(formatDuration(null, t)).toBe('');
  });

  it('uses the language of the app', async () => {
    expect(formatMinutes(132, (await translations('de')).t)).toBe('2 Std. 12 Min.');
  });
});
