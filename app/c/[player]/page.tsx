import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChronicleRow } from "@/components/ChronicleRow";
import { InventoryRail } from "@/components/InventoryRail";
import { SampleNote } from "@/components/SampleNote";
import { achievementsFor } from "@/lib/achievements";
import { NETWORK_LABEL } from "@/lib/chain";
import { getPlayer, getPlayerLines, getWorld } from "@/lib/contract";
import { ago, playerPath, shortAddr } from "@/lib/format";

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

export async function generateMetadata({
  params,
}: {
  params: { player: string };
}): Promise<Metadata> {
  return {
    title: `${shortAddr(params.player)} - character sheet`,
    description: `Inventory with provenance, achievements and chronicle highlights for ${shortAddr(params.player)}.`,
  };
}

export default async function CharacterPage({
  params,
}: {
  params: { player: string };
}) {
  const address = decodeURIComponent(params.player).trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) notFound();

  const [world, player, lines] = await Promise.all([
    getWorld(),
    getPlayer(address),
    getPlayerLines(address, 8),
  ]);

  const now = new Date();

  // A read that failed cannot say a character does not exist. Only the contract
  // answering `exists: false` can, and that is what "absent" means here.
  if (player.status === "unavailable") {
    return (
      <div className="page">
        <div className="eyebrow">{"// COULD NOT READ THIS CHARACTER"}</div>
        <h1 className="mono display" style={{ marginTop: 14, letterSpacing: "-.02em" }}>
          {shortAddr(address)}
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>
          The node did not answer, so this page cannot tell you anything about
          this address - including whether it has a character. {NETWORK_LABEL} is
          rate limited, so a busy moment looks exactly like this. Nothing has been
          lost; reload in a few seconds.
        </p>
        {player.error ? (
          <p className="mono" style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            {player.error}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
          <Link href={playerPath(address)} className="btn">
            Try again
          </Link>
          <Link href="/chronicle" className="btn-ghost">
            Read the chronicle
          </Link>
        </div>
      </div>
    );
  }

  if (!player.data.exists) {
    return (
      <div className="page">
        <SampleNote live={player.live} error={player.error} />
        <div className="eyebrow" style={{ marginTop: 24 }}>
          {"// CHARACTER SHEET"}
        </div>
        <h1 className="mono display" style={{ marginTop: 14, letterSpacing: "-.02em" }}>
          {shortAddr(address)}
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: "56ch" }}>
          This address has never entered the world, so there is nothing in storage
          for it. That is the only thing this page can honestly say about it.
        </p>
        <div style={{ marginTop: 26 }}>
          <Link href="/play" className="btn">
            Enter the world
          </Link>
        </div>
      </div>
    );
  }

  /* Computed here and not beside the reads, because the contract answers an
   * address that never entered with `{ address, exists: false }` and nothing
   * else. `achievementsFor` reads `player.inventory.length`, so running it
   * before the guard above threw on the absent payload and served the error
   * boundary instead of the "never entered the world" page - for any
   * well-formed address a visitor might paste. Dormant only while no contract
   * is configured, because the seeded fallback always has an inventory. */
  const achievements = achievementsFor(player.data, world.data);

  return (
    <div className="page">
      <SampleNote live={player.live} error={player.error} />

      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
          borderBottom: "1px solid var(--line)",
          paddingBottom: 26,
          marginTop: player.live ? 0 : 24,
        }}
      >
        <div>
          <div className="eyebrow">{"// CHARACTER SHEET"}</div>
          <h1
            className="mono"
            style={{
              margin: "14px 0 0",
              fontSize: 44,
              letterSpacing: "-.02em",
              fontWeight: 700,
              lineHeight: 1,
              wordBreak: "break-all",
            }}
          >
            {shortAddr(address)}
          </h1>
          <div style={{ marginTop: 12, color: "var(--muted)" }}>
            {player.data.region_name} . depth {player.data.depth} . joined{" "}
            {player.data.joined.slice(0, 10)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          <div>
            <div className="stat-value">{player.data.actions.toLocaleString("en-US")}</div>
            <div className="stat-key">ACTIONS</div>
          </div>
          <div>
            <div className="stat-value">{player.data.best_roll}</div>
            <div className="stat-key">BEST ROLL</div>
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--accent-text)" }}>
              {player.data.rank > 0 ? `#${player.data.rank}` : " - "}
            </div>
            <div className="stat-key">SEASON RANK</div>
          </div>
        </div>
      </div>

      <div className="sheet" style={{ marginTop: 30 }}>
        <div className="stack">
          <InventoryRail player={player.data} title="INVENTORY WITH PROVENANCE" />

          <div className="panel pad-sm">
            <div className="label">ACHIEVEMENTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              {achievements.map((a) => (
                <div key={a.name}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: a.held ? "var(--accent-text)" : "var(--muted)",
                    }}
                  >
                    {a.name}
                    {a.held ? "" : " . not yet"}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", marginTop: 4 }}>
                    {a.body}
                  </div>
                  {/* The measurement, so the badge is a claim anyone can check. */}
                  <div
                    className="mono"
                    style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}
                  >
                    {a.measure}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-dim">
          <div className="panel-head label">
            <span>CHRONICLE HIGHLIGHTS</span>
            <span>{lines.data.length} shown</span>
          </div>
          {lines.data.length === 0 ? (
            <div style={{ padding: 22 }}>
              <p className="lede">
                This character has entered the world and not yet acted in it.
              </p>
            </div>
          ) : (
            lines.data.map((line) => (
              <ChronicleRow key={line.index} line={line} ago={ago(line.at, now)} showAction />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
