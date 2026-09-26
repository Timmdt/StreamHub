import { catalogFullTextSearchAvailable, getStreamHubDatabase } from "./local-cache";
import type { Provider, Title } from "./types";

type StoredTitleRow = { payload_json: string };

const TITLE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const PROVIDER_MAX_AGE_MS = 1000 * 60 * 60 * 6;

function titleKey(title: Pick<Title, "mediaType" | "id">) {
  return `${title.mediaType}:${title.id}`;
}

function parseStoredTitle(row?: StoredTitleRow) {
  if (!row) return null;
  try {
    return JSON.parse(row.payload_json) as Title;
  } catch {
    return null;
  }
}

function mergeTitle(existing: Title | null, incoming: Title): Title {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    originalTitle: incoming.originalTitle ?? existing.originalTitle,
    genres: incoming.genres?.length ? incoming.genres : existing.genres,
    watchLink: incoming.watchLink ?? existing.watchLink,
    homepage: incoming.homepage ?? existing.homepage,
    runtime: incoming.runtime ?? existing.runtime,
    seasons: incoming.seasons ?? existing.seasons,
    episodeGuide: incoming.episodeGuide ?? existing.episodeGuide,
  };
}

export function upsertCatalogTitles(titles: Title[]) {
  if (!titles.length) return;
  const database = getStreamHubDatabase();
  const now = Date.now();
  const selectTitle = database.prepare(`
    SELECT payload_json FROM catalog_titles WHERE media_type = ? AND tmdb_id = ?
  `);
  const upsertTitle = database.prepare(`
    INSERT INTO catalog_titles(
      media_type, tmdb_id, title, original_title, overview, year, rating, popularity,
      genre_ids_json, genres_json, poster_path, backdrop_path, watch_link, homepage,
      anime, runtime, seasons, payload_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(media_type, tmdb_id) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      overview = excluded.overview,
      year = excluded.year,
      rating = excluded.rating,
      popularity = excluded.popularity,
      genre_ids_json = excluded.genre_ids_json,
      genres_json = excluded.genres_json,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      watch_link = excluded.watch_link,
      homepage = excluded.homepage,
      anime = excluded.anime,
      runtime = excluded.runtime,
      seasons = excluded.seasons,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);
  const upsertProvider = database.prepare(`
    INSERT INTO catalog_providers(provider_id, name, short, color, logo_path, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET
      name = excluded.name,
      short = excluded.short,
      color = excluded.color,
      logo_path = COALESCE(excluded.logo_path, catalog_providers.logo_path),
      updated_at = excluded.updated_at
  `);
  const deleteProviders = database.prepare(`
    DELETE FROM title_providers WHERE media_type = ? AND tmdb_id = ?
  `);
  const insertProvider = database.prepare(`
    INSERT INTO title_providers(media_type, tmdb_id, provider_id, link, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const ftsAvailable = catalogFullTextSearchAvailable();
  const deleteSearch = ftsAvailable
    ? database.prepare("DELETE FROM catalog_search WHERE search_key = ?")
    : null;
  const insertSearch = ftsAvailable
    ? database.prepare("INSERT INTO catalog_search(search_key, title, original_title, overview) VALUES (?, ?, ?, ?)")
    : null;

  database.exec("BEGIN IMMEDIATE");
  try {
    titles.forEach((incoming) => {
      const existingRow = selectTitle.get(incoming.mediaType, incoming.id) as StoredTitleRow | undefined;
      const title = mergeTitle(parseStoredTitle(existingRow), incoming);
      upsertTitle.run(
        title.mediaType,
        title.id,
        title.title,
        title.originalTitle ?? null,
        title.overview,
        title.year,
        title.rating,
        title.popularity,
        JSON.stringify(title.genreIds),
        title.genres ? JSON.stringify(title.genres) : null,
        title.posterPath,
        title.backdropPath,
        title.watchLink ?? null,
        title.homepage ?? null,
        title.anime ? 1 : 0,
        title.runtime ?? null,
        title.seasons ?? null,
        JSON.stringify(title),
        now,
      );

      deleteProviders.run(title.mediaType, title.id);
      title.providers.forEach((provider: Provider) => {
        upsertProvider.run(
          provider.id,
          provider.name,
          provider.short,
          provider.color,
          provider.logoPath ?? null,
          now,
        );
        insertProvider.run(title.mediaType, title.id, provider.id, provider.link ?? null, now);
      });

      if (deleteSearch && insertSearch) {
        deleteSearch.run(titleKey(title));
        insertSearch.run(titleKey(title), title.title, title.originalTitle ?? "", title.overview);
      }
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function searchTokens(query: string) {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .match(/[a-z0-9äöüß]+/g)
    ?.filter((token) => token.length > 1)
    .slice(0, 8) ?? [];
}

function parseRows(rows: unknown[]) {
  const unique = new Map<string, Title>();
  rows.forEach((raw) => {
    const title = parseStoredTitle(raw as StoredTitleRow);
    if (title) unique.set(titleKey(title), title);
  });
  return [...unique.values()];
}

export function searchIndexedTitles(query: string, providerIds: number[], limit = 36) {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];
  const database = getStreamHubDatabase();
  const safeProviderIds = [...new Set(providerIds.filter(Number.isInteger))];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const providerPlaceholders = safeProviderIds.map(() => "?").join(", ");
  const providerFilter = safeProviderIds.length
    ? `AND EXISTS (
        SELECT 1 FROM title_providers tp
        WHERE tp.media_type = titles.media_type
          AND tp.tmdb_id = titles.tmdb_id
          AND tp.provider_id IN (${providerPlaceholders})
          AND tp.updated_at >= ?
      )`
    : "";
  const titleCutoff = Date.now() - TITLE_MAX_AGE_MS;
  const providerCutoff = Date.now() - PROVIDER_MAX_AGE_MS;

  if (catalogFullTextSearchAvailable()) {
    try {
      const matchQuery = tokens.map((token) => `"${token}"*`).join(" AND ");
      const parameters: Array<string | number> = [matchQuery, titleCutoff, ...safeProviderIds];
      if (safeProviderIds.length) parameters.push(providerCutoff);
      parameters.push(safeLimit);
      const rows = database.prepare(`
        SELECT titles.payload_json
        FROM catalog_search
        JOIN catalog_titles titles
          ON catalog_search.search_key = titles.media_type || ':' || titles.tmdb_id
        WHERE catalog_search MATCH ?
          AND titles.updated_at >= ?
          ${providerFilter}
        ORDER BY bm25(catalog_search), titles.popularity DESC, titles.rating DESC
        LIMIT ?
      `).all(...parameters);
      const results = parseRows(rows);
      if (results.length) return results;
    } catch {
      // LIKE bleibt als kompatibler Fallback aktiv, falls FTS auf dem Host fehlt.
    }
  }

  const like = `%${tokens.join("%")}%`;
  const parameters: Array<string | number> = [titleCutoff, like, like, ...safeProviderIds];
  if (safeProviderIds.length) parameters.push(providerCutoff);
  parameters.push(safeLimit);
  const rows = database.prepare(`
    SELECT titles.payload_json
    FROM catalog_titles titles
    WHERE titles.updated_at >= ?
      AND (
        lower(titles.title) LIKE ?
        OR lower(COALESCE(titles.original_title, '')) LIKE ?
      )
      ${providerFilter}
    ORDER BY titles.popularity DESC, titles.rating DESC
    LIMIT ?
  `).all(...parameters);
  return parseRows(rows);
}
