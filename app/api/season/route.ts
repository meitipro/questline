import { NextResponse } from "next/server";

import { getLeaderboard } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const board = await getLeaderboard(20);
  return NextResponse.json(board, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" },
  });
}
