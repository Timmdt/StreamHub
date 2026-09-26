import { NextRequest, NextResponse } from "next/server";
import { hasTmdbToken } from "@/lib/tmdb";
import { predictWatchOrders } from "@/lib/predicted-watch-orders";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (query.length < 2 || !hasTmdbToken()) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await predictWatchOrders(query) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ results: [] });
  }
}
