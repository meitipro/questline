import type { Band, Line } from "./types";

/**
 * The colour of a band, as a CSS variable rather than a hex literal.
 *
 * These end up in inline styles, so a literal would be frozen at whatever the
 * dark palette says and the band labels would stay near-unreadable on paper.
 * The -text variants are the contrast-corrected ones; see the measurements at
 * the top of app/globals.css.
 */
export const BAND_COLOR: Record<Band, string> = {
  fail: "var(--fail-text)",
  partial: "var(--accent-text)",
  success: "var(--success-text)",
};

/** Short form, for the chip beside an outcome. */
export const BAND_LABEL: Record<Band, string> = {
  fail: "failed",
  partial: "partial",
  success: "success",
};

/** Long form, for a line's own page. */
export const BAND_LONG: Record<Band, string> = {
  fail: "failure",
  partial: "partial success",
  success: "success",
};

export function bandOf(roll: number, failMax = 5, partialMax = 15): Band {
  if (roll <= failMax) return "fail";
  if (roll <= partialMax) return "partial";
  return "success";
}

export function rollText(roll: number, die = 20): string {
  return `roll ${roll} of ${die}`;
}

/**
 * How much of a region's ceiling a band is allowed to spend.
 *
 * The mirror of `_band_cap` in contracts/questline.py. A partial success that
 * landed the full magnitude would be indistinguishable from a success, which
 * would make the middle band decorative - so half, rounded up. The contract
 * publishes its own copy of this rule through get_world, which is what lets a
 * reader check this function rather than take it on trust.
 */
export function bandCap(band: Band, regionCap: number): number {
  return band === "partial" ? Math.ceil(regionCap / 2) : regionCap;
}

/**
 * Contract timestamps are UTC with no zone marker, because the contract strips
 * it. Parsing one without putting the Z back reads it as local time, which is
 * how a chronicle line ends up claiming to be from the future.
 */
export function parseStamp(at: string): Date {
  return new Date(`${at}Z`);
}

/**
 * The exact 19 character form the contract hashes.
 *
 * The mirror of `_normalise` in contracts/questline.py, and it is not a nicety.
 * The chronicle line page prints the timestamp as `2026-08-15T11:50:09Z` - with
 * the Z - because that is the honest way to show a UTC instant. The seed does
 * NOT contain the Z. So a reader who copied the stamp off the page and into the
 * verifier got a different hash and a different roll, and the page told them the
 * chronicle's number "should be impossible".
 *
 * Measured: the same line reads 14 in the contract's form, 6 with a trailing Z,
 * 8 with a space separator, and 12 with milliseconds. All four are shapes the
 * contract itself accepts and folds together, so the verifier folds them too.
 */
export function normaliseStamp(raw: string): string {
  let text = raw.trim().replace(" ", "T");
  if (text.endsWith("Z")) text = text.slice(0, -1);
  return text.slice(0, 19);
}

export function ago(at: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - parseStamp(at).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return parseStamp(at).toISOString().slice(0, 10);
}

/** "in 4h 12m", the exact form the design uses beside the energy meter. */
export function untilShort(at: string, now: Date = new Date()): string {
  const ms = parseStamp(at).getTime() - now.getTime();
  if (ms <= 0) return "now";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `in ${m}m`;
  return `in ${h}h ${String(m).padStart(2, "0")}m`;
}

/** "12d 04h 08m 31s", for the season clock. */
export function countdown(at: string, now: Date = new Date()): string {
  let ms = parseStamp(at).getTime() - now.getTime();
  if (ms <= 0) return "closed";
  const days = Math.floor(ms / 86400000);
  ms -= days * 86400000;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  ms -= m * 60000;
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days}d ${p(h)}h ${p(m)}m ${p(s)}s`;
}

const GEN = 10n ** 18n;

/**
 * Wei to GEN, as a string, without going through Number. A prize pool is the
 * number people argue about, and float rounding in the display of it is the
 * kind of bug that reads as dishonesty.
 */
export function gen(wei: string | bigint, decimals = 0): string {
  let value: bigint;
  try {
    value = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  } catch {
    return "0";
  }
  const whole = value / GEN;
  if (decimals === 0) return whole.toLocaleString("en-US");
  const fraction = ((value % GEN) * 10n ** BigInt(decimals)) / GEN;
  return `${whole.toLocaleString("en-US")}.${String(fraction).padStart(decimals, "0")}`;
}

/**
 * The energy a player would actually have if they acted right now.
 *
 * A view method cannot write, so `get_player` reports the energy as stored - it
 * has no way to roll the cycle forward the way `act` does. That means a player
 * whose cycle turned an hour ago still reads as zero, and an interface that
 * trusted the stored number would refuse a turn the contract would happily have
 * accepted.
 *
 * The mirror of `_refresh` in contracts/questline.py, for display and for
 * pre-flight only. The contract remains the authority.
 */
export function effectiveEnergy(
  player: { energy: number; max_energy: number; next_cycle: string },
  now: Date = new Date()
): number {
  if (!player.next_cycle) return player.max_energy;
  if (parseStamp(player.next_cycle).getTime() <= now.getTime()) {
    return player.max_energy;
  }
  return player.energy;
}

/** 0x88a1 - the form the design uses everywhere a player is named. */
export function shortAddr(address: string): string {
  if (!address) return "0x0000";
  return address.slice(0, 6).toLowerCase();
}

/**
 * Which sentence to put beside a magnitude.
 *
 * "capped at 4 by the region" and "capped at 2 by the partial band" are
 * different facts, and a player arguing about a result deserves the one that
 * actually applied to them.
 */
export function capSentence(line: Pick<Line, "magnitude" | "region_cap" | "band_cap">): string {
  if (line.band_cap < line.region_cap) {
    return `${line.magnitude}, capped at ${line.band_cap} by the partial band, ${line.region_cap} by the region`;
  }
  return `${line.magnitude}, capped at ${line.region_cap} by the region`;
}

export function linePath(index: number): string {
  return `/chronicle/${index}`;
}

export function playerPath(address: string): string {
  return `/c/${address.toLowerCase()}`;
}
