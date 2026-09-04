import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ source: "demo", page: 1, totalPages: 0, results: [] });
  }
  const providerIds = (request.nextUrl.searchParams.get("providers") || "")
    .split(",")
    .map(Number)
    .filter(Boolean);
  return NextResponse.json(await searchCatalog(query.slice(0, 100), providerIds));
}
