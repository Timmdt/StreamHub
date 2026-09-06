import { NextRequest, NextResponse } from "next/server";
import { listWatchOrders } from "@/lib/watch-orders";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  return NextResponse.json({ results: listWatchOrders(query) });
}
