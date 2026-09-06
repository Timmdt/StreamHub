export type MediaType = "movie" | "tv";

export type Provider = {
  id: number;
  name: string;
  short: string;
  color: string;
  logoPath?: string | null;
  link?: string;
};

export type EpisodeProviderLink = {
  providerId: number;
  url: string;
  directVideo: boolean;
  quality?: string;
  scope?: "episode" | "season" | "series";
};

export type Episode = {
  number: number;
  title: string;
  overview: string;
  year?: number;
  stillPath?: string | null;
  providerLinks: EpisodeProviderLink[];
};

export type Season = {
  number: number;
  title: string;
  providerLinks: EpisodeProviderLink[];
  episodes: Episode[];
};

export type EpisodeGuide = {
  status: "ready" | "not_configured" | "not_found" | "unavailable";
  seasons: Season[];
};

export type Title = {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  overview: string;
  year: string;
  rating: number;
  popularity: number;
  genreIds: number[];
  genres?: { id: number; name: string }[];
  posterPath: string | null;
  backdropPath: string | null;
  providers: Provider[];
  watchLink?: string;
  homepage?: string | null;
  anime?: boolean;
  runtime?: number | null;
  seasons?: number | null;
  episodeGuide?: EpisodeGuide;
};

export type CatalogResponse = {
  source: "tmdb" | "demo";
  page: number;
  totalPages: number;
  results: Title[];
};

export type Subscription = {
  providerId: number;
  active: boolean;
  plan: string;
  billingCycle: "Monatlich" | "Jährlich";
  nextBilling: string;
  endsAt: string;
  inactiveReason: string;
};

export type WatchOrderItemKind = "series" | "season" | "movie" | "special" | "alternative";

export type WatchOrderModeId = "story" | "release";

export type WatchOrderEntry = {
  id: string;
  title: string;
  description: string;
  year: string;
  kind: WatchOrderItemKind;
  mediaType: MediaType;
  tmdbId: number;
  imagePath?: string;
  seasonLabel?: string;
  episodeRange?: string;
  optional?: boolean;
  note?: string;
};

export type WatchOrderMode = {
  id: WatchOrderModeId;
  label: string;
  description: string;
  entries: WatchOrderEntry[];
};

export type WatchOrderSummary = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  aliases: string[];
  category: "anime" | "film";
  titleRefs: string[];
  backdropPath: string;
  posterPath: string;
  accent: string;
  entryCount: number;
  updatedAt: string;
};

export type WatchOrderResolvedEntry = WatchOrderEntry & {
  media: Title | null;
};

export type WatchOrderDetails = Omit<WatchOrderSummary, "entryCount"> & {
  entryCount: number;
  modes: (Omit<WatchOrderMode, "entries"> & { entries: WatchOrderResolvedEntry[] })[];
};

// Compatibility types for the earlier dashboard and API routes that remain in
// the project while StreamHubApp is the active V0.8 interface.
export type ProviderKey = "netflix" | "prime" | "disney" | "paramount" | "apple" | "crunchyroll";

export type CategoryKey =
  | "all"
  | "action"
  | "adventure"
  | "animation"
  | "anime"
  | "comedy"
  | "crime"
  | "documentary"
  | "drama"
  | "family"
  | "fantasy"
  | "horror"
  | "romance"
  | "scifi"
  | "thriller";

export type LegacyProvider = {
  key: ProviderKey;
  name: string;
  short: string;
  accent: string;
  pricingUrl: string;
  tmdbNames: string[];
};

export type CatalogItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  type: "Film" | "Serie" | "Anime";
  year: number;
  rating: number;
  providers: ProviderKey[];
  posterPath: string | null;
  backdropPath: string | null;
  description: string;
  releaseDate?: string;
  genreIds?: number[];
  originCountry?: string[];
  popularity?: number;
};

export type TitleDetail = CatalogItem & {
  genres: string[];
  runtime: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  homepage: string | null;
  watchLink: string | null;
};

export type CatalogPayload = {
  configured: boolean;
  source: "tmdb" | "demo";
  popular: CatalogItem[];
  newReleases: CatalogItem[];
  providerIds?: Partial<Record<ProviderKey, number>>;
  error?: string;
};

export type BrowsePayload = {
  configured: boolean;
  source: "tmdb" | "demo";
  results: CatalogItem[];
  page: number;
  hasMore: boolean;
  provider: ProviderKey | "all";
  category: CategoryKey;
  error?: string;
};

export type InactiveReason = "cancelled" | "expired" | "paused" | "payment_failed" | "manual";

export type LegacySubscription = {
  provider: ProviderKey;
  status: "active" | "inactive";
  plan: string;
  billingCycle: "monthly" | "yearly";
  nextBillingAt?: string;
  endsAt?: string;
  inactiveReason?: InactiveReason;
};

export type WatchHistoryEntry = {
  id: string;
  provider: ProviderKey;
  itemKey: string;
  mediaType: MediaType;
  title: string;
  genreIds: number[];
  category: CategoryKey;
  watchedAt: string;
};
