import type { TranslationsSignal } from '@ngneers/signal-translate';

import { ApiGraphNode } from '../api/models';
import type { Translations } from '../i18n/translate.service';

type TitleTranslations = TranslationsSignal<Translations, '_'>;
type TitleParts = Pick<
  ApiGraphNode,
  'name' | 'shortName' | 'type' | 'year' | 'season' | 'episodeFrom' | 'episodeTo'
>;

/**
 * Season and episodes of a series, e.g. "Season 1, Episodes 1–7" or (short) "S1 · E1–7".
 * Empty for movies.
 */
export function episodeInfo(node: TitleParts, t: TitleTranslations, short = false) {
  if (node.type !== 'series') return '';
  const parts: string[] = [];
  if (node.season != null) {
    parts.push((short ? t.title_seasonShort : t.title_season)({ season: node.season }));
  }
  if (node.episodeFrom != null) {
    const params = { from: node.episodeFrom, to: node.episodeTo };
    parts.push(
      node.episodeTo != null && node.episodeTo !== node.episodeFrom
        ? (short ? t.title_episodesShort : t.title_episodes)(params)
        : (short ? t.title_episodeShort : t.title_episode)(params)
    );
  }
  return parts.join(short ? ' · ' : ', ');
}

/** Everything that identifies a title, e.g. "Agents of S.H.I.E.L.D. – Season 1, Episodes 1–7 (2013)". */
export function fullTitle(node: TitleParts, t: TitleTranslations) {
  const episodes = episodeInfo(node, t);
  return `${node.name}${episodes ? ` – ${episodes}` : ''}${node.year ? ` (${node.year})` : ''}`;
}

/** The title for places with little space: the short title if there is one. */
export function shortTitle(node: TitleParts) {
  return node.shortName?.trim() || node.name;
}

/** What a poster shows when titles are shown: the (short) title and season / episodes. */
export function posterTitle(node: TitleParts, t: TitleTranslations) {
  return { title: shortTitle(node), episodes: episodeInfo(node, t, true) };
}
