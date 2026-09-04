import type { ProviderKey } from "./types";

export function providerSearchUrl(provider: ProviderKey, title: string) {
  const q = encodeURIComponent(title);
  switch (provider) {
    case "netflix":
      return `https://www.netflix.com/search?q=${q}`;
    case "prime":
      return `https://www.amazon.de/s?k=${q}&i=instant-video`;
    case "disney":
      return `https://www.disneyplus.com/search?q=${q}`;
    case "paramount":
      return `https://www.paramountplus.com/de/search/?query=${q}`;
    case "apple":
      return `https://tv.apple.com/de/search?term=${q}`;
    case "crunchyroll":
      return `https://www.crunchyroll.com/search?q=${q}`;
  }
}

export function homepageMatchesProvider(provider: ProviderKey, homepage?: string | null) {
  if (!homepage) return false;
  try {
    const host = new URL(homepage).hostname.replace(/^www\./, "");
    const domains: Record<ProviderKey, string[]> = {
      netflix: ["netflix.com"],
      prime: ["amazon.de", "primevideo.com"],
      disney: ["disneyplus.com"],
      paramount: ["paramountplus.com"],
      apple: ["tv.apple.com", "apple.com"],
      crunchyroll: ["crunchyroll.com"]
    };
    return domains[provider].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
