import { mono, sans } from "@/lib/fonts";
import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_BOOT } from "@/components/ThemeToggle";
import { ORIGIN } from "@/lib/chain";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: {
    default: "Questline - the game master is a contract",
    template: "%s - Questline",
  },
  description:
    "A persistent text world where the rules, the rolls and your inventory live on chain. Validators resolve what you type against rules you can read.",
  openGraph: {
    title: "Questline - the game master is a contract",
    description:
      "The rules, the rolls and your inventory live on chain. Nobody here can cheat. Not even us.",
    /* The ROOT url, and every route that does not set its own inherits it.
     * That is correct for the site card and wrong for a deep link: a shared
     * /season previewed as the landing page. Routes with their own
     * generateMetadata (a chronicle line, a character sheet) already override
     * it; the static routes are covered by the sitemap, which names the real
     * urls. Worth setting per route if the social cards ever matter more. */
    url: ORIGIN,
    siteName: "Questline",
    type: "website",
    /* The site card. Without this the landing declared summary_large_image and
     * supplied no image, so the one url anybody actually shares rendered as a
     * bare line of text while every chronicle line had a picture. A chronicle
     * line page overrides this with its own card in generateMetadata. */
    images: [
      {
        url: `${ORIGIN}/api/og`,
        width: 1200,
        height: 630,
        alt: "Questline - nobody here can cheat. Not even us.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${ORIGIN}/api/og`],
  },
};

export const viewport: Viewport = {
  // Must match the DEFAULT theme, not the reader's. This paints the browser
  // chrome before any script runs, so a light value here would put a white bar
  // above a near-black page for every default visitor.
  themeColor: "#0a0b0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning because THEME_BOOT writes data-theme onto this
    // element before React hydrates, so the server's markup and the browser's
    // legitimately differ by exactly that attribute.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script
          // Runs before first paint. See THEME_BOOT for why it has to.
          dangerouslySetInnerHTML={{ __html: THEME_BOOT }}
        />
      </head>
      <body>
        <div className="shell">
          <a href="#main" className="skip-link">
            Skip to the world
          </a>
          <SiteHeader />
          <main id="main" style={{ flex: 1 }}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
