import { PROVIDER_BY_ID, PROVIDERS, trustedProviderTitleUrl } from "./providers";
import { localCacheKey, withLocalCache } from "./local-cache";
import type { EpisodeGuide, EpisodeProviderLink, MediaType, Provider } from "./types";

const DIRECT_API_ROOT = "https://api.movieofthenight.com/v4";
const RAPID_API_ROOT = "https://streaming-availability.p.rapidapi.com";
const REGION = "de";

type RawService = {
  id?: string;
  name?: string;
};

type RawStreamingOption = {
  service?: RawService;
  type?: string;
  link?: string;
  videoLink?: string;
  quality?: string;
};

type RawStreamingOptions = Record<string, RawStreamingOption[] | undefined>;

type RawEpisode = {
  title?: string;
  overview?: string;
  airYear?: number;
  streamingOptions?: RawStreamingOptions;
};

type RawSeason = {
  title?: string;
  streamingOptions?: RawStreamingOptions;
  episodes?: RawEpisode[];
};

type RawShow = {
  streamingOptions?: RawStreamingOptions;
  seasons?: RawSeason[];
};

export type StreamingAvailabilityResult = {
  titleLinks: EpisodeProviderLink[];
  linkedProviders: Provider[];
  episodeGuide?: EpisodeGuide;
};

type ApiConfig = {
  root: string;
  headers: Record<string, string>;
};

const providerServiceIds = new Map<string, number>([
  ["netflix", 8],
  ["prime", 119],
  ["amazon", 119],
  ["amazon prime video", 119],
  ["disney", 337],
  ["disney+", 337],
  ["paramount", 531],
  ["paramount+", 531],
  ["apple", 350],
  ["apple tv", 350],
  ["apple tv+", 350],
  ["crunchyroll", 283],
]);

function apiConfig(): ApiConfig | null {
  const directKey = process.env.STREAMING_AVAILABILITY_API_KEY?.trim()
    || process.env.MOVIE_OF_THE_NIGHT_API_KEY?.trim();
  if (directKey) {
    return {
      root: DIRECT_API_ROOT,
      headers: { "X-API-Key": directKey },
    };
  }

  const rapidKey = process.env.STREAMING_AVAILABILITY_RAPID_API_KEY?.trim();
  if (rapidKey) {
    return {
      root: RAPID_API_ROOT,
      headers: {
        "X-RapidAPI-Key": rapidKey,
        "X-RapidAPI-Host": "streaming-availability.p.rapidapi.com",
      },
    };
  }

  return null;
}

function optionsForGermany(options?: RawStreamingOptions) {
  if (!options) return [];
  return options[REGION] ?? options[REGION.toUpperCase()] ?? [];
}

function providerForService(service?: RawService) {
  const id = service?.id?.trim().toLocaleLowerCase("en") ?? "";
  const name = service?.name?.trim().toLocaleLowerCase("en") ?? "";
  const providerId = providerServiceIds.get(id)
    ?? providerServiceIds.get(name)
    ?? [...providerServiceIds].find(([key]) => id.includes(key) || name.includes(key))?.[1];
  return providerId ? PROVIDER_BY_ID.get(providerId) : undefined;
}

function supportedOffer(option: RawStreamingOption) {
  return !option.type || ["subscription", "free", "addon"].includes(option.type);
}

function exactProviderLinks(options: RawStreamingOption[], scope: EpisodeProviderLink["scope"] = "series") {
  const links = new Map<number, EpisodeProviderLink>();

  for (const option of options) {
    if (!supportedOffer(option)) continue;
    const provider = providerForService(option.service);
    if (!provider) continue;

    const directVideo = trustedProviderTitleUrl(provider.id, option.videoLink);
    const exactPage = trustedProviderTitleUrl(provider.id, option.link);
    const url = directVideo ?? exactPage;
    if (!url) continue;

    const current = links.get(provider.id);
    if (!current || (!current.directVideo && Boolean(directVideo))) {
      links.set(provider.id, {
        providerId: provider.id,
        url,
        directVideo: Boolean(directVideo),
        quality: option.quality,
        scope,
      });
    }
  }

  return [...links.values()];
}

function ordinalFromTitle(title: string | undefined, fallback: number) {
  if (!title) return fallback;
  if (/special/i.test(title)) return 0;
  const number = Number(title.match(/\d+/)?.[0]);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function toEpisodeGuide(show: RawShow): EpisodeGuide {
  const seasons = (show.seasons ?? [])
    .map((season, seasonIndex) => ({
      number: ordinalFromTitle(season.title, seasonIndex + 1),
      title: season.title?.trim() || `Staffel ${seasonIndex + 1}`,
      providerLinks: exactProviderLinks(optionsForGermany(season.streamingOptions), "season"),
      episodes: (season.episodes ?? []).map((episode, episodeIndex) => ({
        number: episodeIndex + 1,
        title: episode.title?.trim() || `Folge ${episodeIndex + 1}`,
        overview: episode.overview?.trim() || "Für diese Folge ist noch keine Beschreibung verfügbar.",
        year: episode.airYear,
        providerLinks: exactProviderLinks(optionsForGermany(episode.streamingOptions), "episode"),
      })),
    }))
    .filter((season) => season.episodes.length > 0)
    .sort((a, b) => a.number - b.number);

  return {
    status: seasons.length ? "ready" : "unavailable",
    seasons,
  };
}

export async function streamingAvailability(
  mediaType: MediaType,
  tmdbId: number,
): Promise<StreamingAvailabilityResult> {
  const config = apiConfig();
  if (!config) {
    return {
      titleLinks: [],
      linkedProviders: [],
      episodeGuide: mediaType === "tv" ? { status: "not_configured", seasons: [] } : undefined,
    };
  }

  const url = new URL(`${config.root}/shows/${mediaType}/${tmdbId}`);
  url.searchParams.set("country", REGION);
  url.searchParams.set("series_granularity", mediaType === "tv" ? "episode" : "show");

  try {
    return await withLocalCache(
      localCacheKey("streaming-availability", `${config.root}:${REGION}:${mediaType}:${tmdbId}`),
      1000 * 60 * 60 * 6,
      async () => {
        const response = await fetch(url, {
          headers: { ...config.headers, accept: "application/json" },
          next: { revalidate: 60 * 60 * 6 },
        });

        if (response.status === 404) {
          return {
            titleLinks: [],
            linkedProviders: [],
            episodeGuide: mediaType === "tv" ? { status: "not_found" as const, seasons: [] } : undefined,
          };
        }
        if (!response.ok) throw new Error(`Streaming Availability API ${response.status}`);

        const show = await response.json() as RawShow;
        const titleLinks = exactProviderLinks(optionsForGermany(show.streamingOptions));
        const linkedProviders = titleLinks
          .map((link) => PROVIDER_BY_ID.get(link.providerId))
          .filter((provider): provider is Provider => Boolean(provider));

        return {
          titleLinks,
          linkedProviders,
          episodeGuide: mediaType === "tv" ? toEpisodeGuide(show) : undefined,
        };
      },
    );
  } catch (error) {
    console.error(error);
    return {
      titleLinks: [],
      linkedProviders: [],
      episodeGuide: mediaType === "tv" ? { status: "unavailable", seasons: [] } : undefined,
    };
  }
}

export function hasStreamingAvailabilityKey() {
  return Boolean(apiConfig());
}

export const STREAMING_AVAILABILITY_PROVIDERS = PROVIDERS;
