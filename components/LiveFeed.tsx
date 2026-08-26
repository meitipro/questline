"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ago, linePath, shortAddr } from "@/lib/format";
import type { Line } from "@/lib/types";

import { RollBadge } from "./RollBadge";
import { Sep } from "./Sep";

type Row = { line: Line; ago: string };

/**
 * The homepage is the chronicle. Real resolved actions with real rolls are more
 * convincing than any amount of concept art, so this is the first thing on the
 * page and it moves.
 *
 * Live mode polls the cached read route. Demonstration mode advances through the
 * seeded pool instead - and each seeded line's timestamp is still searched until
 * its roll verifies, so even the ticker is arithmetic somebody could check.
 */
export function LiveFeed({
  initial,
  live,
  intervalMs = 6000,
}: {
  initial: Row[];
  live: boolean;
  intervalMs?: number;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
  }, []);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/chronicle?count=8", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const page = await response.json();
        if (cancelled || !Array.isArray(page?.data?.lines)) return;

        // A poll that came back NOT live means the server fell through to the
        // seeded world. Dropping it is the whole point: this feed is labelled as
        // the live chronicle, so quietly swapping invented lines into it during
        // an rpc hiccup would be exactly the thing the product says nobody can
        // do. The last good feed stays on screen instead.
        if (page.live === false) return;

        setRows(
          page.data.lines.map((line: Line) => ({ line, ago: ago(line.at) }))
        );
      } catch {
        /* A dropped poll leaves the last good feed on screen. */
      }
    }

    const timer = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [live, intervalMs]);

  /* Demonstration mode ROTATES the seeded lines. It used to mint a new line with
   * a fresh index every few seconds, and every one of those indices was a dead
   * link: the ticker is the first thing a visitor sees, and clicking any row in
   * it landed on "No such line, and the world does not invent them" - while the
   * ticker was, in fact, inventing them.
   *
   * So nothing new is claimed here. The real seeded lines cycle through the
   * window, keeping their real indices, their real timestamps and their real
   * permalinks. There is still motion; there is simply no lie in it. */
  useEffect(() => {
    if (live) return;
    if (initial.length < 2) return;
    const timer = setInterval(() => {
      setRows((current) => {
        if (current.length < 2) return current;
        return [current[current.length - 1], ...current.slice(0, -1)];
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [live, intervalMs, initial.length]);

  return (
    <div className="panel">
      <div className="panel-head label" style={{ padding: "12px 16px" }}>
        <span>LIVE CHRONICLE</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--accent-text)",
          }}
        >
          {/* The dot only animates once mounted, so the server's html and the
              client's first render agree - and it only pulses when something is
              actually resolving. A seeded feed that says RESOLVING is claiming
              the world is busy when it is a fixture. */}
          <span
            className="live-dot"
            style={pulse && live ? undefined : { animation: "none" }}
          />
          {live ? "RESOLVING" : "SEEDED"}
        </span>
      </div>

      <div className="scroller">
        {rows.map(({ line, ago: when }) => (
          <Link
            key={`${line.index}-${line.at}`}
            href={linePath(line.index)}
            className="feed-row"
            style={{ padding: 16 }}
          >
            <div style={{ fontSize: 15, lineHeight: 1.55 }}>{line.text}</div>
            <div className="meta" style={{ marginTop: 10 }}>
              <RollBadge roll={line.roll} band={line.band} />
              <Sep />
              <span>{shortAddr(line.who)}</span>
              <Sep />
              <span>{line.region_name}</span>
              <Sep />
              <span>rules v{line.rules_version}</span>
              <Sep />
              <span>{when}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
