/**
 * The landing page.
 *
 * Three sections and nothing else: the hero over its own full height frame,
 * the six guarantees, and the four questions. Everything that argues the case
 * with real data - the chronicle, the world's rules, the season - has its own
 * route, and this page's job is to get somebody there.
 *
 * The numbers in the hero are read from the chain rather than written down.
 * With no contract configured `getWorld` answers from the seeded world and
 * SampleNote says so, so the page is complete and honest before a deploy.
 */

import { SampleNote } from "@/components/SampleNote";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { getChronicle, getLeaderboard, getWorld } from "@/lib/contract";

export const dynamic = "force-dynamic";

/**
 * Every page here reads the chain, so it is a function rather than a static
 * file and it gets whatever ceiling the platform hands it - ten seconds on a
 * Vercel hobby plan. lib/contract.ts caps each read at five seconds and falls
 * back to the seeded world, so a page cannot legitimately need this much; the
 * headroom is here so a slow-but-working chain degrades to the seeded world
 * rather than to a gateway timeout, which is a page the visitor cannot read at
 * all.
 */
export const maxDuration = 30;

export default async function HomePage() {
  // The board fills the orbit chips. Read alongside the world rather than
  // after it, because two sequential reads on Studio is two chances to be
  // rate limited for one page.
  /* The banner reports on EVERY read the page made, not just one of them.
   * Each of these pages issues two or three independent reads, and reporting
   * on one meant a page could show seeded data from a failed read under a
   * banner saying it was live. On /season that reached a wallet: the pass card
   * signs `world.data.season.pass_price` as the transaction value, so a rate
   * limited get_world beside a cached get_leaderboard would have offered the
   * seeded price with nothing on the page saying so. */
  const [world, board, chronicle] = await Promise.all([
    getWorld(),
    getLeaderboard(8),
    getChronicle(0, 1),
  ]);

  return (
    <div>
      <Hero
        world={world.data}
        leaders={board.data.rows}
        newest={chronicle.data.lines[0] ?? null}
      />
      {/* Under the hero rather than over it: the banner is a fact about where
          the numbers came from, and covering the picture with it would make
          the seeded state look like an error. */}
      <SampleNote
        live={world.live && board.live && chronicle.live}
        error={world.error ?? board.error ?? chronicle.error}
      />
      <Features />
      <Faq />
    </div>
  );
}
