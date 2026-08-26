import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SampleNote } from "@/components/SampleNote";
import { ShareLine } from "@/components/ShareLine";
import { NETWORK_LABEL, ORIGIN } from "@/lib/chain";
import { getLine, verifyRollOnChain } from "@/lib/contract";
import {
  BAND_COLOR,
  BAND_LONG,
  ago,
  capSentence,
  playerPath,
  shortAddr,
} from "@/lib/format";
import { rollSeed, sha256Hex, verifyRoll } from "@/lib/roll";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { index: string };
}): Promise<Metadata> {
  const line = (await getLine(Number(params.index))).data;
  if (!line) return { title: `Line ${params.index}` };

  // Every line is a shareable artifact that also happens to explain the protocol
  // to someone who has never heard of it, so the card carries the narration, the
  // roll and the band - the three things that make the point without a click.
  const image = `${ORIGIN}/api/og/${line.index}`;

  return {
    title: `roll ${line.roll} of 20, ${BAND_LONG[line.band]}`,
    description: line.text,
    openGraph: {
      title: `roll ${line.roll} of 20, ${BAND_LONG[line.band]} - Questline`,
      description: line.text,
      url: `${ORIGIN}/chronicle/${line.index}`,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function LinePage({
  params,
}: {
  params: { index: string };
}) {
  const index = Number(params.index);
  if (!Number.isFinite(index) || index < 0) notFound();

  const read = await getLine(Math.floor(index));
  const line = read.data;

  // Only a contract that said "no such line" earns a 404. A node that did not
  // answer earns a retry - a 404 is a permanent claim about the world, and
  // getting it from a rate limit tells a reader their chronicle entry was
  // deleted when it is sitting in storage untouched.
  if (!line && read.status === "absent") notFound();

  if (!line) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 72px" }}>
        <Link href="/chronicle" className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          &larr; chronicle
        </Link>
        <div className="panel pad" style={{ marginTop: 20 }}>
          <div className="eyebrow">{"// COULD NOT READ THIS LINE"}</div>
          <h1 className="display" style={{ marginTop: 14, maxWidth: "22ch" }}>
            The node did not answer. The line is still there.
          </h1>
          <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>
            This is not a missing chronicle entry - storage was simply not
            readable just now. {NETWORK_LABEL} is rate limited, so a busy moment
            looks exactly like this. Reload in a few seconds.
          </p>
          {read.error ? (
            <p className="mono" style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
              {read.error}
            </p>
          ) : null}
          <div style={{ marginTop: 24 }}>
            <Link href={`/chronicle/${Math.floor(index)}`} className="btn">
              Try again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Recomputed here, on the server, from the line's own public fields. If this
  // disagreed with the stored roll the page says so loudly rather than showing
  // the stored number and hoping - a silent mismatch is the exact failure this
  // product exists to make impossible.
  const recomputed = verifyRoll(line.at, line.who, line.index);
  const verified = recomputed === line.roll;
  const seed = rollSeed(line.at, line.who, line.index);
  const digest = sha256Hex(seed);

  /* And once more, from the contract itself.
   *
   * Three independent computations of the same number: what storage recorded,
   * what this server just worked out with its own sha256, and what the chain
   * answers when asked. Two of those agreeing proves less than it looks -
   * they could share a bug. Asking the contract is the one that closes it.
   *
   * Null when there is no contract to ask, or when the node did not answer; the
   * row is then omitted rather than guessed at. */
  const onChain = await verifyRollOnChain(line.at, line.who, line.index);

  const rows: [string, React.ReactNode, string?][] = [
    ["effect", line.effect],
    ["target", line.target || " - "],
    ["magnitude", capSentence(line)],
    ["region rules", `v${line.rules_version} . ${line.region_name}`],
    ["inventory at the time", line.inventory || "nothing", "var(--muted)"],
    // rows is a table of pairs, not a render list: the wrapper div in the map
    // below carries key={key}, and this is a single child of a span.
    // eslint-disable-next-line react/jsx-key -- not a list child
    ["player", <Link href={playerPath(line.who)}>{shortAddr(line.who)}</Link>],
    ["resolved at", `${line.at}Z . ${ago(line.at)}`, "var(--muted)"],
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 72px" }}>
      <SampleNote live={read.live} error={read.error} />

      <div style={{ marginTop: read.live ? 0 : 24 }}>
        <Link href="/chronicle" className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          &larr; chronicle
        </Link>
      </div>

      <article className="panel" style={{ marginTop: 20, padding: 34 }}>
        <div className="label">questline.world/chronicle/{line.index}</div>

        <p
          style={{
            margin: "22px 0 0",
            fontSize: 30,
            lineHeight: 1.35,
            letterSpacing: "-.02em",
            textWrap: "pretty",
          }}
        >
          {line.text}
        </p>

        <div
          className="mono"
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22, flexWrap: "wrap" }}
        >
          <span className="tag" style={{ fontSize: 18, padding: "6px 12px" }}>
            roll {line.roll} of 20
          </span>
          <span style={{ fontSize: 18, color: BAND_COLOR[line.band] }}>
            {BAND_LONG[line.band]}
          </span>
          {line.decided ? null : (
            <span style={{ fontSize: 14, color: "var(--fail-text)" }}>
              undecided . no state moved and the energy was refunded
            </span>
          )}
        </div>

        {/* The recomputation. The seed string is shown in full so a reader can
            paste it into any sha256 tool and get the same two bytes. */}
        <div
          className="mono"
          style={{
            marginTop: 22,
            border: "1px solid var(--line)",
            background: "var(--ink)",
            padding: 16,
            fontSize: 14,
            color: "var(--body)",
            overflowX: "auto",
          }}
        >
          <div style={{ whiteSpace: "nowrap" }}>seed = {seed}</div>
          <div style={{ whiteSpace: "nowrap", marginTop: 6 }}>
            sha256 = {digest.slice(0, 4)}
            <span style={{ color: "var(--muted)" }}>{digest.slice(4)}</span>
          </div>
          <div style={{ whiteSpace: "nowrap", marginTop: 6 }}>
            0x{digest.slice(0, 4)} mod 20 + 1 ={" "}
            <span style={{ color: verified ? "var(--success-text)" : "var(--fail-text)" }}>
              {recomputed}
            </span>
          </div>
        </div>

        <div
          className="mono"
          style={{ marginTop: 10, fontSize: 12, color: verified ? "var(--muted)" : "var(--fail-text)" }}
        >
          {verified ? (
            <>
              Anyone can recompute it from public data. This page just did - {" "}
              <Link href="/verify">so can you, field by field</Link>.
            </>
          ) : (
            `The stored roll is ${line.roll} and the arithmetic says ${recomputed}. That should be impossible; do not trust this line.`
          )}
        </div>

        {/* The chain's own answer, when there is a chain to ask. Omitted rather
            than guessed when the node is quiet - a verification badge that
            appears whether or not anything was verified is worse than none. */}
        {onChain !== null ? (
          <div
            className="mono"
            style={{
              marginTop: 6,
              fontSize: 12,
              color: onChain === line.roll ? "var(--success-text)" : "var(--fail-text)",
            }}
          >
            {onChain === line.roll
              ? `The contract was asked too, through verify_roll, and answered ${onChain}. Storage, this page and the chain all agree.`
              : `The contract answers ${onChain} for this line and storage says ${line.roll}. Do not trust this line.`}
          </div>
        ) : null}

        <div style={{ marginTop: 30, borderTop: "1px solid var(--line)" }}>
          {rows.map(([key, value, color]) => (
            <div key={key} className="kv">
              <span className="k">{key}</span>
              <span style={{ color: color ?? "var(--cream)" }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <ShareLine url={`${ORIGIN}/chronicle/${line.index}`} />
          <Link href="/play" className="btn-ghost">
            Open in world
          </Link>
        </div>
      </article>

      <p className="note" style={{ margin: "22px 0 0" }}>
        Every line is a shareable artifact that also happens to explain the
        protocol to someone who has never heard of it.
      </p>
    </div>
  );
}
