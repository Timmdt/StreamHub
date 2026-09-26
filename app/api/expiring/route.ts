import { NextRequest, NextResponse } from "next/server";
import { expiringCatalog } from "@/lib/expiring";

export async function GET(request: NextRequest) {
  const providerIds = (request.nextUrl.searchParams.get("providers") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 32);
  return NextResponse.json(await expiringCatalog(providerIds));
}
