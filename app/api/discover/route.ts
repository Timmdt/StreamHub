import { NextRequest, NextResponse } from "next/server";
import { discoverCatalog } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind") || "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const providerIds = (params.get("providers") || "")
    .split(",")
    .map(Number)
    .filter(Boolean);
  const genre = Number(params.get("genre")) || undefined;
  const tasteGenres = (params.get("taste") || "")
    .split(",")
    .map(Number)
    .filter(Boolean);
  const data = await discoverCatalog({ kind, page, providerIds, genre, tasteGenres });
  return NextResponse.json(data);
}
