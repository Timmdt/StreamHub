import { NextResponse } from "next/server";
import { categoryCovers } from "@/lib/tmdb";

export async function GET() {
  return NextResponse.json(await categoryCovers());
}
