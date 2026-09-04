import { NextRequest, NextResponse } from "next/server";
import { browseCatalog, parseCategory, parseProviderKeys } from "@/lib/server/catalog";
import type { ProviderKey } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const keys = parseProviderKeys(request.nextUrl.searchParams.get("providers"));
    const requestedProvider = request.nextUrl.searchParams.get("provider") ?? "all";
    const provider = requestedProvider === "all" || keys.includes(requestedProvider as ProviderKey)
      ? requestedProvider as ProviderKey | "all"
      : "all";
    const category = parseCategory(request.nextUrl.searchParams.get("category"));
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    return NextResponse.json(await browseCatalog(keys, provider, category, page));
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        source: "tmdb",
        results: [],
        page: 1,
        hasMore: false,
        provider: "all",
        category: "all",
        error: error instanceof Error ? error.message : "Browse-Fehler"
      },
      { status: 500 }
    );
  }
}
