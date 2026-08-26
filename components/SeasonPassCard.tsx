"use client";

import { useEffect, useState } from "react";

import { buySeasonPass, humaniseStamps, readableError } from "@/lib/actions";
import { IS_LIVE } from "@/lib/chain";
import { gen } from "@/lib/format";
import { useWallet } from "@/lib/useWallet";
import type { Player, Season, WriteStage } from "@/lib/types";

/**
 * Buying into the ranked season.
 *
 * This is the one action on the site that moves money, so it is the one that
 * waits for FINALIZED rather than acting on ACCEPTED. Everything else in
 * Questline is a record and can be shown the moment validators agree; a payment
 * that was shown as done and then reversed cannot be taken back.
 *
 * The price is read from the contract rather than written here. A season pass
 * is a governance value the owner can change between seasons, and a hardcoded
 * copy in the client fails the write with a message about value rather than a
 * message about price.
 */
const STAGE_COPY: Record<WriteStage, string> = {
  idle: "",
  signing: "sign the payment in your wallet",
  sent: "paying into the season pool",
  accepted: "accepted. waiting for the appeal window to close",
  finalized: "paid, and the pool has it",
  failed: "",
};

export function SeasonPassCard({ season }: { season: Season }) {
  const { address, onCorrectChain, connecting, hasWallet, connect } = useWallet();
  const [player, setPlayer] = useState<Player | null>(null);
  const [stage, setStage] = useState<WriteStage>("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!address) {
      setPlayer(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/player/${address}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((blob) => {
        // Same rule as everywhere else: an "unavailable" payload is the seeded
        // character, not this one, and telling somebody they already hold a pass
        // on the strength of seeded data is how a real purchase gets skipped.
        if (cancelled || !blob?.data || blob.status === "unavailable") return;
        setPlayer(blob.data as Player);
      })
      .catch(() => {
        /* The card falls back to its unknown state, which is honest. */
      });
    return () => {
      cancelled = true;
    };
  }, [address, done]);

  if (!IS_LIVE) {
    return (
      <div className="panel pad-sm">
        <div className="label">SEASON PASS</div>
        <p className="note" style={{ marginTop: 12 }}>
          {gen(season.pass_price, 2)} GEN. No contract is configured yet, so
          there is nothing to pay into - the pool on this page is seeded.
        </p>
      </div>
    );
  }

  const price = (() => {
    try {
      return BigInt(season.pass_price || "0");
    } catch {
      return 0n;
    }
  })();

  async function buy() {
    if (!address) {
      await connect();
      return;
    }
    setError("");
    setStage("signing");
    try {
      await buySeasonPass(address as `0x${string}`, price, (s, n) => {
        setStage(s);
        setNote(n ?? "");
      });
      setDone(true);
    } catch (e) {
      setError(humaniseStamps(readableError(e)));
      setStage("failed");
    }
  }

  const busy = stage === "signing" || stage === "sent" || stage === "accepted";

  return (
    <div className="panel pad-sm">
      <div className="label">SEASON PASS</div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.03em" }}>
          {gen(season.pass_price, 2)}
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          GEN
        </span>
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        Entry to the ranked season. Everything you send goes into the pool, which
        the contract holds and pays out on finality.
      </p>

      {season.closed ? (
        <p className="note" style={{ marginTop: 14, color: "var(--muted)" }}>
          This season is closed. The next one opens with its own pass.
        </p>
      ) : player?.ranked || done ? (
        <p
          className="mono"
          style={{ marginTop: 14, fontSize: 12, color: "var(--success-text)" }}
        >
          you hold a pass for this season
        </p>
      ) : (
        <>
          <button
            className="btn"
            style={{ marginTop: 16, width: "100%" }}
            onClick={buy}
            disabled={busy || connecting || !hasWallet}
          >
            {!hasWallet
              ? "No wallet in this browser"
              : !address
                ? "Connect a wallet"
                : busy
                  ? "working..."
                  : "Buy a season pass"}
          </button>

          {address && player && !player.exists ? (
            <p className="note" style={{ marginTop: 10 }}>
              You have not entered the world yet. A pass without a character has
              nothing to rank.
            </p>
          ) : null}

          {onCorrectChain === false ? (
            <p
              className="mono"
              style={{ marginTop: 10, fontSize: 12, color: "var(--fail-text)" }}
            >
              your wallet is on another network
            </p>
          ) : null}
        </>
      )}

      {busy || stage === "finalized" ? (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--accent-text)" }}>
            {note || STAGE_COPY[stage]}
          </div>
          {/* Said plainly, because "accepted" and "paid" are different facts and
              only one of them is safe to celebrate. */}
          {stage === "accepted" ? (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              nothing has moved yet. a payout shown before finality can be reversed
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="blocked" style={{ marginTop: 14 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
