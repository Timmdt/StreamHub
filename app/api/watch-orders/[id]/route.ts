import { NextResponse } from "next/server";
import { getWatchOrder } from "@/lib/watch-orders";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = await getWatchOrder(id);
  if (!order) return NextResponse.json({ error: "Reihenfolge nicht gefunden" }, { status: 404 });
  return NextResponse.json(order);
}
