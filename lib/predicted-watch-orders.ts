import { tmdbFetch, watchOrderEntryImage, watchOrderTitleDetails } from "./tmdb";
import type {
  Title,
  WatchOrderDetails,
  WatchOrderEntry,
  WatchOrderSummary,
} from "./types";

type SearchResult = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
};

type SearchPage = { results?: SearchResult[] };

type MovieDetails = SearchResult & {
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
  } | null;
};

type CollectionDetails = {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: SearchResult[];
};

type TvDetails = SearchResult & {
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  seasons?: {
    season_number: number;
    name?: string;
    overview?: string;
    air_date?: string | null;
    episode_count?: number;
    poster_path?: string | null;
  }[];
};

const ACCENTS = ["#7057e8", "#3e8ed0", "#24a48b", "#d66741", "#c95889", "#b38a35"];
const WEEK = 60 * 60 * 24 * 7;

function monthLabel() {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date());
}

function accentFor(id: number) {
  return ACCENTS[Math.abs(id) % ACCENTS.length];
}

function titleOf(item: SearchResult) {
  return item.title ?? item.name ?? item.original_title ?? item.original_name ?? "Unbekannter Titel";
}

function yearOf(item: SearchResult) {
  return (item.release_date ?? item.first_air_date ?? "").slice(0, 4) || "—";
}

function isAnime(item: SearchResult | TvDetails) {
  const genres = item.genre_ids ?? ("genres" in item ? item.genres?.map((genre) => genre.id) : []) ?? [];
  return genres.includes(16) && (item.original_language === "ja" || item.origin_country?.includes("JP"));
}

function sortByRelease<T extends SearchResult>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.release_date ?? left.first_air_date ?? "9999-12-31";
    const rightDate = right.release_date ?? right.first_air_date ?? "9999-12-31";
    return leftDate.localeCompare(rightDate) || left.id - right.id;
  });
}

function predictedBase(): Pick<WatchOrderSummary, "origin" | "confidence" | "updatedAt"> {
  return { origin: "predicted", confidence: "medium", updatedAt: monthLabel() };
}

function collectionSummary(collection: CollectionDetails): WatchOrderSummary | null {
  const parts = sortByRelease((collection.parts ?? []).filter((item) => item.release_date));
  const image = collection.backdrop_path ?? parts.find((item) => item.backdrop_path)?.backdrop_path;
  const poster = collection.poster_path ?? parts.find((item) => item.poster_path)?.poster_path;
  if (parts.length < 2 || !image || !poster) return null;
  return {
    id: `predicted-collection-${collection.id}`,
    title: collection.name,
    eyebrow: "PROGNOSE · FILMSAMMLUNG",
    description: collection.overview?.trim() || "Automatisch aus zusammengehörigen Filmen und ihren Veröffentlichungsdaten aufgebaut.",
    aliases: [collection.name, ...parts.flatMap((item) => [titleOf(item), item.original_title ?? ""])].filter(Boolean),
    category: "film",
    titleRefs: parts.map((item) => `movie:${item.id}`),
    backdropPath: image,
    posterPath: poster,
    accent: accentFor(collection.id),
    entryCount: parts.length,
    sourceLabel: "TMDB-Sammlung & Veröffentlichungsdaten",
    ...predictedBase(),
  };
}

function tvSummary(series: TvDetails): WatchOrderSummary | null {
  const seasons = (series.seasons ?? []).filter((season) => season.season_number > 0 && (season.episode_count ?? 0) > 0);
  const image = series.backdrop_path;
  const poster = series.poster_path ?? seasons.find((season) => season.poster_path)?.poster_path;
  if (seasons.length < 2 || !image || !poster) return null;
  return {
    id: `predicted-tv-${series.id}`,
    title: titleOf(series),
    eyebrow: isAnime(series) ? "PROGNOSE · ANIME-STAFFELN" : "PROGNOSE · SERIEN-STAFFELN",
    description: series.overview?.trim() || "Automatisch aus den vorhandenen Staffeln und ihren Ausstrahlungsdaten aufgebaut.",
    aliases: [titleOf(series), series.original_name ?? ""].filter(Boolean),
    category: isAnime(series) ? "anime" : "series",
    titleRefs: [`tv:${series.id}`],
    backdropPath: image,
    posterPath: poster,
    accent: accentFor(series.id),
    entryCount: seasons.length,
    sourceLabel: "TMDB-Staffeln & Ausstrahlungsdaten",
    ...predictedBase(),
  };
}

async function collectionById(id: number) {
  return tmdbFetch<CollectionDetails>(`/collection/${id}`, {}, WEEK);
}

async function seriesById(id: number) {
  return tmdbFetch<TvDetails>(`/tv/${id}`, {}, WEEK);
}

export async function predictWatchOrders(query: string) {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];
  const page = await tmdbFetch<SearchPage>("/search/multi", { query: cleaned, include_adult: "false" }, 60 * 60 * 12);
  const results = (page.results ?? [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 10);
  const summaries: WatchOrderSummary[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    try {
      let candidate: WatchOrderSummary | null = null;
      if (result.media_type === "tv") {
        candidate = tvSummary(await seriesById(result.id));
      } else {
        const movie = await tmdbFetch<MovieDetails>(`/movie/${result.id}`, {}, WEEK);
        if (movie.belongs_to_collection) candidate = collectionSummary(await collectionById(movie.belongs_to_collection.id));
      }
      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        summaries.push(candidate);
      }
      if (summaries.length >= 6) break;
    } catch {
      // A single incomplete TMDB result must not make all predictions disappear.
    }
  }
  return summaries;
}

async function resolveEntries(entries: WatchOrderEntry[]) {
  const resolved: (Title | null)[] = Array(entries.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(6, entries.length) }, async () => {
    while (cursor < entries.length) {
      const index = cursor++;
      const item = entries[index];
      resolved[index] = await watchOrderTitleDetails(item.mediaType, item.tmdbId);
    }
  });
  await Promise.all(workers);
  return entries.map((item, index) => ({
    ...item,
    media: resolved[index]
      ? { ...resolved[index]!, backdropPath: item.imagePath ?? resolved[index]!.backdropPath, episodeGuide: undefined }
      : null,
  }));
}

async function predictedCollectionDetails(id: number): Promise<WatchOrderDetails | null> {
  const collection = await collectionById(id);
  const summary = collectionSummary(collection);
  if (!summary) return null;
  const entries: WatchOrderEntry[] = sortByRelease((collection.parts ?? []).filter((item) => item.release_date)).map((item) => ({
    id: `collection-${id}-${item.id}`,
    title: titleOf(item),
    description: item.overview?.trim() || "Für diesen Film ist noch keine deutsche Beschreibung verfügbar.",
    year: yearOf(item),
    kind: "movie",
    mediaType: "movie",
    tmdbId: item.id,
    imagePath: item.backdrop_path ?? item.poster_path ?? undefined,
  }));
  const resolved = await resolveEntries(entries);
  return {
    ...summary,
    modes: [{
      id: "predicted",
      label: "Prognostizierte Reihenfolge",
      description: "Nach Veröffentlichung sortiert. StreamHub verwendet dies als vorsichtige Prognose für die Haupthandlung; Prequels, Rückblenden oder alternative Fassungen können abweichen.",
      entries: resolved,
    }],
  };
}

async function predictedTvDetails(id: number): Promise<WatchOrderDetails | null> {
  const series = await seriesById(id);
  const summary = tvSummary(series);
  if (!summary) return null;
  const seasons = (series.seasons ?? [])
    .filter((season) => season.season_number > 0 && (season.episode_count ?? 0) > 0)
    .sort((left, right) => left.season_number - right.season_number);
  const entries = await Promise.all(seasons.map(async (season, index): Promise<WatchOrderEntry> => ({
    id: `tv-${id}-season-${season.season_number}`,
    title: season.name?.trim() || `${titleOf(series)} – Staffel ${season.season_number}`,
    description: season.overview?.trim() || `Staffel ${season.season_number} von ${titleOf(series)}.`,
    year: season.air_date?.slice(0, 4) || "—",
    kind: "season",
    mediaType: "tv",
    tmdbId: id,
    seasonNumber: season.season_number,
    seasonLabel: `Staffel ${season.season_number}`,
    episodeRange: season.episode_count ? `${season.episode_count} Folgen` : undefined,
    imagePath: await watchOrderEntryImage("tv", id, { seasonNumber: season.season_number, variant: index }) ?? undefined,
  })));
  const resolved = await resolveEntries(entries);
  return {
    ...summary,
    modes: [{
      id: "predicted",
      label: "Prognostizierte Reihenfolge",
      description: "Nach Staffelnummer und Erstausstrahlung sortiert. Specials und alternative Fassungen werden nicht automatisch in die Haupthandlung gemischt.",
      entries: resolved,
    }],
  };
}

export async function getPredictedWatchOrder(id: string) {
  const collectionId = Number(id.match(/^predicted-collection-(\d+)$/)?.[1]);
  if (Number.isInteger(collectionId) && collectionId > 0) return predictedCollectionDetails(collectionId);
  const tvId = Number(id.match(/^predicted-tv-(\d+)$/)?.[1]);
  if (Number.isInteger(tvId) && tvId > 0) return predictedTvDetails(tvId);
  return null;
}
