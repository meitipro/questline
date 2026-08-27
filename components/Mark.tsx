/**
 * The mark: a twenty sided die flattened into a square with five pips, the
 * middle one in the accent. It reads as a game without borrowing swords,
 * dragons or pixel art.
 *
 * Smallest size is 16px for the mark alone and 22px locked to the wordmark, so
 * the pips are drawn as a fraction of the box rather than at fixed pixels -
 * otherwise the centre pip disappears first, which is the one that carries the
 * accent and therefore the whole idea.
 */
export function Mark({ size = 22 }: { size?: number }) {
  const pip = Math.max(2, Math.round(size * 0.14));
  const inset = Math.max(2, Math.round(size * 0.16));

  const dot = (color: string) => ({
    width: pip,
    height: pip,
    borderRadius: "50%",
    background: color,
  });

  return (
    <span
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        width: size,
        height: size,
        // currentColor, not a token: over the landing photograph the header
        // fixes its own light colour in both themes, and the mark has to follow
        // the wordmark beside it rather than flipping to near-black.
        border: "1.5px solid currentColor",
        padding: inset,
        gap: 1,
        flex: "0 0 auto",
      }}
    >
      <span style={dot("currentColor")} />
      <span />
      <span style={{ ...dot("currentColor"), justifySelf: "end" }} />
      <span />
      <span style={{ ...dot("var(--accent)"), placeSelf: "center" }} />
      <span />
      <span style={{ ...dot("currentColor"), alignSelf: "end" }} />
      <span />
      <span style={{ ...dot("currentColor"), justifySelf: "end", alignSelf: "end" }} />
    </span>
  );
}
