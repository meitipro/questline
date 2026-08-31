import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="eyebrow">{"// NOTHING HERE"}</div>
      {/* This is the SITE WIDE not-found, so it also serves a mistyped path and
          a malformed character sheet address, not only a missing chronicle
          index. It used to speak only about chronicle lines, which read as a
          non sequitur on /nope. The sentence is now about the world in
          general and still says the thing that matters. */}
      <h1 className="display" style={{ marginTop: 14, maxWidth: "22ch" }}>
        Nothing here, and the world does not invent it.
      </h1>
      <p className="lede" style={{ marginTop: 16, maxWidth: "56ch" }}>
        Every page in this world is something storage holds: a resolved action, a
        character that entered, a region that was published. There is no page for
        an address the contract has never seen.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
        <Link href="/chronicle" className="btn">
          Read the chronicle
        </Link>
        <Link href="/play" className="btn-ghost">
          Enter the world
        </Link>
      </div>
    </div>
  );
}
