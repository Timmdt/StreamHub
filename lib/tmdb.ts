import { demoTitles } from "./demo";
import { CATEGORY_OPTIONS, PROVIDER_BY_ID, PROVIDERS, trustedProviderTitleUrl } from "./providers";
import type { CatalogResponse, MediaType, Provider, Title } from "./types";

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

export function hasTmdbToken() {
  return Boolean(process.env.TMDB_READ_TOKEN?.trim());
}

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const token = process.env.TMDB_READ_TOKEN?.trim();
  if (!token) throw new Error("TMDB_READ_TOKEN is missing");
  const url = new URL(`${API_ROOT}${path}`);
  url.searchParams.set("language", "de-DE");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: 60 * 30 },
  });
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${path}`);
  return (await response.json()) as T;
}

function toBaseTitle(raw: TmdbResult, fallbackType: MediaType): Title {
  const mediaType: MediaType = raw.media_type === "tv" || raw.media_type === "movie" ? raw.media_type : fallbackType;
  const genreIds = raw.genre_ids ?? raw.genres?.map((genre) => genre.id) ?? [];
  const isAnime = mediaType === "tv" && genreIds.includes(16) && (raw.origin_country?.includes("JP") || raw.original_language === "ja");
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
        ?? (normalizedName.includes("netflix") ? PROVIDER_BY_ID.get(8) : undefined);
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

function trustedWatchPage(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase("en").replace(/^www\./, "");
    return url.protocol === "https:" && hostname === "themoviedb.org" ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&quot;", '"');
}

function unwrapDestination(value: string | null) {
  if (!value) return [];
  const candidates = [value];
  try {
    const url = new URL(value);
    for (const key of ["u", "url", "redirect", "redirect_url", "destination"]) {
      const nested = url.searchParams.get(key);
      if (nested?.startsWith("https://")) candidates.unshift(nested);
    }
  } catch {
    return candidates;
  }
  return candidates;
}

async function directProviderLinks(watchLink: string | undefined) {
  const pageUrl = trustedWatchPage(watchLink);
  const links = new Map<number, string>();
  if (!pageUrl) return links;

  try {
    const response = await fetch(pageUrl, {
      headers: { accept: "text/html", "user-agent": "StreamHub/0.7" },
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!response.ok) return links;
    const html = await response.text();
    const matches = html.matchAll(/href=["'](https:\/\/click\.justwatch\.com\/a\?[^"']+)["']/gi);

    for (const match of matches) {
      const clickout = new URL(decodeHtmlAttribute(match[1]));
      const destination = clickout.searchParams.get("r");
      for (const provider of PROVIDERS) {
        const trusted = unwrapDestination(destination)
          .map((candidate) => trustedProviderTitleUrl(provider.id, candidate))
          .find(Boolean);
        if (trusted && !links.has(provider.id)) links.set(provider.id, trusted);
      }
    }
  } catch {
    return links;
  }

  return links;
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
      tv = await discoverType("tv", page, providerIds, 16, { with_origin_country: "JP", with_original_language: "ja" });
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
    const results = await hydrateMany(combined, kind === "movies" ? "movie" : "tv", kind === "catalog" ? 36 : 24);
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

export async function titleDetails(mediaType: MediaType, id: number) {
  if (!hasTmdbToken()) return demoTitles().find((title) => title.id === id) ?? null;
  try {
    const raw = await tmdb<TmdbResult>(`/${mediaType}/${id}`);
    const hydrated = await hydrate(raw, mediaType);
    const providerLinks = await directProviderLinks(hydrated.watchLink);
    return {
      ...hydrated,
      providers: hydrated.providers.map((provider) => ({
        ...provider,
        link: providerLinks.get(provider.id),
      })),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function categoryCovers() {
  if (!hasTmdbToken()) return { source: "demo" as const, covers: {} as Record<string, string> };

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

  const used = new Set<string>();
  const entries = candidates.map(([id, paths, categoryIndex]) => {
    const offset = paths.length ? (categoryIndex * 3) % paths.length : 0;
    const rotated = [...paths.slice(offset), ...paths.slice(0, offset)];
    const uniquePath = rotated.find((path) => !used.has(path)) ?? rotated[0] ?? "";
    if (uniquePath) used.add(uniquePath);
    return [id, uniquePath] as const;
  });

  return {
    source: "tmdb" as const,
    covers: Object.fromEntries(entries.filter(([, path]) => Boolean(path))),
  };
}

export async function officialProviders() {
  if (!hasTmdbToken()) return { source: "demo" as const, providers: PROVIDERS };
  try {
    const data = await tmdb<{ results: { provider_id: number; provider_name: string; logo_path: string }[] }>("/watch/providers/movie", {
      watch_region: REGION,
    });
    const logos = new Map(data.results.map((item) => [item.provider_id, item.logo_path]));
    return {
      source: "tmdb" as const,
      providers: PROVIDERS.map((provider) => ({ ...provider, logoPath: logos.get(provider.id) ?? null })),
    };
  } catch {
    return { source: "demo" as const, providers: PROVIDERS };
  }
}
