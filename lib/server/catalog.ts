import { categories, categoryDefinition, genreForCategory, itemMatchesCategory } from "@/lib/categories";
import { mockCatalog, providers } from "@/lib/mock-data";
import { hasTmdbToken, tmdbFetch } from "@/lib/tmdb";
import type {
  BrowsePayload,
  CatalogItem,
  CategoryKey,
  MediaType,
  ProviderKey,
  TitleDetail
} from "@/lib/types";

type TMDBProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

type ProviderList = { results: TMDBProvider[] };

type WatchRegion = {
  link?: string;
  flatrate?: TMDBProvider[];
  ads?: TMDBProvider[];
  free?: TMDBProvider[];
  rent?: TMDBProvider[];
  buy?: TMDBProvider[];
};

type WatchResponse = { results?: Record<string, WatchRegion> };

type DiscoverItem = {
  id: number;
  title?: string;
  name?: string;
  media_type?: MediaType | "person";
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
};

type DiscoverResponse = {
  page: number;
  results: DiscoverItem[];
  total_pages?: number;
  total_results?: number;
};

type MovieDetailRaw = DiscoverItem & {
  title: string;
  genres?: Array<{ id: number; name: string }>;
  runtime?: number | null;
  homepage?: string | null;
};

type TVDetailRaw = DiscoverItem & {
  name: string;
  genres?: Array<{ id: number; name: string }>;
  episode_run_time?: number[];
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  homepage?: string | null;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("de").replace(/[^a-z0-9+]/g, "");
}

export function parseProviderKeys(raw?: string | null): ProviderKey[] {
  const allowed = new Set(providers.map((provider) => provider.key));
  const values = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ProviderKey => allowed.has(value as ProviderKey));
  return values.length ? Array.from(new Set(values)) : providers.map((provider) => provider.key);
}

export function parseCategory(raw?: string | null): CategoryKey {
  const value = (raw ?? "all") as CategoryKey;
  return categories.some((category) => category.key === value) ? value : "all";
}

async function providerList(mediaType: MediaType) {
  return tmdbFetch<ProviderList>(`/watch/providers/${mediaType === "movie" ? "movie" : "tv"}`, {
    watch_region: "DE",
    language: "de-DE"
  });
}

export async function resolveProviderIds(keys: ProviderKey[], mediaType: MediaType) {
  const list = await providerList(mediaType);
  const result: Partial<Record<ProviderKey, number>> = {};

  for (const provider of providers) {
    if (!keys.includes(provider.key)) continue;
    const aliases = provider.tmdbNames.map(normalize);
    const match = list.results.find((candidate) => aliases.includes(normalize(candidate.provider_name)));
    if (match) result[provider.key] = match.provider_id;
  }

  return result;
}

function keyForTmdbProvider(providerName: string): ProviderKey | null {
  const normalized = normalize(providerName);
  const match = providers.find((provider) =>
    provider.tmdbNames.some((alias) => normalize(alias) === normalized)
  );
  return match?.key ?? null;
}

async function watchInfo(mediaType: MediaType, id: number) {
  const response = await tmdbFetch<WatchResponse>(`/${mediaType}/${id}/watch/providers`, {}, 30 * 60);
  const de = response.results?.DE;
  const flat = de?.flatrate ?? [];
  const keys = Array.from(
    new Set(flat.map((provider) => keyForTmdbProvider(provider.provider_name)).filter(Boolean))
  ) as ProviderKey[];
  return { providers: keys, link: de?.link ?? null };
}

function classifyType(raw: DiscoverItem, mediaType: MediaType): CatalogItem["type"] {
  const genreIds = raw.genre_ids ?? [];
  const origin = raw.origin_country ?? [];
  const anime = genreIds.includes(16) && (origin.includes("JP") || raw.original_language === "ja");
  if (anime) return "Anime";
  return mediaType === "movie" ? "Film" : "Serie";
}

function baseCatalogItem(raw: DiscoverItem, mediaType: MediaType, providerKeys: ProviderKey[]): CatalogItem {
  const releaseDate = mediaType === "movie" ? raw.release_date : raw.first_air_date;
  const year = releaseDate ? Number(releaseDate.slice(0, 4)) || 0 : 0;
  return {
    id: raw.id,
    mediaType,
    title: raw.title ?? raw.name ?? "Unbekannter Titel",
    type: classifyType(raw, mediaType),
    year,
    rating: Number(raw.vote_average ?? 0),
    providers: providerKeys,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    description: raw.overview?.trim() || "Für diesen Titel ist noch keine deutsche Beschreibung verfügbar.",
    releaseDate: releaseDate || undefined,
    genreIds: raw.genre_ids ?? [],
    originCountry: raw.origin_country ?? [],
    popularity: Number(raw.popularity ?? 0)
  };
}

function mergeUnique(items: CatalogItem[], max = Number.POSITIVE_INFINITY) {
  const map = new Map<string, CatalogItem>();
  for (const item of items) {
    const key = `${item.mediaType}:${item.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.providers = Array.from(new Set([...existing.providers, ...item.providers]));
      existing.rating = Math.max(existing.rating, item.rating);
      existing.popularity = Math.max(existing.popularity ?? 0, item.popularity ?? 0);
    } else {
      map.set(key, { ...item, providers: [...item.providers] });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || b.rating - a.rating)
    .slice(0, max);
}

function providerFilter(ids: Partial<Record<ProviderKey, number>>) {
  return Object.values(ids).filter((id): id is number => typeof id === "number").join("|");
}

async function enrichItems(rawItems: DiscoverItem[], mediaType: MediaType, requestedProviders: ProviderKey[], max = 16) {
  const limited = rawItems.slice(0, max);
  const enriched = await Promise.all(
    limited.map(async (raw) => {
      try {
        const availability = await watchInfo(mediaType, raw.id);
        const visibleProviders = availability.providers.filter((key) => requestedProviders.includes(key));
        if (!visibleProviders.length) return null;
        return baseCatalogItem(raw, mediaType, visibleProviders);
      } catch {
        return null;
      }
    })
  );
  return enriched.filter((item): item is CatalogItem => Boolean(item));
}

export async function getCatalog(keys: ProviderKey[]) {
  if (!hasTmdbToken()) {
    return {
      configured: false,
      source: "demo" as const,
      popular: mockCatalog,
      newReleases: mockCatalog.filter((item) => item.year >= 2026),
      error: "TMDB_READ_TOKEN fehlt. StreamHub läuft im Demo-Modus."
    };
  }

  const [movieIds, tvIds] = await Promise.all([
    resolveProviderIds(keys, "movie"),
    resolveProviderIds(keys, "tv")
  ]);

  const movieProviderFilter = providerFilter(movieIds);
  const tvProviderFilter = providerFilter(tvIds);

  if (!movieProviderFilter && !tvProviderFilter) {
    return {
      configured: true,
      source: "tmdb" as const,
      popular: [],
      newReleases: [],
      error: "Für die gewählten Dienste konnten in TMDB keine deutschen Provider-IDs aufgelöst werden."
    };
  }

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - 9);
  const date = (value: Date) => value.toISOString().slice(0, 10);

  const common = {
    language: "de-DE",
    watch_region: "DE",
    with_watch_monetization_types: "flatrate",
    include_adult: "false"
  };

  const [popularMoviesRaw, popularTvRaw, newMoviesRaw, newTvRaw] = await Promise.all([
    movieProviderFilter
      ? tmdbFetch<DiscoverResponse>("/discover/movie", {
          ...common,
          with_watch_providers: movieProviderFilter,
          sort_by: "popularity.desc",
          "vote_count.gte": "80"
        }, 30 * 60)
      : Promise.resolve({ page: 1, results: [] }),
    tvProviderFilter
      ? tmdbFetch<DiscoverResponse>("/discover/tv", {
          ...common,
          with_watch_providers: tvProviderFilter,
          sort_by: "popularity.desc",
          "vote_count.gte": "80"
        }, 30 * 60)
      : Promise.resolve({ page: 1, results: [] }),
    movieProviderFilter
      ? tmdbFetch<DiscoverResponse>("/discover/movie", {
          ...common,
          with_watch_providers: movieProviderFilter,
          sort_by: "primary_release_date.desc",
          "primary_release_date.gte": date(cutoff),
          "primary_release_date.lte": date(today),
          "vote_count.gte": "10"
        }, 30 * 60)
      : Promise.resolve({ page: 1, results: [] }),
    tvProviderFilter
      ? tmdbFetch<DiscoverResponse>("/discover/tv", {
          ...common,
          with_watch_providers: tvProviderFilter,
          sort_by: "first_air_date.desc",
          "first_air_date.gte": date(cutoff),
          "first_air_date.lte": date(today),
          "vote_count.gte": "10"
        }, 30 * 60)
      : Promise.resolve({ page: 1, results: [] })
  ]);

  const [popularMovies, popularTv, newMovies, newTv] = await Promise.all([
    enrichItems(popularMoviesRaw.results, "movie", keys, 14),
    enrichItems(popularTvRaw.results, "tv", keys, 14),
    enrichItems(newMoviesRaw.results, "movie", keys, 12),
    enrichItems(newTvRaw.results, "tv", keys, 12)
  ]);

  return {
    configured: true,
    source: "tmdb" as const,
    popular: mergeUnique([...popularMovies, ...popularTv], 24),
    newReleases: mergeUnique(
      [...newMovies, ...newTv].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")),
      20
    ),
    providerIds: { ...movieIds, ...tvIds }
  };
}

function discoverParams(
  mediaType: MediaType,
  providerId: number,
  category: CategoryKey,
  page: number
) {
  const genre = genreForCategory(category, mediaType);
  const definition = categoryDefinition(category);
  const params: Record<string, string> = {
    language: "de-DE",
    watch_region: "DE",
    with_watch_monetization_types: "flatrate",
    include_adult: "false",
    with_watch_providers: String(providerId),
    sort_by: "popularity.desc",
    page: String(page),
    "vote_count.gte": "5"
  };

  if (typeof genre === "number") params.with_genres = String(genre);
  if (definition.anime) {
    params.with_original_language = "ja";
    if (mediaType === "tv") params.with_origin_country = "JP";
  }
  return params;
}

async function browseOneProvider(
  provider: ProviderKey,
  movieId: number | undefined,
  tvId: number | undefined,
  category: CategoryKey,
  page: number
) {
  const movieGenre = genreForCategory(category, "movie");
  const tvGenre = genreForCategory(category, "tv");
  const movieAllowed = category === "all" || typeof movieGenre === "number";
  const tvAllowed = category === "all" || typeof tvGenre === "number";

  const [movies, tv] = await Promise.all([
    movieId && movieAllowed
      ? tmdbFetch<DiscoverResponse>("/discover/movie", discoverParams("movie", movieId, category, page), 20 * 60)
      : Promise.resolve({ page, results: [], total_pages: 0 }),
    tvId && tvAllowed
      ? tmdbFetch<DiscoverResponse>("/discover/tv", discoverParams("tv", tvId, category, page), 20 * 60)
      : Promise.resolve({ page, results: [], total_pages: 0 })
  ]);

  const items = [
    ...movies.results.map((raw) => baseCatalogItem(raw, "movie", [provider])),
    ...tv.results.map((raw) => baseCatalogItem(raw, "tv", [provider]))
  ];
  const hasMore = page < Math.max(movies.total_pages ?? 0, tv.total_pages ?? 0);
  return { items, hasMore };
}

export async function browseCatalog(
  keys: ProviderKey[],
  provider: ProviderKey | "all",
  category: CategoryKey,
  page: number
): Promise<BrowsePayload> {
  const safePage = Math.max(1, Math.min(500, page || 1));
  if (!hasTmdbToken()) {
    const filtered = mockCatalog.filter((item) =>
      (provider === "all" || item.providers.includes(provider)) && itemMatchesCategory(item, category)
    );
    return {
      configured: false,
      source: "demo",
      results: filtered,
      page: safePage,
      hasMore: false,
      provider,
      category
    };
  }

  const chosen = provider === "all" ? keys : keys.includes(provider) ? [provider] : [];
  if (!chosen.length) {
    return { configured: true, source: "tmdb", results: [], page: safePage, hasMore: false, provider, category };
  }

  const [movieIds, tvIds] = await Promise.all([
    resolveProviderIds(chosen, "movie"),
    resolveProviderIds(chosen, "tv")
  ]);

  const chunks = await Promise.all(
    chosen.map((key) => browseOneProvider(key, movieIds[key], tvIds[key], category, safePage))
  );

  const merged = mergeUnique(chunks.flatMap((chunk) => chunk.items), provider === "all" ? 60 : 40);
  return {
    configured: true,
    source: "tmdb",
    results: merged,
    page: safePage,
    hasMore: chunks.some((chunk) => chunk.hasMore),
    provider,
    category
  };
}

export async function searchCatalog(query: string, keys: ProviderKey[]) {
  if (!hasTmdbToken()) {
    const q = query.toLocaleLowerCase("de");
    return {
      configured: false,
      source: "demo" as const,
      results: mockCatalog.filter((item) => item.title.toLocaleLowerCase("de").includes(q))
    };
  }

  const data = await tmdbFetch<DiscoverResponse>("/search/multi", {
    query,
    language: "de-DE",
    include_adult: "false"
  }, 60);

  const candidates = data.results
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 20);

  const enriched = await Promise.all(
    candidates.map(async (raw) => {
      const mediaType = raw.media_type as MediaType;
      try {
        const availability = await watchInfo(mediaType, raw.id);
        const matched = availability.providers.filter((provider) => keys.includes(provider));
        return matched.length ? baseCatalogItem(raw, mediaType, matched) : null;
      } catch {
        return null;
      }
    })
  );

  return {
    configured: true,
    source: "tmdb" as const,
    results: enriched.filter((item): item is CatalogItem => Boolean(item)).slice(0, 20)
  };
}

export async function getTitleDetail(mediaType: MediaType, id: number): Promise<TitleDetail> {
  if (!hasTmdbToken()) {
    const item = mockCatalog.find((candidate) => candidate.mediaType === mediaType && candidate.id === id);
    if (!item) throw new Error("Demo-Titel nicht gefunden.");
    return {
      ...item,
      genres: item.type === "Anime" ? ["Animation"] : [],
      runtime: null,
      numberOfSeasons: item.mediaType === "tv" ? 1 : null,
      numberOfEpisodes: null,
      homepage: null,
      watchLink: null
    };
  }

  const [raw, availability] = await Promise.all([
    tmdbFetch<MovieDetailRaw | TVDetailRaw>(`/${mediaType}/${id}`, { language: "de-DE" }, 60 * 60),
    watchInfo(mediaType, id)
  ]);

  const catalog = baseCatalogItem(
    {
      ...raw,
      genre_ids: raw.genres?.map((genre) => genre.id) ?? [],
      media_type: mediaType
    },
    mediaType,
    availability.providers
  );

  if (mediaType === "movie") {
    const movie = raw as MovieDetailRaw;
    return {
      ...catalog,
      genres: movie.genres?.map((genre) => genre.name) ?? [],
      runtime: movie.runtime ?? null,
      numberOfSeasons: null,
      numberOfEpisodes: null,
      homepage: movie.homepage ?? null,
      watchLink: availability.link
    };
  }

  const tv = raw as TVDetailRaw;
  return {
    ...catalog,
    genres: tv.genres?.map((genre) => genre.name) ?? [],
    runtime: tv.episode_run_time?.[0] ?? null,
    numberOfSeasons: tv.number_of_seasons ?? null,
    numberOfEpisodes: tv.number_of_episodes ?? null,
    homepage: tv.homepage ?? null,
    watchLink: availability.link
  };
}
