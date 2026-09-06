import { NextRequest, NextResponse } from "next/server";
import { searchCategoryCatalog } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const categoryId = Number(params.get("category"));
  if (query.length < 2 || !categoryId) {
    return NextResponse.json({ source: "demo", page: 1, totalPages: 0, results: [] });
  }
  const providerIds = (params.get("providers") || "")
    .split(",")
    .map(Number)
    .filter(Boolean);
  return NextResponse.json(await searchCategoryCatalog(query.slice(0, 100), categoryId, providerIds));
}
