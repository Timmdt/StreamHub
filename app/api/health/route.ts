import { NextResponse } from "next/server";
import { localCacheStats } from "@/lib/local-cache";

export async function GET() {
  const cache = await localCacheStats();
  return NextResponse.json({
    ok: true,
    app: "StreamHub",
    version: "1.0.1",
    cache,
  });
}
