import Link from "next/link";

import { NETWORK_LABEL } from "@/lib/chain";

export function Footer() {
  return (
    <footer className="band band-dim">
      <div
        style={{
          maxWidth: "var(--page)",
          margin: "0 auto",
          padding: "40px 32px",
          display: "flex",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              color: "var(--cream)",
              fontFamily: "var(--sans)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-.03em",
            }}
          >
            questline.world
          </span>
          {/* Read off lib/chain.ts rather than typed, so the footer cannot
              claim one network while the app talks to another. */}
          <span>GENLAYER . {NETWORK_LABEL} . GENVM PYTHON SDK</span>
        </div>

        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/play" style={{ color: "var(--muted)" }}>
              Play
            </Link>
            <Link href="/chronicle" style={{ color: "var(--muted)" }}>
              Chronicle
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/world" style={{ color: "var(--muted)" }}>
              World &amp; rules
            </Link>
            <Link href="/verify" style={{ color: "var(--muted)" }}>
              Verify a roll
            </Link>
            <Link href="/season" style={{ color: "var(--muted)" }}>
              Season
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              textAlign: "right",
            }}
          >
            <span>PREPARED FOR @MEITIPRO1</span>
            <span>INFERNODE.ORG / @INFER_NODE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
