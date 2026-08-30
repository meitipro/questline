import type { MetadataRoute } from "next";

import { ORIGIN } from "@/lib/chain";

/**
 * The chronicle is the product's marketing engine, so it is deliberately open
 * to crawlers - every line is public on chain anyway, and a permalink that
 * cannot be indexed cannot do the one job it has.
 *
 * The json routes are disallowed because they are a second copy of the same
 * public data in a shape nobody should be reading as a page.
 *
 * `/api/og` IS NOT ONE OF THEM, and blanket-disallowing `/api/` broke the thing
 * the whole launch depends on: every `og:image` and `twitter:image` on this
 * site points into `/api/og`, and a card renderer that respects robots.txt
 * declines to fetch a disallowed url. Every share of every page would have
 * arrived without its picture, silently, with the tags present and correct.
 *
 * The json routes are therefore named individually rather than covered by a
 * prefix. A new json route has to be added here, which is the right amount of
 * friction: forgetting exposes a duplicate of public data, while the previous
 * shape's failure was invisible.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/chronicle",
        "/api/line",
        "/api/player",
        "/api/season",
        "/api/world",
      ],
    },
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
