import { NextResponse } from "next/server";

import { getChronicle } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The public feed. `before` is an exclusive cursor and 0 means "the newest",
 * which is the same contract the view method uses, so a caller can page through
 * the chronicle without knowing anything about storage.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const before = Number(params.get("before") ?? 0);
  const count = Number(params.get("count") ?? 24);

  const page = await getChronicle(
    Number.isFinite(before) && before > 0 ? Math.floor(before) : 0,
    Number.isFinite(count) ? Math.min(Math.max(1, Math.floor(count)), 50) : 24
  );

  return NextResponse.json(page, {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" },
  });
}
