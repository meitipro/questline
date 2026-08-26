import type { MetadataRoute } from "next";

import { ORIGIN } from "@/lib/chain";
import { getChronicle } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The fixed routes, plus the most recent chronicle lines.
 *
 * Only the recent ones. A world that has resolved a hundred thousand actions
 * would otherwise produce a hundred thousand urls, which is both over the
 * 50,000 limit a sitemap is allowed and a read loop against the chain on every
 * crawl. The newest few hundred are the ones anyone is sharing.
 */
const RECENT_LINES = 200;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${ORIGIN}/play`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ORIGIN}/chronicle`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ORIGIN}/world`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${ORIGIN}/verify`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${ORIGIN}/season`, changeFrequency: "daily", priority: 0.7 },
  ];

  try {
    // 50 is the contract's own page ceiling, so this is four reads at most.
    const lines: MetadataRoute.Sitemap = [];
    let cursor = 0;
    let guard = 0;
    while (lines.length < RECENT_LINES) {
      const page = await getChronicle(cursor, 50);
      if (page.data.lines.length === 0) break;
      for (const line of page.data.lines) {
        lines.push({
          url: `${ORIGIN}/chronicle/${line.index}`,
          lastModified: new Date(`${line.at}Z`),
          changeFrequency: "never",
          priority: 0.5,
        });
      }
      if (!page.data.more) break;

      // The cursor must strictly decrease. It does, in the contract as written -
      // but this loop calls out to a network, and a paginator that ever stops
      // advancing turns a sitemap into a serverless function that never returns
      // and bills until it is killed. Two belts: the cursor has to move, and
      // there is a hard trip count.
      const next = page.data.next;
      if (!(next < cursor) && cursor !== 0) break;
      if (++guard > 8) break;
      cursor = next;
    }
    return [...fixed, ...lines.slice(0, RECENT_LINES)];
  } catch {
    // A sitemap that lists the fixed routes is far better than a 500 that tells
    // a crawler the whole site is broken.
    return fixed;
  }
}
