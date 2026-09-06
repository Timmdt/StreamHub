import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "StreamHub",
    version: "0.9.1"
  });
}
