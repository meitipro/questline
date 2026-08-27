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

export default async function HomePage() {
  // The board fills the orbit chips. Read alongside the world rather than
  // after it, because two sequential reads on Studio is two chances to be
  // rate limited for one page.
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
      <SampleNote live={world.live} error={world.error} />
      <Features />
      <Faq />
    </div>
  );
}
