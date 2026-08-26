import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="eyebrow">{"// NOTHING HERE"}</div>
      <h1 className="display" style={{ marginTop: 14, maxWidth: "22ch" }}>
        No such line, and the world does not invent them.
      </h1>
      <p className="lede" style={{ marginTop: 16, maxWidth: "56ch" }}>
        A chronicle line exists only if an action resolved into it. There is no
        page for an index that storage has never held.
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
