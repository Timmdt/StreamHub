export type MediaType = "movie" | "tv";

export type Provider = {
  id: number;
  name: string;
  short: string;
  color: string;
  logoPath?: string | null;
  link?: string;
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
