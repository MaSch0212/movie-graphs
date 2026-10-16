import type { TranslationsSignal } from '@ngneers/signal-translate';

import type { Translations } from '../i18n/translate.service';
import { fromTimeSpan } from './time-span';

type DurationTranslations = TranslationsSignal<Translations, '_'>;

/** A duration for people, e.g. "2 h 12 min", "45 min" or "16 h". */
export function formatMinutes(totalMinutes: number, t: DurationTranslations) {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t.duration_minutes({ minutes: rest });
  if (!rest) return t.duration_hours({ hours });
  return t.duration_hoursMinutes({ hours, minutes: rest });
}

/** The duration of a title for people, or '' if it has none. */
export function formatDuration(duration: string | null | undefined, t: DurationTranslations) {
  return duration ? formatMinutes(fromTimeSpan(duration), t) : '';
}
