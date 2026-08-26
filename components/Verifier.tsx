"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  BAND_COLOR,
  BAND_LABEL,
  bandOf,
  linePath,
  normaliseStamp,
  shortAddr,
} from "@/lib/format";
import { rollSeed, sha256Hex, verifyRoll } from "@/lib/roll";
import type { Line } from "@/lib/types";

type Row = { line: Line; recomputed: number; ok: boolean };

/**
 * The claim, made checkable.
 *
 * Every page in this product asserts that a roll can be recomputed from public
 * data. This is the only one that lets a reader actually do it - first on one
 * line, field by field, and then on the whole chronicle at once, in their own
 * browser, watching the tally climb.
 *
 * Nothing here talks to the chain. That is the entire point: the arithmetic runs
 * on the reader's machine, over data the reader can see, using the same twenty
 * lines of sha256 the contract uses. If the site were lying, this page would be
 * the thing that caught it - so it is deliberately built to be able to fail
 * loudly rather than to reassure.
 */
export function Verifier({
  initialLines,
  live,
}: {
  initialLines: Line[];
  live: boolean;
}) {
  const [at, setAt] = useState("");
  const [who, setWho] = useState("");
  const [index, setIndex] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [scanned, setScanned] = useState(0);
  const cancelled = useRef(false);

  // Prefill from the newest line so the fields are never an empty puzzle.
  useEffect(() => {
    const first = initialLines[0];
    if (!first) return;
    setAt(first.at);
    setWho(first.who);
    setIndex(String(first.index));
  }, [initialLines]);

  useEffect(() => () => { cancelled.current = true; }, []);

  /* Normalised exactly as the contract normalises it, because the chronicle line
   * page prints the stamp WITH a trailing Z and a reader will paste that. The Z
   * is not in the seed: the same line reads 14 in the contract's form and 6 with
   * the Z attached, so without this the verifier accused an honest chronicle of
   * the impossible. Milliseconds and a space separator fold in the same way. */
  const cleanAt = normaliseStamp(at);
  const stampWasReshaped = cleanAt !== at.trim();

  const seed =
    cleanAt && who && index !== "" ? rollSeed(cleanAt, who, Number(index)) : "";
  const digest = seed ? sha256Hex(seed) : "";
  const manual =
    seed && Number.isFinite(Number(index))
      ? verifyRoll(cleanAt, who, Number(index))
      : null;

  /** What the chronicle says this line rolled, if it is a line we hold. */
  const claimed = initialLines.find((l) => l.index === Number(index));

  /**
   * Walk the chronicle, recomputing every roll.
   *
   * Yields to the event loop every few lines so the tally is watchable and the
   * page never locks up - the arithmetic is fast enough that doing it all at
   * once would finish before a single frame painted, which would look like a
   * number being asserted rather than a computation being done.
   */
  const runAll = useCallback(async () => {
    cancelled.current = false;
    setRunning(true);
    setDone(false);
    setRows([]);
    setScanned(0);

    const found: Row[] = [];
    for (let i = 0; i < initialLines.length; i++) {
      if (cancelled.current) break;
      const line = initialLines[i];
      const recomputed = verifyRoll(line.at, line.who, line.index);
      found.push({ line, recomputed, ok: recomputed === line.roll });
      setScanned(i + 1);
      if (i % 3 === 2) {
        setRows([...found]);
        await new Promise((r) => setTimeout(r, 55));
      }
    }
    setRows(found);
    setRunning(false);
    setDone(true);
  }, [initialLines]);

  const bad = rows.filter((r) => !r.ok);

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* ---- one line, field by field ---- */}
      <section className="panel pad">
        <div className="label">RECOMPUTE ONE ROLL</div>
        <p className="note" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Three public fields go in. Change any of them and the roll changes -
          which is the whole reason a player can check the world rather than
          trust it.
        </p>

        <div className="verify-fields" style={{ marginTop: 18 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="label">RESOLVED AT (UTC)</span>
            <input
              className="field mono"
              style={{ fontSize: 14 }}
              value={at}
              onChange={(e) => setAt(e.target.value.trim())}
              spellCheck={false}
            />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="label">PLAYER</span>
            <input
              className="field mono"
              style={{ fontSize: 14 }}
              value={who}
              onChange={(e) => setWho(e.target.value.trim())}
              spellCheck={false}
            />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="label">LINE INDEX</span>
            <input
              className="field mono"
              style={{ fontSize: 14 }}
              value={index}
              onChange={(e) => setIndex(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              spellCheck={false}
            />
          </label>
        </div>

        {stampWasReshaped ? (
          <p className="mono" style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            read as <span style={{ color: "var(--cream)" }}>{cleanAt}</span> - the
            contract stores nineteen characters of UTC, so a trailing Z,
            milliseconds and a space separator are all folded away before the
            hash. The chronicle page prints the Z; the seed does not contain it.
          </p>
        ) : null}

        {seed ? (
          <div
            className="mono"
            style={{
              marginTop: 18,
              border: "1px solid var(--line)",
              background: "var(--ink)",
              padding: 16,
              fontSize: 14,
              color: "var(--body)",
              overflowX: "auto",
            }}
          >
            <div style={{ whiteSpace: "nowrap" }}>seed = {seed}</div>
            <div style={{ whiteSpace: "nowrap", marginTop: 6 }}>
              sha256 ={" "}
              <span style={{ color: "var(--cream)" }}>{digest.slice(0, 4)}</span>
              <span style={{ color: "var(--muted)" }}>{digest.slice(4)}</span>
            </div>
            <div style={{ whiteSpace: "nowrap", marginTop: 6 }}>
              0x{digest.slice(0, 4)} = {parseInt(digest.slice(0, 4), 16)}
            </div>
            <div style={{ whiteSpace: "nowrap", marginTop: 6 }}>
              {parseInt(digest.slice(0, 4), 16)} mod 20 + 1 ={" "}
              <span style={{ color: "var(--accent-text)", fontSize: 18 }}>{manual}</span>
            </div>
          </div>
        ) : null}

        {manual !== null ? (
          <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className="tag" style={{ fontSize: 14, padding: "5px 10px" }}>
              roll {manual} of 20
            </span>
            <span className="mono" style={{ fontSize: 14, color: BAND_COLOR[bandOf(manual)] }}>
              {BAND_LABEL[bandOf(manual)]}
            </span>
            {claimed ? (
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  color: claimed.roll === manual ? "var(--success-text)" : "var(--fail-text)",
                }}
              >
                {claimed.roll === manual
                  ? `matches line ${claimed.index} in the chronicle`
                  : `line ${claimed.index} claims ${claimed.roll} - that should be impossible`}
              </span>
            ) : (
              <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                not a line this page is holding, so there is nothing to compare it to
              </span>
            )}
          </div>
        ) : null}
      </section>

      {/* ---- the whole chronicle, at once ---- */}
      <section className="panel-dim">
        <div className="panel-head label">
          <span>VERIFY EVERY LINE THIS PAGE CAN SEE</span>
          <span>{initialLines.length} lines</span>
        </div>

        <div style={{ padding: 22 }}>
          <p className="note" style={{ maxWidth: "68ch" }}>
            This runs in your browser, over the same public fields shown on every
            chronicle line, using the same arithmetic the contract runs. It talks
            to nothing.
            {live
              ? ""
              : " These lines come from the seeded world, and they verify too - the timestamps were chosen so they would."}
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={runAll} disabled={running || initialLines.length === 0}>
              {running ? "recomputing..." : done ? "Run it again" : "Recompute every roll"}
            </button>

            {running || done ? (
              <span className="mono" style={{ fontSize: 14 }}>
                <span style={{ color: "var(--cream)" }}>{scanned}</span>
                <span style={{ color: "var(--muted)" }}> of {initialLines.length} checked</span>
                {done ? (
                  <span
                    style={{
                      marginLeft: 12,
                      color: bad.length === 0 ? "var(--success-text)" : "var(--fail-text)",
                    }}
                  >
                    {bad.length === 0
                      ? "every one verifies"
                      : `${bad.length} DISAGREE`}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {rows.map(({ line, recomputed, ok }) => (
              <div
                key={line.index}
                className="verify-row mono"
                style={{
                  padding: "11px 22px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13,
                }}
              >
                <Link href={linePath(line.index)} style={{ color: "var(--muted)" }}>
                  line {line.index}
                </Link>
                <span style={{ color: "var(--muted)" }}>{shortAddr(line.who)}</span>
                <span style={{ color: "var(--muted)" }}>stored {line.roll}</span>
                <span style={{ color: "var(--cream)" }}>computed {recomputed}</span>
                <span style={{ color: ok ? "var(--success-text)" : "var(--fail-text)" }}>
                  {ok ? "agrees" : "DISAGREES"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
