"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType
} from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  ExternalLink,
  Heart,
  Home,
  Info,
  LoaderCircle,
  Play,
  Search,
  Settings,
  Sparkles,
  Star,
  UserRound,
  Users,
  X
} from "lucide-react";
import { categories, categoryDefinition, itemMatchesCategory } from "@/lib/categories";
import { providers } from "@/lib/mock-data";
import { homepageMatchesProvider, providerSearchUrl } from "@/lib/provider-links";
import type {
  CatalogItem,
  BrowsePayload,
  CatalogPayload,
  CategoryKey,
  InactiveReason,
  ProviderKey,
  LegacySubscription as Subscription,
  TitleDetail,
  WatchHistoryEntry
} from "@/lib/types";

type Tab = "home" | "discover" | "expiring" | "watchlist" | "settings";
type AppNotification = {
  id: string;
  title: string;
  body: string;
  tone: "warning" | "info" | "success";
};

type ExpirationMap = Record<string, string>;

const nav: Array<{ id: Tab; label: string; icon: ElementType }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "discover", label: "Entdecken", icon: Compass },
  { id: "expiring", label: "Läuft bald ab", icon: Clock3 },
  { id: "watchlist", label: "Watchlist", icon: Heart },
  { id: "settings", label: "Einstellungen", icon: Settings }
];

const defaultSubscriptions: Subscription[] = providers.map((provider) => ({
  provider: provider.key,
  status: "active",
  plan: "",
  billingCycle: "monthly"
}));

const reasonLabels: Record<InactiveReason, string> = {
  cancelled: "Gekündigt",
  expired: "Abo abgelaufen",
  paused: "Pausiert",
  payment_failed: "Zahlung fehlgeschlagen",
  manual: "Manuell deaktiviert"
};

function itemKey(item: Pick<CatalogItem, "mediaType" | "id">) {
  return `${item.mediaType}:${item.id}`;
}

function providerOf(key: ProviderKey) {
  return providers.find((provider) => provider.key === key)!;
}

function imageUrl(path?: string | null, size = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

function daysUntil(date?: string) {
  if (!date) return null;
  const target = new Date(`${date}T23:59:59`);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function dateLabel(date?: string) {
  if (!date) return "Nicht hinterlegt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function isExpired(subscription: Subscription) {
  const remaining = daysUntil(subscription.endsAt);
  return remaining !== null && remaining < 0;
}

function effectiveReason(subscription: Subscription): InactiveReason | undefined {
  if (isExpired(subscription)) return "expired";
  return subscription.status === "inactive"
    ? subscription.inactiveReason ?? "manual"
    : undefined;
}

function LoadingCards() {
  return (
    <div className="poster-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-poster" />
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return (
    <div className="empty-state">
      <Icon size={26} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ProviderBadges({ keys }: { keys: ProviderKey[] }) {
  return (
    <div className="provider-badges">
      {keys.map((key) => {
        const provider = providerOf(key);
        return (
          <span key={key} className="provider-badge" title={provider.name}>
            <i style={{ background: provider.accent }} />
            {provider.name}
          </span>
        );
      })}
    </div>
  );
}

function PosterCard({
  item,
  saved,
  expiresAt,
  onToggle,
  onOpen
}: {
  item: CatalogItem;
  saved: boolean;
  expiresAt?: string;
  onToggle: (item: CatalogItem) => void;
  onOpen: (item: CatalogItem) => void;
}) {
  const poster = imageUrl(item.posterPath);
  const primaryProvider = item.providers[0] ? providerOf(item.providers[0]) : null;
  const remaining = daysUntil(expiresAt);

  return (
    <article className="poster-card">
      <button className="poster-open" onClick={() => onOpen(item)} aria-label={`${item.title} öffnen`}>
        <div
          className={`poster-art ${poster ? "has-image" : ""}`}
          style={
            poster
              ? { backgroundImage: `url(${poster})` }
              : {
                  background: `radial-gradient(circle at 78% 18%, ${primaryProvider?.accent ?? "#8b5cf6"}55, transparent 34%), linear-gradient(155deg, #202635, #0d1017 65%)`
                }
          }
        >
          <div className="poster-type">{item.type}</div>
          {!poster && <div className="poster-title-art">{item.title}</div>}
          {primaryProvider && (
            <div className="provider-orb" style={{ borderColor: primaryProvider.accent }}>
              {primaryProvider.short}
            </div>
          )}
        </div>
      </button>

      <button
        className={`heart-button floating ${saved ? "is-saved" : ""}`}
        onClick={() => onToggle(item)}
        aria-label={saved ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufügen"}
      >
        <Heart size={17} fill={saved ? "currentColor" : "none"} />
      </button>

      <div className="poster-copy">
        <div className="poster-line">
          <strong title={item.title}>{item.title}</strong>
          <span><Star size={11} fill="currentColor" /> {item.rating.toFixed(1)}</span>
        </div>
        <div className="meta-line">
          {item.year || "–"} · {item.providers.map((key) => providerOf(key).name).join(" · ") || "Keine Abo-Verfügbarkeit"}
        </div>
        {remaining !== null && remaining >= 0 && (
          <div className="expires-badge"><Clock3 size={13} /> noch {remaining} Tage</div>
        )}
      </div>
    </article>
  );
}

function Shelf({
  title,
  subtitle,
  items,
  savedItems,
  expirations,
  loading,
  onToggle,
  onOpen
}: {
  title: string;
  subtitle?: string;
  items: CatalogItem[];
  savedItems: CatalogItem[];
  expirations: ExpirationMap;
  loading?: boolean;
  onToggle: (item: CatalogItem) => void;
  onOpen: (item: CatalogItem) => void;
}) {
  return (
    <section className="shelf">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {loading ? (
        <LoadingCards />
      ) : items.length ? (
        <div className="poster-grid">
          {items.map((item) => (
            <PosterCard
              key={itemKey(item)}
              item={item}
              saved={savedItems.some((saved) => itemKey(saved) === itemKey(item))}
              expiresAt={expirations[itemKey(item)]}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={Compass} title="Noch nichts gefunden" text="Ändere Filter oder Suche nach einem anderen Titel." />
      )}
    </section>
  );
}


function ProviderFilterBar({
  activeKeys,
  selected,
  onSelect,
  allLabel = "Alle"
}: {
  activeKeys: ProviderKey[];
  selected: ProviderKey | "all";
  onSelect: (provider: ProviderKey | "all") => void;
  allLabel?: string;
}) {
  const active = providers.filter((service) => activeKeys.includes(service.key));
  const inactive = providers.filter((service) => !activeKeys.includes(service.key));

  return (
    <div className="provider-row provider-row-sorted">
      <button className={selected === "all" ? "provider-chip selected" : "provider-chip"} onClick={() => onSelect("all")}>{allLabel}</button>
      {active.map((service) => (
        <button key={service.key} className={selected === service.key ? "provider-chip selected" : "provider-chip"} onClick={() => onSelect(service.key)}>
          <span className="provider-dot" style={{ backgroundColor: service.accent }} /> {service.name}
        </button>
      ))}
      {inactive.length > 0 && <span className="provider-spacer" aria-hidden="true" />}
      {inactive.map((service) => (
        <button key={service.key} disabled className="provider-chip disabled provider-chip-inactive" title={`${service.name} ist aktuell inaktiv`}>
          <span className="provider-dot" style={{ backgroundColor: service.accent }} /> {service.name}
        </button>
      ))}
    </div>
  );
}

function CategoryFilterBar({ selected, onSelect }: { selected: CategoryKey; onSelect: (category: CategoryKey) => void }) {
  return (
    <div className="category-row" aria-label="Kategorien">
      {categories.map((category) => (
        <button
          key={category.key}
          className={selected === category.key ? "category-chip selected" : "category-chip"}
          onClick={() => onSelect(category.key)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

function BrowseSection({
  title,
  subtitle,
  items,
  savedItems,
  expirations,
  loading,
  loadingMore,
  hasMore,
  onToggle,
  onOpen,
  onLoadMore
}: {
  title: string;
  subtitle?: string;
  items: CatalogItem[];
  savedItems: CatalogItem[];
  expirations: ExpirationMap;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onToggle: (item: CatalogItem) => void;
  onOpen: (item: CatalogItem) => void;
  onLoadMore: () => void;
}) {
  return (
    <section className="shelf browse-section">
      <div className="section-heading">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {!loading && <span className="result-count">{items.length} geladen</span>}
      </div>
      {loading ? <LoadingCards /> : items.length ? (
        <>
          <div className="poster-grid browse-grid">
            {items.map((item) => (
              <PosterCard
                key={itemKey(item)}
                item={item}
                saved={savedItems.some((saved) => itemKey(saved) === itemKey(item))}
                expiresAt={expirations[itemKey(item)]}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-wrap">
              <button className="load-more-button" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? <><LoaderCircle size={16} className="spin" /> Weitere Titel werden geladen …</> : "Mehr laden"}
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={Compass} title="Keine Titel in diesem Filter" text="Wähle eine andere Kategorie oder einen anderen Streaming-Dienst." />
      )}
    </section>
  );
}

function topTasteCategories(history: WatchHistoryEntry[], provider: ProviderKey) {
  const scores = new Map<CategoryKey, number>();
  const relevant = history.filter((entry) => entry.provider === provider);
  for (const entry of relevant) {
    for (const category of categories) {
      if (category.key === "all") continue;
      let matched = false;
      if (category.key === "anime" && entry.category === "anime") matched = true;
      const genre = entry.mediaType === "movie" ? category.movieGenre : category.tvGenre;
      if (typeof genre === "number" && entry.genreIds.includes(genre)) matched = true;
      if (matched) scores.set(category.key, (scores.get(category.key) ?? 0) + 1);
    }
  }
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, score]) => ({ key, label: categoryDefinition(key).label, score }));
}

function recommendationScore(item: CatalogItem, taste: Array<{ key: CategoryKey; score: number }>) {
  return taste.reduce((score, category) => score + (itemMatchesCategory(item, category.key) ? category.score : 0), 0);
}

function SubscriptionRow({
  subscription,
  onChange
}: {
  subscription: Subscription;
  onChange: (next: Subscription) => void;
}) {
  const provider = providerOf(subscription.provider);
  const [expanded, setExpanded] = useState(false);
  const reason = effectiveReason(subscription);
  const active = subscription.status === "active" && !isExpired(subscription);

  function patch(next: Partial<Subscription>) {
    onChange({ ...subscription, ...next });
  }

  return (
    <div className={`subscription-row ${active ? "" : "is-inactive"}`}>
      <div className="subscription-summary">
        <div className="service-identity">
          <div className="service-logo" style={{ borderColor: `${provider.accent}70`, color: provider.accent }}>
            {provider.short}
          </div>
          <div>
            <strong>{provider.name}</strong>
            <span>{subscription.plan || "Tarif noch nicht hinterlegt"}</span>
          </div>
        </div>

        <div className="subscription-date-block">
          <span>Nächste Abrechnung</span>
          <strong>{dateLabel(subscription.nextBillingAt)}</strong>
        </div>

        <div className="subscription-date-block">
          <span>Abo-Ende</span>
          <strong>{dateLabel(subscription.endsAt)}</strong>
        </div>

        <div className="subscription-status-wrap">
          <span className={`status-badge ${active ? "active" : "inactive"}`}>
            <span />
            {active ? "Aktiv" : reason ? reasonLabels[reason] : "Inaktiv"}
          </span>
          {!active && reason && <small>{reasonLabels[reason]}</small>}
        </div>

        <div className="subscription-actions">
          {!active && reason === "expired" && (
            <a className="pricing-button" href={provider.pricingUrl} target="_blank" rel="noreferrer">
              Tarife & Preise <ExternalLink size={14} />
            </a>
          )}
          <button className="expand-button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            Bearbeiten <ChevronDown size={15} className={expanded ? "rotated" : ""} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="subscription-editor">
          <label>
            <span>Status</span>
            <select
              value={subscription.status}
              onChange={(event) => patch({
                status: event.target.value as Subscription["status"],
                inactiveReason: event.target.value === "inactive" ? subscription.inactiveReason ?? "manual" : undefined
              })}
            >
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </label>

          <label>
            <span>Tarif</span>
            <input value={subscription.plan} placeholder="z. B. Premium" onChange={(event) => patch({ plan: event.target.value })} />
          </label>

          <label>
            <span>Abrechnung</span>
            <select value={subscription.billingCycle} onChange={(event) => patch({ billingCycle: event.target.value as Subscription["billingCycle"] })}>
              <option value="monthly">Monatlich</option>
              <option value="yearly">Jährlich</option>
            </select>
          </label>

          <label>
            <span>Nächste Abrechnung</span>
            <input type="date" value={subscription.nextBillingAt ?? ""} onChange={(event) => patch({ nextBillingAt: event.target.value || undefined })} />
          </label>

          <label>
            <span>Abo endet am</span>
            <input type="date" value={subscription.endsAt ?? ""} onChange={(event) => patch({ endsAt: event.target.value || undefined })} />
          </label>

          {subscription.status === "inactive" && (
            <label>
              <span>Grund</span>
              <select value={subscription.inactiveReason ?? "manual"} onChange={(event) => patch({ inactiveReason: event.target.value as InactiveReason })}>
                <option value="cancelled">Gekündigt</option>
                <option value="expired">Abo abgelaufen</option>
                <option value="paused">Pausiert</option>
                <option value="payment_failed">Zahlung fehlgeschlagen</option>
                <option value="manual">Manuell deaktiviert</option>
              </select>
            </label>
          )}

          <a className="price-link-inline" href={provider.pricingUrl} target="_blank" rel="noreferrer">
            Offizielle Tarif- & Preisseite öffnen <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}

function DetailModal({
  item,
  detail,
  loading,
  saved,
  expiration,
  onClose,
  onToggleSaved,
  onSetExpiration,
  onProviderOpen
}: {
  item: CatalogItem;
  detail: TitleDetail | null;
  loading: boolean;
  saved: boolean;
  expiration?: string;
  onClose: () => void;
  onToggleSaved: (item: CatalogItem) => void;
  onSetExpiration: (item: CatalogItem, date?: string) => void;
  onProviderOpen: (item: CatalogItem, provider: ProviderKey) => void;
}) {
  const current = detail ?? item;
  const backdrop = imageUrl(current.backdropPath, "w1280") || imageUrl(current.posterPath, "w780");

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="detail-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Schließen"><X size={20} /></button>
        <div className="detail-visual" style={backdrop ? { backgroundImage: `linear-gradient(90deg, rgba(8,10,15,.98) 0%, rgba(8,10,15,.72) 50%, rgba(8,10,15,.2) 100%), url(${backdrop})` } : undefined}>
          <div className="detail-copy">
            <span className="eyebrow">{current.type} · {current.year || "Jahr unbekannt"}</span>
            <h2>{current.title}</h2>
            <div className="detail-score"><Star size={15} fill="currentColor" /> {current.rating.toFixed(1)} / 10</div>
            <ProviderBadges keys={current.providers} />
            <p>{current.description}</p>

            {loading && <div className="detail-loading"><LoaderCircle className="spin" size={18} /> Details werden geladen …</div>}

            {detail && (
              <div className="detail-facts">
                {detail.genres.length > 0 && <span>{detail.genres.join(" · ")}</span>}
                {detail.runtime ? <span>{detail.runtime} Min.</span> : null}
                {detail.numberOfSeasons ? <span>{detail.numberOfSeasons} Staffeln</span> : null}
                {detail.numberOfEpisodes ? <span>{detail.numberOfEpisodes} Episoden</span> : null}
              </div>
            )}

            <div className="detail-actions detail-actions-v05">
              <div className="watch-provider-actions">
                {current.providers.map((key) => {
                  const service = providerOf(key);
                  const directHomepage = detail?.homepage && homepageMatchesProvider(key, detail.homepage) ? detail.homepage : null;
                  const href = directHomepage || providerSearchUrl(key, current.title);
                  return (
                    <a
                      key={key}
                      className="watch-provider-button"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => onProviderOpen(item, key)}
                      title={directHomepage ? `Direkte Titelseite bei ${service.name}` : `${current.title} bei ${service.name} suchen`}
                    >
                      <Play size={16} fill="currentColor" /> {service.name} öffnen
                    </a>
                  );
                })}
                {detail?.watchLink && (
                  <a className="secondary link-button all-options-button" href={detail.watchLink} target="_blank" rel="noreferrer">
                    Alle Optionen <ExternalLink size={15} />
                  </a>
                )}
              </div>

              <button
                className={`detail-watchlist-button ${saved ? "is-saved" : ""}`}
                onClick={() => onToggleSaved(item)}
                aria-label={saved ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufügen"}
                title={saved ? "Auf deiner Watchlist" : "Zur Watchlist hinzufügen"}
              >
                <Heart size={20} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="provider-link-note">Direkte Titelseite, wenn verfügbar; sonst öffnet StreamHub die Suche beim ausgewählten Anbieter.</div>
          </div>
        </div>

        <div className="detail-lower">
          <div>
            <h3>Ablauf-Tracker</h3>
            <p>
              TMDB liefert keine verlässlichen persönlichen Ablaufdaten. Wenn du ein bestätigtes Datum findest,
              kannst du es hier speichern. StreamHub warnt dich dann automatisch.
            </p>
          </div>
          <div className="expiration-editor">
            <input type="date" value={expiration ?? ""} onChange={(event) => onSetExpiration(item, event.target.value || undefined)} />
            {expiration && <button onClick={() => onSetExpiration(item, undefined)}>Entfernen</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StreamingDashboard() {
  const [tab, setTab] = useState<Tab>("home");
  const [provider, setProvider] = useState<ProviderKey | "all">("all");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(defaultSubscriptions);
  const [savedItems, setSavedItems] = useState<CatalogItem[]>([]);
  const [expirations, setExpirations] = useState<ExpirationMap>({});
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [browseItems, setBrowseItems] = useState<CatalogItem[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasMore, setBrowseHasMore] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedSubscriptions = window.localStorage.getItem("streamhub-subscriptions-v03");
      const legacySubscriptions = window.localStorage.getItem("streamhub-subscriptions-v02");
      if (storedSubscriptions || legacySubscriptions) {
        setSubscriptions(JSON.parse(storedSubscriptions || legacySubscriptions || "[]") as Subscription[]);
      }
      const storedWatchlist = window.localStorage.getItem("streamhub-watchlist-v03");
      if (storedWatchlist) setSavedItems(JSON.parse(storedWatchlist) as CatalogItem[]);
      const storedExpirations = window.localStorage.getItem("streamhub-expirations-v03");
      if (storedExpirations) setExpirations(JSON.parse(storedExpirations) as ExpirationMap);
      const storedHistory = window.localStorage.getItem("streamhub-watch-history-v05");
      if (storedHistory) setWatchHistory(JSON.parse(storedHistory) as WatchHistoryEntry[]);
    } catch {
      // Ignore damaged local data and continue with defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("streamhub-subscriptions-v03", JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    window.localStorage.setItem("streamhub-watchlist-v03", JSON.stringify(savedItems));
  }, [savedItems]);

  useEffect(() => {
    window.localStorage.setItem("streamhub-expirations-v03", JSON.stringify(expirations));
  }, [expirations]);

  useEffect(() => {
    window.localStorage.setItem("streamhub-watch-history-v05", JSON.stringify(watchHistory));
  }, [watchHistory]);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setTab("discover");
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") {
        setSelectedItem(null);
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (notificationOpen && notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }

      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notificationOpen, profileOpen]);

  const activeProviderKeys = useMemo(
    () => subscriptions
      .filter((subscription) => subscription.status === "active" && !isExpired(subscription))
      .map((subscription) => subscription.provider),
    [subscriptions]
  );

  const activeProviderParam = activeProviderKeys.join(",");

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(null);
    fetch(`/api/catalog?providers=${encodeURIComponent(activeProviderParam)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as CatalogPayload;
        if (!response.ok) throw new Error(data.error || "Katalog konnte nicht geladen werden.");
        return data;
      })
      .then((data) => setCatalog(data))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogError(error instanceof Error ? error.message : "Katalogfehler");
      })
      .finally(() => setCatalogLoading(false));
    return () => controller.abort();
  }, [activeProviderParam]);

  useEffect(() => {
    if (provider !== "all" && !activeProviderKeys.includes(provider)) setProvider("all");
  }, [provider, activeProviderKeys]);

  useEffect(() => {
    if (tab !== "discover" || query.trim().length >= 2) return;
    const controller = new AbortController();
    setBrowseLoading(true);
    setBrowseError(null);
    setBrowsePage(1);
    const url = `/api/browse?providers=${encodeURIComponent(activeProviderParam)}&provider=${encodeURIComponent(provider)}&category=${encodeURIComponent(category)}&page=1`;
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as BrowsePayload;
        if (!response.ok) throw new Error(data.error || "Katalogansicht konnte nicht geladen werden.");
        return data;
      })
      .then((data) => {
        setBrowseItems(data.results);
        setBrowseHasMore(data.hasMore);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBrowseItems([]);
        setBrowseHasMore(false);
        setBrowseError(error instanceof Error ? error.message : "Browse-Fehler");
      })
      .finally(() => setBrowseLoading(false));
    return () => controller.abort();
  }, [tab, provider, category, activeProviderParam, query]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      const providersToSearch = provider === "all" ? activeProviderKeys : [provider];
      fetch(`/api/search?q=${encodeURIComponent(value)}&providers=${encodeURIComponent(providersToSearch.join(","))}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { results?: CatalogItem[] }) => setSearchResults(data.results ?? []))
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, provider, activeProviderKeys]);

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetail(null);
    fetch(`/api/title/${selectedItem.mediaType}/${selectedItem.id}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as TitleDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || "Details konnten nicht geladen werden.");
        return data;
      })
      .then(setDetail)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [selectedItem]);

  const allCatalogItems = useMemo(() => {
    const values = [...(catalog?.popular ?? []), ...(catalog?.newReleases ?? []), ...browseItems, ...savedItems, ...searchResults];
    const map = new Map<string, CatalogItem>();
    values.forEach((item) => map.set(itemKey(item), item));
    return Array.from(map.values());
  }, [catalog, browseItems, savedItems, searchResults]);

  const expiringItems = useMemo(() => {
    return Object.entries(expirations)
      .map(([key, date]) => ({ item: allCatalogItems.find((candidate) => itemKey(candidate) === key), date, days: daysUntil(date) }))
      .filter((entry): entry is { item: CatalogItem; date: string; days: number } => Boolean(entry.item) && entry.days !== null && entry.days >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expirations, allCatalogItems]);

  const notifications = useMemo<AppNotification[]>(() => {
    const titleNotifications = expiringItems
      .filter((entry) => entry.days <= 14)
      .slice(0, 8)
      .map((entry) => ({
        id: `title-${itemKey(entry.item)}-${entry.date}`,
        title: `${entry.item.title} läuft bald ab`,
        body: `${entry.item.providers.map((key) => providerOf(key).name).join(" / ")}: noch ${entry.days} ${entry.days === 1 ? "Tag" : "Tage"}.`,
        tone: entry.days <= 3 ? "warning" as const : "info" as const
      }));

    const subscriptionNotifications = subscriptions.flatMap((subscription) => {
      if (!subscription.endsAt) return [];
      const remaining = daysUntil(subscription.endsAt);
      if (remaining === null || remaining > 14) return [];
      const service = providerOf(subscription.provider);
      if (remaining < 0) {
        return [{
          id: `subscription-expired-${subscription.provider}-${subscription.endsAt}`,
          title: `${service.name} ist abgelaufen`,
          body: `Das hinterlegte Abo-Ende war am ${dateLabel(subscription.endsAt)}.`,
          tone: "warning" as const
        }];
      }
      return [{
        id: `subscription-ending-${subscription.provider}-${subscription.endsAt}`,
        title: `${service.name} endet bald`,
        body: `Dein Abo endet in ${remaining} ${remaining === 1 ? "Tag" : "Tagen"}.`,
        tone: remaining <= 3 ? "warning" as const : "info" as const
      }];
    });

    return [...subscriptionNotifications, ...titleNotifications];
  }, [expiringItems, subscriptions]);

  const unreadCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length;

  const providerFilteredPopular = useMemo(() => {
    const items = catalog?.popular ?? [];
    return provider === "all" ? items : items.filter((item) => item.providers.includes(provider));
  }, [catalog, provider]);

  const providerFilteredNew = useMemo(() => {
    const items = catalog?.newReleases ?? [];
    return provider === "all" ? items : items.filter((item) => item.providers.includes(provider));
  }, [catalog, provider]);

  const searching = query.trim().length >= 2;
  const filteredSearchResults = useMemo(
    () => searchResults.filter((item) => itemMatchesCategory(item, category)),
    [searchResults, category]
  );
  const discoverItems = searching ? filteredSearchResults : browseItems;
  const tasteCategories = useMemo(
    () => provider === "all" ? [] : topTasteCategories(watchHistory, provider),
    [watchHistory, provider]
  );
  const recommendedItems = useMemo(() => {
    if (provider === "all" || searching) return [];
    if (!tasteCategories.length) return browseItems.slice(0, 12);
    return [...browseItems]
      .map((item) => ({ item, score: recommendationScore(item, tasteCategories) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
      .slice(0, 12)
      .map((entry) => entry.item);
  }, [browseItems, tasteCategories, provider, searching]);

  function toggleSaved(item: CatalogItem) {
    setSavedItems((current) => {
      const key = itemKey(item);
      return current.some((saved) => itemKey(saved) === key)
        ? current.filter((saved) => itemKey(saved) !== key)
        : [item, ...current];
    });
  }

  function updateSubscription(next: Subscription) {
    setSubscriptions((current) => current.map((item) => item.provider === next.provider ? next : item));
  }

  function setExpiration(item: CatalogItem, date?: string) {
    setExpirations((current) => {
      const next = { ...current };
      if (date) next[itemKey(item)] = date;
      else delete next[itemKey(item)];
      return next;
    });
  }

  function recordProviderOpen(item: CatalogItem, key: ProviderKey) {
    const entry: WatchHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      provider: key,
      itemKey: itemKey(item),
      mediaType: item.mediaType,
      title: item.title,
      genreIds: item.genreIds ?? [],
      category,
      watchedAt: new Date().toISOString()
    };
    setWatchHistory((current) => [entry, ...current].slice(0, 250));
  }

  function loadMoreBrowse() {
    if (browseLoadingMore || !browseHasMore || searching) return;
    const nextPage = browsePage + 1;
    setBrowseLoadingMore(true);
    const url = `/api/browse?providers=${encodeURIComponent(activeProviderParam)}&provider=${encodeURIComponent(provider)}&category=${encodeURIComponent(category)}&page=${nextPage}`;
    fetch(url)
      .then(async (response) => {
        const data = await response.json() as BrowsePayload;
        if (!response.ok) throw new Error(data.error || "Weitere Titel konnten nicht geladen werden.");
        return data;
      })
      .then((data) => {
        setBrowseItems((current) => {
          const map = new Map<string, CatalogItem>();
          [...current, ...data.results].forEach((item) => map.set(itemKey(item), item));
          return Array.from(map.values());
        });
        setBrowsePage(nextPage);
        setBrowseHasMore(data.hasMore);
      })
      .catch((error) => setBrowseError(error instanceof Error ? error.message : "Browse-Fehler"))
      .finally(() => setBrowseLoadingMore(false));
  }

  const selectedSaved = selectedItem ? savedItems.some((item) => itemKey(item) === itemKey(selectedItem)) : false;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">S</div>
            <div><strong>StreamHub</strong><span>V0.5 · personal</span></div>
          </div>

          <nav className="sidebar-nav">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                  <Icon size={19} /><span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="profile-anchor" ref={profileRef}>
          <button
            className={`profile-card ${profileOpen ? "is-open" : ""}`}
            onClick={() => {
              setProfileOpen((value) => !value);
              setNotificationOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-label="Profil öffnen"
          >
            <div className="avatar">T</div>
            <div><strong>Tim</strong><span>{activeProviderKeys.length} Dienste aktiv</span></div>
          </button>

          {profileOpen && (
            <div className="profile-popover">
              <div className="profile-popover-head">
                <div className="profile-icon"><UserRound size={18} /></div>
                <div><strong>Tim</strong><span>Persönliches Profil</span></div>
              </div>
              <div className="profile-quick-stats">
                <div><span>Aktive Dienste</span><strong>{activeProviderKeys.length}</strong></div>
                <div><span>Watchlist</span><strong>{savedItems.length}</strong></div>
              </div>
              <div className="profile-coming">
                <Users size={16} />
                <div><strong>Profil & Familie</strong><span>Weitere Profilfunktionen planen wir später gemeinsam.</span></div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="search-box">
            <Search size={18} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setTab("discover")}
              placeholder="Filme, Serien und Anime suchen …"
            />
            {searchLoading ? <LoaderCircle size={16} className="spin" /> : <kbd>Ctrl K</kbd>}
          </div>

          <div className="notification-anchor" ref={notificationRef}>
            <button className={`icon-button ${unreadCount > 0 ? "has-dot" : ""}`} aria-label="Benachrichtigungen" onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); }}>
              <Bell size={19} />
              {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
            </button>

            {notificationOpen && (
              <div className="notification-center">
                <div className="notification-header">
                  <div><strong>Benachrichtigungen</strong><span>{unreadCount} ungelesen</span></div>
                  <button onClick={() => setNotificationOpen(false)} aria-label="Schließen"><X size={17} /></button>
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="empty-notifications"><Check size={22} /><strong>Alles ruhig</strong><span>Aktuell gibt es nichts Dringendes.</span></div>
                  ) : notifications.map((notification) => {
                    const read = readNotificationIds.includes(notification.id);
                    return (
                      <button key={notification.id} className={`notification-item ${notification.tone} ${read ? "read" : ""}`} onClick={() => setReadNotificationIds((current) => current.includes(notification.id) ? current : [...current, notification.id])}>
                        <span className="notification-dot" />
                        <span><strong>{notification.title}</strong><small>{notification.body}</small></span>
                      </button>
                    );
                  })}
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button className="mark-read-button" onClick={() => setReadNotificationIds(notifications.map((item) => item.id))}>
                    <Check size={15} /> Alle als gelesen markieren
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {catalogError && <div className="status-banner error"><Info size={17} /> {catalogError}</div>}
        {browseError && tab === "discover" && <div className="status-banner error"><Info size={17} /> {browseError}</div>}
        {catalog && !catalog.configured && (
          <div className="status-banner demo">
            <Info size={17} />
            <span><strong>Demo-Modus.</strong> Trage deinen TMDB Read Access Token in <code>.env.local</code> ein, dann werden echte Titel, Poster und deutsche Streaming-Verfügbarkeiten geladen.</span>
          </div>
        )}

        {tab === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow"><Sparkles size={14} /> Deine Streaming-Zentrale</span>
                <h1>Sechs Abos. Eine Oberfläche.</h1>
                <p>
                  StreamHub zeigt dir Filme, Serien und Anime, die in deinen aktiven Diensten in Deutschland verfügbar sind –
                  inklusive echter TMDB-Poster, Suche, Watchlist und eigenem Ablauf-Tracker.
                </p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => setTab("discover")}><Compass size={18} /> Entdecken</button>
                  <button className="secondary" onClick={() => setTab("expiring")}><Clock3 size={18} /> Läuft bald ab</button>
                </div>
              </div>

              <div className="hero-panel">
                <div className="hero-stat"><span>Aktive Dienste</span><strong>{activeProviderKeys.length}</strong></div>
                <div className="hero-stat"><span>Watchlist</span><strong>{savedItems.length}</strong></div>
                <div className="hero-stat warning"><span>Getrackte Abläufe</span><strong>{expiringItems.length}</strong></div>
                <div className="calendar-card"><CalendarDays size={18} /><div><strong>Nächster Ablauf</strong><span>{expiringItems[0] ? `${expiringItems[0].item.title} · ${dateLabel(expiringItems[0].date)}` : "Noch kein Titel hinterlegt"}</span></div></div>
              </div>
            </section>

            <ProviderFilterBar activeKeys={activeProviderKeys} selected={provider} onSelect={setProvider} allLabel="Alle aktiven Dienste" />

            <Shelf title="Beliebt in deinen Abos" subtitle="Aktuell als Flatrate in mindestens einem aktiven Dienst verfügbar" items={providerFilteredPopular.slice(0, 12)} savedItems={savedItems} expirations={expirations} loading={catalogLoading} onToggle={toggleSaved} onOpen={setSelectedItem} />
            <Shelf title="Neu veröffentlicht" subtitle="Neuere Veröffentlichungen, die aktuell in deinen Abos verfügbar sind" items={providerFilteredNew.slice(0, 12)} savedItems={savedItems} expirations={expirations} loading={catalogLoading} onToggle={toggleSaved} onOpen={setSelectedItem} />
          </>
        )}

        {tab === "discover" && (
          <>
            <div className="page-heading discover-heading">
              <div>
                <span className="eyebrow">Katalog · V0.5</span>
                <h1>{provider === "all" ? "Entdecken" : `Alles auf ${providerOf(provider).name}`}</h1>
                <p>
                  {searching
                    ? `Suchergebnisse für „${query.trim()}“${category !== "all" ? ` · ${categoryDefinition(category).label}` : ""}`
                    : provider === "all"
                      ? "Durchsuche alle aktiven Streaming-Abos und filtere direkt nach Kategorie."
                      : `Blättere durch den ${providerOf(provider).name}-Katalog in Deutschland – mit Kategorien, Verlauf und persönlichen Vorschlägen.`}
                </p>
              </div>
            </div>

            <ProviderFilterBar activeKeys={activeProviderKeys} selected={provider} onSelect={setProvider} />

            <div className="filter-block">
              <div className="filter-block-title">
                <strong>Kategorien</strong>
                <span>{category === "all" ? "Alle Genres" : categoryDefinition(category).label}</span>
              </div>
              <CategoryFilterBar selected={category} onSelect={setCategory} />
            </div>

            {!searching && provider !== "all" && (
              <section className="provider-intelligence">
                <div className="provider-intelligence-copy">
                  <span className="eyebrow">Dein {providerOf(provider).name}</span>
                  <h2>Geschmack & Vorschläge</h2>
                  <p>
                    StreamHub merkt sich lokal, welche Titel du über einen Anbieter öffnest. Daraus entstehen mit der Zeit deine meistgenutzten Kategorien und bessere Vorschläge.
                  </p>
                </div>
                <div className="taste-panel">
                  <span className="taste-label">Am meisten geöffnet</span>
                  {tasteCategories.length ? (
                    <div className="taste-chips">
                      {tasteCategories.map((taste) => (
                        <button key={taste.key} onClick={() => setCategory(taste.key)}>
                          {taste.label}<small>{taste.score}×</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="taste-empty">Noch keine Historie – aktuell basieren die Vorschläge auf Beliebtheit.</div>
                  )}
                </div>
              </section>
            )}

            {!searching && provider !== "all" && recommendedItems.length > 0 && (
              <Shelf
                title="Vorschläge für dich"
                subtitle={tasteCategories.length ? "Gewichtet nach deinen bisher geöffneten Kategorien" : `Beliebte Titel auf ${providerOf(provider).name}`}
                items={recommendedItems}
                savedItems={savedItems}
                expirations={expirations}
                onToggle={toggleSaved}
                onOpen={setSelectedItem}
              />
            )}

            {searching ? (
              <Shelf
                title={`${discoverItems.length} passende Titel`}
                subtitle={category !== "all" ? `Gefiltert nach ${categoryDefinition(category).label}` : "Nur Titel aus deinen ausgewählten Streaming-Abos"}
                items={discoverItems}
                savedItems={savedItems}
                expirations={expirations}
                loading={searchLoading}
                onToggle={toggleSaved}
                onOpen={setSelectedItem}
              />
            ) : (
              <BrowseSection
                title={provider === "all" ? (category === "all" ? "Katalog deiner Abos" : categoryDefinition(category).label) : (category === "all" ? `Alles auf ${providerOf(provider).name}` : `${categoryDefinition(category).label} auf ${providerOf(provider).name}`)}
                subtitle={provider === "all" ? "Bis zu 60 Titel pro Seite – mit Mehr-laden statt der bisherigen kleinen Auswahl" : "Bis zu 40 Titel pro Seite · weitere Seiten per Mehr laden"}
                items={discoverItems}
                savedItems={savedItems}
                expirations={expirations}
                loading={browseLoading}
                loadingMore={browseLoadingMore}
                hasMore={browseHasMore}
                onToggle={toggleSaved}
                onOpen={setSelectedItem}
                onLoadMore={loadMoreBrowse}
              />
            )}
          </>
        )}

        {tab === "expiring" && (
          <>
            <div className="page-heading"><div><span className="eyebrow">Countdown</span><h1>Läuft bald ab</h1><p>Nur bestätigte Ablaufdaten, die du selbst hinterlegt hast. Keine erfundenen Demo-Abläufe mehr.</p></div></div>
            {expiringItems.length ? (
              <Shelf title="Nach Ablaufdatum sortiert" subtitle="Benachrichtigungen erscheinen automatisch ab 14 Tagen Restzeit" items={expiringItems.map((entry) => entry.item)} savedItems={savedItems} expirations={expirations} onToggle={toggleSaved} onOpen={setSelectedItem} />
            ) : (
              <EmptyState icon={Clock3} title="Noch keine Ablaufdaten" text="Öffne einen Titel und hinterlege im Ablauf-Tracker ein bestätigtes Datum. Eine spätere Version automatisiert diesen Teil weiter." />
            )}
          </>
        )}

        {tab === "watchlist" && (
          <>
            <div className="page-heading"><div><span className="eyebrow">Gespeichert</span><h1>Deine Watchlist</h1><p>Bleibt jetzt auch nach einem Browser-Neustart erhalten.</p></div></div>
            {savedItems.length ? (
              <Shelf title={`${savedItems.length} gespeichert`} items={savedItems} savedItems={savedItems} expirations={expirations} onToggle={toggleSaved} onOpen={setSelectedItem} />
            ) : (
              <EmptyState icon={Heart} title="Deine Watchlist ist leer" text="Speichere Filme und Serien über das Herz auf einer Karte." />
            )}
          </>
        )}

        {tab === "settings" && (
          <section className="settings-page">
            <div className="page-heading"><div><span className="eyebrow">StreamHub</span><h1>Einstellungen</h1><p>Abos, Laufzeiten und Datenquellen.</p></div></div>

            <div className="settings-block">
              <div className="settings-block-heading"><div><h2>Meine Streaming-Dienste</h2><p>Inaktive oder abgelaufene Dienste werden aus dem Katalogfilter entfernt.</p></div><span>{activeProviderKeys.length} / {providers.length} aktiv</span></div>
              <div className="subscription-list">
                {subscriptions.map((subscription) => <SubscriptionRow key={subscription.provider} subscription={subscription} onChange={updateSubscription} />)}
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-card">
                <div><h3>Live-Daten</h3><p>{catalog?.configured ? "TMDB ist verbunden. Streaming-Verfügbarkeiten werden für Deutschland abgefragt." : "TMDB ist noch nicht konfiguriert. Aktuell läuft die Oberfläche mit Demo-Inhalten."}</p></div>
                <span className={`connection-pill ${catalog?.configured ? "online" : "offline"}`}>{catalog?.configured ? "Verbunden" : "Demo"}</span>
              </div>
              <div className="settings-card">
                <div><h3>Benachrichtigungen</h3><p>Das interne Notification Center reagiert bereits auf Abo-Enden und manuell bestätigte Titel-Abläufe. Web Push folgt in einer späteren Version.</p></div>
                <Bell size={22} />
              </div>
              <div className="settings-card">
                <div><h3>Datenhaltung</h3><p>Watchlist, Abos und Ablaufdaten werden in V0.3 lokal im Browser gespeichert. Eine richtige Datenbank folgt als nächster großer Backend-Schritt.</p></div>
                <span className="soon">localStorage</span>
              </div>
              <div className="settings-card muted-card">
                <div><h3>Familienprofile</h3><p>Architektur bleibt dafür vorbereitet: getrennte Watchlists, Dienste und Benachrichtigungen pro Person.</p></div>
                <span className="soon">später</span>
              </div>
            </div>
          </section>
        )}

        <footer className="credits">
          <div className="credit-row">
            {/* The externally hosted official attribution logo must stay unmodified. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg" alt="TMDB" />
            <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
          </div>
          <span>Streaming availability data powered by JustWatch via TMDB · Region: Deutschland · Flatrate-Abos</span>
        </footer>
      </section>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          detail={detail}
          loading={detailLoading}
          saved={selectedSaved}
          expiration={expirations[itemKey(selectedItem)]}
          onClose={() => setSelectedItem(null)}
          onToggleSaved={toggleSaved}
          onSetExpiration={setExpiration}
          onProviderOpen={recordProviderOpen}
        />
      )}
    </main>
  );
}
