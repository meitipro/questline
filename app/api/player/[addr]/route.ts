import { NextResponse } from "next/server";

import { getPlayer, getPlayerLines } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: { addr: string } }
) {
  const addr = params.addr.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return NextResponse.json({ error: "not an address" }, { status: 400 });
  }

  const [player, lines] = await Promise.all([
    getPlayer(addr),
    getPlayerLines(addr, 12),
  ]);

  return NextResponse.json(
    { ...player, lines: lines.data },
    { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } }
  );
}
