import type { Metadata } from "next";

import { PlayConsole } from "@/components/PlayConsole";
import { SampleNote } from "@/components/SampleNote";
import { getPlayerLines, getWorld } from "@/lib/contract";
import { SAMPLE_YOU } from "@/lib/sample";

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

export const metadata: Metadata = {
  title: "Play",
  description:
    "Type one action. Validators resolve it against public rules and your real inventory, and the result becomes a public chronicle line.",
};

/**
 * The screen the product lives or dies on.
 *
 * The server's job here is only to hand over a complete world and a starting
 * feed. Everything that follows is a signed transaction, so the console itself
 * is a client component.
 */
export default async function PlayPage() {
  const world = await getWorld();

  /* The resolution feed is YOUR actions, not the world's - the chronicle is the
   * place for everyone else's. Live, the server cannot know who you are until a
   * wallet is connected, so the feed starts empty and the client fills it. In the
   * demonstration world it can be prefilled, because the demo already knows
   * which character it has put you in. */
  const live = world.live;
  const initialLines = live ? [] : (await getPlayerLines(SAMPLE_YOU, 8)).data;

  if (world.data.regions.length === 0) {
    return (
      <div className="page">
        <div className="eyebrow">{"// PLAY"}</div>
        <h1 className="display" style={{ marginTop: 14, maxWidth: "24ch" }}>
          The world has no regions yet.
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: "60ch" }}>
          A region carries the rules an action is judged against, so there is
          nothing to resolve until one exists. Run{" "}
          <span className="mono">npm run seed</span> to publish the opening season.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: "24px 32px 0" }}>
        <SampleNote live={live} error={world.error} />
      </div>
      <PlayConsole world={world.data} live={live} initialLines={initialLines} />
    </>
  );
}
