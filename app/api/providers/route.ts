import { NextResponse } from "next/server";
import { officialProviders } from "@/lib/tmdb";

export async function GET() {
  return NextResponse.json(await officialProviders());
}
