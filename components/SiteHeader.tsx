"use client";

/**
 * The header, in two variants.
 *
 * "over" sits transparent on top of the landing photograph and uses fixed light
 * colours, because the picture is dark in BOTH themes and a token here would
 * turn the brand near-black the moment somebody switched to light.
 *
 * "solid" is the themed bar every other route gets: translucent ink with a
 * hairline under it.
 *
 * The nav marks the current route from `usePathname` rather than being told,
 * so a new route cannot forget to pass its own name and land with nothing lit.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Mark } from "./Mark";
import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/play", label: "Play" },
  { href: "/chronicle", label: "Chronicle" },
  { href: "/world", label: "World" },
  { href: "/season", label: "Season" },
];

export function SiteHeader({ variant }: { variant?: "solid" | "over" }) {
  const pathname = usePathname() ?? "/";
  // Decided here rather than passed in by the layout, so a route cannot be
  // added and forget to say which bar it wants. The landing is the only page
  // with a picture behind the header.
  const over = variant ? variant === "over" : pathname === "/";

  const brand = over ? "#efebe2" : "var(--cream)";
  const idle = over ? "rgba(239,235,226,.72)" : "var(--muted)";

  return (
    <header
      className={over ? "site-header site-header-over" : "site-header"}
      style={{
        background: over ? "transparent" : "rgba(var(--ink-rgb), .86)",
        borderBottom: over ? "0" : "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "clamp(20px, 2.6vw, 48px)" }}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, height: 32, color: brand }}
        >
          <Mark size={26} />
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", whiteSpace: "nowrap" }}>
            questline
          </span>
        </Link>

        <nav className="site-nav" style={{ display: "flex", alignItems: "center", gap: "clamp(14px, 1.7vw, 32px)" }}>
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="site-nav-link"
                style={{ color: active ? (over ? "#efebe2" : "var(--cream)") : idle }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "clamp(10px, 1.2vw, 16px)" }}>
        <span className="header-extras">
          <ThemeToggle />
        </span>
        <WalletButton />
        {/* The conic border animates around the button. Its own element rather
            than a pseudo-element on the link, so the sweep is not clipped by
            the link's overflow:hidden fill. */}
        <span className="cta-ring">
          <Link href="/play" className="cta-fill">
            <span style={{ position: "relative", zIndex: 1 }}>Launch dApp</span>
          </Link>
        </span>
      </div>
    </header>
  );
}
