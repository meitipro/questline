/**
 * The footer: mark, links, icon row, and the two lines of small print.
 *
 * Centred rather than columned, because there are six links and a columned
 * footer with six links spends more height on its headings than on its
 * content.
 *
 * The icon row repeats destinations the text row already covers, so each icon
 * carries an aria-label and the row is not a second tab stop for a screen
 * reader working through the same four places twice - it is marked
 * presentational at the list level and each link still names itself.
 */

import Link from "next/link";

import { Mark } from "./Mark";
import { ORIGIN } from "@/lib/chain";

const LINKS = [
  { href: "/play", label: "Play" },
  { href: "/chronicle", label: "Chronicle" },
  { href: "/world", label: "World & rules" },
  { href: "/season", label: "Season" },
  { href: "/verify", label: "Verify a roll" },
  { href: "/#features", label: "How it works" },
];

const ICONS = [
  {
    href: "/",
    label: "Home",
    path: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
      </>
    ),
  },
  {
    href: "/chronicle",
    label: "Chronicle",
    path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    href: "/season",
    label: "Season",
    path: <path d="m22 2-7 20-4-9-9-4Z" />,
  },
  {
    href: "/world",
    label: "World",
    path: (
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
      </>
    ),
  },
];

export function SiteFooter() {
  // The host without a scheme, so the wordmark reads as a name rather than a
  // url. ORIGIN is the one place the domain is configured.
  const host = ORIGIN.replace(/^https?:\/\//, "");

  return (
    <footer style={{ position: "relative", background: "var(--ink)", borderTop: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "72px clamp(20px, 3.4vw, 64px)" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "var(--cream)",
          }}
        >
          <Mark size={26} />
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.03em" }}>{host}</span>
        </Link>

        <nav
          aria-label="Footer"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 26,
            margin: "34px 0",
            fontSize: 14,
          }}
        >
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="footer-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 22,
            marginBottom: 34,
            color: "var(--muted)",
          }}
        >
          {ICONS.map((icon) => (
            <Link key={icon.label} href={icon.href} aria-label={icon.label} className="footer-link">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {icon.path}
              </svg>
            </Link>
          ))}
        </div>

        <div
          className="mono"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            letterSpacing: ".14em",
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          <span>GENLAYER . STUDIONET . GENVM PYTHON SDK</span>
          <span>QUESTLINE . BUILT ON GENLAYER BY INFERNODE</span>
        </div>
      </div>
    </footer>
  );
}
