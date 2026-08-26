"use client";

import { useEffect, useState } from "react";

import { ago } from "@/lib/format";
import type { ChroniclePage, Effect, Line } from "@/lib/types";

import { ChronicleRow } from "./ChronicleRow";

const FILTERS: (Effect | "all")[] = [
  "all",
  "discover",
  "gain_item",
  "move",
  "damage",
  "lose_item",
  "none",
];

/**
 * The filterable feed of every resolved action.
 *
 * Filtering happens on what has been loaded rather than by asking the chain for
 * a filtered page, because the contract deliberately has no filtered view: an
 * index over effects would be storage the operator maintains, and every piece of
 * storage the operator maintains is a thing a player would otherwise have to
 * trust. Paging is cheap; a trusted index is not.
 */
export function ChronicleFeed({
  initial,
  live,
}: {
  initial: ChroniclePage;
  live: boolean;
}) {
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [cursor, setCursor] = useState(initial.next);
  const [more, setMore] = useState(initial.more);
  const [filter, setFilter] = useState<Effect | "all">("all");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setNow(new Date()), []);

  const shown = filter === "all" ? lines : lines.filter((l) => l.effect === filter);
  const notable = lines.filter((l) => l.roll >= 17 || l.roll <= 4).slice(0, 4);

  async function loadMore() {
    if (!live || loading || !more) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/chronicle?before=${cursor}&count=24`, {
        cache: "no-store",
      });
      const page = await response.json();
      const next: ChroniclePage | undefined = page?.data;
      if (next?.lines?.length) {
        setLines((current) => [...current, ...next.lines]);
        setCursor(next.next);
        setMore(next.more);
      } else {
        setMore(false);
      }
    } catch {
      /* Leave the button. A failed page is a retry, not an error state. */
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className="chip"
            data-on={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="split" style={{ marginTop: 34 }}>
        <div className="panel-dim">
          {shown.length === 0 ? (
            <div style={{ padding: 22 }}>
              <p className="lede">
                Nothing here resolved as <span className="mono">{filter}</span>.
                {more ? " There may be older lines; load them below." : ""}
              </p>
            </div>
          ) : (
            shown.map((line) => (
              <ChronicleRow
                key={line.index}
                line={line}
                ago={now ? ago(line.at, now) : line.at}
                showAction
              />
            ))
          )}

          {more ? (
            <div style={{ padding: 20, borderTop: "1px solid var(--line)" }}>
              <button className="btn-ghost" onClick={loadMore} disabled={loading}>
                {loading ? "reading storage..." : "Load older lines"}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="rail">
          <div className="panel pad-sm">
            <div className="label eyebrow-accent">NOTABLE ROLLS TODAY</div>
            {notable.length === 0 ? (
              <p className="note" style={{ marginTop: 12 }}>
                No natural highs or lows yet. The middle of the die is where most
                of a season actually happens.
              </p>
            ) : (
              <div className="rowlist" style={{ marginTop: 12 }}>
                {notable.map((line) => (
                  <a key={line.index} href={`/chronicle/${line.index}`} style={{ display: "block" }}>
                    <span style={{ display: "block", width: "100%" }}>
                      <span
                        className="mono"
                        style={{ display: "block", fontSize: 12, color: "var(--muted)" }}
                      >
                        roll {line.roll} of 20 . {line.band}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 6,
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        {line.text.length > 72 ? `${line.text.slice(0, 72)}...` : line.text}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="panel-ink pad-sm">
            <p className="note">
              Chronicle lines and state changes appear on acceptance. Item mints
              and prize payouts wait for finality.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
