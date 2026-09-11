import type { Metadata } from "next";
import Link from "next/link";

import { PublishWorld } from "@/components/PublishWorld";
import { SampleNote } from "@/components/SampleNote";
import { IS_LIVE } from "@/lib/chain";
import { getWorld } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* Not in the navigation and not indexed. It is a tool for one account, and
 * every other wallet that opens it is shown that it is not that account. */
export const metadata: Metadata = {
  title: "Publish the world",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!IS_LIVE) {
    return (
      <div className="page">
        <div className="eyebrow">{"// OWNER"}</div>
        <h1 className="display" style={{ marginTop: 14, maxWidth: "22ch" }}>
          There is no contract to publish to.
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>
          No contract address is configured, so this site is running the seeded
          demonstration world. Set NEXT_PUBLIC_QUESTLINE_ADDRESS and redeploy.
        </p>
      </div>
    );
  }

  const world = await getWorld();

  /* Never plan from the seeded world. It has four regions and ten items, so a
   * plan built from it would mark every step "already on chain" and publish
   * nothing - on the one page whose job is to tell the owner what is missing. */
  if (!world.live) {
    return (
      <div className="page">
        <SampleNote live={false} error={world.error} />
        <div className="eyebrow" style={{ marginTop: 24 }}>
          {"// OWNER"}
        </div>
        <h1 className="display" style={{ marginTop: 14, maxWidth: "22ch" }}>
          The contract did not answer.
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>
          Without a reading of what is already published this page cannot say what
          is missing, and it will not guess. Reload in a moment.
        </p>
      </div>
    );
  }

  const { owner, registry, regions } = world.data;

  return (
    <div className="page">
      <div className="eyebrow">{"// OWNER"}</div>
      <h1 className="display" style={{ marginTop: 14, maxWidth: "22ch" }}>
        Publish the opening world.
      </h1>
      <p className="lede" style={{ marginTop: 16, maxWidth: "60ch" }}>
        Five transactions from the account that deployed this contract: the item
        registry first, then the four regions in order. Each is a public record,
        and each is refused from any other wallet. The owner is the only account
        that can change the world - and it still cannot rewrite anything that has
        already happened in it.
      </p>

      <PublishWorld
        owner={owner}
        items={registry.length}
        regions={regions.map((r) => r.name)}
      />

      <p className="note" style={{ marginTop: 22, maxWidth: "62ch" }}>
        The same world can be published from a terminal with{" "}
        <span className="mono">npm run seed</span>, which reads the owner off the
        contract first and refuses a key that is not it. What gets published is
        in <span className="mono">lib/opening-world.ts</span>; both routes read
        that one file. <Link href="/world">What a region carries</Link>.
      </p>
    </div>
  );
}
