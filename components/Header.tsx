import Link from "next/link";

import { Mark } from "./Mark";
import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/play", label: "Play" },
  { href: "/chronicle", label: "Chronicle" },
  { href: "/world", label: "World" },
  { href: "/season", label: "Season" },
];

export function Header() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        padding: "14px 32px",
        // Follows the theme. A literal rgba(10,11,12,.86) would keep the sticky
        // header near-black over a paper page.
        background: "rgba(var(--ink-rgb), .86)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <Link
        href="/"
        style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--cream)" }}
      >
        <Mark size={22} />
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.03em" }}>
          questline
        </span>
      </Link>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26,
          fontSize: 14,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} style={{ color: "var(--muted)" }}>
            {item.label}
          </Link>
        ))}
        <WalletButton />
        <ThemeToggle />
        <Link
          href="/play"
          style={{
            padding: "8px 16px",
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          Enter the world
        </Link>
      </nav>
    </header>
  );
}
