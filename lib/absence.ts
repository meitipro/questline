/**
 * Telling "this does not exist" apart from "I could not ask".
 *
 * Its own module because it is the single most dangerous judgement the read path
 * makes, and because keeping it free of genlayer-js and next imports is what
 * lets `npm run selftest` exercise it directly.
 *
 * The asymmetry below is deliberate and load bearing. Anything this cannot
 * positively identify as the contract's own refusal is treated as "the node did
 * not answer". Being wrong in that direction shows a retry for a line that
 * really is missing, which is a mildly annoying page. Being wrong the other way
 * tells a reader their chronicle entry was deleted, serves a 404 that crawlers
 * cache, and does it because the network was busy for a second.
 */

/** The contract's own sentence for an index it does not hold. */
export const NO_SUCH_LINE = "no chronicle line with that index";

/**
 * Whether an error is the contract saying the line does not exist.
 *
 * A GenLayer refusal does not always arrive as plain text - it can come back
 * base64 encoded, with a one byte result tag in front of the message - so the
 * error is checked both as-is and with any base64-looking run decoded.
 */
export function saysNoSuchLine(message: string): boolean {
  if (message.toLowerCase().includes(NO_SUCH_LINE)) return true;

  // `=` is padding and appears only at the END of a base64 run. Including it in
  // the body of the class lets a match start one key=value pair earlier -
  // "result=AAA..." matches whole, decodes to noise, and the refusal is missed.
  // That exact mistake was in the first version of this function, and the test
  // in scripts/selftest.mjs is what caught it.
  for (const candidate of message.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? []) {
    try {
      const decoded = Buffer.from(candidate, "base64").toString("utf8");
      if (decoded.toLowerCase().includes(NO_SUCH_LINE)) return true;
    } catch {
      /* not base64, or not text - keep looking */
    }
  }
  return false;
}

/**
 * Everything an error is carrying, as one searchable string.
 *
 * The contract's refusal is NOT in the message. genlayer-js reports
 * "Missing or invalid parameters" at the top level and buries the real answer at
 * `cause.data.receipt.result` as base64 with a one byte tag in front:
 *
 *     AVtFWFBFQ1RFRF0gbm8gY2hyb25pY2xlIGxpbmUgd2l0aCB0aGF0IGluZGV4
 *     -> [EXPECTED] no chronicle line with that index
 *
 * Measured against a live contract, because the shape is not documented and the
 * top level message actively points the wrong way. Searching only the message
 * meant a genuinely missing line was classed "unavailable" and the page offered
 * a retry forever instead of a 404.
 */
export function errorText(e: unknown): string {
  const seen = new WeakSet<object>();
  try {
    // JSON.stringify returns the VALUE undefined, not a string, for undefined,
    // a function or a symbol. Handing that straight back made saysNoSuchLine
    // call .toLowerCase() on undefined and throw, so a read that failed in an
    // unusual way took the whole page down with a 500 instead of degrading to
    // "unavailable" - the one outcome this module exists to guarantee.
    const json = JSON.stringify(e, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
        // Error fields are not enumerable, so they are lifted out by hand.
        if (value instanceof Error) {
          return {
            message: value.message,
            ...(value as unknown as Record<string, unknown>),
            cause: (value as Error & { cause?: unknown }).cause,
          };
        }
      }
      return value;
    });
    return json ?? String(e);
  } catch {
    return String((e as { message?: unknown } | null)?.message ?? e);
  }
}
