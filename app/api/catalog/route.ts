import { NextRequest, NextResponse } from "next/server";
import { getCatalog, parseProviderKeys } from "@/lib/server/catalog";

export async function GET(request: NextRequest) {
  try {
    const keys = parseProviderKeys(request.nextUrl.searchParams.get("providers"));
    return NextResponse.json(await getCatalog(keys));
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        source: "tmdb",
        popular: [],
        newReleases: [],
        error: error instanceof Error ? error.message : "Unbekannter Katalogfehler"
      },
      { status: 500 }
    );
  }
}
