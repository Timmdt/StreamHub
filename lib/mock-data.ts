import type { CatalogItem, LegacyProvider } from "./types";

export const providers: LegacyProvider[] = [
  {
    key: "netflix",
    name: "Netflix",
    short: "N",
    accent: "#e50914",
    pricingUrl: "https://www.netflix.com/de/",
    tmdbNames: ["Netflix"]
  },
  {
    key: "prime",
    name: "Prime Video",
    short: "P",
    accent: "#00a8e1",
    pricingUrl: "https://www.amazon.de/amazonprime",
    tmdbNames: ["Amazon Prime Video", "Prime Video"]
  },
  {
    key: "disney",
    name: "Disney+",
    short: "D+",
    accent: "#4e7bff",
    pricingUrl: "https://www.disneyplus.com/de-de",
    tmdbNames: ["Disney Plus", "Disney+"]
  },
  {
    key: "paramount",
    name: "Paramount+",
    short: "P+",
    accent: "#2277ff",
    pricingUrl: "https://help.paramountplus.com/s/article/PD-What-plans-are-available-for-Paramount-and-how-much-do-they-cost",
    tmdbNames: ["Paramount Plus", "Paramount+"]
  },
  {
    key: "apple",
    name: "Apple TV+",
    short: "",
    accent: "#f5f5f7",
    pricingUrl: "https://www.apple.com/de/apple-tv-plus/",
    tmdbNames: ["Apple TV Plus", "Apple TV+"]
  },
  {
    key: "crunchyroll",
    name: "Crunchyroll",
    short: "C",
    accent: "#f47521",
    pricingUrl: "https://www.crunchyroll.com/de/premium",
    tmdbNames: ["Crunchyroll"]
  }
];

export const mockCatalog: CatalogItem[] = [
  {
    id: 101,
    mediaType: "movie",
    title: "Orbital Drift",
    type: "Film",
    year: 2026,
    rating: 8.2,
    providers: ["prime"],
    posterPath: null,
    backdropPath: null,
    description: "Demo-Inhalt. Hinterlege deinen TMDB-Token, damit hier echte Titel erscheinen.",
    releaseDate: "2026-07-12"
  },
  {
    id: 102,
    mediaType: "tv",
    title: "Neon Horizon",
    type: "Serie",
    year: 2026,
    rating: 8.6,
    providers: ["netflix", "prime"],
    posterPath: null,
    backdropPath: null,
    description: "Demo-Inhalt für die Oberfläche von StreamHub V0.3.",
    releaseDate: "2026-05-09"
  },
  {
    id: 103,
    mediaType: "tv",
    title: "Moonlit Protocol",
    type: "Anime",
    year: 2026,
    rating: 8.9,
    providers: ["crunchyroll"],
    posterPath: null,
    backdropPath: null,
    description: "Demo-Anime. Live-Daten kommen über TMDB, sobald der Token gesetzt ist.",
    releaseDate: "2026-08-20",
    genreIds: [16],
    originCountry: ["JP"]
  },
  {
    id: 104,
    mediaType: "movie",
    title: "Signal Black",
    type: "Film",
    year: 2025,
    rating: 7.8,
    providers: ["paramount"],
    posterPath: null,
    backdropPath: null,
    description: "Demo-Inhalt.",
    releaseDate: "2025-11-03"
  },
  {
    id: 105,
    mediaType: "tv",
    title: "Glass City",
    type: "Serie",
    year: 2025,
    rating: 8.0,
    providers: ["apple"],
    posterPath: null,
    backdropPath: null,
    description: "Demo-Inhalt.",
    releaseDate: "2025-10-18"
  },
  {
    id: 106,
    mediaType: "movie",
    title: "The Last Lighthouse",
    type: "Film",
    year: 2024,
    rating: 7.6,
    providers: ["disney"],
    posterPath: null,
    backdropPath: null,
    description: "Demo-Inhalt.",
    releaseDate: "2024-12-01"
  }
];
