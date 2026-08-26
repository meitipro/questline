import { NextResponse } from "next/server";

import { getLine } from "@/lib/contract";
import { verifyRoll } from "@/lib/roll";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * One chronicle line, with the roll recomputed alongside it.
 *
 * The recomputation is included in the response rather than left to the reader,
 * because the point of this endpoint is that anyone building on the chronicle
 * gets the check for free. `verified` false means the stored roll and the
 * arithmetic disagree, which should be impossible and is therefore worth
 * shouting about rather than swallowing.
 */
export async function GET(
  _request: Request,
  { params }: { params: { index: string } }
) {
  const index = Number(params.index);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "not a line index" }, { status: 400 });
  }

  const line = await getLine(Math.floor(index));

  if (!line.data) {
    // The same distinction the page makes, and for the same reason: 404 is a
    // permanent claim that this line does not exist, and only the contract's own
    // refusal proves that. A node that did not answer gets 503 and a Retry-After,
    // so anything built on this endpoint retries instead of caching an absence.
    if (line.status === "absent") {
      return NextResponse.json({ error: "no such line" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "could not read that line",
        status: "unavailable",
        detail: line.error ?? null,
      },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }

  const recomputed = verifyRoll(line.data.at, line.data.who, line.data.index);

  return NextResponse.json(
    {
      ...line,
      recomputed,
      verified: recomputed === line.data.roll,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
