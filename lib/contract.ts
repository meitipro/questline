/**
 * Reads, server side, with a few seconds of cache.
 *
 * Nothing in the product depends on the cache for correctness. A stale read
 * shows a chronicle line a moment late, which is a cosmetic bug; no write and
 * no payout is ever decided from here. Writes all go through the browser wallet
 * in lib/actions.ts.
 *
 * When no contract address is configured every function answers from
 * lib/sample.ts and reports `live: false`, so the site is complete and legible
 * before a deploy - and every page that shows it says so.
 */

import { createClient } from "genlayer-js";

import { errorText, saysNoSuchLine } from "./absence";
import { CHAIN, IS_LIVE, QUESTLINE } from "./chain";
import {
  sampleChronicle,
  sampleLeaderboard,
  samplePlayer,
  samplePlayerLines,
  sampleWorld,
} from "./sample";
import type {
  ChroniclePage,
  Leaderboard,
  Line,
  Player,
  World,
} from "./types";

export interface Read<T> {
  data: T;
  /** False when this came from lib/sample.ts rather than from the chain. */
  live: boolean;
  /** Set when the chain was asked and could not answer. */
  error?: string;
  /**
   * Why a lookup produced nothing, when it produced nothing.
   *
   * "absent" is a permanent claim about the world: storage does not hold this.
   * "unavailable" is a fact about the last second: the node did not answer.
   *
   * Collapsing the two is a genuinely damaging bug - a rate limited read renders
   * as "no such line", a 404 gets cached and indexed, and a real chronicle entry
   * appears to have been deleted. When it cannot be told which happened,
   * "unavailable" is the safer answer: claiming a line is gone is the more
   * damaging mistake, and it is the one a reader cannot check.
   */
  status?: "absent" | "unavailable";
}

/**
 * Studio allows about thirty reads a minute and answers "unknown RPC error"
 * when that is exceeded. Every page here costs one to three reads, so a short
 * cache is not an optimisation, it is what keeps the site inside the limit.
 * Nothing depends on it for correctness - a stale read shows a chronicle line a
 * moment late.
 */
const TTL_MS = 20_000;

type Entry = { at: number; value: unknown };
const cache = new Map<string, Entry>();

/**
 * How long a FAILED read is remembered, and why there is a second cache at all.
 *
 * A chronicle line page reads the line twice: once in generateMetadata for the
 * share card and once in the page body. On success the second read is free -
 * the cache above already holds it. On failure nothing was cached, so both
 * reads ran a full three-attempt cycle: about 18.5 seconds each, 37 in total,
 * past the 30 second maxDuration the page declares. The visitor would get a
 * gateway timeout, which is the exact failure the deadline exists to prevent.
 *
 * So a failure is remembered too, briefly. Long enough that the second read in
 * one page render returns instantly, short enough that a visitor arriving
 * moments after an outage ends still gets a real answer.
 */
const FAIL_TTL_MS = 5_000;
const failures = new Map<string, { at: number; error: unknown }>();

/* eslint-disable @typescript-eslint/no-explicit-any */

function client() {
  return createClient({ chain: CHAIN as any });
}

/**
 * How long a single read may take before the page gives up on it.
 *
 * There was no deadline at all, and a configured-but-unreachable contract made
 * the pages take between eleven and TWENTY-ONE seconds before falling back to
 * the seeded world. Measured against a production build pointed at an address
 * that does not exist, which is exactly the state a wrong env var or a Studio
 * outage produces.
 *
 * That is not slow, it is broken: a serverless function is killed long before
 * twenty-one seconds, so the visitor gets a gateway timeout instead of the
 * page that was one fallback away from rendering perfectly.
 *
 * SIX SECONDS PER ATTEMPT, THREE ATTEMPTS. Both numbers are measured, and the
 * earlier five-second single shot was based on a wrong premise - the comment
 * said a healthy Studio read lands in hundreds of milliseconds. It does not.
 * Timed against a live contract, four calls each:
 *
 *   get_leaderboard   1.6  1.6  1.6  1.6
 *   get_line          2.5  1.6  1.6  3.7
 *   get_world         err  err  2.5  1.8
 *   get_chronicle     err  err  err  1.8
 *
 * So a successful read is 1.6 to 3.7 seconds and five seconds was not headroom,
 * it was the edge of the distribution: get_chronicle timed out at 5,000ms on a
 * contract that answers correctly, and the page showed the seeded world.
 *
 * The failures are the second half of the story. They are not slow reads - they
 * are transient connection errors that surface after ten to nineteen seconds,
 * and the NEXT attempt usually succeeds. Studio resolves to a pool of edge
 * addresses and node pins one per process, so one unlucky pick reads as the
 * whole chain being down. scripts/e2e.mjs and scripts/match.mjs already retry
 * for exactly this reason; the site did not, and fell back to the seeded world
 * on the first stumble.
 *
 * Six seconds is comfortably past the slowest observed success and cuts a
 * stalled connection short instead of waiting nineteen seconds to be told. The
 * worst case is three attempts plus two pauses, about 18.5 seconds, inside the
 * 30 second maxDuration the pages declare.
 */
const READ_DEADLINE_MS = 6_000;
const READ_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 250;

/**
 * The read, or a rejection at the deadline, whichever comes first.
 *
 * Losing the race does not cancel the underlying request - there is no abort
 * signal through genlayer-js's readContract - so the fetch runs on and its
 * result is simply ignored. That is acceptable here: the caller has already
 * degraded to the seeded world, and an orphaned read writes nothing.
 */
function withDeadline<T>(work: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${what} did not answer within ${READ_DEADLINE_MS}ms`)),
        READ_DEADLINE_MS
      );
    }),
  ]);
}

async function callView(functionName: string, args: unknown[]): Promise<string> {
  const key = `${functionName}(${JSON.stringify(args)})`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as string;

  const failed = failures.get(key);
  if (failed && Date.now() - failed.at < FAIL_TTL_MS) throw failed.error;

  let raw: unknown;
  let last: unknown;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      raw = await withDeadline(
        client().readContract({
          address: QUESTLINE,
          functionName,
          args: args as any,
        }),
        functionName
      );
      break;
    } catch (e) {
      last = e;
      if (attempt >= READ_ATTEMPTS) {
        failures.set(key, { at: Date.now(), error: last });
        throw last;
      }
      /* client() builds a new client per call, so the next attempt opens its
       * own connection rather than reusing the one that just failed. The pause
       * is there so a node that is briefly busy is not asked three times in the
       * same instant. */
      await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
    }
  }

  // Most views answer with a json string, but verify_roll answers with a u256,
  // which genlayer-js decodes to a bigint. JSON.stringify throws outright on a
  // bigint ("Do not know how to serialize a BigInt"), so it cannot be the
  // fallback - that turned every numeric view into a silent failure.
  const text =
    typeof raw === "string"
      ? raw
      : typeof raw === "bigint" || typeof raw === "number"
        ? raw.toString()
        : JSON.stringify(raw);

  cache.set(key, { at: Date.now(), value: text });
  failures.delete(key);
  return text;
}

/**
 * One shape for every read: try the chain, and on failure fall back to the
 * sample with the reason attached rather than throwing a 500 at a reader. A
 * dead RPC should degrade the page, not delete it.
 */
async function read<T>(
  fetcher: () => Promise<T>,
  fallback: () => T
): Promise<Read<T>> {
  if (!IS_LIVE) return { data: fallback(), live: false };
  try {
    return { data: await fetcher(), live: true };
  } catch (e: any) {
    const error = e?.shortMessage ?? e?.message ?? String(e);
    return { data: fallback(), live: false, error };
  }
}

export async function getWorld(): Promise<Read<World>> {
  return read<World>(
    async () => JSON.parse(await callView("get_world", [])),
    () => sampleWorld()
  );
}

export async function getChronicle(
  before = 0,
  count = 24
): Promise<Read<ChroniclePage>> {
  return read<ChroniclePage>(
    async () => JSON.parse(await callView("get_chronicle", [before, count])),
    () => sampleChronicle()
  );
}

/**
 * One chronicle line.
 *
 * The `status` field is the point of this function. A page that renders a
 * missing line as 404 must be certain the line is missing, and the only error
 * that means that is the contract's own "no chronicle line with that index".
 * Anything else - a rate limit, a dropped socket, a slow node - is
 * "unavailable", and the page offers a retry instead of declaring the line
 * deleted.
 */
export async function getLine(index: number): Promise<Read<Line | null>> {
  if (!IS_LIVE) {
    const found = sampleChronicle().lines.find((l) => l.index === index) ?? null;
    return { data: found, live: false, status: found ? undefined : "absent" };
  }

  try {
    const line = JSON.parse(await callView("get_line", [index])) as Line;
    return { data: line, live: true };
  } catch (e: any) {
    const message = String(e?.shortMessage ?? e?.message ?? e);
    return {
      data: null,
      live: false,
      error: message,
      status: saysNoSuchLine(errorText(e)) ? "absent" : "unavailable",
    };
  }
}

/**
 * One player.
 *
 * Same rule as getLine, and for the same reason. "This address has never entered
 * the world" is a permanent claim about somebody's character, and a read that
 * failed cannot make it. Falling back to the seeded player here was worse than
 * the 404 it mirrors: `samplePlayer` answers `exists: false` for any address it
 * does not recognise, so a real player whose read timed out was told their
 * character did not exist - with a seeded inventory underneath it.
 */
export async function getPlayer(address: string): Promise<Read<Player>> {
  if (!IS_LIVE) return { data: samplePlayer(address), live: false };

  try {
    const player = JSON.parse(await callView("get_player", [address])) as Player;
    // The contract answers `exists: false` itself for an address it has never
    // seen. That IS proof of absence, unlike a failed read.
    return { data: player, live: true, status: player.exists ? undefined : "absent" };
  } catch (e: any) {
    const message = String(e?.shortMessage ?? e?.message ?? e);
    return {
      data: samplePlayer(address),
      live: false,
      error: message,
      status: "unavailable",
    };
  }
}

export async function getPlayerLines(
  address: string,
  count = 12
): Promise<Read<Line[]>> {
  if (!IS_LIVE) return { data: samplePlayerLines(address), live: false };

  try {
    const blob = JSON.parse(await callView("get_player_lines", [address, count]));
    return { data: blob.lines ?? [], live: true };
  } catch (e: any) {
    // Empty, not seeded. Showing another character's invented history under a
    // real address is the kind of quiet lie this whole product argues against.
    return {
      data: [],
      live: false,
      error: String(e?.shortMessage ?? e?.message ?? e),
      status: "unavailable",
    };
  }
}

export async function getLeaderboard(count = 20): Promise<Read<Leaderboard>> {
  return read<Leaderboard>(
    async () => JSON.parse(await callView("get_leaderboard", [count])),
    () => sampleLeaderboard()
  );
}

/**
 * Ask the chain to recompute a roll. lib/roll.ts does the same arithmetic in the
 * browser; if the two ever disagree, the chronicle line is the thing that is
 * wrong, and that disagreement is worth surfacing rather than hiding.
 */
export async function verifyRollOnChain(
  at: string,
  who: string,
  index: number
): Promise<number | null> {
  if (!IS_LIVE) return null;
  try {
    // callView normalises a u256 to its decimal string, so Number() is enough
    // and JSON.parse would only add a way to fail.
    const value = Number(await callView("verify_roll", [at, who, index]));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
