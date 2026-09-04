import type { Provider, Title } from "./types";

export const PROVIDERS: Provider[] = [
  { id: 8, name: "Netflix", short: "N", color: "#e50914" },
  { id: 119, name: "Prime Video", short: "P", color: "#00a8e1" },
  { id: 337, name: "Disney+", short: "D+", color: "#2f6bff" },
  { id: 531, name: "Paramount+", short: "P+", color: "#2874ff" },
  { id: 350, name: "Apple TV+", short: "A+", color: "#f4f4f4" },
  { id: 283, name: "Crunchyroll", short: "C", color: "#f47521" },
];

export const PROVIDER_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

export const DEFAULT_SUBSCRIPTIONS = [
  { providerId: 8, active: true, plan: "Premium", billingCycle: "Monatlich" as const, nextBilling: "", endsAt: "", inactiveReason: "" },
  { providerId: 119, active: true, plan: "Prime", billingCycle: "Jährlich" as const, nextBilling: "", endsAt: "", inactiveReason: "" },
  { providerId: 337, active: true, plan: "Premium", billingCycle: "Monatlich" as const, nextBilling: "", endsAt: "", inactiveReason: "" },
  { providerId: 531, active: true, plan: "Standard", billingCycle: "Monatlich" as const, nextBilling: "", endsAt: "", inactiveReason: "" },
  { providerId: 350, active: true, plan: "Apple TV+", billingCycle: "Monatlich" as const, nextBilling: "", endsAt: "", inactiveReason: "" },
  { providerId: 283, active: true, plan: "Fan", billingCycle: "Monatlich" as const, nextBilling: "", endsAt: "", inactiveReason: "" },
];

const PROVIDER_DOMAINS: Record<number, string[]> = {
  8: ["netflix.com"],
  119: ["amazon.de", "amazon.com", "primevideo.com"],
  337: ["disneyplus.com"],
  531: ["paramountplus.com"],
  350: ["tv.apple.com"],
  283: ["crunchyroll.com"],
};

function trustedUrl(value: string | null | undefined, domains: string[]) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const hostname = url.hostname.toLocaleLowerCase("en").replace(/^www\./, "");
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ? url.toString() : null;
  } catch {
    return null;
  }
}

export type ProviderTitleDestination = {
  url: string;
  kind: "direct";
};

export function trustedProviderTitleUrl(providerId: number, value: string | null | undefined) {
  return trustedUrl(value, PROVIDER_DOMAINS[providerId] ?? []);
}

export function providerTitleDestination(
  provider: Pick<Provider, "id" | "link">,
  title: Pick<Title, "homepage">,
): ProviderTitleDestination | null {
  const directLink = trustedProviderTitleUrl(provider.id, provider.link)
    ?? trustedProviderTitleUrl(provider.id, title.homepage);
  return directLink ? { url: directLink, kind: "direct" } : null;
}

export const CATEGORY_OPTIONS = [
  { id: 28, label: "Action", tint: "#ef4444" },
  { id: 12, label: "Abenteuer", tint: "#f59e0b" },
  { id: 16, label: "Animation", tint: "#8b5cf6" },
  { id: 90001, label: "Anime", tint: "#ec4899" },
  { id: 35, label: "Komödie", tint: "#eab308" },
  { id: 80, label: "Krimi", tint: "#64748b" },
  { id: 99, label: "Dokumentation", tint: "#14b8a6" },
  { id: 18, label: "Drama", tint: "#6366f1" },
  { id: 10751, label: "Familie", tint: "#22c55e" },
  { id: 14, label: "Fantasy", tint: "#a855f7" },
  { id: 27, label: "Horror", tint: "#dc2626" },
  { id: 10749, label: "Romance", tint: "#f43f5e" },
  { id: 878, label: "Sci-Fi", tint: "#06b6d4" },
  { id: 53, label: "Thriller", tint: "#7c3aed" },
];
