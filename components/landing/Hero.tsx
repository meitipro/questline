/**
 * The hero: the typed headline on the left, the orbiting count on the right.
 *
 * Both halves sit over a dark photograph that does not change with the theme,
 * so the type colours here are fixed rather than tokens. That is the one place
 * in this codebase where hard-coded colours are correct, and the scrim below
 * is what makes them legible: it is a gradient, not a flat wash, so the picture
 * still reads at the bottom of the frame.
 */

import Link from "next/link";

import { HERO } from "@/lib/landing";
import type { World } from "@/lib/types";

import { OrbitRings } from "./OrbitRings";
import { Ticker } from "./Ticker";
import { TypedHeadline } from "./TypedHeadline";

export function Hero({ world }: { world: World }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          // The design points this at a remote CDN. A landing page that waits on
          // a third party host for its own background is a landing page that
          // renders grey when that host is slow, so the artwork belongs in
          // public/ - drop it in as hero.webp and add it in front of this
          // gradient. Until then the gradient IS the background rather than a
          // placeholder that fails visibly.
          background: "radial-gradient(120% 90% at 72% 18%, #1b1d22 0%, #101114 45%, #0a0b0c 100%)",
        }}
      />
      {/* Darkest at the top, where the header sits, and clear by 340px so the
          picture is still a picture. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 340,
          background:
            "linear-gradient(180deg, rgba(10,11,12,.72) 0%, rgba(10,11,12,.66) 45%, rgba(10,11,12,.3) 75%, rgba(10,11,12,0) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="hero-body"
        style={{
          position: "relative",
          zIndex: 2,
          flex: "1 1 auto",
          width: "100%",
          maxWidth: 1920,
          margin: "0 auto",
          boxSizing: "border-box",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          padding: "120px clamp(20px, 3.4vw, 64px) 0",
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: "1 1 320px",
            minWidth: 0,
            maxWidth: 600,
            animation: "ql-fade-up 1s cubic-bezier(.22,1,.36,1) both",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 12,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "#e9a23b",
              marginBottom: 16,
            }}
          >
            {HERO.eyebrow}
          </div>

          <TypedHeadline />

          <p
            style={{
              margin: "18px 0 0",
              maxWidth: "46ch",
              fontSize: 17,
              lineHeight: 1.5,
              color: "#efebe2",
              animation: "ql-fade-up-sm .8s cubic-bezier(.22,1,.36,1) 2.8s both",
            }}
          >
            {HERO.lede}
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 24,
              animation: "ql-fade-up-sm .8s cubic-bezier(.22,1,.36,1) 3.2s both",
            }}
          >
            <span className="cta-ring">
              <Link href="/play" className="cta-fill cta-fill-lg">
                <span style={{ position: "relative", zIndex: 1 }}>{HERO.primary}</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ position: "relative", zIndex: 1 }}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </span>
            <Link href="/chronicle" className="cta-ghost">
              {HERO.secondary}
            </Link>
          </div>

          <div
            className="hero-badge"
            style={{ animation: "ql-fade-up-sm .8s cubic-bezier(.22,1,.36,1) 3.6s both" }}
          >
            <svg width="22" height="24" viewBox="0 0 22 24" fill="none" aria-hidden="true" style={{ flex: "0 0 auto" }}>
              <path
                d="M3 1.6 18.4 12.1l-6.6.9 3.4 7.2-2.7 1.3-3.4-7.2-4.6 4.4z"
                fill="var(--accent)"
                stroke="#fff"
                strokeWidth="1.2"
              />
            </svg>
            <span
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#e9a23b",
                color: "#0a0b0c",
                fontSize: 14,
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: 20,
              }}
            >
              {HERO.badge}
            </span>
          </div>
        </div>

        <OrbitRings players={world.counts.players} resolved={world.counts.actions} />
      </div>

      <Ticker regions={world.regions} />
    </div>
  );
}
