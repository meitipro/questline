import { ImageResponse } from "next/og";

/**
 * The share card for one chronicle line.
 *
 * `runtime = "edge"` is not a preference. The node build of next/og resolves its
 * bundled font with fileURLToPath(join(import.meta.url, "../noto-sans.ttf")) at
 * module scope, which survives on posix by accident and throws ERR_INVALID_URL
 * on Windows - taking the dev server down with an uncaught rejection before any
 * request arrives. Supplying your own font does not help, because the failure is
 * at import. Edge is the only configuration that works on both.
 */
export const runtime = "edge";

const INK = "#0A0B0C";
const CREAM = "#EFEBE2";
const MUTED = "#7A7F86";
const LINE = "#1F2124";
const BAND: Record<string, string> = {
  fail: "#C4553D",
  partial: "#E9A23B",
  success: "#6FA97B",
};

export async function GET(
  request: Request,
  { params }: { params: { index: string } }
) {
  const index = Number(params.index);

  /* The card is built from the line the chain holds, fetched by index, rather
   * than from text handed in as query parameters. A card that rendered whatever
   * a url told it to would let anyone mint a convincing screenshot of a roll
   * that never happened, which is the exact thing this product exists to make
   * impossible. The origin comes off the incoming request so this works in dev,
   * on a preview deployment and in production without configuration. */
  const origin = new URL(request.url).origin;

  let line: {
    index: number;
    text: string;
    roll: number;
    band: string;
    region_name: string;
    rules_version: number;
    effect: string;
  } | null = null;

  try {
    const response = await fetch(`${origin}/api/line/${index}`, {
      cache: "no-store",
    });
    if (response.ok) {
      const blob = await response.json();
      line = blob?.data ?? null;
    }
  } catch {
    /* Falls through to the generic card below. */
  }

  const accent = line ? (BAND[line.band] ?? BAND.partial) : BAND.partial;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          color: CREAM,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 26,
              height: 26,
              border: `2px solid ${CREAM}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 8,
                background: BAND.partial,
              }}
            />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
            questline
          </div>
          <div style={{ fontSize: 20, color: MUTED, marginLeft: 8 }}>
            the game master is a contract
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: line && line.text.length > 150 ? 38 : 46,
              lineHeight: 1.3,
              maxWidth: 1000,
            }}
          >
            {line
              ? line.text
              : "Nobody here can cheat. Not even us."}
          </div>

          {line ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 34,
                fontSize: 26,
              }}
            >
              {/* One template literal, not `roll {n} of 20`. Satori refuses any
                  div with more than one child node unless it declares display,
                  and interpolated JSX text counts as three children. */}
              <div
                style={{
                  border: `1px solid ${LINE}`,
                  padding: "8px 16px",
                  color: CREAM,
                }}
              >
                {`roll ${line.roll} of 20`}
              </div>
              <div style={{ color: accent }}>{line.band}</div>
              <div style={{ color: MUTED }}>{line.effect}</div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: MUTED,
            borderTop: `1px solid ${LINE}`,
            paddingTop: 22,
          }}
        >
          <div>
            {line
              ? `${line.region_name} . rules v${line.rules_version}`
              : "the rules, the rolls and your inventory live on chain"}
          </div>
          {/* The permalink is on the card on purpose: it is the thing that lets
              anyone check the card against the line it claims to show. */}
          <div>{line ? `/chronicle/${line.index}` : "questline.world"}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
