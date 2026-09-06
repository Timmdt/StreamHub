"use client";

import Image from "next/image";
import {
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Compass,
  ExternalLink,
  Film,
  Heart,
  Home,
  Info,
  Layers3,
  ListOrdered,
  LoaderCircle,
  Menu,
  MonitorCog,
  Play,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_OPTIONS, DEFAULT_SUBSCRIPTIONS, PROVIDERS, providerTitleDestination } from "@/lib/providers";
import type {
  CatalogResponse,
  Provider,
  Subscription,
  Title,
  WatchOrderDetails,
  WatchOrderModeId,
  WatchOrderSummary,
} from "@/lib/types";

type View = "home" | "discover" | "orders" | "expiring" | "watchlist" | "settings";
type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

type NotificationItem = {
  id: string;
  title: string;
  text: string;
  urgent?: boolean;
  read?: boolean;
};

const NAV_ITEMS: { id: View; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Start", icon: Home },
  { id: "discover", label: "Entdecken", icon: Compass },
  { id: "orders", label: "Reihenfolgen", icon: ListOrdered },
  { id: "expiring", label: "Läuft bald ab", icon: Clock3 },
  { id: "watchlist", label: "Watchlist", icon: Heart },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => ["home", "discover", "orders", "watchlist"].includes(item.id));

const ROWS = [
  { id: "taste", title: "Für deinen Geschmack", subtitle: "Basierend auf deinen angesehenen Titeln", kind: "all", icon: Sparkles },
  { id: "popular-movies", title: "Filme – aktuell beliebt", subtitle: "Die meistgesehenen Filme bei deinen Diensten", kind: "movies", icon: Film },
  { id: "popular-series", title: "Serien – aktuell beliebt", subtitle: "Serien, über die gerade alle sprechen", kind: "series", icon: Tv },
  { id: "popular-anime", title: "Anime – aktuell beliebt", subtitle: "Neue Folgen und große Favoriten", kind: "anime", icon: Layers3 },
  { id: "movies-for-you", title: "Filme für dich", subtitle: "Passend zu deinem Geschmack", kind: "movies", icon: Sparkles },
  { id: "series-for-you", title: "Serien für dich", subtitle: "Deine persönliche nächste Serie", kind: "series", icon: Sparkles },
] as const;

const CATEGORY_COVER_ROTATION_MS = 18_000;

function titleKey(title: Pick<Title, "mediaType" | "id">) {
  return `${title.mediaType}:${title.id}`;
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de").replace(/[^a-z0-9]+/g, " ").trim();
}

function watchOrderMatches(order: WatchOrderSummary, query: string) {
  const needle = normalizedText(query);
  if (needle.length < 2) return false;
  const values = [order.title, ...order.aliases].map(normalizedText);
  return values.some((value) => value.includes(needle))
    || needle.split(" ").every((word) => values.some((value) => value.includes(word)));
}

function normalizeSubscriptions(value: unknown): Subscription[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];
  return DEFAULT_SUBSCRIPTIONS.map((fallback) => {
    const provider = PROVIDERS.find((item) => item.id === fallback.providerId)!;
    const match = records.find((record) => {
      if (!record || typeof record !== "object") return false;
      const item = record as Record<string, unknown>;
      return Number(item.providerId ?? item.id) === fallback.providerId
        || String(item.provider ?? item.name ?? "").toLocaleLowerCase("de") === provider.name.toLocaleLowerCase("de");
    }) as Record<string, unknown> | undefined;
    if (!match) return fallback;
    return {
      providerId: fallback.providerId,
      active: typeof match.active === "boolean" ? match.active : fallback.active,
      plan: String(match.plan ?? match.tariff ?? fallback.plan),
      billingCycle: match.billingCycle === "Jährlich" ? "Jährlich" : match.billingCycle === "Monatlich" ? "Monatlich" : fallback.billingCycle,
      nextBilling: String(match.nextBilling ?? match.nextBillingDate ?? ""),
      endsAt: String(match.endsAt ?? match.expiryDate ?? match.endDate ?? ""),
      inactiveReason: String(match.inactiveReason ?? match.reason ?? ""),
    };
  });
}

function normalizeWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.map((entry) => {
    if (typeof entry === "string") return entry.includes(":") ? entry : `movie:${entry}`;
    if (typeof entry === "number") return `movie:${entry}`;
    if (!entry || typeof entry !== "object") return "";
    const item = entry as Record<string, unknown>;
    const id = Number(item.id);
    const mediaType = item.mediaType === "tv" || item.media_type === "tv" ? "tv" : "movie";
    return id ? `${mediaType}:${id}` : "";
  }).filter(Boolean);
  return [...new Set(keys)];
}

function normalizeSavedTitles(value: unknown): Record<string, Title> {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];
  const result: Record<string, Title> = {};
  candidates.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as Partial<Title> & { media_type?: string; name?: string };
    if (!Number(item.id)) return;
    const mediaType = item.mediaType === "tv" || item.media_type === "tv" ? "tv" : "movie";
    const normalized: Title = {
      id: Number(item.id),
      mediaType,
      title: String(item.title ?? item.name ?? "Gespeicherter Titel"),
      overview: String(item.overview ?? ""),
      year: String(item.year ?? "—"),
      rating: Number(item.rating ?? 0),
      popularity: Number(item.popularity ?? 0),
      genreIds: Array.isArray(item.genreIds) ? item.genreIds.map(Number) : [],
      posterPath: item.posterPath ?? null,
      backdropPath: item.backdropPath ?? null,
      providers: Array.isArray(item.providers) ? item.providers : [],
      anime: Boolean(item.anime),
    };
    result[titleKey(normalized)] = normalized;
  });
  return result;
}

function useStoredState<T>(key: string, fallback: T, legacyKeys: string[] = [], normalize?: (value: unknown) => T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const legacyKeyList = legacyKeys.join("|");
  useEffect(() => {
    for (const candidate of [key, ...legacyKeyList.split("|").filter(Boolean)]) {
      const stored = window.localStorage.getItem(candidate);
      if (!stored) continue;
      try {
        const parsed: unknown = JSON.parse(stored);
        setValue(normalize ? normalize(parsed) : parsed as T);
        break;
      } catch {
        // Ignore data from an incompatible older version.
      }
    }
    setReady(true);
  }, [key, legacyKeyList, normalize]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, ready, value]);
  return [value, setValue] as const;
}

function ProviderMark({
  provider,
  small = false,
  muted = false,
  mutedReason,
}: {
  provider: Provider;
  small?: boolean;
  muted?: boolean;
  mutedReason?: string;
}) {
  const label = muted ? `${provider.name} – ${mutedReason ?? "nicht in deinen aktiven Diensten"}` : provider.name;
  return (
    <span
      className={`provider-mark ${small ? "provider-mark--small" : ""} ${muted ? "provider-mark--muted" : ""}`}
      style={{ "--provider": provider.color } as React.CSSProperties}
      title={label}
      aria-label={label}
    >
      {provider.logoPath ? (
        <Image src={`https://image.tmdb.org/t/p/w92${provider.logoPath}`} alt="" width={small ? 20 : 26} height={small ? 20 : 26} />
      ) : (
        provider.short
      )}
    </span>
  );
}

function ProviderMarks({
  providers,
  limit,
  ownedProviderIds,
  mutedProviderIds,
}: {
  providers: Provider[];
  limit?: number;
  ownedProviderIds?: ReadonlySet<number>;
  mutedProviderIds?: ReadonlySet<number>;
}) {
  const ordered = ownedProviderIds
    ? [...providers].sort((a, b) => Number(ownedProviderIds.has(b.id)) - Number(ownedProviderIds.has(a.id)))
    : providers;
  const visible = typeof limit === "number" ? ordered.slice(0, limit) : ordered;
  return (
    <span className="provider-marks" aria-label={ordered.map((provider) => provider.name).join(", ")}>
      {visible.map((provider) => {
        const isNotOwned = Boolean(ownedProviderIds && !ownedProviderIds.has(provider.id));
        const hasNoDirectLink = Boolean(mutedProviderIds?.has(provider.id));
        const mutedReason = isNotOwned
          ? "nicht in deinen aktiven Diensten"
          : hasNoDirectLink
            ? "kein exakter Direktlink"
            : undefined;
        return <ProviderMark key={provider.id} provider={provider} small muted={Boolean(mutedReason)} mutedReason={mutedReason} />;
      })}
      {limit && ordered.length > limit ? <span className="provider-more">+{ordered.length - limit}</span> : null}
    </span>
  );
}

function preferredProviderForSeason(
  season: NonNullable<Title["episodeGuide"]>["seasons"][number],
  ownedProviderIds: ReadonlySet<number>,
) {
  const coverage = new Map<number, { episodeCount: number; seasonLink: boolean }>();
  season.episodes.forEach((episode) => {
    episode.providerLinks.forEach((link) => {
      if (ownedProviderIds.has(link.providerId)) {
        const current = coverage.get(link.providerId) ?? { episodeCount: 0, seasonLink: false };
        coverage.set(link.providerId, { ...current, episodeCount: current.episodeCount + 1 });
      }
    });
  });
  season.providerLinks.forEach((link) => {
    if (!ownedProviderIds.has(link.providerId)) return;
    const current = coverage.get(link.providerId) ?? { episodeCount: 0, seasonLink: false };
    coverage.set(link.providerId, { ...current, seasonLink: true });
  });

  return [...coverage.entries()]
    .map(([providerId, values]) => ({
      providerId,
      episodeCount: values.episodeCount,
      hasSeasonLink: values.seasonLink,
      coverage: values.seasonLink ? season.episodes.length : values.episodeCount,
    }))
    .sort((providerA, providerB) => {
      if (providerA.coverage !== providerB.coverage) return providerB.coverage - providerA.coverage;
      if (providerA.episodeCount !== providerB.episodeCount) return providerB.episodeCount - providerA.episodeCount;
      const rankA = PROVIDERS.findIndex((provider) => provider.id === providerA.providerId);
      const rankB = PROVIDERS.findIndex((provider) => provider.id === providerB.providerId);
      return rankA - rankB;
    })[0] ?? null;
}

function TitleCard({
  title,
  saved,
  ownedProviderIds,
  onToggle,
  onOpen,
}: {
  title: Title;
  saved: boolean;
  ownedProviderIds: ReadonlySet<number>;
  onToggle: (title: Title) => void;
  onOpen: (title: Title) => void;
}) {
  const demoGradient = title.watchLink?.startsWith("linear-gradient") ? title.watchLink : undefined;
  return (
    <article className="title-card">
      <div
        className="poster"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(title)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(title); }}
        aria-label={`${title.title} öffnen`}
        style={{ background: demoGradient }}
      >
        {title.posterPath ? (
          <Image src={`https://image.tmdb.org/t/p/w500${title.posterPath}`} alt={`Poster von ${title.title}`} fill sizes="(max-width: 700px) 42vw, 210px" />
        ) : (
          <span className="poster-fallback"><Play size={31} /><strong>{title.title}</strong></span>
        )}
              <span className="media-pill">
                {title.anime
                  ? title.mediaType === "movie"
                    ? "ANIME · FILM"
                    : "ANIME · SERIE"
                  : title.mediaType === "movie"
                    ? "FILM"
                    : "SERIE"}
              </span>
        <button
          className={`card-heart ${saved ? "is-saved" : ""}`}
          onClick={(event) => { event.stopPropagation(); onToggle(title); }}
          aria-label={saved ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufügen"}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="poster-providers"><ProviderMarks providers={title.providers} limit={4} ownedProviderIds={ownedProviderIds} /></span>
      </div>
      <button className="title-meta" onClick={() => onOpen(title)}>
        <span className="title-line"><strong title={title.title}>{title.title}</strong><span>★ {title.rating || "—"}</span></span>
        <span>{title.year} · {title.providers.length ? title.providers.map((provider) => provider.name).join(" · ") : "Verfügbarkeit prüfen"}</span>
      </button>
    </article>
  );
}

function RowSkeleton() {
  return <div className="rail skeleton-rail">{Array.from({ length: 7 }, (_, index) => <span className="skeleton-card" key={index} />)}</div>;
}

function ContentRow({
  title,
  subtitle,
  icon: Icon,
  coverPath,
  kind,
  genre,
  providerIds,
  ownedProviderIds,
  tasteGenres,
  watchlist,
  onToggle,
  onOpen,
  eager = false,
}: {
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  coverPath?: string | null;
  kind: string;
  genre?: number;
  providerIds: number[];
  ownedProviderIds: ReadonlySet<number>;
  tasteGenres: number[];
  watchlist: string[];
  onToggle: (title: Title) => void;
  onOpen: (title: Title) => void;
  eager?: boolean;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Title[]>([]);
  const [error, setError] = useState(false);
  const [failedCoverPaths, setFailedCoverPaths] = useState<string[]>([]);
  const [position, setPosition] = useState({ left: false, right: true });
  const providerKey = providerIds.join(",");
  const tasteKey = tasteGenres.join(",");
  const shouldLoad = visible || eager;

  useEffect(() => {
    if (shouldLoad || !rootRef.current) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: "500px 0px" });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ kind, providers: providerKey });
    if (genre) params.set("genre", String(genre));
    if (title.includes("Geschmack") || title.includes("für dich")) params.set("taste", tasteKey);
    fetch(`/api/discover?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json() as Promise<CatalogResponse>;
      })
      .then((data) => setItems(data.results))
      .catch((reason: unknown) => { if ((reason as { name?: string }).name !== "AbortError") setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [genre, kind, providerKey, shouldLoad, tasteKey, title]);

  const updateArrows = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setPosition({ left: rail.scrollLeft > 8, right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 8 });
  }, []);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(260, rail.clientWidth * 0.82), behavior: "smooth" });
    window.setTimeout(updateArrows, 400);
  };

  const coverCandidates = [coverPath, ...items.flatMap((item) => [item.backdropPath, item.posterPath])]
    .filter((path): path is string => Boolean(path));
  const rowCoverPath = [...new Set(coverCandidates)].find((path) => !failedCoverPaths.includes(path)) ?? null;

  return (
    <section className="content-row" ref={rootRef}>
      <header className="row-heading">
        <div>
          <span className={`row-icon ${rowCoverPath ? "row-icon--cover" : ""}`}>
            {rowCoverPath ? (
              <Image
                key={rowCoverPath}
                className="rotating-cover"
                src={`https://image.tmdb.org/t/p/w300${rowCoverPath}`}
                alt=""
                fill
                sizes="58px"
                onError={() => setFailedCoverPaths((paths) => paths.includes(rowCoverPath) ? paths : [...paths, rowCoverPath])}
              />
            ) : <Icon size={17} />}
          </span>
          <span><h2>{title}</h2><p>{subtitle}</p></span>
        </div>
        <div className="row-controls">
          <button onClick={() => move(-1)} disabled={!position.left} aria-label={`${title}: zurück`}><ChevronLeft /></button>
          <button onClick={() => move(1)} disabled={!position.right} aria-label={`${title}: weiter`}><ChevronRight /></button>
        </div>
      </header>
      {!shouldLoad || loading ? <RowSkeleton /> : error ? <div className="row-empty">Diese Reihe konnte gerade nicht geladen werden.</div> : items.length ? (
        <div className="rail-wrap">
          <div className="rail" ref={railRef} onScroll={updateArrows}>
            {items.map((item) => (
              <TitleCard key={titleKey(item)} title={item} saved={watchlist.includes(titleKey(item))} ownedProviderIds={ownedProviderIds} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </div>
          {position.left ? <button className="rail-arrow rail-arrow--left" onClick={() => move(-1)} aria-label="Zurück"><ChevronLeft /></button> : null}
          {position.right ? <button className="rail-arrow rail-arrow--right" onClick={() => move(1)} aria-label="Weiter"><ChevronRight /></button> : null}
        </div>
      ) : <div className="row-empty">Keine passenden Titel bei deinen aktiven Diensten gefunden.</div>}
    </section>
  );
}

function CategoryCatalogView({
  category,
  coverPath,
  query,
  providers,
  activeProviderIds,
  selectedProviderIds,
  providerIds,
  ownedProviderIds,
  watchlist,
  onToggleProvider,
  onClearProviders,
  onToggle,
  onOpen,
  onBack,
}: {
  category: CategoryOption;
  coverPath?: string;
  query: string;
  providers: Provider[];
  activeProviderIds: number[];
  selectedProviderIds: number[];
  providerIds: number[];
  ownedProviderIds: ReadonlySet<number>;
  watchlist: string[];
  onToggleProvider: (providerId: number) => void;
  onClearProviders: () => void;
  onToggle: (title: Title) => void;
  onOpen: (title: Title) => void;
  onBack: () => void;
}) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const providerKey = providerIds.join(",");
  const searchTerm = debouncedQuery.trim().length >= 2 ? debouncedQuery.trim() : "";
  const catalogKey = `${category.id}|${providerKey}|${searchTerm}`;
  const catalogKeyRef = useRef(catalogKey);

  useEffect(() => {
    catalogKeyRef.current = catalogKey;
  }, [catalogKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const requestKey = catalogKey;
    setItems([]);
    setPage(1);
    setTotalPages(0);
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ providers: providerKey });
    if (searchTerm) {
      params.set("q", searchTerm);
      params.set("category", String(category.id));
    } else {
      params.set("kind", category.id === 90001 ? "anime" : "category");
      params.set("page", "1");
      if (category.id !== 90001) params.set("genre", String(category.id));
    }
    fetch(`${searchTerm ? "/api/category-search" : "/api/discover"}?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("category-catalog");
        return response.json() as Promise<CatalogResponse>;
      })
      .then((data) => {
        if (catalogKeyRef.current !== requestKey) return;
        setItems(data.results);
        setTotalPages(data.totalPages);
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name !== "AbortError" && catalogKeyRef.current === requestKey) setError(true);
      })
      .finally(() => {
        if (catalogKeyRef.current === requestKey) setLoading(false);
      });
    return () => controller.abort();
  }, [catalogKey, category.id, providerKey, searchTerm]);

  const loadMore = useCallback(() => {
    if (loading || searchTerm || !totalPages || page >= totalPages) return;
    const nextPage = page + 1;
    const requestKey = catalogKey;
    const params = new URLSearchParams({
      kind: category.id === 90001 ? "anime" : "category",
      page: String(nextPage),
      providers: providerKey,
    });
    if (category.id !== 90001) params.set("genre", String(category.id));
    setLoading(true);
    fetch(`/api/discover?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error("category-page");
        return response.json() as Promise<CatalogResponse>;
      })
      .then((data) => {
        if (catalogKeyRef.current !== requestKey) return;
        setItems((current) => {
          const known = new Set(current.map(titleKey));
          return [...current, ...data.results.filter((title) => !known.has(titleKey(title)))];
        });
        setPage(nextPage);
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        if (catalogKeyRef.current === requestKey) setError(true);
      })
      .finally(() => {
        if (catalogKeyRef.current === requestKey) setLoading(false);
      });
  }, [catalogKey, category.id, loading, page, providerKey, searchTerm, totalPages]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || searchTerm || page >= totalPages) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "650px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, page, searchTerm, totalPages]);

  return (
    <section className="category-catalog-page">
      <section className="category-catalog-hero" style={{ "--category": category.tint } as React.CSSProperties}>
        {coverPath ? <Image key={coverPath} className="category-catalog-cover rotating-cover" src={`https://image.tmdb.org/t/p/w1280${coverPath}`} alt="" fill sizes="100vw" priority /> : null}
        <span className="category-catalog-shade" />
        <button className="category-back" type="button" onClick={onBack}><ChevronLeft /> Entdecken</button>
        <div className="category-catalog-copy">
          <span>KATEGORIE</span>
          <h1>{category.label}</h1>
          <p>{category.id === 90001
            ? "Anime-Filme und Anime-Serien aus deinen ausgewählten Streaming-Diensten."
            : `Filme und Serien aus der Kategorie ${category.label} bei deinen Streaming-Diensten.`}</p>
        </div>
      </section>

      <section className="category-provider-block" aria-label={`Streaming-Dienste für ${category.label}`}>
        <div className="category-filter-heading"><span>VERFÜGBAR BEI</span><small>Mehrere Dienste gleichzeitig auswählbar</small></div>
        <div className="provider-filter category-provider-filter">
          <button className={selectedProviderIds.length === 0 ? "active" : ""} onClick={onClearProviders} aria-pressed={selectedProviderIds.length === 0}>Alle aktiven Dienste</button>
          {providers.map((provider) => {
            const active = activeProviderIds.includes(provider.id);
            const selected = active && selectedProviderIds.includes(provider.id);
            return (
              <button key={provider.id} className={`${selected ? "active" : ""} ${active ? "" : "inactive"}`} onClick={() => active && onToggleProvider(provider.id)} disabled={!active} aria-pressed={selected}>
                <ProviderMark provider={provider} small muted={!active} mutedReason="nicht in deinen aktiven Diensten" />
                {provider.name}{!active ? <span>inaktiv</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <header className="category-results-heading">
        <div><span>{searchTerm ? "KATEGORIE-SUCHE" : "GROSSE AUSWAHL"}</span><h2>{searchTerm ? `„${searchTerm}“ in ${category.label}` : `Alle ${category.label}-Titel`}</h2></div>
        <p>{items.length} Titel geladen{!searchTerm && page < totalPages ? " · weitere folgen automatisch" : ""}</p>
      </header>

      {loading && !items.length ? (
        <div className="catalog-grid category-catalog-grid category-grid-loading">{Array.from({ length: 12 }, (_, index) => <span className="skeleton-card" key={index} />)}</div>
      ) : error && !items.length ? (
        <div className="empty-state compact"><Info /><h2>Kategorie konnte nicht geladen werden</h2><p>Versuche es gleich noch einmal.</p></div>
      ) : items.length ? (
        <div className="catalog-grid category-catalog-grid">{items.map((item) => <TitleCard key={titleKey(item)} title={item} saved={watchlist.includes(titleKey(item))} ownedProviderIds={ownedProviderIds} onToggle={onToggle} onOpen={onOpen} />)}</div>
      ) : (
        <div className="empty-state compact"><Search /><h2>Keine passenden Titel gefunden</h2><p>Ändere die Suche oder wähle weitere aktive Dienste aus.</p></div>
      )}

      <div className="category-load-sentinel" ref={sentinelRef}>
        {loading && items.length ? <><LoaderCircle className="spin" /> Weitere Titel werden geladen …</> : !searchTerm && page < totalPages ? "Beim Weiterscrollen werden weitere Titel geladen." : items.length ? <><Check /> Alle passenden Ergebnisse geladen</> : null}
      </div>
    </section>
  );
}

function SearchPanel({
  query,
  setQuery,
  results,
  searching,
  watchOrders,
  watchlist,
  ownedProviderIds,
  onToggle,
  onOpen,
  onOpenOrder,
  onClose,
  panelRef,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Title[];
  searching: boolean;
  watchOrders: WatchOrderSummary[];
  watchlist: string[];
  ownedProviderIds: ReadonlySet<number>;
  onToggle: (title: Title) => void;
  onOpen: (title: Title) => void;
  onOpenOrder: (id: string) => void;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="search-panel" ref={panelRef}>
      <div className="search-panel-head">
        <div><strong>{query.length >= 2 ? `Ergebnisse für „${query}“` : "Suche nach Titel oder Kategorie"}</strong><span>Filme, Serien, Anime, Genre oder Jahr</span></div>
        <button onClick={onClose} aria-label="Suche schließen"><X /></button>
      </div>
      {query.length >= 2 && watchOrders.length ? (
        <div className="search-order-matches">
          {watchOrders.map((order) => (
            <button key={order.id} onClick={() => onOpenOrder(order.id)}>
              <span className="search-order-image">
                <Image src={`https://image.tmdb.org/t/p/w300${order.backdropPath}`} alt="" fill sizes="88px" />
              </span>
              <span><small>PASSENDE REIHENFOLGE</small><strong>{order.title}</strong><em>{order.entryCount} Stationen · chronologisch ansehen</em></span>
              <ChevronRight />
            </button>
          ))}
        </div>
      ) : null}
      {query.length < 2 ? (
        <div className="search-suggestions">
          <p>Direkt nach Kategorien suchen</p>
          <div>{CATEGORY_OPTIONS.slice(0, 10).map((category) => <button key={category.id} onClick={() => setQuery(category.label)}>{category.label}</button>)}</div>
          <p className="search-tip">Tipp: Probiere „Action Filme“, „Anime“ oder „Dune 2021“.</p>
        </div>
      ) : searching ? (
        <div className="search-loading"><LoaderCircle className="spin" /> Suche deine Streaming-Dienste …</div>
      ) : results.length ? (
        <div className="search-results">
          {results.map((item) => <TitleCard key={titleKey(item)} title={item} saved={watchlist.includes(titleKey(item))} ownedProviderIds={ownedProviderIds} onToggle={onToggle} onOpen={onOpen} />)}
        </div>
      ) : <div className="search-loading">Kein Treffer. Versuche einen Originaltitel, ein Jahr oder eine Kategorie.</div>}
    </div>
  );
}

function EpisodeGuideSection({
  detail,
  ownedProviderIds,
  loading,
}: {
  detail: Title;
  ownedProviderIds: ReadonlySet<number>;
  loading: boolean;
}) {
  const seasons = useMemo(() => detail.episodeGuide?.seasons ?? [], [detail.episodeGuide]);
  const [seasonNumber, setSeasonNumber] = useState<number | null>(seasons[0]?.number ?? null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const seasonPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!seasons.length) return;
    setSeasonNumber((current) => seasons.some((season) => season.number === current) ? current : seasons[0].number);
    setSeasonMenuOpen(false);
  }, [seasons]);

  useEffect(() => {
    if (!seasonMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !seasonPickerRef.current?.contains(target)) setSeasonMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSeasonMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [seasonMenuOpen]);

  if (loading && !detail.episodeGuide) {
    return <section className="episode-guide"><div className="episode-loading"><LoaderCircle className="spin" /> Staffeln und Folgen werden geladen …</div></section>;
  }

  const guide = detail.episodeGuide;
  if (!guide) return null;
  if (guide.status !== "ready") {
    const text = guide.status === "not_configured"
      ? "Die kostenlose Folgen-Datenquelle ist noch nicht mit StreamHub verbunden."
      : guide.status === "not_found"
        ? "Für diese Serie sind derzeit keine verlässlichen Folgenlinks verfügbar."
        : "Die Folgen konnten gerade nicht zuverlässig geladen werden.";
    return (
      <section className="episode-guide">
        <header className="episode-heading"><div><span>STAFFELN & FOLGEN</span><h3>Direkt zur richtigen Folge</h3></div></header>
        <div className="episode-empty"><Info /> <span>{text}<small>StreamHub verwendet keine Namenssuche als Ersatz.</small></span></div>
      </section>
    );
  }

  const season = seasons.find((item) => item.number === seasonNumber) ?? seasons[0];
  const preferred = preferredProviderForSeason(season, ownedProviderIds);
  const preferredProvider = preferred ? PROVIDERS.find((provider) => provider.id === preferred.providerId) : undefined;
  const preferredFallback = preferred
    ? season.providerLinks.find((link) => link.providerId === preferred.providerId)
    : undefined;
  return (
    <section className="episode-guide">
      <header className="episode-heading">
        <div>
          <span>STAFFELN & FOLGEN</span>
          <h3>Direkt zur richtigen Folge</h3>
          <p>Nur verifizierte Ziele beim jeweiligen Streaming-Dienst.</p>
          {preferredProvider ? (
            <p className="episode-preference">
              Bevorzugt in dieser Staffel: <strong>{preferredProvider.name}</strong> · {preferred.coverage} von {season.episodes.length} Folgen
              {preferred.hasSeasonLink && preferred.episodeCount < season.episodes.length
                ? preferredFallback?.scope === "series" ? " · mit verifiziertem Serienlink" : " · mit verifiziertem Staffellink"
                : ""}
            </p>
          ) : null}
        </div>
        {seasons.length > 1 ? (
          <div className="season-picker" ref={seasonPickerRef}>
            <span>Staffel auswählen</span>
            <button
              className="season-picker-trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={seasonMenuOpen}
              onClick={() => setSeasonMenuOpen((open) => !open)}
            >
              <span><strong>{season.title}</strong><small>{season.episodes.length} Folgen</small></span>
              <ChevronDown />
            </button>
            {seasonMenuOpen ? (
              <div className="season-menu" role="listbox" aria-label="Staffel auswählen">
                {seasons.map((item) => (
                  <button
                    className={item.number === season.number ? "active" : ""}
                    type="button"
                    role="option"
                    aria-selected={item.number === season.number}
                    key={item.number}
                    onClick={() => {
                      setSeasonNumber(item.number);
                      setSeasonMenuOpen(false);
                    }}
                  >
                    <span><strong>{item.title}</strong><small>{item.episodes.length} Folgen</small></span>
                    {item.number === season.number ? <Check /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : <span className="season-single">{season.title}</span>}
      </header>

      <div className="episode-list">
        {season.episodes.map((episode) => {
          const linkByProvider = new Map(episode.providerLinks.map((link) => [link.providerId, link]));
          const seasonLinkByProvider = new Map(season.providerLinks.map((link) => [link.providerId, link]));
          const providerPool = new Map(detail.providers.map((provider) => [provider.id, provider]));
          episode.providerLinks.forEach((link) => {
            const provider = PROVIDERS.find((item) => item.id === link.providerId);
            if (provider && !providerPool.has(provider.id)) providerPool.set(provider.id, provider);
          });
          season.providerLinks.forEach((link) => {
            const provider = PROVIDERS.find((item) => item.id === link.providerId);
            if (provider && !providerPool.has(provider.id)) providerPool.set(provider.id, provider);
          });
          const providers = [...providerPool.values()].sort((a, b) => Number(ownedProviderIds.has(b.id)) - Number(ownedProviderIds.has(a.id)));
          const primaryEpisodeLink = preferred ? linkByProvider.get(preferred.providerId) : undefined;
          const primary = primaryEpisodeLink ?? (preferred ? seasonLinkByProvider.get(preferred.providerId) : undefined);
          const primaryUsesSeasonLink = Boolean(primary && !primaryEpisodeLink);
          const primaryUsesSeriesLink = primaryUsesSeasonLink && primary?.scope === "series";
          const primaryProvider = primary ? providerPool.get(primary.providerId) : undefined;
          const episodeNumber = String(episode.number).padStart(2, "0");
          const summary = (
            <>
              {episode.stillPath ? (
                <span className="episode-still">
                  <Image
                    src={`https://image.tmdb.org/t/p/w300${episode.stillPath}`}
                    alt={`Szenenbild aus ${episode.title}`}
                    fill
                    sizes="(max-width: 700px) 112px, 126px"
                  />
                  <span>{episodeNumber}</span>
                </span>
              ) : <span className="episode-number">{episodeNumber}</span>}
              <span className="episode-copy">
                <strong title={episode.title}>{episode.title}</strong>
                <small>S{String(season.number).padStart(2, "0")} · E{String(episode.number).padStart(2, "0")}{episode.year ? ` · ${episode.year}` : ""}</small>
                <span>{episode.overview}</span>
              </span>
            </>
          );

          return (
            <article className={`episode-card ${primary ? "is-playable" : ""}`} key={`${season.number}-${episode.number}`}>
              {primary ? (
                <a className="episode-summary" href={primary.url} target="_blank" rel="noreferrer" title={`${primaryUsesSeriesLink ? detail.title : primaryUsesSeasonLink ? season.title : episode.title} bei ${primaryProvider?.name ?? "deinem Dienst"} öffnen`}>
                  {summary}
                </a>
              ) : <div className="episode-summary">{summary}</div>}
              <div className="episode-provider-actions" aria-label="Streaming-Anbieter dieser Folge">
                {providers.map((provider) => {
                  const episodeLink = linkByProvider.get(provider.id);
                  const link = episodeLink ?? seasonLinkByProvider.get(provider.id);
                  const owned = ownedProviderIds.has(provider.id);
                  const linkLabel = episodeLink ? episode.title : link?.scope === "series" ? detail.title : season.title;
                  return link ? (
                    <a key={provider.id} href={link.url} target="_blank" rel="noreferrer" title={`${linkLabel} bei ${provider.name} ${episodeLink?.directVideo ? "abspielen" : "öffnen"}`}>
                      <ProviderMark provider={provider} small muted={!owned} mutedReason="nicht in deinen aktiven Diensten" />
                    </a>
                  ) : <ProviderMark key={provider.id} provider={provider} small muted mutedReason="kein exakter Folgenlink" />;
                })}
              </div>
              {primary ? (
                <a className="episode-open" href={primary.url} target="_blank" rel="noreferrer">
                  <Play fill="currentColor" />
                  <span>{primaryUsesSeriesLink ? "Serie öffnen" : primaryUsesSeasonLink ? "Staffel öffnen" : primary.directVideo ? "Abspielen" : "Folge öffnen"}<small>{primaryProvider?.name}</small></span>
                </a>
              ) : <span className="episode-no-link">Kein exakter Link<br />in deinen Diensten</span>}
            </article>
          );
        })}
      </div>
      <p className="episode-attribution">Folgen-Verfügbarkeit bereitgestellt von <a href="https://www.movieofthenight.com/about/api" target="_blank" rel="noreferrer">Streaming Availability API by Movie of the Night</a>.</p>
    </section>
  );
}

function WatchOrderCard({
  order,
  saved,
  liked,
  progress,
  onOpen,
  onToggleSave,
  onToggleLike,
}: {
  order: WatchOrderSummary;
  saved: boolean;
  liked: boolean;
  progress: number;
  onOpen: (id: string) => void;
  onToggleSave: (id: string) => void;
  onToggleLike: (id: string) => void;
}) {
  const progressPercent = order.entryCount ? Math.min(100, Math.round((progress / order.entryCount) * 100)) : 0;
  return (
    <article className="watch-order-card" style={{ "--order-accent": order.accent } as React.CSSProperties}>
      <button className="watch-order-card-visual" onClick={() => onOpen(order.id)} aria-label={`${order.title} öffnen`}>
        <Image src={`https://image.tmdb.org/t/p/w780${order.backdropPath}`} alt="" fill sizes="(max-width: 700px) 92vw, 31vw" />
        <span className="watch-order-card-shade" />
        <span className="watch-order-card-copy"><small>{order.eyebrow}</small><strong>{order.title}</strong><em>{order.entryCount} Stationen</em></span>
      </button>
      <div className="watch-order-card-body">
        <p>{order.description}</p>
        {progress ? <div className="watch-order-card-progress"><span><i style={{ width: `${progressPercent}%` }} /></span><small>{progress} von {order.entryCount} erledigt</small></div> : null}
        <div className="watch-order-card-actions">
          <button className="primary" onClick={() => onOpen(order.id)}><ListOrdered /> Reihenfolge ansehen</button>
          <button className={saved ? "active" : ""} onClick={() => onToggleSave(order.id)} aria-label={saved ? "Aus gespeicherten Reihenfolgen entfernen" : "Reihenfolge speichern"}><Bookmark fill={saved ? "currentColor" : "none"} /></button>
          <button className={liked ? "active" : ""} onClick={() => onToggleLike(order.id)} aria-label={liked ? "Gefällt mir entfernen" : "Gefällt mir"}><Heart fill={liked ? "currentColor" : "none"} /></button>
        </div>
      </div>
    </article>
  );
}

function WatchOrderDetailView({
  orderId,
  saved,
  liked,
  watchedEntryIds,
  ownedProviderIds,
  onBack,
  onToggleSave,
  onToggleLike,
  onToggleWatched,
  onResetProgress,
  onOpenTitle,
}: {
  orderId: string;
  saved: boolean;
  liked: boolean;
  watchedEntryIds: string[];
  ownedProviderIds: ReadonlySet<number>;
  onBack: () => void;
  onToggleSave: (id: string) => void;
  onToggleLike: (id: string) => void;
  onToggleWatched: (orderId: string, entryId: string) => void;
  onResetProgress: (orderId: string) => void;
  onOpenTitle: (title: Title) => void;
}) {
  const [order, setOrder] = useState<WatchOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [modeId, setModeId] = useState<WatchOrderModeId>("story");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`/api/watch-orders/${orderId}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<WatchOrderDetails> : Promise.reject())
      .then((data) => { setOrder(data); setModeId(data.modes[0]?.id ?? "story"); })
      .catch((reason: unknown) => { if ((reason as { name?: string }).name !== "AbortError") setFailed(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [orderId]);

  if (loading) return <section className="order-detail-loading"><LoaderCircle className="spin" /><strong>Reihenfolge wird zusammengestellt …</strong><span>Titel und Verfügbarkeit werden abgeglichen.</span></section>;
  if (failed || !order) return <section className="empty-state"><Info /><h2>Reihenfolge konnte nicht geladen werden</h2><p>Versuche es gleich noch einmal.</p><button onClick={onBack}>Zurück zur Übersicht</button></section>;

  const mode = order.modes.find((item) => item.id === modeId) ?? order.modes[0];
  const watched = new Set(watchedEntryIds);
  const completed = mode.entries.filter((item) => watched.has(item.id)).length;
  const progressPercent = mode.entries.length ? Math.round((completed / mode.entries.length) * 100) : 0;
  const kindLabel = { series: "SERIE", season: "STAFFEL", movie: "FILM", special: "SPECIAL", alternative: "ALTERNATIVE" } as const;

  return (
    <section className="watch-order-detail" style={{ "--order-accent": order.accent } as React.CSSProperties}>
      <button className="order-back" onClick={onBack}><ChevronLeft /> Alle Reihenfolgen</button>
      <section className="order-detail-hero">
        <Image src={`https://image.tmdb.org/t/p/original${order.backdropPath}`} alt="" fill sizes="100vw" priority />
        <div className="order-detail-shade" />
        <div className="order-detail-copy">
          <span>{order.eyebrow}</span>
          <h1>{order.title}</h1>
          <p>{order.description}</p>
          <small>Geprüft · aktualisiert {order.updatedAt}</small>
          <div>
            <button className={saved ? "primary active" : "primary"} onClick={() => onToggleSave(order.id)}><Bookmark fill={saved ? "currentColor" : "none"} /> {saved ? "Gespeichert" : "Reihenfolge speichern"}</button>
            <button className={liked ? "active" : ""} onClick={() => onToggleLike(order.id)}><Heart fill={liked ? "currentColor" : "none"} /> {liked ? "Gefällt dir" : "Gefällt mir"}</button>
          </div>
        </div>
      </section>

      <div className="order-detail-toolbar">
        <div className="order-mode-tabs" role="tablist" aria-label="Art der Reihenfolge">
          {order.modes.map((item) => <button key={item.id} className={mode.id === item.id ? "active" : ""} onClick={() => setModeId(item.id)} role="tab" aria-selected={mode.id === item.id}>{item.label}</button>)}
        </div>
        <div className="order-progress-summary">
          <div><strong>{completed} / {mode.entries.length}</strong><span>angesehen</span></div>
          <span className="order-progress-track"><i style={{ width: `${progressPercent}%` }} /></span>
          {completed ? <button onClick={() => onResetProgress(order.id)}><RotateCcw /> Zurücksetzen</button> : null}
        </div>
      </div>
      <p className="order-mode-description">{mode.description}</p>

      <div className="order-timeline">
        {mode.entries.map((item, index) => {
          const isWatched = watched.has(item.id);
          const directProviders = (item.media?.providers ?? [])
            .map((provider) => ({ provider, destination: providerTitleDestination(provider) }))
            .filter((value) => value.destination)
            .sort((a, b) => Number(ownedProviderIds.has(b.provider.id)) - Number(ownedProviderIds.has(a.provider.id)));
          const destination = directProviders[0];
          const imagePath = item.media?.backdropPath ?? item.media?.posterPath;
          return (
            <article key={item.id} className={`order-entry ${item.optional ? "optional" : ""} ${isWatched ? "watched" : ""}`}>
              <button className="order-entry-index" onClick={() => onToggleWatched(order.id, item.id)} aria-label={isWatched ? `${item.title} als ungesehen markieren` : `${item.title} als angesehen markieren`}>
                {isWatched ? <Check /> : String(index + 1).padStart(2, "0")}
              </button>
              <button className="order-entry-visual" onClick={() => item.media && onOpenTitle(item.media)} disabled={!item.media}>
                {imagePath ? <Image src={`https://image.tmdb.org/t/p/w500${imagePath}`} alt="" fill sizes="180px" /> : <Film />}
                <span>{kindLabel[item.kind]}</span>
              </button>
              <div className="order-entry-copy">
                <div className="order-entry-kicker"><span>{kindLabel[item.kind]}</span><i>{item.year}</i>{item.optional ? <em>Optional</em> : null}</div>
                <h2>{item.title}</h2>
                <div className="order-entry-meta">{item.seasonLabel ? <strong>{item.seasonLabel}</strong> : null}{item.episodeRange ? <span>{item.episodeRange}</span> : null}</div>
                <p>{item.description}</p>
                {item.note ? <small className="order-entry-note"><Info /> {item.note}</small> : null}
                {item.media?.providers.length ? <ProviderMarks providers={item.media.providers} ownedProviderIds={ownedProviderIds} mutedProviderIds={new Set(item.media.providers.filter((provider) => !providerTitleDestination(provider)).map((provider) => provider.id))} /> : null}
              </div>
              <div className="order-entry-actions">
                {item.media ? <button onClick={() => onOpenTitle(item.media!)}><Info /> Details</button> : null}
                {destination ? <a href={destination.destination!.url} target="_blank" rel="noreferrer"><Play fill="currentColor" /> Bei {destination.provider.name} ansehen</a> : <span>Kein exakter Direktlink</span>}
                <button className={isWatched ? "watched" : ""} onClick={() => onToggleWatched(order.id, item.id)}><Check /> {isWatched ? "Angesehen" : "Als angesehen markieren"}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WatchOrdersView({
  orders,
  selectedOrderId,
  savedOrderIds,
  likedOrderIds,
  orderProgress,
  ownedProviderIds,
  onOpen,
  onBack,
  onToggleSave,
  onToggleLike,
  onToggleWatched,
  onResetProgress,
  onOpenTitle,
}: {
  orders: WatchOrderSummary[];
  selectedOrderId: string | null;
  savedOrderIds: string[];
  likedOrderIds: string[];
  orderProgress: Record<string, string[]>;
  ownedProviderIds: ReadonlySet<number>;
  onOpen: (id: string) => void;
  onBack: () => void;
  onToggleSave: (id: string) => void;
  onToggleLike: (id: string) => void;
  onToggleWatched: (orderId: string, entryId: string) => void;
  onResetProgress: (orderId: string) => void;
  onOpenTitle: (title: Title) => void;
}) {
  const [orderQuery, setOrderQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "anime" | "film">("all");
  const normalizedQuery = normalizedText(orderQuery);
  const filtered = orders.filter((order) => {
    const categoryMatch = categoryFilter === "all" || order.category === categoryFilter;
    const searchMatch = !normalizedQuery || [order.title, ...order.aliases].some((value) => normalizedText(value).includes(normalizedQuery));
    return categoryMatch && searchMatch;
  });

  if (selectedOrderId) {
    return <WatchOrderDetailView orderId={selectedOrderId} saved={savedOrderIds.includes(selectedOrderId)} liked={likedOrderIds.includes(selectedOrderId)} watchedEntryIds={orderProgress[selectedOrderId] ?? []} ownedProviderIds={ownedProviderIds} onBack={onBack} onToggleSave={onToggleSave} onToggleLike={onToggleLike} onToggleWatched={onToggleWatched} onResetProgress={onResetProgress} onOpenTitle={onOpenTitle} />;
  }

  return (
    <section className="watch-orders-page">
      <section className="watch-orders-hero">
        <div><span><ListOrdered /> NEU IN V0.9</span><h1>Was kommt<br />eigentlich zuerst?</h1><p>StreamHub sortiert Serien, Filme, Specials und Alternativen zu einer verständlichen Reihenfolge.</p></div>
        <div className="watch-order-search"><Search /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Franchise suchen, z. B. Sword Art Online …" aria-label="Reihenfolgen durchsuchen" />{orderQuery ? <button onClick={() => setOrderQuery("")} aria-label="Suche leeren"><X /></button> : null}<small>{filtered.length} kuratierte {filtered.length === 1 ? "Reihenfolge" : "Reihenfolgen"}</small></div>
      </section>
      <header className="watch-orders-heading"><div><span>KURATIERT STATT GERATEN</span><h2>Chronologische Reihenfolgen</h2></div><p>Alternative Fassungen und optionale Spin-offs werden sichtbar markiert.</p></header>
      <div className="watch-order-type-tabs" aria-label="Reihenfolgen filtern">
        <button className={categoryFilter === "all" ? "active" : ""} onClick={() => setCategoryFilter("all")}>Alle <span>{orders.length}</span></button>
        <button className={categoryFilter === "film" ? "active" : ""} onClick={() => setCategoryFilter("film")}><Film /> Filme <span>{orders.filter((order) => order.category === "film").length}</span></button>
        <button className={categoryFilter === "anime" ? "active" : ""} onClick={() => setCategoryFilter("anime")}><Layers3 /> Anime <span>{orders.filter((order) => order.category === "anime").length}</span></button>
      </div>
      {filtered.length ? <div className="watch-orders-grid">{filtered.map((order) => <WatchOrderCard key={order.id} order={order} saved={savedOrderIds.includes(order.id)} liked={likedOrderIds.includes(order.id)} progress={(orderProgress[order.id] ?? []).length} onOpen={onOpen} onToggleSave={onToggleSave} onToggleLike={onToggleLike} />)}</div> : <div className="empty-state compact"><Search /><h2>Noch keine passende Reihenfolge</h2><p>Versuche „Marvel“, „Star Wars“, „SAO“ oder „Demon Slayer“.</p><button onClick={() => { setOrderQuery(""); setCategoryFilter("all"); }}>Alle anzeigen</button></div>}
      <div className="order-curation-note"><Info /><span><strong>Warum kuratiert?</strong> Automatisch erratene Listen verwechseln schnell Remakes, Recaps und Spin-offs. StreamHub ordnet diese bewusst ein und kennzeichnet Alternativen.</span></div>
    </section>
  );
}

function WatchlistView({
  titles,
  orders,
  activeTab,
  onChangeTab,
  watchlist,
  ownedProviderIds,
  savedOrderIds,
  likedOrderIds,
  orderProgress,
  onToggleTitle,
  onOpenTitle,
  onOpenOrder,
  onToggleSaveOrder,
  onToggleLikeOrder,
  onDiscoverTitles,
  onDiscoverOrders,
}: {
  titles: Title[];
  orders: WatchOrderSummary[];
  activeTab: "titles" | "orders";
  onChangeTab: (tab: "titles" | "orders") => void;
  watchlist: string[];
  ownedProviderIds: ReadonlySet<number>;
  savedOrderIds: string[];
  likedOrderIds: string[];
  orderProgress: Record<string, string[]>;
  onToggleTitle: (title: Title) => void;
  onOpenTitle: (title: Title) => void;
  onOpenOrder: (id: string) => void;
  onToggleSaveOrder: (id: string) => void;
  onToggleLikeOrder: (id: string) => void;
  onDiscoverTitles: () => void;
  onDiscoverOrders: () => void;
}) {
  const savedOrders = savedOrderIds.map((id) => orders.find((order) => order.id === id)).filter((order): order is WatchOrderSummary => Boolean(order));
  return (
    <section className="simple-page watchlist-page">
      <div className="page-title"><span>DEINE LISTE</span><h1>Watchlist</h1><p>Titel und ganze Reihenfolgen an einem Ort.</p></div>
      <div className="watchlist-tabs" role="tablist"><button className={activeTab === "titles" ? "active" : ""} onClick={() => onChangeTab("titles")}><Heart /> Titel <span>{watchlist.length}</span></button><button className={activeTab === "orders" ? "active" : ""} onClick={() => onChangeTab("orders")}><ListOrdered /> Reihenfolgen <span>{savedOrderIds.length}</span></button></div>
      {activeTab === "titles" ? (
        titles.length ? <div className="catalog-grid">{titles.map((item) => <TitleCard key={titleKey(item)} title={item} saved ownedProviderIds={ownedProviderIds} onToggle={onToggleTitle} onOpen={onOpenTitle} />)}</div> : <div className="empty-state"><Heart /><h2>Noch keine Titel gemerkt</h2><p>Tippe bei einem Titel auf das Herz, dann erscheint er hier.</p><button onClick={onDiscoverTitles}>Titel entdecken</button></div>
      ) : savedOrders.length ? (
        <div className="watch-orders-grid">{savedOrders.map((order) => <WatchOrderCard key={order.id} order={order} saved liked={likedOrderIds.includes(order.id)} progress={(orderProgress[order.id] ?? []).length} onOpen={onOpenOrder} onToggleSave={onToggleSaveOrder} onToggleLike={onToggleLikeOrder} />)}</div>
      ) : <div className="empty-state"><ListOrdered /><h2>Noch keine Reihenfolge gespeichert</h2><p>Speichere eine kuratierte Film- oder Serienreihenfolge für später.</p><button onClick={onDiscoverOrders}>Reihenfolgen entdecken</button></div>}
    </section>
  );
}

function DetailModal({
  title,
  saved,
  watchOrder,
  ownedProviderIds,
  onToggle,
  onOpenOrder,
  onClose,
}: {
  title: Title;
  saved: boolean;
  watchOrder?: WatchOrderSummary | null;
  ownedProviderIds: ReadonlySet<number>;
  onToggle: (title: Title) => void;
  onOpenOrder: (id: string) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState(title);
  const [detailLoading, setDetailLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(title);
    setDetailLoading(true);
    fetch(`/api/title/${title.mediaType}/${title.id}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Title> : Promise.reject())
      .then(setDetail)
      .catch(() => undefined)
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [title]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  const providerDestinations = detail.providers.map((provider) => ({
    provider,
    destination: providerTitleDestination(provider),
  }));
  const linkedProviders = providerDestinations
    .filter((entry) => entry.destination)
    .sort((a, b) => Number(ownedProviderIds.has(b.provider.id)) - Number(ownedProviderIds.has(a.provider.id)));
  const mutedProviderIds = new Set(
    providerDestinations.filter((entry) => !entry.destination).map((entry) => entry.provider.id),
  );
  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="detail-modal" role="dialog" aria-modal="true" aria-label={detail.title}>
        <div className="detail-visual">
          {detail.backdropPath ? <Image src={`https://image.tmdb.org/t/p/original${detail.backdropPath}`} alt="" fill sizes="900px" priority /> : null}
          <div className="detail-shade" />
          <button className={`detail-watchlist ${saved ? "is-saved" : ""}`} onClick={() => onToggle(detail)} aria-label="Watchlist">
            <Heart fill={saved ? "currentColor" : "none"} />
            <span>{saved ? "Gemerkt" : "Merken"}</span>
          </button>
          <button className="detail-close" onClick={onClose} aria-label="Schließen"><X /></button>
          <div className="detail-title">
            <span>{detail.anime ? "ANIME" : detail.mediaType === "movie" ? "FILM" : "SERIE"}</span>
            <h2>{detail.title}</h2>
            <p>{detail.year} · ★ {detail.rating || "—"}{detail.runtime ? ` · ${detail.runtime} Min.` : ""}{detail.seasons ? ` · ${detail.seasons} Staffeln` : ""}</p>
          </div>
        </div>
        <div className="detail-body">
          <p>{detail.overview}</p>
          {watchOrder ? (
            <button className="detail-order-link" onClick={() => onOpenOrder(watchOrder.id)}>
              <ListOrdered />
              <span><small>PASSENDE SAMMLUNG</small><strong>Chronologische Reihenfolge finden</strong><em>{watchOrder.title} · {watchOrder.entryCount} Stationen</em></span>
              <ChevronRight />
            </button>
          ) : null}
          <div className="available-on"><strong>Verfügbar bei</strong><ProviderMarks providers={detail.providers} ownedProviderIds={ownedProviderIds} mutedProviderIds={mutedProviderIds} /></div>
          {linkedProviders.length ? (
            <div className="watch-actions">
              {linkedProviders.map(({ provider, destination }) => (
                  <a key={provider.id} href={destination!.url} target="_blank" rel="noreferrer">
                    <ProviderMark provider={provider} small muted={!ownedProviderIds.has(provider.id)} mutedReason="nicht in deinen aktiven Diensten" />
                    Bei {provider.name} ansehen
                    <ExternalLink size={15} />
                  </a>
              ))}
            </div>
          ) : detail.providers.length ? null : <div className="no-provider">Aktuell keine Flatrate-Verfügbarkeit bei deinen Diensten gefunden.</div>}
          {linkedProviders.length ? (
            <p className="provider-link-note">StreamHub zeigt nur geprüfte Direktlinks zum exakten Titel beim Anbieter – keine Namenssuche und keine TMDB-Zwischenseite.</p>
          ) : null}
          {detail.mediaType === "tv" ? <EpisodeGuideSection detail={detail} ownedProviderIds={ownedProviderIds} loading={detailLoading} /> : null}
        </div>
      </article>
    </div>
  );
}

function SubscriptionsView({ subscriptions, providers, setSubscriptions }: { subscriptions: Subscription[]; providers: Provider[]; setSubscriptions: (items: Subscription[]) => void }) {
  const update = (providerId: number, patch: Partial<Subscription>) => {
    setSubscriptions(subscriptions.map((item) => item.providerId === providerId ? { ...item, ...patch } : item));
  };
  const orderedSubscriptions = [...subscriptions].sort((a, b) => Number(b.active) - Number(a.active));
  const providerFor = (providerId: number) => providers.find((item) => item.id === providerId) ?? PROVIDERS.find((item) => item.id === providerId)!;
  return (
    <section className="settings-page">
      <div className="page-title"><span>DEINE ZENTRALE</span><h1>Streaming-Dienste</h1><p>Verwalte Status, Tarif und Abrechnungen. Die Daten bleiben in deinem Browser.</p></div>
      <section className="settings-services" aria-label="Deine Dienste">
        <div className="settings-services-title">DEINE DIENSTE</div>
        <div className="settings-services-list">
          {orderedSubscriptions.map((subscription) => {
            const provider = providerFor(subscription.providerId);
            return <div className={subscription.active ? "" : "inactive"} key={provider.id}><ProviderMark provider={provider} small /><span>{provider.name}</span><small>{subscription.active ? "Aktiv" : "Aus"}</small></div>;
          })}
        </div>
        <p className="settings-roadmap"><strong>Für weitere Versionen:</strong> eigene Streaming-Dienste mit Logos hinzufügen und in der Suche Studios wie Marvel, Studio Ghibli oder Pixar direkt filtern.</p>
      </section>
      <div className="settings-section-label">ABOS VERWALTEN</div>
      <div className="subscription-grid">
        {subscriptions.map((subscription) => {
          const provider = providerFor(subscription.providerId);
          return (
            <article id={`subscription-${provider.id}`} className={`subscription-card ${subscription.active ? "" : "is-inactive"}`} key={provider.id}>
              <header><ProviderMark provider={provider} /><div><strong>{provider.name}</strong><span>{subscription.active ? "Aktiv" : subscription.inactiveReason || "Inaktiv"}</span></div><button className={`switch ${subscription.active ? "on" : ""}`} onClick={() => update(provider.id, { active: !subscription.active })}><span /></button></header>
              <label>Tarif<input value={subscription.plan} onChange={(event) => update(provider.id, { plan: event.target.value })} /></label>
              <div className="field-pair"><label>Nächste Abrechnung<input type="date" value={subscription.nextBilling} onChange={(event) => update(provider.id, { nextBilling: event.target.value })} /></label><label>Abo-Ende<input type="date" value={subscription.endsAt} onChange={(event) => update(provider.id, { endsAt: event.target.value })} /></label></div>
              {!subscription.active ? <label>Grund<select value={subscription.inactiveReason} onChange={(event) => update(provider.id, { inactiveReason: event.target.value })}><option value="">Nicht angegeben</option><option>Gekündigt</option><option>Abo abgelaufen</option><option>Pausiert</option><option>Zahlung fehlgeschlagen</option><option>Manuell deaktiviert</option></select></label> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function StreamHubApp() {
  const [view, setView] = useState<View>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
  const [providers, setProviders] = useState(PROVIDERS);
  const [subscriptions, setSubscriptions] = useStoredState<Subscription[]>("streamhub.subscriptions", DEFAULT_SUBSCRIPTIONS, ["streamhubSubscriptions", "streamhub-services"], normalizeSubscriptions);
  const [watchlist, setWatchlist] = useStoredState<string[]>("streamhub.watchlist", [], ["streamhubWatchlist"], normalizeWatchlist);
  const [savedTitles, setSavedTitles] = useStoredState<Record<string, Title>>("streamhub.savedTitles", {}, ["streamhubWatchlist", "streamhubWatchlistTitles"], normalizeSavedTitles);
  const [savedOrderIds, setSavedOrderIds] = useStoredState<string[]>("streamhub.watchOrders.saved", []);
  const [likedOrderIds, setLikedOrderIds] = useStoredState<string[]>("streamhub.watchOrders.liked", []);
  const [orderProgress, setOrderProgress] = useStoredState<Record<string, string[]>>("streamhub.watchOrders.progress", {});
  const [taste, setTaste] = useStoredState<Record<string, number>>("streamhub.taste", {});
  const [notifications, setNotifications] = useStoredState<NotificationItem[]>("streamhub.notifications", [
    { id: "welcome", title: "Willkommen in StreamHub", text: "Deine Suche und Empfehlungen wurden verbessert." },
    { id: "watchlist", title: "Watchlist bereit", text: "Merke Titel und öffne sie direkt beim Anbieter." },
  ]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Title[]>([]);
  const [detail, setDetail] = useState<Title | null>(null);
  const [watchOrders, setWatchOrders] = useState<WatchOrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [watchlistTab, setWatchlistTab] = useState<"titles" | "orders">("titles");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [categoryCoverSets, setCategoryCoverSets] = useState<Record<string, string[]>>({});
  const [categoryCoverRotation, setCategoryCoverRotation] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const mobileProfileButtonRef = useRef<HTMLButtonElement>(null);

  const activeProviderIds = useMemo(() => subscriptions.filter((item) => item.active).map((item) => item.providerId), [subscriptions]);
  const activeProviderSet = useMemo(() => new Set(activeProviderIds), [activeProviderIds]);
  const selectedActiveProviderIds = useMemo(
    () => selectedProviderIds.filter((id) => activeProviderIds.includes(id)),
    [activeProviderIds, selectedProviderIds],
  );
  const filteredProviderIds = selectedActiveProviderIds.length ? selectedActiveProviderIds : activeProviderIds;
  const tasteGenres = useMemo(() => Object.entries(taste).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => Number(id)), [taste]);
  const unread = notifications.filter((item) => !item.read).length;
  const categoryCovers = useMemo(() => Object.fromEntries(
    Object.entries(categoryCoverSets).flatMap(([id, paths]) => paths.length
      ? [[id, paths[categoryCoverRotation % paths.length]]]
      : []),
  ), [categoryCoverRotation, categoryCoverSets]);
  const selectedCategory = CATEGORY_OPTIONS.find((category) => category.id === selectedCategoryId) ?? null;
  const matchingSearchOrders = useMemo(
    () => query.trim().length >= 2 ? watchOrders.filter((order) => watchOrderMatches(order, query)).slice(0, 2) : [],
    [query, watchOrders],
  );
  const detailWatchOrder = useMemo(() => {
    if (!detail) return null;
    const ref = titleKey(detail);
    const exact = watchOrders.find((order) => order.titleRefs.includes(ref));
    if (exact) return exact;
    return watchOrders.find((order) => watchOrderMatches(order, detail.title)) ?? null;
  }, [detail, watchOrders]);

  useEffect(() => {
    fetch("/api/providers")
      .then((response) => response.json() as Promise<{ providers: Provider[] }>)
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/watch-orders")
      .then((response) => response.json() as Promise<{ results: WatchOrderSummary[] }>)
      .then((data) => setWatchOrders(data.results))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/category-covers")
      .then((response) => response.json() as Promise<{ covers: Record<string, string>; coverSets?: Record<string, string[]> }>)
      .then((data) => setCategoryCoverSets(data.coverSets ?? Object.fromEntries(
        Object.entries(data.covers).map(([id, path]) => [id, [path]]),
      )))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!Object.values(categoryCoverSets).some((paths) => paths.length > 1)) return;
    const timer = window.setInterval(() => setCategoryCoverRotation((rotation) => rotation + 1), CATEGORY_COVER_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [categoryCoverSets]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        if (!selectedCategoryId) setSearchOpen(true);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (event.key === "Escape") { setSearchOpen(false); setProfileOpen(false); setNotificationsOpen(false); setDetail(null); }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const insideMenus = Boolean(
        menusRef.current?.contains(target) || mobileProfileButtonRef.current?.contains(target),
      );
      if (!insideMenus) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }

      const insideSearch = Boolean(
        searchContainerRef.current?.contains(target) || searchPanelRef.current?.contains(target),
      );
      if (!insideSearch) setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", handler); window.removeEventListener("pointerdown", outside); };
  }, [selectedCategoryId]);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: query.trim(), providers: filteredProviderIds.join(",") });
      fetch(`/api/search?${params}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<CatalogResponse>)
        .then((data) => setSearchResults(data.results))
        .catch((reason: unknown) => { if ((reason as { name?: string }).name !== "AbortError") setSearchResults([]); })
        .finally(() => setSearching(false));
    }, 320);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filteredProviderIds, query, searchOpen]);

  const toggleWatchlist = (title: Title) => {
    const key = titleKey(title);
    setWatchlist((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
    setSavedTitles((current) => ({ ...current, [key]: title }));
  };

  const openTitle = (title: Title) => {
    setDetail(title);
    setSearchOpen(false);
    setTaste((current) => {
      const next = { ...current };
      title.genreIds.forEach((id) => { next[id] = (next[id] ?? 0) + 1; });
      return next;
    });
  };

  const openWatchOrder = (id: string) => {
    setView("orders");
    setSelectedOrderId(id);
    setSelectedCategoryId(null);
    setSearchOpen(false);
    setDetail(null);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSavedOrder = (id: string) => {
    setSavedOrderIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleLikedOrder = (id: string) => {
    setLikedOrderIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleWatchedOrderEntry = (orderId: string, entryId: string) => {
    setOrderProgress((current) => {
      const entries = current[orderId] ?? [];
      return { ...current, [orderId]: entries.includes(entryId) ? entries.filter((id) => id !== entryId) : [...entries, entryId] };
    });
  };

  const changeView = (next: View) => {
    setView(next);
    setSelectedOrderId(null);
    setSelectedCategoryId(null);
    setCategoryQuery("");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCategory = (categoryId: number) => {
    setView("discover");
    setSelectedCategoryId(categoryId);
    setCategoryQuery("");
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleProviderFilter = (providerId: number) => {
    setSelectedProviderIds((current) => current.includes(providerId)
      ? current.filter((id) => id !== providerId)
      : [...current, providerId]);
  };
  const savedList = watchlist.map((key) => savedTitles[key]).filter(Boolean);
  const displayedProviders = [...providers].sort((a, b) => Number(activeProviderIds.includes(b.id)) - Number(activeProviderIds.includes(a.id)));

  const mainContent = selectedCategory ? (
    <CategoryCatalogView
      key={selectedCategory.id}
      category={selectedCategory}
      coverPath={categoryCovers[String(selectedCategory.id)]}
      query={categoryQuery}
      providers={displayedProviders}
      activeProviderIds={activeProviderIds}
      selectedProviderIds={selectedActiveProviderIds}
      providerIds={filteredProviderIds}
      ownedProviderIds={activeProviderSet}
      watchlist={watchlist}
      onToggleProvider={toggleProviderFilter}
      onClearProviders={() => setSelectedProviderIds([])}
      onToggle={toggleWatchlist}
      onOpen={openTitle}
      onBack={() => changeView("discover")}
    />
  ) : view === "orders" ? (
    <WatchOrdersView
      orders={watchOrders}
      selectedOrderId={selectedOrderId}
      savedOrderIds={savedOrderIds}
      likedOrderIds={likedOrderIds}
      orderProgress={orderProgress}
      ownedProviderIds={activeProviderSet}
      onOpen={openWatchOrder}
      onBack={() => setSelectedOrderId(null)}
      onToggleSave={toggleSavedOrder}
      onToggleLike={toggleLikedOrder}
      onToggleWatched={toggleWatchedOrderEntry}
      onResetProgress={(id) => setOrderProgress((current) => ({ ...current, [id]: [] }))}
      onOpenTitle={openTitle}
    />
  ) : view === "settings" ? (
    <SubscriptionsView subscriptions={subscriptions} providers={providers} setSubscriptions={setSubscriptions} />
  ) : view === "watchlist" ? (
    <WatchlistView
      titles={savedList}
      orders={watchOrders}
      activeTab={watchlistTab}
      onChangeTab={setWatchlistTab}
      watchlist={watchlist}
      ownedProviderIds={activeProviderSet}
      savedOrderIds={savedOrderIds}
      likedOrderIds={likedOrderIds}
      orderProgress={orderProgress}
      onToggleTitle={toggleWatchlist}
      onOpenTitle={openTitle}
      onOpenOrder={openWatchOrder}
      onToggleSaveOrder={toggleSavedOrder}
      onToggleLikeOrder={toggleLikedOrder}
      onDiscoverTitles={() => changeView("discover")}
      onDiscoverOrders={() => changeView("orders")}
    />
  ) : view === "expiring" ? (
    <section className="simple-page"><div className="page-title"><span>RECHTZEITIG ANSCHAUEN</span><h1>Läuft bald ab</h1><p>Bestätigte Ablaufdaten und deine persönlichen Abo-Enden an einem Ort.</p></div><div className="notice-banner"><Info /><div><strong>Verfügbarkeits-Verlauf wird vorbereitet</strong><p>TMDB zeigt aktuelle Verfügbarkeit, aber keine zuverlässigen künftigen Ablaufdaten. StreamHub sammelt dafür in einer späteren Version einen eigenen Verlauf. Deine eingetragenen Abo-Enden funktionieren schon jetzt.</p></div></div><div className="expiry-list">{subscriptions.filter((item) => item.endsAt).map((item) => { const provider = providers.find((provider) => provider.id === item.providerId)!; return <article key={item.providerId}><ProviderMark provider={provider} /><div><strong>{provider.name}</strong><span>Abo endet am {new Date(item.endsAt).toLocaleDateString("de-DE")}</span></div><CalendarDays /></article>; })}{!subscriptions.some((item) => item.endsAt) ? <div className="empty-state compact"><CalendarDays /><h2>Keine Ablaufdaten hinterlegt</h2><p>Trage sie in den Einstellungen bei deinen Streaming-Diensten ein.</p><button onClick={() => changeView("settings")}>Zu den Einstellungen</button></div> : null}</div></section>
  ) : (
    <>
      <section className={`hero ${view === "discover" ? "hero--compact" : ""}`}>
        <div className="hero-copy"><span><Sparkles size={14} /> DEINE STREAMING-ZENTRALE</span><h1>{view === "discover" ? "Mehr finden. Weniger suchen." : <>Alles, was du streamen kannst.<br />An einem Ort.</>}</h1><p>Durchsuche deine aktiven Abos, entdecke persönliche Vorschläge und öffne Titel direkt beim Anbieter.</p><div className="hero-actions"><button onClick={() => changeView("discover")}><Compass /> Entdecken</button><button onClick={() => changeView("watchlist")}><Heart /> Watchlist</button></div></div>
        <div className="hero-stats"><article><span>Aktive Dienste</span><strong>{activeProviderIds.length}</strong></article><article><span>Watchlist</span><strong>{watchlist.length}</strong></article><article><span>Geschmacksprofil</span><strong>{tasteGenres.length ? "Aktiv" : "Neu"}</strong></article><div><Sparkles /><span><strong>Deine Vorschläge lernen mit</strong>Öffne Titel, um die Auswahl zu verbessern.</span></div></div>
      </section>

      <section className="provider-filter" aria-label="Streaming-Dienste filtern">
        <button className={selectedActiveProviderIds.length === 0 ? "active" : ""} onClick={() => setSelectedProviderIds([])} aria-pressed={selectedActiveProviderIds.length === 0}>Alle aktiven Dienste</button>
        {displayedProviders.map((provider) => {
          const active = activeProviderIds.includes(provider.id);
          const selected = active && selectedActiveProviderIds.includes(provider.id);
          return <button key={provider.id} className={`${selected ? "active" : ""} ${active ? "" : "inactive"}`} onClick={() => active && toggleProviderFilter(provider.id)} disabled={!active} aria-pressed={selected}><i style={{ background: provider.color }} />{provider.name}{!active ? <span>inaktiv</span> : null}</button>;
        })}
      </section>

      {view === "discover" ? (
        <section className="categories"><div className="section-kicker">NACH KATEGORIE ENTDECKEN</div><div className="category-grid">{CATEGORY_OPTIONS.map((category) => {
          const cover = categoryCovers[String(category.id)];
          return <button key={category.id} type="button" onClick={() => openCategory(category.id)} style={{ "--category": category.tint } as React.CSSProperties}>{cover ? <Image key={cover} className="category-cover rotating-cover" src={`https://image.tmdb.org/t/p/w780${cover}`} alt="" fill sizes="(max-width: 700px) 48vw, 14vw" /> : null}<span className="category-shade" /><strong>{category.label}</strong><ChevronRight /></button>;
        })}</div></section>
      ) : null}

      <div className="rows">
        {ROWS.map((row, index) => <ContentRow key={`${row.id}-${filteredProviderIds.join("-")}`} title={row.title} subtitle={row.subtitle} icon={row.icon} kind={row.kind} providerIds={filteredProviderIds} ownedProviderIds={activeProviderSet} tasteGenres={tasteGenres} watchlist={watchlist} onToggle={toggleWatchlist} onOpen={openTitle} eager={index < 2} />)}
        <div className="category-rows-title"><span>KATEGORIEN FÜR DICH</span><h2>Stöbere Bahn für Bahn</h2><p>Weitere Reihen laden automatisch, sobald du nach unten scrollst.</p></div>
        {CATEGORY_OPTIONS.map((category) => <div className="category-row-anchor" id={`category-${category.id}`} key={`${category.id}-${filteredProviderIds.join("-")}`}><ContentRow title={category.label} subtitle={`Beliebte ${category.label}-Titel bei deinen Diensten`} icon={Layers3} coverPath={categoryCovers[String(category.id)]} kind={category.id === 90001 ? "anime" : "all"} genre={category.id === 90001 ? undefined : category.id} providerIds={filteredProviderIds} ownedProviderIds={activeProviderSet} tasteGenres={tasteGenres} watchlist={watchlist} onToggle={toggleWatchlist} onOpen={openTitle} /></div>)}
        <div className="load-sentinel"><Check /> Alle Kategorien geladen</div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="brand" onClick={() => changeView("home")}><Image src="/streamhub-icon.svg" alt="" width={34} height={34} /><span>Stream<strong>Hub</strong></span></button>
        <nav>{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)}><item.icon />{item.label}{item.id === "watchlist" && watchlist.length + savedOrderIds.length ? <b>{watchlist.length + savedOrderIds.length}</b> : null}</button>)}</nav>
        <div className="sidebar-footer">Katalog via TMDB<br />Direktlinks via Movie of the Night</div>
      </aside>
      {sidebarOpen ? <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Menü schließen" /> : null}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Menü"><Menu /></button>
          {selectedCategory ? (
            <div ref={searchContainerRef} className="global-search category-context-search">
              <Search />
              <input ref={searchRef} value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder={`Nur ${selectedCategory.label} durchsuchen …`} aria-label={`Nur ${selectedCategory.label} durchsuchen`} />
              <span className="search-scope">{selectedCategory.label}</span>
              {categoryQuery ? <button onClick={() => setCategoryQuery("")} aria-label="Kategorie-Suche leeren"><X /></button> : null}
            </div>
          ) : (
            <div ref={searchContainerRef} className={`global-search ${searchOpen ? "focused" : ""}`}><Search /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Filme, Serien, Anime oder Kategorien suchen …" /><kbd>Ctrl K</kbd>{query ? <button onClick={() => setQuery("")} aria-label="Suche leeren"><X /></button> : null}</div>
          )}
          <div className="top-actions" ref={menusRef}>
            <button className="icon-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label="Benachrichtigungen"><Bell />{unread ? <span>{unread}</span> : null}</button>
            <button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }} aria-label="Profil öffnen"><span>T</span><div><strong>Tim</strong><small>Persönliches Profil</small></div><ChevronDown /></button>
            {notificationsOpen ? <div className="popover notification-popover"><header><div><strong>Benachrichtigungen</strong><span>{unread} ungelesen</span></div><button onClick={() => setNotifications(notifications.map((item) => ({ ...item, read: true })))}>Alle gelesen</button></header>{notifications.map((item) => <button className={item.read ? "read" : ""} key={item.id} onClick={() => setNotifications(notifications.map((other) => other.id === item.id ? { ...other, read: true } : other))}><i className={item.urgent ? "urgent" : ""} /><span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}</div> : null}
            {profileOpen ? <div className="popover profile-popover"><div className="profile-head"><span>T</span><div><strong>Tim</strong><small>Lokales StreamHub-Profil</small></div></div><div className="profile-numbers"><span><strong>{activeProviderIds.length}</strong>Dienste</span><span><strong>{watchlist.length + savedOrderIds.length}</strong>Watchlist</span></div><div className="tech-info"><MonitorCog /><span><strong>Technische Info · V0.9.1</strong><small>Next.js 16 · Turbopack (Entwicklung)</small><small>Produktiv ohne Dev-Anzeige</small></span></div><button onClick={() => { changeView("settings"); setProfileOpen(false); }}><Settings /> Einstellungen öffnen <ChevronRight /></button></div> : null}
          </div>
        </header>

        {!selectedCategory && searchOpen ? <SearchPanel query={query} setQuery={setQuery} results={searchResults} searching={searching} watchOrders={matchingSearchOrders} watchlist={watchlist} ownedProviderIds={activeProviderSet} onToggle={toggleWatchlist} onOpen={openTitle} onOpenOrder={openWatchOrder} onClose={() => setSearchOpen(false)} panelRef={searchPanelRef} /> : null}
        <div className="page-content">{mainContent}</div>
        <footer><span><strong>TMDB</strong> Dieses Produkt nutzt die TMDB API, wird aber nicht von TMDB unterstützt oder zertifiziert.</span><span>Folgen- und Direktlinkdaten von <a href="https://www.movieofthenight.com/about/api" target="_blank" rel="noreferrer">Streaming Availability API by Movie of the Night</a> · Region Deutschland</span></footer>
      </main>

      <nav className="mobile-nav">{MOBILE_NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)}><item.icon /><span>{item.label}</span></button>)}<button ref={mobileProfileButtonRef} className={profileOpen || view === "settings" ? "active" : ""} onClick={() => { setProfileOpen((current) => !current); setNotificationsOpen(false); }}><CircleUserRound /><span>Profil</span></button></nav>
      {detail ? <DetailModal title={detail} saved={watchlist.includes(titleKey(detail))} watchOrder={detailWatchOrder} ownedProviderIds={activeProviderSet} onToggle={toggleWatchlist} onOpenOrder={openWatchOrder} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
