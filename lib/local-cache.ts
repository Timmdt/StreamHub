import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type LegacyCacheEntry = {
  value: unknown;
  expiresAt: number;
  updatedAt: number;
};

type LegacyCacheFile = {
  version: 1;
  entries: Record<string, LegacyCacheEntry>;
};

type CacheRow = {
  value_json: string;
  expires_at: number;
};

type CountRow = { count: number };

const DATA_DIRECTORY = process.env.STREAMHUB_DATA_DIR?.trim()
  || path.join(process.cwd(), ".streamhub-data");
const DATABASE_FILE = path.join(DATA_DIRECTORY, "streamhub.sqlite");
const LEGACY_CACHE_FILE = path.join(DATA_DIRECTORY, "cache-v1.json");
const MAX_CACHE_ENTRIES = 20_000;

const globalDatabase = globalThis as typeof globalThis & {
  streamHubDatabase?: DatabaseSync;
  streamHubDatabaseInitialized?: boolean;
  streamHubDatabaseMaintained?: boolean;
};

const inFlight = new Map<string, Promise<unknown>>();
let hits = 0;
let misses = 0;

function namespaceFromKey(key: string) {
  return key.split(":", 1)[0] || "general";
}

function initializeSchema(database: DatabaseSync) {
  if (globalDatabase.streamHubDatabaseInitialized) return;
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;

    CREATE TABLE IF NOT EXISTS database_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS cache_entries (
      cache_key TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      value_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0
    ) STRICT;

    CREATE INDEX IF NOT EXISTS cache_entries_expiry_idx
      ON cache_entries(expires_at);
    CREATE INDEX IF NOT EXISTS cache_entries_namespace_updated_idx
      ON cache_entries(namespace, updated_at DESC);

    CREATE TABLE IF NOT EXISTS catalog_titles (
      media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
      tmdb_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      original_title TEXT,
      overview TEXT NOT NULL,
      year TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 0,
      popularity REAL NOT NULL DEFAULT 0,
      genre_ids_json TEXT NOT NULL,
      genres_json TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      watch_link TEXT,
      homepage TEXT,
      anime INTEGER NOT NULL DEFAULT 0,
      runtime INTEGER,
      seasons INTEGER,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(media_type, tmdb_id)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS catalog_titles_popularity_idx
      ON catalog_titles(popularity DESC);
    CREATE INDEX IF NOT EXISTS catalog_titles_updated_idx
      ON catalog_titles(updated_at DESC);
    CREATE INDEX IF NOT EXISTS catalog_titles_year_idx
      ON catalog_titles(year);

    CREATE TABLE IF NOT EXISTS catalog_providers (
      provider_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      short TEXT NOT NULL,
      color TEXT NOT NULL,
      logo_path TEXT,
      updated_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS title_providers (
      media_type TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      link TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(media_type, tmdb_id, provider_id),
      FOREIGN KEY(media_type, tmdb_id)
        REFERENCES catalog_titles(media_type, tmdb_id) ON DELETE CASCADE,
      FOREIGN KEY(provider_id)
        REFERENCES catalog_providers(provider_id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX IF NOT EXISTS title_providers_provider_idx
      ON title_providers(provider_id, updated_at DESC);
  `);

  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS catalog_search USING fts5(
        search_key UNINDEXED,
        title,
        original_title,
        overview,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `);
    database.prepare("INSERT OR REPLACE INTO database_meta(key, value) VALUES ('fts5', 'true')").run();
  } catch {
    database.prepare("INSERT OR REPLACE INTO database_meta(key, value) VALUES ('fts5', 'false')").run();
  }

  database.prepare("INSERT OR REPLACE INTO database_meta(key, value) VALUES ('schema_version', '2')").run();
  globalDatabase.streamHubDatabaseInitialized = true;
}

function migrateLegacyCache(database: DatabaseSync) {
  const migrated = database.prepare("SELECT value FROM database_meta WHERE key = 'legacy_json_imported'").get();
  if (migrated) return;

  database.exec("BEGIN IMMEDIATE");
  try {
    if (existsSync(LEGACY_CACHE_FILE)) {
      const legacy = JSON.parse(readFileSync(LEGACY_CACHE_FILE, "utf8")) as LegacyCacheFile;
      const insert = database.prepare(`
        INSERT OR IGNORE INTO cache_entries(
          cache_key, namespace, value_json, expires_at, updated_at, last_accessed_at, hit_count
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
      `);
      if (legacy.version === 1 && legacy.entries) {
        Object.entries(legacy.entries).forEach(([key, entry]) => {
          insert.run(
            key,
            namespaceFromKey(key),
            JSON.stringify(entry.value),
            entry.expiresAt,
            entry.updatedAt,
            entry.updatedAt,
          );
        });
      }
    }
    database.prepare("INSERT OR REPLACE INTO database_meta(key, value) VALUES ('legacy_json_imported', ?)")
      .run(new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function maintainDatabase(database: DatabaseSync) {
  if (globalDatabase.streamHubDatabaseMaintained) return;
  const oldestUsefulFallback = Date.now() - 1000 * 60 * 60 * 24 * 30;
  database.prepare("DELETE FROM cache_entries WHERE expires_at < ?").run(oldestUsefulFallback);
  database.exec("PRAGMA optimize");
  try {
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    // Ein paralleler Next.js-Worker kann den WAL-Checkpoint kurzzeitig blockieren.
  }
  globalDatabase.streamHubDatabaseMaintained = true;
}

export function getStreamHubDatabase() {
  if (!globalDatabase.streamHubDatabase) {
    mkdirSync(DATA_DIRECTORY, { recursive: true });
    globalDatabase.streamHubDatabase = new DatabaseSync(DATABASE_FILE, { timeout: 5_000 });
  }
  initializeSchema(globalDatabase.streamHubDatabase);
  migrateLegacyCache(globalDatabase.streamHubDatabase);
  maintainDatabase(globalDatabase.streamHubDatabase);
  return globalDatabase.streamHubDatabase;
}

export function streamHubDatabasePath() {
  return DATABASE_FILE;
}

export function catalogFullTextSearchAvailable() {
  const row = getStreamHubDatabase()
    .prepare("SELECT value FROM database_meta WHERE key = 'fts5'")
    .get() as { value?: string } | undefined;
  return row?.value === "true";
}

function pruneCache(database: DatabaseSync) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM cache_entries").get() as CountRow;
  if (row.count <= MAX_CACHE_ENTRIES) return;
  database.prepare(`
    DELETE FROM cache_entries
    WHERE cache_key IN (
      SELECT cache_key FROM cache_entries
      ORDER BY last_accessed_at DESC, updated_at DESC
      LIMIT -1 OFFSET ?
    )
  `).run(MAX_CACHE_ENTRIES);
}

export function localCacheKey(namespace: string, value: string) {
  const digest = createHash("sha256").update(value).digest("hex");
  return `${namespace}:${digest}`;
}

export async function withLocalCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const database = getStreamHubDatabase();
  const cached = database.prepare(`
    SELECT value_json, expires_at
    FROM cache_entries
    WHERE cache_key = ?
  `).get(key) as CacheRow | undefined;
  const now = Date.now();

  if (cached && cached.expires_at > now) {
    hits += 1;
    database.prepare(`
      UPDATE cache_entries
      SET last_accessed_at = ?, hit_count = hit_count + 1
      WHERE cache_key = ?
    `).run(now, key);
    return JSON.parse(cached.value_json) as T;
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  misses += 1;
  const request = (async () => {
    try {
      const value = await loader();
      database.prepare(`
        INSERT INTO cache_entries(
          cache_key, namespace, value_json, expires_at, updated_at, last_accessed_at, hit_count
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(cache_key) DO UPDATE SET
          namespace = excluded.namespace,
          value_json = excluded.value_json,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at,
          last_accessed_at = excluded.last_accessed_at
      `).run(key, namespaceFromKey(key), JSON.stringify(value), now + ttlMs, now, now);
      pruneCache(database);
      return value;
    } catch (error) {
      // Bei kurzen API-Ausfällen bleiben vorhandene Daten als Notfall-Fallback nutzbar.
      if (cached) return JSON.parse(cached.value_json) as T;
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, request);
  return request;
}

export async function localCacheStats() {
  const database = getStreamHubDatabase();
  const cache = database.prepare("SELECT COUNT(*) AS count FROM cache_entries").get() as CountRow;
  const expired = database.prepare("SELECT COUNT(*) AS count FROM cache_entries WHERE expires_at <= ?").get(Date.now()) as CountRow;
  const titles = database.prepare("SELECT COUNT(*) AS count FROM catalog_titles").get() as CountRow;
  const providers = database.prepare("SELECT COUNT(*) AS count FROM catalog_providers").get() as CountRow;
  const titleProviders = database.prepare("SELECT COUNT(*) AS count FROM title_providers").get() as CountRow;

  return {
    active: true,
    engine: "sqlite",
    schemaVersion: 2,
    file: path.basename(DATABASE_FILE),
    fileBytes: existsSync(DATABASE_FILE) ? statSync(DATABASE_FILE).size : 0,
    entries: cache.count,
    expiredEntries: expired.count,
    indexedTitles: titles.count,
    indexedProviders: providers.count,
    titleProviderLinks: titleProviders.count,
    fullTextSearch: catalogFullTextSearchAvailable(),
    hits,
    misses,
  };
}
