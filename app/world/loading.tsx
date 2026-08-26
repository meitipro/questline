/**
 * Shown while this page waits on the chain.
 *
 * Deliberately NOT at the app root. A loading file creates a Suspense boundary,
 * and Next flushes the shell - status line included - before the page resolves.
 * Any route that can call notFound() below such a boundary therefore answers
 * 200 with not-found content, which is a soft 404 a crawler will happily index.
 * So these live only on segments that always have something to show:
 * /play, /world and /season. /chronicle/[index] and /c/[player] have none.
 *
 * A read here is not a database query - it crosses to a GenLayer node and back.
 * The design's rule holds for waiting as much as for resolving: say what is
 * happening rather than spin.
 */
export default function Loading() {
  return (
    <div className="page">
      <div className="eyebrow eyebrow-accent">{"// READING CONTRACT STORAGE"}</div>
      <p className="lede" style={{ marginTop: 16, maxWidth: "52ch" }}>
        The world is being read from the chain rather than from a cache the
        operator controls, which is the slower way round and the only honest one.
      </p>
      <div className="validators" style={{ marginTop: 26, maxWidth: 320 }} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="validator">
            <span style={{ animationDelay: `${i * 0.14}s` }} />
          </span>
        ))}
      </div>
    </div>
  );
}
