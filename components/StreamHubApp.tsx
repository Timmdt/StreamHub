"use client";

import Image from "next/image";
import {
  Bell,
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
  LoaderCircle,
  Menu,
  MonitorCog,
  Play,
  Search,
  Settings,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_OPTIONS, DEFAULT_SUBSCRIPTIONS, PROVIDERS, providerTitleDestination } from "@/lib/providers";
import type { CatalogResponse, Provider, Subscription, Title } from "@/lib/types";

type View = "home" | "discover" | "expiring" | "watchlist" | "settings";

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
  { id: "expiring", label: "Läuft bald ab", icon: Clock3 },
  { id: "watchlist", label: "Watchlist", icon: Heart },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

const ROWS = [
  { id: "taste", title: "Für deinen Geschmack", subtitle: "Basierend auf deinen angesehenen Titeln", kind: "all", icon: Sparkles },
  { id: "popular-movies", title: "Filme – aktuell beliebt", subtitle: "Die meistgesehenen Filme bei deinen Diensten", kind: "movies", icon: Film },
  { id: "popular-series", title: "Serien – aktuell beliebt", subtitle: "Serien, über die gerade alle sprechen", kind: "series", icon: Tv },
  { id: "popular-anime", title: "Anime – aktuell beliebt", subtitle: "Neue Folgen und große Favoriten", kind: "anime", icon: Layers3 },
  { id: "movies-for-you", title: "Filme für dich", subtitle: "Passend zu deinem Geschmack", kind: "movies", icon: Sparkles },
  { id: "series-for-you", title: "Serien für dich", subtitle: "Deine persönliche nächste Serie", kind: "series", icon: Sparkles },
] as const;

function titleKey(title: Pick<Title, "mediaType" | "id">) {
  return `${title.mediaType}:${title.id}`;
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

function ProviderMark({ provider, small = false }: { provider: Provider; small?: boolean }) {
  return (
    <span
      className={`provider-mark ${small ? "provider-mark--small" : ""}`}
      style={{ "--provider": provider.color } as React.CSSProperties}
      title={provider.name}
      aria-label={provider.name}
    >
      {provider.logoPath ? (
        <Image src={`https://image.tmdb.org/t/p/w92${provider.logoPath}`} alt="" width={small ? 20 : 26} height={small ? 20 : 26} />
      ) : (
        provider.short
      )}
    </span>
  );
}

function ProviderMarks({ providers, limit }: { providers: Provider[]; limit?: number }) {
  const visible = typeof limit === "number" ? providers.slice(0, limit) : providers;
  return (
    <span className="provider-marks" aria-label={providers.map((provider) => provider.name).join(", ")}>
      {visible.map((provider) => <ProviderMark key={provider.id} provider={provider} small />)}
      {limit && providers.length > limit ? <span className="provider-more">+{providers.length - limit}</span> : null}
    </span>
  );
}

function TitleCard({
  title,
  saved,
  onToggle,
  onOpen,
}: {
  title: Title;
  saved: boolean;
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
        <span className="media-pill">{title.anime ? "ANIME" : title.mediaType === "movie" ? "FILM" : "SERIE"}</span>
        <button
          className={`card-heart ${saved ? "is-saved" : ""}`}
          onClick={(event) => { event.stopPropagation(); onToggle(title); }}
          aria-label={saved ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufügen"}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="poster-providers"><ProviderMarks providers={title.providers} limit={4} /></span>
      </div>
      <button className="title-meta" onClick={() => onOpen(title)}>
        <span className="title-line"><strong>{title.title}</strong><span>★ {title.rating || "—"}</span></span>
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
  kind,
  genre,
  providerIds,
  tasteGenres,
  watchlist,
  onToggle,
  onOpen,
  eager = false,
}: {
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  kind: string;
  genre?: number;
  providerIds: number[];
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

  return (
    <section className="content-row" ref={rootRef}>
      <header className="row-heading">
        <div><span className="row-icon"><Icon size={17} /></span><span><h2>{title}</h2><p>{subtitle}</p></span></div>
        <div className="row-controls">
          <button onClick={() => move(-1)} disabled={!position.left} aria-label={`${title}: zurück`}><ChevronLeft /></button>
          <button onClick={() => move(1)} disabled={!position.right} aria-label={`${title}: weiter`}><ChevronRight /></button>
        </div>
      </header>
      {!shouldLoad || loading ? <RowSkeleton /> : error ? <div className="row-empty">Diese Reihe konnte gerade nicht geladen werden.</div> : items.length ? (
        <div className="rail-wrap">
          <div className="rail" ref={railRef} onScroll={updateArrows}>
            {items.map((item) => (
              <TitleCard key={titleKey(item)} title={item} saved={watchlist.includes(titleKey(item))} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </div>
          {position.left ? <button className="rail-arrow rail-arrow--left" onClick={() => move(-1)} aria-label="Zurück"><ChevronLeft /></button> : null}
          {position.right ? <button className="rail-arrow rail-arrow--right" onClick={() => move(1)} aria-label="Weiter"><ChevronRight /></button> : null}
        </div>
      ) : <div className="row-empty">Keine passenden Titel bei deinen aktiven Diensten gefunden.</div>}
    </section>
  );
}

function SearchPanel({
  query,
  setQuery,
  results,
  searching,
  watchlist,
  onToggle,
  onOpen,
  onClose,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Title[];
  searching: boolean;
  watchlist: string[];
  onToggle: (title: Title) => void;
  onOpen: (title: Title) => void;
  onClose: () => void;
}) {
  return (
    <div className="search-panel">
      <div className="search-panel-head">
        <div><strong>{query.length >= 2 ? `Ergebnisse für „${query}“` : "Suche nach Titel oder Kategorie"}</strong><span>Filme, Serien, Anime, Genre oder Jahr</span></div>
        <button onClick={onClose} aria-label="Suche schließen"><X /></button>
      </div>
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
          {results.map((item) => <TitleCard key={titleKey(item)} title={item} saved={watchlist.includes(titleKey(item))} onToggle={onToggle} onOpen={onOpen} />)}
        </div>
      ) : <div className="search-loading">Kein Treffer. Versuche einen Originaltitel, ein Jahr oder eine Kategorie.</div>}
    </div>
  );
}

function DetailModal({
  title,
  saved,
  onToggle,
  onClose,
}: {
  title: Title;
  saved: boolean;
  onToggle: (title: Title) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState(title);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/title/${title.mediaType}/${title.id}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Title> : Promise.reject())
      .then(setDetail)
      .catch(() => undefined);
    return () => controller.abort();
  }, [title]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
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
          <div className="available-on"><strong>Verfügbar bei</strong><ProviderMarks providers={detail.providers} /></div>
          {detail.providers.length ? (
            <div className="watch-actions">
              {detail.providers.map((provider) => {
                const destination = providerTitleDestination(provider, detail);
                return destination ? (
                  <a key={provider.id} href={destination.url} target="_blank" rel="noreferrer">
                    <ProviderMark provider={provider} small />
                    Bei {provider.name} ansehen
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <span className="watch-action-unavailable" key={provider.id}>
                    <ProviderMark provider={provider} small /> Für {provider.name} ist kein exakter Link verfügbar
                  </span>
                );
              })}
            </div>
          ) : <div className="no-provider">Aktuell keine Flatrate-Verfügbarkeit bei deinen Diensten gefunden.</div>}
          {detail.providers.length ? (
            <p className="provider-link-note">StreamHub zeigt nur geprüfte Direktlinks zum exakten Titel beim Anbieter – keine Namenssuche und keine TMDB-Zwischenseite.</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function SubscriptionsView({ subscriptions, setSubscriptions }: { subscriptions: Subscription[]; setSubscriptions: (items: Subscription[]) => void }) {
  const update = (providerId: number, patch: Partial<Subscription>) => {
    setSubscriptions(subscriptions.map((item) => item.providerId === providerId ? { ...item, ...patch } : item));
  };
  const orderedSubscriptions = [...subscriptions].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <section className="settings-page">
      <div className="page-title"><span>DEINE ZENTRALE</span><h1>Streaming-Dienste</h1><p>Verwalte Status, Tarif und Abrechnungen. Die Daten bleiben in deinem Browser.</p></div>
      <section className="settings-services" aria-label="Deine Dienste">
        <div className="settings-services-title">DEINE DIENSTE</div>
        <div className="settings-services-list">
          {orderedSubscriptions.map((subscription) => {
            const provider = PROVIDERS.find((item) => item.id === subscription.providerId)!;
            return <div className={subscription.active ? "" : "inactive"} key={provider.id}><i style={{ background: provider.color }} /><span>{provider.name}</span><small>{subscription.active ? "Aktiv" : "Aus"}</small></div>;
          })}
        </div>
      </section>
      <div className="settings-section-label">ABOS VERWALTEN</div>
      <div className="subscription-grid">
        {subscriptions.map((subscription) => {
          const provider = PROVIDERS.find((item) => item.id === subscription.providerId)!;
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [categoryCovers, setCategoryCovers] = useState<Record<string, string>>({});
  const [requestedCategoryId, setRequestedCategoryId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  const activeProviderIds = useMemo(() => subscriptions.filter((item) => item.active).map((item) => item.providerId), [subscriptions]);
  const selectedActiveProviderIds = useMemo(
    () => selectedProviderIds.filter((id) => activeProviderIds.includes(id)),
    [activeProviderIds, selectedProviderIds],
  );
  const filteredProviderIds = selectedActiveProviderIds.length ? selectedActiveProviderIds : activeProviderIds;
  const tasteGenres = useMemo(() => Object.entries(taste).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => Number(id)), [taste]);
  const unread = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    fetch("/api/providers")
      .then((response) => response.json() as Promise<{ providers: Provider[] }>)
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/category-covers")
      .then((response) => response.json() as Promise<{ covers: Record<string, string> }>)
      .then((data) => setCategoryCovers(data.covers))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault(); setSearchOpen(true); window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (event.key === "Escape") { setSearchOpen(false); setProfileOpen(false); setNotificationsOpen(false); setDetail(null); }
    };
    const outside = (event: MouseEvent) => {
      if (menusRef.current && !menusRef.current.contains(event.target as Node)) { setProfileOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("mousedown", outside);
    return () => { window.removeEventListener("keydown", handler); window.removeEventListener("mousedown", outside); };
  }, []);

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

  const changeView = (next: View) => { setView(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openCategory = (categoryId: number) => {
    setRequestedCategoryId(categoryId);
    window.requestAnimationFrame(() => {
      document.getElementById(`category-${categoryId}`)?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };
  const toggleProviderFilter = (providerId: number) => {
    setSelectedProviderIds((current) => current.includes(providerId)
      ? current.filter((id) => id !== providerId)
      : [...current, providerId]);
  };
  const savedList = watchlist.map((key) => savedTitles[key]).filter(Boolean);
  const displayedProviders = [...providers].sort((a, b) => Number(activeProviderIds.includes(b.id)) - Number(activeProviderIds.includes(a.id)));

  const mainContent = view === "settings" ? (
    <SubscriptionsView subscriptions={subscriptions} setSubscriptions={setSubscriptions} />
  ) : view === "watchlist" ? (
    <section className="simple-page"><div className="page-title"><span>DEINE LISTE</span><h1>Watchlist</h1><p>Alles, was du dir für später gemerkt hast.</p></div>{savedList.length ? <div className="catalog-grid">{savedList.map((item) => <TitleCard key={titleKey(item)} title={item} saved onToggle={toggleWatchlist} onOpen={openTitle} />)}</div> : <div className="empty-state"><Heart /><h2>Noch nichts gemerkt</h2><p>Tippe bei einem Titel auf das Herz, dann erscheint er hier.</p><button onClick={() => changeView("discover")}>Titel entdecken</button></div>}</section>
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
          return <button key={category.id} type="button" onClick={() => openCategory(category.id)} style={{ "--category": category.tint } as React.CSSProperties}>{cover ? <Image className="category-cover" src={`https://image.tmdb.org/t/p/w780${cover}`} alt="" fill sizes="(max-width: 700px) 48vw, 14vw" /> : null}<span className="category-shade" /><strong>{category.label}</strong><ChevronRight /></button>;
        })}</div></section>
      ) : null}

      <div className="rows">
        {ROWS.map((row, index) => <ContentRow key={`${row.id}-${filteredProviderIds.join("-")}`} title={row.title} subtitle={row.subtitle} icon={row.icon} kind={row.kind} providerIds={filteredProviderIds} tasteGenres={tasteGenres} watchlist={watchlist} onToggle={toggleWatchlist} onOpen={openTitle} eager={index < 2} />)}
        <div className="category-rows-title"><span>KATEGORIEN FÜR DICH</span><h2>Stöbere Bahn für Bahn</h2><p>Weitere Reihen laden automatisch, sobald du nach unten scrollst.</p></div>
        {CATEGORY_OPTIONS.map((category) => <div className="category-row-anchor" id={`category-${category.id}`} key={`${category.id}-${filteredProviderIds.join("-")}`}><ContentRow title={category.label} subtitle={`Beliebte ${category.label}-Titel bei deinen Diensten`} icon={Layers3} kind={category.id === 90001 ? "anime" : "all"} genre={category.id === 90001 ? undefined : category.id} providerIds={filteredProviderIds} tasteGenres={tasteGenres} watchlist={watchlist} onToggle={toggleWatchlist} onOpen={openTitle} eager={requestedCategoryId === category.id} /></div>)}
        <div className="load-sentinel"><Check /> Alle Kategorien geladen</div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="brand" onClick={() => changeView("home")}><Image src="/streamhub-icon.svg" alt="" width={34} height={34} /><span>Stream<strong>Hub</strong></span></button>
        <nav>{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)}><item.icon />{item.label}{item.id === "watchlist" && watchlist.length ? <b>{watchlist.length}</b> : null}</button>)}</nav>
        <div className="sidebar-footer">Verfügbarkeit via TMDB / JustWatch<br />Region: Deutschland</div>
      </aside>
      {sidebarOpen ? <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Menü schließen" /> : null}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Menü"><Menu /></button>
          <div className={`global-search ${searchOpen ? "focused" : ""}`}><Search /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Filme, Serien, Anime oder Kategorien suchen …" /><kbd>Ctrl K</kbd>{query ? <button onClick={() => setQuery("")} aria-label="Suche leeren"><X /></button> : null}</div>
          <div className="top-actions" ref={menusRef}>
            <button className="icon-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label="Benachrichtigungen"><Bell />{unread ? <span>{unread}</span> : null}</button>
            <button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }} aria-label="Profil öffnen"><span>T</span><div><strong>Tim</strong><small>Persönliches Profil</small></div><ChevronDown /></button>
            {notificationsOpen ? <div className="popover notification-popover"><header><div><strong>Benachrichtigungen</strong><span>{unread} ungelesen</span></div><button onClick={() => setNotifications(notifications.map((item) => ({ ...item, read: true })))}>Alle gelesen</button></header>{notifications.map((item) => <button className={item.read ? "read" : ""} key={item.id} onClick={() => setNotifications(notifications.map((other) => other.id === item.id ? { ...other, read: true } : other))}><i className={item.urgent ? "urgent" : ""} /><span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}</div> : null}
            {profileOpen ? <div className="popover profile-popover"><div className="profile-head"><span>T</span><div><strong>Tim</strong><small>Lokales StreamHub-Profil</small></div></div><div className="profile-numbers"><span><strong>{activeProviderIds.length}</strong>Dienste</span><span><strong>{watchlist.length}</strong>Watchlist</span></div><div className="tech-info"><MonitorCog /><span><strong>Technische Info</strong><small>Next.js 16 · Turbopack (Entwicklung)</small><small>Produktiv ohne Dev-Anzeige</small></span></div><button onClick={() => { changeView("settings"); setProfileOpen(false); }}><Settings /> Einstellungen öffnen <ChevronRight /></button></div> : null}
          </div>
        </header>

        {searchOpen ? <SearchPanel query={query} setQuery={setQuery} results={searchResults} searching={searching} watchlist={watchlist} onToggle={toggleWatchlist} onOpen={openTitle} onClose={() => setSearchOpen(false)} /> : null}
        <div className="page-content">{mainContent}</div>
        <footer><span><strong>TMDB</strong> Dieses Produkt nutzt die TMDB API, wird aber nicht von TMDB unterstützt oder zertifiziert.</span><span>Streaming-Verfügbarkeit bereitgestellt von JustWatch via TMDB · Region Deutschland</span></footer>
      </main>

      <nav className="mobile-nav">{NAV_ITEMS.slice(0, 4).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)}><item.icon /><span>{item.label}</span></button>)}<button className={profileOpen || view === "settings" ? "active" : ""} onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><CircleUserRound /><span>Profil</span></button></nav>
      {detail ? <DetailModal title={detail} saved={watchlist.includes(titleKey(detail))} onToggle={toggleWatchlist} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
