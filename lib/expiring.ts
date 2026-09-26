import { localCacheKey, withLocalCache } from "./local-cache";
import { PROVIDER_BY_ID, trustedProviderTitleUrl } from "./providers";
import { watchOrderTitleDetails } from "./tmdb";
import type { ExpiringCatalogResponse, ExpiringProvider, ExpiringTitle, MediaType } from "./types";

const DIRECT_API_ROOT = "https://api.movieofthenight.com/v4";
const RAPID_API_ROOT = "https://streaming-availability.p.rapidapi.com";
const REGION = "de";

type ApiConfig = { root: string; headers: Record<string, string> };
type RawService = { id?: string; name?: string };
type RawChange = {
  showId?: string;
  showType?: "movie" | "series";
  itemType?: "show" | "season" | "episode";
  changeType?: "expiring";
  timestamp?: number;
  link?: string;
  service?: RawService;
  streamingOptionType?: string;
};
type RawChangedShow = { tmdbId?: string | number; showType?: "movie" | "series" };
type RawChangesResult = {
  changes?: RawChange[];
  shows?: Record<string, RawChangedShow | undefined>;
  hasMore?: boolean;
  nextCursor?: string;
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

const providerCatalogIds = new Map<number, string>([
  [8, "netflix"],
  [119, "prime.subscription"],
  [337, "disney"],
  [531, "paramount"],
  [350, "apple"],
  [283, "crunchyroll"],
]);

function apiConfig(): ApiConfig | null {
  const directKey = process.env.STREAMING_AVAILABILITY_API_KEY?.trim()
    || process.env.MOVIE_OF_THE_NIGHT_API_KEY?.trim();
  if (directKey) return { root: DIRECT_API_ROOT, headers: { "X-API-Key": directKey } };
  const rapidKey = process.env.STREAMING_AVAILABILITY_RAPID_API_KEY?.trim();
  if (!rapidKey) return null;
  return {
    root: RAPID_API_ROOT,
    headers: {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": "streaming-availability.p.rapidapi.com",
    },
  };
}

function providerIdForService(service?: RawService) {
  const id = service?.id?.trim().toLocaleLowerCase("en") ?? "";
  const name = service?.name?.trim().toLocaleLowerCase("en") ?? "";
  return providerServiceIds.get(id)
    ?? providerServiceIds.get(name)
    ?? [...providerServiceIds].find(([key]) => id.includes(key) || name.includes(key))?.[1];
}

function emptyCatalog(): ExpiringCatalogResponse {
  return { source: "unavailable", results: [], hasMore: false, fetchedAt: new Date().toISOString() };
}

export async function expiringCatalog(providerIds: number[]): Promise<ExpiringCatalogResponse> {
  const config = apiConfig();
  const requestedProviders = [...new Set(providerIds)].filter((id) => PROVIDER_BY_ID.has(id));
  const catalogs = requestedProviders
    .map((id) => providerCatalogIds.get(id))
    .filter((id): id is string => Boolean(id));
  if (!config || !catalogs.length) return emptyCatalog();

  const cacheKey = localCacheKey("expiring-catalog-v2", `${config.root}:${REGION}:${catalogs.slice().sort().join(",")}`);
  try {
    return await withLocalCache(cacheKey, 1000 * 60 * 60 * 3, async () => {
      const allChanges: RawChange[] = [];
      const allShows: Record<string, RawChangedShow | undefined> = {};
      let cursor: string | undefined;
      let hasMore = false;

      for (let page = 0; page < 4; page += 1) {
        const url = new URL(`${config.root}/changes`);
        url.searchParams.set("country", REGION);
        url.searchParams.set("catalogs", catalogs.join(","));
        url.searchParams.set("change_type", "expiring");
        url.searchParams.set("item_type", "show");
        url.searchParams.set("include_unknown_dates", "false");
        url.searchParams.set("order_direction", "asc");
        url.searchParams.set("output_language", "de");
        if (cursor) url.searchParams.set("cursor", cursor);

        const response = await fetch(url, {
          headers: { ...config.headers, accept: "application/json" },
          next: { revalidate: 60 * 60 * 3 },
        });
        if (!response.ok) throw new Error(`Streaming Availability changes API ${response.status}`);
        const pageData = await response.json() as RawChangesResult;
        allChanges.push(...(pageData.changes ?? []));
        Object.assign(allShows, pageData.shows ?? {});
        hasMore = Boolean(pageData.hasMore);
        cursor = pageData.nextCursor;
        if (!hasMore || !cursor) break;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const grouped = new Map<string, { mediaType: MediaType; tmdbId: number; providers: ExpiringProvider[] }>();
      for (const change of allChanges) {
        if (change.changeType !== "expiring" || change.itemType !== "show") continue;
        if (!change.timestamp || change.timestamp < nowSeconds) continue;
        if (change.streamingOptionType && !["subscription", "free", "addon"].includes(change.streamingOptionType)) continue;
        const rawShow = change.showId ? allShows[change.showId] : undefined;
        const tmdbId = Number(String(rawShow?.tmdbId ?? "").split("/").at(-1));
        const mediaType: MediaType = (change.showType ?? rawShow?.showType) === "series" ? "tv" : "movie";
        const providerId = providerIdForService(change.service);
        if (!tmdbId || !providerId || !requestedProviders.includes(providerId)) continue;

        const directLink = trustedProviderTitleUrl(providerId, change.link) ?? undefined;
        const itemKey = `${mediaType}:${tmdbId}`;
        const current = grouped.get(itemKey) ?? { mediaType, tmdbId, providers: [] };
        const existing = current.providers.find((item) => item.providerId === providerId);
        if (!existing || change.timestamp < existing.expiresOn) {
          current.providers = current.providers.filter((item) => item.providerId !== providerId);
          current.providers.push({ providerId, expiresOn: change.timestamp, link: directLink });
        }
        grouped.set(itemKey, current);
      }

      const groups = [...grouped.values()];
      const resolved: ExpiringTitle[] = [];
      let nextGroup = 0;
      const workers = Array.from({ length: Math.min(6, groups.length) }, async () => {
        while (nextGroup < groups.length) {
          const group = groups[nextGroup++];
          const title = await watchOrderTitleDetails(group.mediaType, group.tmdbId);
          if (!title) continue;
          const expiringProviders = group.providers.sort((left, right) => left.expiresOn - right.expiresOn);
          resolved.push({ ...title, expiresOn: expiringProviders[0].expiresOn, expiringProviders });
        }
      });
      await Promise.all(workers);
      resolved.sort((left, right) => left.expiresOn - right.expiresOn || right.popularity - left.popularity);
      return {
        source: "streaming-availability",
        results: resolved,
        hasMore,
        fetchedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error(error);
    return emptyCatalog();
  }
}
