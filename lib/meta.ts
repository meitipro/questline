/**
 * The open graph card for a static route.
 *
 * Next does NOT merge `openGraph` between a layout and a page - a page that
 * declares one REPLACES the parent's entirely. So a route that set only its own
 * url, which is the obvious way to stop a shared /season previewing as the
 * landing page, silently dropped og:image, og:site_name and og:type with it,
 * and the link rendered as a bare line of text. Measured on /season: og:title,
 * og:description and og:url present, no og:image at all.
 *
 * This returns the whole card so that cannot happen. A route passes its path,
 * its title and its description; everything shared stays in one place.
 */

import { ORIGIN } from "./chain";

export function cardFor(path: string, title: string, description: string) {
  return {
    title,
    description,
    url: `${ORIGIN}${path}`,
    siteName: "Questline",
    type: "website" as const,
    images: [
      {
        url: `${ORIGIN}/api/og`,
        width: 1200,
        height: 630,
        alt: "Questline - nobody here can cheat. Not even us.",
      },
    ],
  };
}
