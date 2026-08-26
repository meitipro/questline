import { NextResponse } from "next/server";

import { getWorld } from "@/lib/contract";

// The reads are cached in lib/contract.ts for a few seconds, and this header
// lets a CDN do the same. Nothing in the product depends on either for
// correctness, so a stale read is a cosmetic bug rather than a money bug.
export const dynamic = "force-dynamic";

/* Every route here waits on a GenLayer rpc read. The platform default of ten
 * seconds is enough on a healthy day and not enough when the network is slow,
 * and a timeout looks to a reader like the site is broken rather than like the
 * node is busy. lib/contract.ts still falls back to the seeded world on failure,
 * so this only buys the read a fair chance first. */
export const maxDuration = 30;

export async function GET() {
  const world = await getWorld();
  return NextResponse.json(world, {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" },
  });
}
