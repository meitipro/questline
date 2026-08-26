import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/Countdown";
import { SampleNote } from "@/components/SampleNote";
import { SeasonPassCard } from "@/components/SeasonPassCard";
import { achievementDefinitions } from "@/lib/achievements";
import { IS_STUDIO, NETWORK_LABEL } from "@/lib/chain";
import { getLeaderboard, getWorld } from "@/lib/contract";
import { countdown, gen, playerPath, shortAddr } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Season",
  description:
    "The prize pool, the leaderboard, the achievement definitions and the clock. Placings settle on finality, not acceptance.",
};

export default async function SeasonPage() {
  const [board, world] = await Promise.all([getLeaderboard(20), getWorld()]);
  const now = new Date();
  const { season, rows, past } = board.data;
  const definitions = achievementDefinitions(world.data);

  return (
    <div className="page">
      <SampleNote live={board.live} error={board.error} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "end",
          marginTop: board.live ? 0 : 24,
        }}
        className="two-up"
      >
        <div>
          <div className="eyebrow">
            {"// SEASON "}
            {season.number} . {season.name.toUpperCase()}
          </div>
          <h1 className="display" style={{ marginTop: 14 }}>
            A clock, a pool, and a placing worth arguing about.
          </h1>
        </div>

        <div
          className="panel pad"
          style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              PRIZE POOL
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: "-.04em",
                color: "var(--accent-text)",
                lineHeight: 1.1,
              }}
            >
              {gen(season.pool)}
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              GEN, held by the contract
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              {season.closed ? "CLOSED" : "CLOSES IN"}
            </div>
            <div
              className="mono"
              style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.4 }}
            >
              {season.closed ? (
                "settled"
              ) : (
                <Countdown ends={season.ends} initial={countdown(season.ends, now)} />
              )}
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              {season.ends}Z
            </div>
          </div>
        </div>
      </div>

      <div className="season-split" style={{ marginTop: 34 }}>
        {/* ---- leaderboard ---- */}
        <div className="panel-dim">
          <div
            className="label board-head"
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 110px 110px",
              gap: 16,
              padding: "12px 22px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span>#</span>
            <span>PLAYER</span>
            <span>ACTIONS</span>
            <span>DEPTH</span>
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: 22 }}>
              <p className="lede">
                Nobody holds a pass yet. The board fills as players enter the ranked
                season.
              </p>
              <div style={{ marginTop: 18 }}>
                <Link href="/play" className="btn">
                  Enter the world
                </Link>
              </div>
            </div>
          ) : (
            rows.map((row) => (
              <Link
                key={row.address}
                href={playerPath(row.address)}
                className="mono board-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr 110px 110px",
                  gap: 16,
                  padding: "15px 22px",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--cream)",
                  fontSize: 14,
                }}
              >
                <span
                  style={{ color: row.rank === 1 ? "var(--accent-text)" : "var(--muted)" }}
                >
                  {String(row.rank).padStart(2, "0")}
                </span>
                <span>{shortAddr(row.address)}</span>
                <span style={{ color: "var(--muted)" }}>{row.actions}</span>
                <span style={{ color: "var(--muted)" }}>{row.depth}</span>
              </Link>
            ))
          )}

          <div style={{ padding: "14px 22px" }}>
            <p className="note" style={{ fontSize: 12 }}>
              Ordered by resolved actions, then depth, then best roll. The order is
              computed from contract storage on every read, so there is no ranking
              table for anyone to edit.
            </p>
          </div>
        </div>

        <div className="stack">
          {/* The pool on the left is only a number until somebody can pay into
              it, so the way in sits directly beside it. */}
          <SeasonPassCard season={world.data.season} />

          <div className="panel pad-sm">
            <div className="label">ACHIEVEMENT DEFINITIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              {definitions.map((a) => (
                <div key={a.name}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", marginTop: 3 }}>
                    {a.body}
                  </div>
                </div>
              ))}
            </div>
            {/* No holder counts. See the note in lib/achievements.ts: a tally the
                operator maintains is a number nobody should have to trust. */}
            <p className="note" style={{ marginTop: 14, fontSize: 12 }}>
              Every one of these is derived from public state when a character
              sheet is read. None of them is a flag anyone can set, and there is no
              stored holder count to be wrong about.
            </p>
          </div>

          <div className="panel pad-sm">
            <div className="label">PAST SEASONS</div>
            {past.length === 0 ? (
              <p className="note" style={{ marginTop: 12 }}>
                This is the first season. There is nothing behind it yet.
              </p>
            ) : (
              <div className="rowlist" style={{ marginTop: 12 }}>
                {past.map((s) => (
                  <div key={s.number} className="mono" style={{ fontSize: 14 }}>
                    <span>
                      season {s.number} . {s.name}
                    </span>
                    <span style={{ color: "var(--muted)", textAlign: "right" }}>
                      {s.winner === "0x0000000000000000000000000000000000000000"
                        ? "unranked"
                        : `won by ${shortAddr(s.winner)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-ink pad-sm">
            <p className="note">
              Placings settle on finality, not acceptance. Payouts move only after
              the appeal window closes, because a reversal after a payout cannot be
              undone.
            </p>
            <p className="note" style={{ marginTop: 10 }}>
              The pool pays {"50, 30 and 20"} percent to the top three, or the whole
              pool split between however many placed if fewer than three did. The
              split is in the contract rather than in a policy page, and it always
              adds up to the whole pool - a season that paid out less than it held
              would leave coins nobody could ever claim. If nobody places at all,
              nothing is paid and the pool carries into the next season rather
              than being cleared, for the same reason.
            </p>
            {IS_STUDIO ? (
              <p
                className="note"
                style={{ marginTop: 10, color: "var(--fail-text)" }}
              >
                On {NETWORK_LABEL.toLowerCase()} a payout does not arrive. The
                contract emits the transfer and is debited correctly, but the
                emitted transfer is delivered as a contract call and an ordinary
                wallet is not a contract, so it is refused as its own transaction.
                Closing a season here is a real settlement with an unreachable
                payment; nobody gets richer. Verify anything payout-critical on a
                network where transfers land.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
