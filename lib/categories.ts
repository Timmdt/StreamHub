import type { CatalogItem, CategoryKey, MediaType } from "./types";

export type CategoryDefinition = {
  key: CategoryKey;
  label: string;
  movieGenre?: number;
  tvGenre?: number;
  anime?: boolean;
};

export const categories: CategoryDefinition[] = [
  { key: "all", label: "Alle" },
  { key: "action", label: "Action", movieGenre: 28, tvGenre: 10759 },
  { key: "adventure", label: "Abenteuer", movieGenre: 12, tvGenre: 10759 },
  { key: "animation", label: "Animation", movieGenre: 16, tvGenre: 16 },
  { key: "anime", label: "Anime", movieGenre: 16, tvGenre: 16, anime: true },
  { key: "comedy", label: "Komödie", movieGenre: 35, tvGenre: 35 },
  { key: "crime", label: "Krimi", movieGenre: 80, tvGenre: 80 },
  { key: "documentary", label: "Doku", movieGenre: 99, tvGenre: 99 },
  { key: "drama", label: "Drama", movieGenre: 18, tvGenre: 18 },
  { key: "family", label: "Familie", movieGenre: 10751, tvGenre: 10751 },
  { key: "fantasy", label: "Fantasy", movieGenre: 14, tvGenre: 10765 },
  { key: "horror", label: "Horror", movieGenre: 27 },
  { key: "romance", label: "Romance", movieGenre: 10749 },
  { key: "scifi", label: "Sci‑Fi", movieGenre: 878, tvGenre: 10765 },
  { key: "thriller", label: "Thriller", movieGenre: 53 }
];

export function categoryDefinition(key: CategoryKey) {
  return categories.find((category) => category.key === key) ?? categories[0];
}

export function genreForCategory(key: CategoryKey, mediaType: MediaType) {
  const category = categoryDefinition(key);
  return mediaType === "movie" ? category.movieGenre : category.tvGenre;
}

export function itemMatchesCategory(item: CatalogItem, key: CategoryKey) {
  if (key === "all") return true;
  const category = categoryDefinition(key);
  const genre = item.mediaType === "movie" ? category.movieGenre : category.tvGenre;
  if (category.anime) {
    return item.type === "Anime" || Boolean(item.genreIds?.includes(16) && item.originCountry?.includes("JP"));
  }
  return typeof genre === "number" ? Boolean(item.genreIds?.includes(genre)) : false;
}

export function categoryLabelsForItem(item: CatalogItem) {
  return categories
    .filter((category) => category.key !== "all" && itemMatchesCategory(item, category.key))
    .map((category) => category.label);
}
