import { NextResponse } from "next/server";
import { titleDetails } from "@/lib/tmdb";
import type { MediaType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaType: string; id: string }> },
) {
  const { mediaType, id } = await params;
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number(id)) {
    return NextResponse.json({ error: "Ungültiger Titel" }, { status: 400 });
  }
  const title = await titleDetails(mediaType as MediaType, Number(id));
  if (!title) return NextResponse.json({ error: "Titel nicht gefunden" }, { status: 404 });
  return NextResponse.json(title);
}
