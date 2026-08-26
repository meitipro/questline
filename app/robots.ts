import type { MetadataRoute } from "next";

import { ORIGIN } from "@/lib/chain";

/**
 * The chronicle is the product's marketing engine, so it is deliberately open
 * to crawlers - every line is public on chain anyway, and a permalink that
 * cannot be indexed cannot do the one job it has.
 *
 * The api routes are disallowed only because they are a second copy of the same
 * public data in a shape nobody should be reading as a page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
