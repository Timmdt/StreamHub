import { demoTitles } from "./demo";
import { CATEGORY_OPTIONS, PROVIDER_BY_ID, PROVIDERS, verifiedSeriesProviderLinks } from "./providers";
import { streamingAvailability } from "./streaming-availability";
import type { CatalogResponse, EpisodeGuide, MediaType, Provider, Title } from "./types";

const API_ROOT = "https://api.themoviedb.org/3";
const REGION = "DE";

type TmdbResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  origin_country?: string[];
  original_language?: string;
  runtime?: number | null;
  number_of_seasons?: number | null;
  homepage?: string | null;
};

type TmdbPage = {
  page: number;
  total_pages: number;
  results: TmdbResult[];
};

type WatchProviders = {
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: { provider_id: number; provider_name: string; logo_path?: string }[];
      free?: { provider_id: number; provider_name: string; logo_path?: string }[];
      ads?: { provider_id: number; provider_name: string; logo_path?: string }[];
    }
  >;
};

type TmdbSeasonDetails = {
  name?: string;
  episodes?: {
    episode_number?: number;
    name?: string;
    overview?: string;
    air_date?: string | null;
    still_path?: string | null;
  }[];
};

export function hasTmdbToken() {
  return Boolean(process.env.TMDB_READ_TOKEN?.trim());
}

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  revalidateSeconds = 60 * 30,
) {
  const token = process.env.TMDB_READ_TOKEN?.trim();
  if (!token) throw new Error("TMDB_READ_TOKEN is missing");
  const url = new URL(`${API_ROOT}${path}`);
  url.searchParams.set("language", "de-DE");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: revalidateSeconds },
  });
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${path}`);
  return (await response.json()) as T;
}

const tmdb = tmdbFetch;

function toBaseTitle(raw: TmdbResult, fallbackType: MediaType): Title {
  const mediaType: MediaType = raw.media_type === "tv" || raw.media_type === "movie" ? raw.media_type : fallbackType;
  const genreIds = raw.genre_ids ?? raw.genres?.map((genre) => genre.id) ?? [];
  const isAnime = genreIds.includes(16) && (raw.origin_country?.includes("JP") || raw.original_language === "ja");
  return {
    id: raw.id,
    mediaType,
    title: raw.title ?? raw.name ?? "Unbekannter Titel",
    originalTitle: raw.original_title ?? raw.original_name,
    overview: raw.overview || "Für diesen Titel ist noch keine deutsche Beschreibung verfügbar.",
    year: (raw.release_date ?? raw.first_air_date ?? "").slice(0, 4) || "—",
    rating: Number((raw.vote_average ?? 0).toFixed(1)),
    popularity: raw.popularity ?? 0,
    genreIds,
    genres: raw.genres,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    providers: [],
    homepage: raw.homepage ?? null,
    anime: isAnime,
    runtime: raw.runtime,
    seasons: raw.number_of_seasons,
  };
}

async function availability(mediaType: MediaType, id: number) {
  try {
    const data = await tmdb<WatchProviders>(`/${mediaType}/${id}/watch/providers`);
    const local = data.results?.[REGION];
    const all = [...(local?.flatrate ?? []), ...(local?.free ?? []), ...(local?.ads ?? [])];
    const providers: Provider[] = [];
    const seen = new Set<number>();
    for (const item of all) {
      const normalizedName = item.provider_name.toLocaleLowerCase("en");
      const known = PROVIDER_BY_ID.get(item.provider_id)
        ?? (normalizedName.includes("netflix") ? PROVIDER_BY_ID.get(8) : undefined)
        ?? (normalizedName.startsWith("amazon prime video") ? PROVIDER_BY_ID.get(119) : undefined);
      const providerId = known?.id ?? item.provider_id;
      if (seen.has(providerId)) continue;
      seen.add(providerId);
      const short = item.provider_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toLocaleUpperCase("de");
      providers.push(known
        ? { ...known, logoPath: item.logo_path ?? null }
        : { id: item.provider_id, name: item.provider_name, short, color: "#73758a", logoPath: item.logo_path ?? null });
    }
    return { providers, watchLink: local?.link };
  } catch {
    return { providers: [] as Provider[], watchLink: undefined };
  }
}

async function hydrate(raw: TmdbResult, fallbackType: MediaType) {
  const base = toBaseTitle(raw, fallbackType);
  const found = await availability(base.mediaType, base.id);
  return { ...base, ...found };
}

async function hydrateMany(results: TmdbResult[], fallbackType: MediaType, maximum = 24) {
  const usable = results
    .filter((item) => item.poster_path || item.backdrop_path)
    .filter((item) => item.media_type !== "person")
    .slice(0, maximum);
  return Promise.all(usable.map((item) => hydrate(item, fallbackType)));
}

function providerQuery(providerIds: number[]) {
  const ids = providerIds.filter((id) => PROVIDER_BY_ID.has(id));
  return (ids.length ? ids : PROVIDERS.map((provider) => provider.id)).join("|");
}

const tvGenreMap: Record<number, number> = {
  28: 10759,
  12: 10759,
  80: 80,
  99: 99,
  18: 18,
  10751: 10751,
  14: 10765,
  27: 9648,
  10749: 18,
  878: 10765,
  53: 9648,
  35: 35,
  16: 16,
};

async function discoverType(
  mediaType: MediaType,
  page: number,
  providerIds: number[],
  genre?: number,
  extra: Record<string, string | number | undefined> = {},
) {
  const mappedGenre = mediaType === "tv" && genre ? tvGenreMap[genre] ?? genre : genre;
  return tmdb<TmdbPage>(`/discover/${mediaType}`, {
    page,
    watch_region: REGION,
    with_watch_providers: providerQuery(providerIds),
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    "vote_count.gte": 20,
    with_genres: mappedGenre,
    include_adult: "false",
    ...extra,
  });
}

function demoCatalog(kind: string, page: number, genre?: number, query?: string): CatalogResponse {
  let results = demoTitles();
  if (kind === "movies") results = results.filter((title) => title.mediaType === "movie");
  if (kind === "series") results = results.filter((title) => title.mediaType === "tv" && !title.anime);
  if (kind === "anime") results = results.filter((title) => title.anime);
  if (genre) results = results.filter((title) => title.genreIds.includes(genre) || (genre === 90001 && title.anime));
  if (query) {
    const term = query.toLocaleLowerCase("de");
    results = results.filter((title) => title.title.toLocaleLowerCase("de").includes(term));
  }
  const rotated = [...results.slice((page - 1) % Math.max(results.length, 1)), ...results.slice(0, (page - 1) % Math.max(results.length, 1))];
  return { source: "demo", page, totalPages: 8, results: rotated.slice(0, 24) };
}

export async function discoverCatalog(options: {
  kind: string;
  page: number;
  providerIds: number[];
  genre?: number;
  tasteGenres?: number[];
}) {
  const { kind, page, providerIds, genre, tasteGenres = [] } = options;
  if (!hasTmdbToken()) return demoCatalog(kind, page, genre);

  try {
    let movie: TmdbPage | null = null;
    let tv: TmdbPage | null = null;
    if (kind === "movies") movie = await discoverType("movie", page, providerIds, genre ?? tasteGenres[0]);
    else if (kind === "series") tv = await discoverType("tv", page, providerIds, genre ?? tasteGenres[0]);
    else if (kind === "anime") {
      [movie, tv] = await Promise.all([
        discoverType("movie", page, providerIds, 16, { with_origin_country: "JP", with_original_language: "ja" }),
        discoverType("tv", page, providerIds, 16, { with_origin_country: "JP", with_original_language: "ja" }),
      ]);
    } else if (kind === "category") {
      [movie, tv] = await Promise.all([
        discoverType("movie", page, providerIds, genre),
        discoverType("tv", page, providerIds, genre),
      ]);
    } else if (genre && [27, 53, 10749].includes(genre)) {
      movie = await discoverType("movie", page, providerIds, genre);
    } else {
      [movie, tv] = await Promise.all([
        discoverType("movie", page, providerIds, genre ?? tasteGenres[0]),
        discoverType("tv", page, providerIds, genre ?? tasteGenres[0]),
      ]);
    }

    const combined = [
      ...(movie?.results ?? []).map((result) => ({ ...result, media_type: "movie" })),
      ...(tv?.results ?? []).map((result) => ({ ...result, media_type: "tv" })),
    ].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const results = await hydrateMany(combined, kind === "movies" ? "movie" : "tv", ["catalog", "category", "anime"].includes(kind) ? 36 : 24);
    return {
      source: "tmdb" as const,
      page,
      totalPages: Math.min(500, Math.max(movie?.total_pages ?? 0, tv?.total_pages ?? 0)),
      results,
    };
  } catch (error) {
    console.error(error);
    return demoCatalog(kind, page, genre);
  }
}

const genreTerms: Record<string, number> = {
  action: 28,
  abenteuer: 12,
  animation: 16,
  anime: 90001,
  komödie: 35,
  komodie: 35,
  comedy: 35,
  krimi: 80,
  kriminal: 80,
  doku: 99,
  dokumentation: 99,
  drama: 18,
  familie: 10751,
  fantasy: 14,
  horror: 27,
  romance: 10749,
  romantik: 10749,
  "sci-fi": 878,
  scifi: 878,
  sciencefiction: 878,
  thriller: 53,
};

function parseSearchIntent(query: string) {
  const normalized = query.toLocaleLowerCase("de").replace(/[^a-z0-9äöüß-]+/g, " ").trim();
  const genreEntry = Object.entries(genreTerms).find(([term]) => normalized.includes(term));
  const mediaType = /\b(film|filme|movie|movies)\b/.test(normalized)
    ? "movie"
    : /\b(serie|serien|show|shows)\b/.test(normalized)
      ? "tv"
      : undefined;
  const year = normalized.match(/\b(19|20)\d{2}\b/)?.[0];
  return { normalized, genre: genreEntry?.[1], mediaType, year };
}

function searchScore(title: Title, query: string, year?: string) {
  const needle = query.toLocaleLowerCase("de").trim();
  const name = title.title.toLocaleLowerCase("de");
  const original = title.originalTitle?.toLocaleLowerCase("de") ?? "";
  let score = Math.log10(title.popularity + 1) * 8 + title.rating;
  if (name === needle || original === needle) score += 120;
  else if (name.startsWith(needle) || original.startsWith(needle)) score += 65;
  else if (name.includes(needle) || original.includes(needle)) score += 35;
  if (year && title.year === year) score += 50;
  if (title.providers.length) score += 12;
  return score;
}

export async function searchCatalog(query: string, providerIds: number[]) {
  const intent = parseSearchIntent(query);
  if (!hasTmdbToken()) return demoCatalog("all", 1, intent.genre, intent.genre ? undefined : query);

  try {
    if (intent.genre) {
      const kind = intent.genre === 90001 ? "anime" : intent.mediaType === "movie" ? "movies" : intent.mediaType === "tv" ? "series" : "all";
      return discoverCatalog({ kind, page: 1, providerIds, genre: intent.genre === 90001 ? 16 : intent.genre });
    }

    const pages = await Promise.all(
      [1, 2].map((page) =>
        tmdb<TmdbPage>("/search/multi", { query, page, include_adult: "false" }),
      ),
    );
    let raw = pages.flatMap((page) => page.results).filter((item) => item.media_type !== "person");
    if (intent.mediaType) raw = raw.filter((item) => item.media_type === intent.mediaType);
    const hydrated = await hydrateMany(raw, "movie", 36);
    const active = new Set(providerIds);
    const ranked = hydrated
      .filter((title) => !intent.year || title.year === intent.year)
      .sort((a, b) => {
        const aAvailable = a.providers.some((provider) => active.has(provider.id)) ? 20 : 0;
        const bAvailable = b.providers.some((provider) => active.has(provider.id)) ? 20 : 0;
        return searchScore(b, query, intent.year) + bAvailable - (searchScore(a, query, intent.year) + aAvailable);
      });
    return { source: "tmdb" as const, page: 1, totalPages: 2, results: ranked };
  } catch (error) {
    console.error(error);
    return demoCatalog("all", 1, undefined, query);
  }
}

export async function searchCategoryCatalog(query: string, categoryId: number, providerIds: number[]) {
  const data = await searchCatalog(query, providerIds);
  const selectedProviders = new Set(providerIds.length ? providerIds : PROVIDERS.map((provider) => provider.id));
  const mappedTvGenre = tvGenreMap[categoryId] ?? categoryId;
  const results = data.results.filter((title) => {
    const categoryMatch = categoryId === 90001
      ? Boolean(title.anime)
      : title.genreIds.includes(categoryId) || title.genreIds.includes(mappedTvGenre);
    const providerMatch = title.providers.some((provider) => selectedProviders.has(provider.id));
    return categoryMatch && providerMatch;
  });
  return { ...data, page: 1, totalPages: 1, results };
}

export async function watchOrderTitleDetails(mediaType: MediaType, id: number) {
  if (!hasTmdbToken()) return demoTitles().find((title) => title.id === id) ?? null;
  try {
    const raw = await tmdb<TmdbResult>(`/${mediaType}/${id}`);
    return hydrate(raw, mediaType);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function titleDetails(mediaType: MediaType, id: number) {
  if (!hasTmdbToken()) return demoTitles().find((title) => title.id === id) ?? null;
  try {
    const [raw, streaming] = await Promise.all([
      tmdb<TmdbResult>(`/${mediaType}/${id}`),
      streamingAvailability(mediaType, id),
    ]);
    const [hydrated, episodeGuide] = await Promise.all([
      hydrate(raw, mediaType),
      mediaType === "tv" ? localizedEpisodeGuide(id, streaming.episodeGuide, raw.number_of_seasons) : streaming.episodeGuide,
    ]);
    const verifiedSeriesLinks = verifiedSeriesProviderLinks(mediaType, id);
    const episodeGuideWithFallbacks = episodeGuide?.status === "ready" && verifiedSeriesLinks.length
      ? {
          ...episodeGuide,
          seasons: episodeGuide.seasons.map((season) => ({
            ...season,
            providerLinks: uniqueEpisodeLinks([...season.providerLinks, ...verifiedSeriesLinks]),
          })),
        }
      : episodeGuide;
    const providerLinks = new Map(
      [...streaming.titleLinks, ...verifiedSeriesLinks].map((link) => [link.providerId, link.url]),
    );
    const providers = new Map(streaming.linkedProviders.map((provider) => [provider.id, provider]));
    verifiedSeriesLinks.forEach((link) => {
      const provider = PROVIDER_BY_ID.get(link.providerId);
      if (provider) providers.set(provider.id, provider);
    });
    hydrated.providers.forEach((provider) => {
      providers.set(provider.id, { ...providers.get(provider.id), ...provider });
    });
    return {
      ...hydrated,
      providers: [...providers.values()].map((provider) => ({
        ...provider,
        link: providerLinks.get(provider.id),
      })),
      episodeGuide: episodeGuideWithFallbacks,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

function uniqueEpisodeLinks(links: EpisodeGuide["seasons"][number]["providerLinks"]) {
  const unique = new Map<number, (typeof links)[number]>();
  const scopeRank = { series: 0, season: 1, episode: 2 } as const;
  links.forEach((link) => {
    const current = unique.get(link.providerId);
    const currentRank = current?.scope ? scopeRank[current.scope] : 0;
    const nextRank = link.scope ? scopeRank[link.scope] : 0;
    if (!current || nextRank > currentRank || (nextRank === currentRank && link.directVideo && !current.directVideo)) {
      unique.set(link.providerId, link);
    }
  });
  return [...unique.values()];
}

function localizeEpisodes(
  episodes: EpisodeGuide["seasons"][number]["episodes"],
  localized: TmdbSeasonDetails,
) {
  const metadata = new Map(
    (localized.episodes ?? []).map((episode, index) => [episode.episode_number ?? index + 1, episode]),
  );

  return episodes.map((episode, index) => {
    const number = index + 1;
    const german = metadata.get(number);
    const germanTitle = german?.name?.trim();
    const germanOverview = german?.overview?.trim();
    const localizedYear = Number(german?.air_date?.slice(0, 4));
    return {
      ...episode,
      number,
      title: germanTitle || episode.title,
      overview: germanOverview || "Für diese Folge ist noch keine deutsche Beschreibung verfügbar.",
      year: Number.isFinite(localizedYear) && localizedYear > 0 ? localizedYear : episode.year,
      stillPath: german?.still_path ?? null,
    };
  });
}

type SourceSeasonChunk = {
  number: number;
  title: string;
  episodes: EpisodeGuide["seasons"][number]["episodes"];
  providerLinks: EpisodeGuide["seasons"][number]["providerLinks"];
};

function splitSeasonAtYearGap(season: EpisodeGuide["seasons"][number]): SourceSeasonChunk[] {
  if (season.episodes.length < 18) {
    return [{ number: season.number, title: season.title, episodes: season.episodes, providerLinks: season.providerLinks }];
  }

  const boundaries: number[] = [];
  for (let index = 1; index < season.episodes.length; index += 1) {
    const previousYear = season.episodes[index - 1].year;
    const currentYear = season.episodes[index].year;
    if (previousYear && currentYear && currentYear - previousYear >= 2 && index >= 6 && season.episodes.length - index >= 6) {
      boundaries.push(index);
    }
  }
  if (!boundaries.length) {
    return [{ number: season.number, title: season.title, episodes: season.episodes, providerLinks: season.providerLinks }];
  }

  const cuts = [0, ...boundaries, season.episodes.length];
  const episodeProviderCounts = new Map<number, number>();
  season.episodes.forEach((episode) => episode.providerLinks.forEach((link) => {
    episodeProviderCounts.set(link.providerId, (episodeProviderCounts.get(link.providerId) ?? 0) + 1);
  }));

  return cuts.slice(0, -1).map((start, chunkIndex) => {
    const end = cuts[chunkIndex + 1];
    const episodes = season.episodes.slice(start, end);
    const providerLinks = season.providerLinks.filter((link) => {
      const hasEpisodeEvidence = (episodeProviderCounts.get(link.providerId) ?? 0) > 0;
      return !hasEpisodeEvidence || episodes.some((episode) => episode.providerLinks.some((item) => item.providerId === link.providerId));
    });
    const number = season.number + chunkIndex;
    return {
      number,
      title: chunkIndex === 0 ? season.title : `Staffel ${number}`,
      episodes,
      providerLinks,
    };
  });
}

async function localizedEpisodeGuide(seriesId: number, guide?: EpisodeGuide, expectedSeasonCount?: number | null) {
  if (!guide || guide.status !== "ready") return guide;

  const guideNumbers = guide.seasons.map((season) => season.number);
  const largestGuideNumber = Math.max(0, ...guideNumbers);
  const lastSeasonNumber = Math.max(expectedSeasonCount ?? 0, largestGuideNumber);
  const seasonNumbers = [
    ...(guideNumbers.includes(0) ? [0] : []),
    ...Array.from({ length: lastSeasonNumber }, (_, index) => index + 1),
  ];
  const details = new Map<number, TmdbSeasonDetails>();

  await Promise.all(seasonNumbers.map(async (number) => {
    try {
      const localized = await tmdb<TmdbSeasonDetails>(
        `/tv/${seriesId}/season/${number}`,
        { language: "de-DE" },
        60 * 60 * 6,
      );
      details.set(number, localized);
    } catch {
      // A missing announced season must not hide the episode data we already have.
    }
  }));

  const regularSourceSeasons = guide.seasons.filter((season) => season.number > 0);
  const regularTargets = [...details.entries()]
    .filter(([number, season]) => number > 0 && (season.episodes?.length ?? 0) > 0)
    .sort(([numberA], [numberB]) => numberA - numberB);
  const sourceEpisodeCount = regularSourceSeasons.reduce((sum, season) => sum + season.episodes.length, 0);
  const targetEpisodeCount = regularTargets.reduce((sum, [, season]) => sum + (season.episodes?.length ?? 0), 0);
  const countsMatchBySeason = regularTargets.every(([number, target]) => (
    regularSourceSeasons.find((season) => season.number === number)?.episodes.length === target.episodes?.length
  ));
  const shouldRealign = regularTargets.length > 1
    && sourceEpisodeCount === targetEpisodeCount
    && !countsMatchBySeason;
  const inferredSourceSeasons = regularSourceSeasons.flatMap((season) => splitSeasonAtYearGap(season));
  const shouldInferYearSplit = regularTargets.length <= 1
    && inferredSourceSeasons.length > regularSourceSeasons.length;

  if (shouldInferYearSplit) {
    const missingNumbers = inferredSourceSeasons
      .map((season) => season.number)
      .filter((number) => !details.has(number));
    await Promise.all(missingNumbers.map(async (number) => {
      try {
        const localized = await tmdb<TmdbSeasonDetails>(
          `/tv/${seriesId}/season/${number}`,
          { language: "de-DE" },
          60 * 60 * 6,
        );
        details.set(number, localized);
      } catch {
        // Keep the source titles and descriptions if TMDB has no matching season.
      }
    }));
  }

  let regularSeasons: EpisodeGuide["seasons"];
  if (shouldInferYearSplit) {
    regularSeasons = inferredSourceSeasons.map((season) => {
      const localized = details.get(season.number);
      return {
        number: season.number,
        title: localized?.name?.trim() || season.title,
        providerLinks: season.providerLinks,
        episodes: localized ? localizeEpisodes(season.episodes, localized) : localizeEpisodes(season.episodes, { episodes: [] }),
      };
    });
  } else if (shouldRealign) {
    const sourceEpisodes = regularSourceSeasons.flatMap((season) => (
      season.episodes.map((episode) => ({ episode, providerLinks: season.providerLinks }))
    ));
    let cursor = 0;
    regularSeasons = regularTargets.map(([number, localized]) => {
      const episodeCount = localized.episodes?.length ?? 0;
      const slice = sourceEpisodes.slice(cursor, cursor + episodeCount);
      cursor += episodeCount;
      return {
        number,
        title: localized.name?.trim() || `Staffel ${number}`,
        providerLinks: uniqueEpisodeLinks(slice.flatMap((item) => item.providerLinks)),
        episodes: localizeEpisodes(slice.map((item) => item.episode), localized),
      };
    });
  } else {
    regularSeasons = regularSourceSeasons.map((season) => {
      const localized = details.get(season.number);
      if (!localized) return season;
      return {
        ...season,
        title: localized.name?.trim() || season.title,
        episodes: localizeEpisodes(season.episodes, localized),
      };
    });
  }

  const specialSeasons = guide.seasons.filter((season) => season.number === 0).map((season) => {
    const localized = details.get(0);
    if (!localized) return season;
    return {
      ...season,
      title: localized.name?.trim() || season.title,
      episodes: localizeEpisodes(season.episodes, localized),
    };
  });
  const seasons = [...specialSeasons, ...regularSeasons].sort((a, b) => a.number - b.number);

  return { ...guide, seasons };
}

export async function categoryCovers() {
  if (!hasTmdbToken()) return {
    source: "demo" as const,
    covers: {} as Record<string, string>,
    coverSets: {} as Record<string, string[]>,
  };

  const candidates = await Promise.all(CATEGORY_OPTIONS.map(async (category, categoryIndex) => {
    try {
      const page = category.id === 90001
        ? await discoverType("tv", 1, PROVIDERS.map((provider) => provider.id), 16, {
            with_origin_country: "JP",
            with_original_language: "ja",
          })
        : await discoverType("movie", 1, PROVIDERS.map((provider) => provider.id), category.id);
      const paths = page.results
        .map((item) => item.backdrop_path ?? item.poster_path ?? "")
        .filter(Boolean);
      return [String(category.id), paths, categoryIndex] as const;
    } catch {
      return [String(category.id), [] as string[], categoryIndex] as const;
    }
  }));

  const usedFirstImages = new Set<string>();
  const coverSetEntries = candidates.map(([id, paths, categoryIndex]) => {
    const uniquePaths = [...new Set(paths)];
    const offset = uniquePaths.length ? (categoryIndex * 3) % uniquePaths.length : 0;
    const rotated = [...uniquePaths.slice(offset), ...uniquePaths.slice(0, offset)];
    const first = rotated.find((path) => !usedFirstImages.has(path)) ?? rotated[0] ?? "";
    if (first) usedFirstImages.add(first);
    const alternatives = rotated.filter((path) => path !== first);
    return [id, [first, ...alternatives].filter(Boolean).slice(0, 6)] as const;
  });
  const coverSets = Object.fromEntries(coverSetEntries.filter(([, paths]) => paths.length));

  return {
    source: "tmdb" as const,
    covers: Object.fromEntries(Object.entries(coverSets).map(([id, paths]) => [id, paths[0]])),
    coverSets,
  };
}

export async function officialProviders() {
  if (!hasTmdbToken()) return { source: "demo" as const, providers: PROVIDERS };
  try {
    const data = await tmdb<{ results: { provider_id: number; provider_name: string; logo_path: string }[] }>("/watch/providers/movie", {
      watch_region: REGION,
    });
    const logos = new Map(data.results.map((item) => [item.provider_id, item.logo_path]));
    const primeVideoLogo = data.results.find((item) => item.provider_name.toLocaleLowerCase("de").includes("prime video"))?.logo_path;
    return {
      source: "tmdb" as const,
      providers: PROVIDERS.map((provider) => ({
        ...provider,
        logoPath: logos.get(provider.id) ?? (provider.id === 119 ? primeVideoLogo : null) ?? null,
      })),
    };
  } catch {
    return { source: "demo" as const, providers: PROVIDERS };
  }
}
