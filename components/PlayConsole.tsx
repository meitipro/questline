"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  act as actOnChain,
  enterWorld,
  humaniseStamps,
  mintItem,
  readableError,
} from "@/lib/actions";
import { IS_LIVE } from "@/lib/chain";
import {
  ago,
  bandCap,
  bandOf,
  effectiveEnergy,
  gen,
  linePath,
  playerPath,
  shortAddr,
  untilShort,
} from "@/lib/format";
import { verifyRoll } from "@/lib/roll";
import { LOCAL_RESULTS } from "@/lib/outcomes";
import { SAMPLE_YOU, samplePlayer } from "@/lib/sample";
import type { Line, Player, World, WriteStage } from "@/lib/types";
import { useWallet } from "@/lib/useWallet";

import { EnergyMeter } from "./EnergyMeter";
import { InventoryRail } from "./InventoryRail";
import { RollBadge } from "./RollBadge";
import { Sep } from "./Sep";

/**
 * A line, plus where it came from and what the validators voted.
 *
 * The three origins are three different claims and must never share a label.
 * "chain" is storage. "seeded" is the demonstration world, which the banner at
 * the top of the page already accounts for. "local" is a turn this browser
 * resolved a moment ago and wrote nowhere, which is the only one that needs
 * saying on the line itself.
 */
type Origin = "chain" | "seeded" | "local";
type Resolved = { line: Line; origin: Origin; votes?: string };

/**
 * The copy for each stage of a write.
 *
 * A resolution takes as long as several validators need to agree, and the design
 * is explicit that this is narrated rather than spun. Nothing here says
 * "loading"; each line names what the network is actually doing.
 */
const STAGE_COPY: Record<WriteStage, string> = {
  idle: "",
  signing: "sign the action in your wallet",
  sent: "the world is considering your action",
  accepted: "agreed. the line is written",
  finalized: "final",
  failed: "",
};

/**
 * The narration for a local turn when no listed outcome is legal for this
 * player - every item in the band is already carried, say. It says nothing
 * happened, because nothing did.
 */
const NOTHING_HAPPENS =
  "the archive takes the attempt and gives nothing back for it.";

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19);
}

export function PlayConsole({
  world,
  live,
  initialLines,
}: {
  world: World;
  live: boolean;
  initialLines: Line[];
}) {
  const wallet = useWallet();
  const address = wallet.address;
  const [player, setPlayer] = useState<Player | null>(null);
  const [feed, setFeed] = useState<Resolved[]>(
    initialLines.map((line) => ({ line, origin: live ? "chain" : "seeded" }))
  );

  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState("");
  const [blocked, setBlocked] = useState("");
  const [mounted, setMounted] = useState(false);
  const [minting, setMinting] = useState<string | null>(null);
  const [mintNote, setMintNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const region = world.regions[player?.region ?? 0] ?? world.regions[0];

  /* Relative times are computed after mount only. Rendering "6 minutes ago" on
   * the server and again in the browser produces two different strings, and the
   * fix is to let the server ship the absolute fact and the client do the
   * arithmetic once it owns the clock. */
  useEffect(() => setMounted(true), []);

  const loadPlayer = useCallback(async (who: string) => {
    try {
      const response = await fetch(`/api/player/${who}`, { cache: "no-store" });
      if (!response.ok) return;
      const blob = await response.json();

      // "unavailable" means the node did not answer and the payload is the
      // seeded character, not this one. Showing it would hand a connected
      // wallet somebody else's invented inventory and call it theirs.
      if (blob?.status === "unavailable") {
        setBlocked(
          "Could not read your character just now - the network did not answer. Nothing is lost; try again in a moment."
        );
        return;
      }

      /* `exists: false` is a real answer, not a character. The contract sends
       * `{ address, exists: false }` and nothing else for an address that has
       * never called enter, so committing it as a Player gave the rail and the
       * meter an object with no inventory and no energy to read, and they threw
       * on `player.inventory.length`.
       *
       * That was the whole first run: connect a fresh wallet, and the page
       * crashed before it could offer to enter the world. Dormant only because
       * no contract is configured, since the seeded fallback always has an
       * inventory. */
      const fresh = blob?.data as Player | undefined;
      if (fresh?.exists) setPlayer(fresh);
      if (Array.isArray(blob?.lines) && blob.lines.length > 0) {
        setFeed(blob.lines.map((line: Line) => ({ line, origin: "chain" as Origin })));
      }
    } catch {
      /* Leave whatever the page was rendered with. */
    }
  }, []);

  /* The address comes from the shared hook rather than a copy kept here. When it
   * lived in this component the header could not say who you were, and - worse -
   * switching account in MetaMask left this console still addressing the old
   * one, so the character on screen and the account signing were two different
   * people. useWallet listens for that and every consumer moves together. */
  useEffect(() => {
    if (!live) {
      // Demonstration mode puts you in a seeded character so the core screen is
      // legible before a deploy. It is labelled as such, everywhere.
      setPlayer(samplePlayer(SAMPLE_YOU));
      return;
    }
    if (!address) {
      setPlayer(null);
      return;
    }
    loadPlayer(address);
  }, [live, address, loadPlayer]);

  const onConnect = async () => {
    // Deliberately does not copy wallet.error into local state afterwards: the
    // `wallet` object here is this render's closure, so its error field is still
    // the previous value at the moment connect() resolves. The hook's error is
    // rendered directly instead - see `blockedText` below.
    setBlocked("");
    await wallet.connect();
  };

  const onEnter = async () => {
    if (!address) return;
    setPending(true);
    setBlocked("");
    try {
      await enterWorld(address as `0x${string}`, (s, note) =>
        setStage(note ?? STAGE_COPY[s])
      );
      await loadPlayer(address);
    } catch (e) {
      setBlocked(humaniseStamps(readableError(e)));
    } finally {
      setPending(false);
      setStage("");
    }
  };

  /**
   * A turn played in the browser, for the demonstration world only.
   *
   * The roll is not invented: it comes from lib/roll.ts, the same arithmetic the
   * contract runs, over a real timestamp - so the line it produces verifies on
   * its own permalink. The band then decides which outcomes are even available,
   * and the magnitude is clamped by the same bandCap rule the contract publishes
   * through get_world. What this cannot do is prove anything, which is why every
   * line it makes is marked as played locally.
   */
  const resolveLocally = (text: string) => {
    setPending(true);
    setBlocked("");
    setStage(STAGE_COPY.sent);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(
        () =>
          setStage(
            "leader proposed a result . validators are resolving it independently"
          ),
        900
      )
    );

    timers.push(
      setTimeout(() => {
        const who = SAMPLE_YOU;
        const at = nowStamp();
        const index = (feed[0]?.line.index ?? world.counts.actions) + 1;
        const roll = verifyRoll(at, who, index);
        const band = bandOf(roll, world.rules.fail_max, world.rules.partial_max);
        const cap = bandCap(band, region.max_magnitude);

        // Which outcomes are legal for this player right now. The registry is
        // the final word here exactly as it is in the contract: an item that is
        // not in it, or is already carried, cannot be granted.
        //
        // Filtered BEFORE the pick rather than degraded after it. Degrading
        // afterwards kept the chosen narration, so a turn could print "you gain
        // a torn page" next to an effect of `none` - the console contradicting
        // itself on the one point this whole product argues about. On chain the
        // divergence is real and deliberate, because a model wrote the prose and
        // the rules overruled it. Here nothing wrote the prose; we picked it,
        // so picking one that fits is the honest version.
        const carried = player?.inventory ?? [];
        const legal = (o: (typeof LOCAL_RESULTS)[typeof band][number]) => {
          if (o.effect === "gain_item") {
            return (
              world.registry.some((i) => i.name === o.target) &&
              !carried.includes(o.target)
            );
          }
          if (o.effect === "lose_item") return carried.includes(o.target);
          return true;
        };

        const options = LOCAL_RESULTS[band].filter(legal);
        // Every band has at least one entry that touches nothing, so this is a
        // real outcome rather than a placeholder - but if a future edit removes
        // them all, a no-effect turn is still the safe answer.
        const pick =
          options.length > 0
            ? options[Math.floor(Math.random() * options.length)]
            : { text: NOTHING_HAPPENS, effect: "none" as const, target: "", magnitude: 0 };

        const magnitude = Math.min(pick.magnitude, cap);

        const line: Line = {
          index,
          who,
          action: text,
          text: pick.text,
          effect: pick.effect,
          target: pick.target,
          magnitude,
          region_cap: region.max_magnitude,
          band_cap: cap,
          roll,
          band,
          region: region.index,
          region_name: region.name,
          rules_version: region.rules_version,
          inventory: carried.length > 0 ? carried.join(", ") : "nothing",
          at,
          decided: true,
        };

        setFeed((current) =>
          [{ line, origin: "local" as Origin }, ...current].slice(0, 12)
        );
        setPlayer((current) => {
          if (!current) return current;
          const next = { ...current, energy: Math.max(0, current.energy - 1) };
          if (line.effect === "damage") next.health = Math.max(0, next.health - magnitude);
          if (line.effect === "heal") {
            next.health = Math.min(next.max_health, next.health + magnitude);
          }
          if (line.effect === "gain_item") {
            next.inventory = [...next.inventory, line.target];
            /* No provenance entry. The index this turn was given exists only in
             * this browser - nothing was written to a chain - so recording it
             * would make the rail render a link to /chronicle/<index>, which is
             * a 404 under a caption reading "Every item links to the action
             * that granted it". The rail already has an honest branch for an
             * item whose granting line it does not know: it says provenance
             * unknown, which is exactly true here.
             *
             * The feed row beside it is labelled "played in this browser . not
             * written to any chain", so the turn is not being hidden. */
          }
          if (line.effect === "lose_item") {
            next.inventory = next.inventory.filter((i) => i !== line.target);
          }
          return next;
        });

        setPending(false);
        setStage("");
        setInput("");
      }, 2100)
    );

    return () => timers.forEach(clearTimeout);
  };

  const onAct = async () => {
    const text = input.trim();
    if (pending) return;

    // Pressing Act on an empty box used to do nothing at all - no message, no
    // movement. Silence is the one response this world should never give: every
    // other refusal in the product explains itself, and a player cannot tell an
    // ignored click from a broken button. The wording mirrors the contract's own
    // refusal for the same case.
    if (!text) {
      setBlocked("Type what you do. An empty action is not one.");
      inputRef.current?.focus();
      return;
    }

    // Refused here as well as in the contract, so a player who is out of turns
    // is told immediately rather than after a round trip. The contract is still
    // the authority; this is only courtesy.
    //
    // effectiveEnergy rather than player.energy: a view cannot roll the cycle
    // forward, so a player whose cycle turned while they were reading still
    // reads as zero, and blocking on the stored number would refuse a turn the
    // contract would have accepted.
    if (player && effectiveEnergy(player) === 0) {
      setBlocked(
        `You are out of energy for this cycle. The next cycle starts ${
          player.next_cycle ? untilShort(player.next_cycle) : "shortly"
        }, and the action was not spent.`
      );
      return;
    }

    if (!live) {
      resolveLocally(text);
      return;
    }

    if (!address) {
      setBlocked("Connect a wallet first. Every action is a transaction you sign.");
      return;
    }
    if (!player?.exists) {
      setBlocked("You have not entered the world yet.");
      return;
    }

    setPending(true);
    setBlocked("");
    setStage(STAGE_COPY.signing);
    try {
      const { line, votes } = await actOnChain(
        address as `0x${string}`,
        text,
        (s, note) => setStage(note ?? STAGE_COPY[s])
      );
      if (line) {
        setFeed((current) =>
          [{ line, origin: "chain" as Origin, votes }, ...current].slice(0, 12)
        );
      }
      setInput("");
      await loadPlayer(address);
    } catch (e) {
      // The contract's refusals are written for people to read, so they are
      // shown as they are - with any timestamp turned into the relative form the
      // energy meter already uses.
      setBlocked(humaniseStamps(readableError(e)));
    } finally {
      setPending(false);
      setStage("");
      inputRef.current?.focus();
    }
  };

  /**
   * Mint an earned item into a tradable one.
   *
   * The contract checks that the item is in the registry AND in the caller's
   * inventory, which means it must have been granted by a resolved chronicle
   * line - provenance is not a claim this panel makes, it is a fact storage
   * carries. Unlike acting, this moves money, so it waits for finality.
   */
  const onMint = async (item: string) => {
    if (!live || !address || minting) return;
    setMinting(item);
    setMintNote("");
    setBlocked("");
    try {
      await mintItem(
        address as `0x${string}`,
        item,
        BigInt(world.season.mint_price || "0"),
        (s, note) =>
          setMintNote(
            note ?? (s === "finalized" ? `${item} is minted` : STAGE_COPY[s])
          )
      );
      setMintNote(`${item} is minted`);
    } catch (e) {
      setBlocked(humaniseStamps(readableError(e)));
      setMintNote("");
    } finally {
      setMinting(null);
    }
  };

  const needsWallet = live && !address;
  const needsEntry = live && Boolean(address) && player?.exists === false;

  const validators = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => ({ delay: `${i * 0.14}s` })),
    []
  );

  return (
    <div className="page split">
      <div className="stack">
        {/* ---- the region, and the cap that governs it ---- */}
        <section className="panel pad">
          <div className="panel-head label" style={{ padding: 0, border: "none" }}>
            <span>{region.name.toUpperCase()}</span>
            <span>
              rules v{region.rules_version} . max magnitude {region.max_magnitude}
            </span>
          </div>
          <p className="lede" style={{ marginTop: 16, maxWidth: "64ch", color: "var(--cream)" }}>
            {region.description}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            {region.exits.map((exit) => (
              <span key={exit} className="chip" style={{ cursor: "default" }}>
                exit . {exit}
              </span>
            ))}
            <span className="chip" style={{ cursor: "default", color: "var(--muted)" }}>
              depth {region.depth}
            </span>
          </div>
          {/* The rules sit next to the cap because both are how the world proves
              it is not improvising in someone's favour. */}
          <p
            className="mono"
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
              fontSize: 12,
              lineHeight: 1.7,
              color: "var(--muted)",
            }}
          >
            {region.rules}
          </p>
        </section>

        {/* ---- resolution feed ---- */}
        <section className="panel-dim">
          <div className="panel-head label">
            <span>RESOLUTION FEED</span>
            <span>{feed.length === 0 ? "" : `${feed.length} shown`}</span>
          </div>
          <div style={{ maxHeight: 460, overflow: "auto" }}>
            {feed.length === 0 ? (
              <div style={{ padding: 20 }}>
                <p className="lede">The archive is quiet. Someone has to go first.</p>
              </div>
            ) : (
              feed.map(({ line, origin, votes }) => (
                <div key={`${line.index}-${line.at}`} className="feed-row" style={{ padding: 20 }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                    {line.action}
                  </div>
                  <div
                    className="mono"
                    style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 14, flexWrap: "wrap" }}
                  >
                    <RollBadge roll={line.roll} band={line.band} size={14} />
                    <Sep />
                    <span style={{ color: "var(--muted)" }}>{line.effect}</span>
                    {votes ? (
                      <>
                        <Sep />
                        <span style={{ color: "var(--success-text)" }}>{votes} agreed</span>
                      </>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55 }}>
                    {line.text}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                    {/* A turn played in this browser was written nowhere, so it
                        has no permalink. Linking it anyway produced a row whose
                        own link 404s - and on the one screen that is meant to
                        prove every action is addressable. */}
                    {origin === "local" ? (
                      <>
                        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                          no permalink
                        </span>
                        <span className="mono" style={{ fontSize: 12, color: "var(--fail-text)" }}>
                          played in this browser . not written to any chain
                        </span>
                      </>
                    ) : (
                      <Link
                        href={linePath(line.index)}
                        className="mono"
                        style={{ fontSize: 12, color: "var(--muted)" }}
                      >
                        permalink . line {line.index}
                      </Link>
                    )}
                    <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                      {mounted ? ago(line.at) : line.at}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ---- the console ---- */}
        <section className="panel" style={{ padding: 22 }}>
          <div className="eyebrow">WHAT DO YOU DO</div>

          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <input
              ref={inputRef}
              className="field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAct();
              }}
              placeholder="type one action"
              disabled={pending || needsWallet || needsEntry}
              maxLength={400}
              aria-label="Your action"
            />
            {needsWallet ? (
              <button className="btn" onClick={onConnect} style={{ padding: "14px 30px", fontSize: 18 }}>
                Connect a wallet
              </button>
            ) : needsEntry ? (
              <button
                className="btn"
                onClick={onEnter}
                disabled={pending}
                style={{ padding: "14px 30px", fontSize: 18 }}
              >
                Enter the world
              </button>
            ) : (
              <button
                className="btn"
                onClick={onAct}
                disabled={pending}
                style={{ padding: "14px 30px", fontSize: 18 }}
              >
                Act
              </button>
            )}
          </div>

          {pending ? (
            <div
              style={{
                marginTop: 18,
                borderTop: "1px solid var(--line)",
                paddingTop: 16,
              }}
            >
              <div className="mono" style={{ fontSize: 14, color: "var(--accent-text)" }}>
                {stage}
              </div>
              {/* Five bars, one per validator, rather than one spinner. The
                  difference matters: a spinner says "wait", this says what the
                  network is doing while you wait. */}
              <div className="validators">
                {validators.map((v, i) => (
                  <span key={i} className="validator">
                    <span style={{ animationDelay: v.delay }} />
                  </span>
                ))}
              </div>
              <div className="mono" style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                leader proposed . validators reading the evidence
              </div>
            </div>
          ) : null}

          {/* The hook's connect error is rendered straight from the hook rather
              than copied into local state, so it cannot be a render behind. */}
          {blocked || wallet.error ? (
            <div className="blocked" style={{ marginTop: 16 }}>
              {blocked || wallet.error}
            </div>
          ) : null}

          <div className="mono" style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            text you type is speech inside the world, never an instruction to the
            model. angle brackets are removed before it is sent.
          </div>

          {!IS_LIVE ? (
            <div className="mono" style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              no contract is configured, so turns are played here against the same
              published rules and are not recorded anywhere.
            </div>
          ) : null}
        </section>
      </div>

      {/* ---- the rail ---- */}
      <aside className="rail">
        {/* `player.exists` rather than `player`, for the same reason the commit
            above checks it: a character that is not in storage has no inventory
            for these two to render. */}
        {player?.exists ? (
          <>
            <EnergyMeter
              player={player}
              energy={mounted ? effectiveEnergy(player) : undefined}
              nextCycleText={
                mounted && player.next_cycle ? untilShort(player.next_cycle) : undefined
              }
            />
            <InventoryRail
              player={player}
              // Only offered when there is a chain to mint onto and a wallet to
              // sign with. There is nothing to mint in the seeded world.
              onMint={live && address ? onMint : undefined}
              minting={minting}
              mintPrice={gen(world.season.mint_price, 2)}
              mintNote={mintNote}
            />
            <Link href={playerPath(player.address)} className="btn-ghost" style={{ textAlign: "center" }}>
              Your character sheet
            </Link>
          </>
        ) : (
          <div className="panel pad-sm">
            <div className="label">CHARACTER</div>
            <p className="note" style={{ marginTop: 12 }}>
              {needsWallet
                ? "Connect a wallet to see your character. Every action is a transaction you sign, so the world knows you by your address and by nothing else."
                : "Enter the world to be given a character."}
            </p>
          </div>
        )}

        {address ? (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            signed in as {shortAddr(address)}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
