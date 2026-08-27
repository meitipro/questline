/**
 * Every word and number the landing page shows that is not read from the chain.
 *
 * One file on purpose. The landing is the page most likely to be reworded, and
 * hunting a sentence through six components is how a copy change turns into a
 * layout change. Anything here is safe to edit without touching a component.
 *
 * What is NOT here: the player count, the resolved count and the region list.
 * Those come from `getWorld()` so the page cannot claim a number the contract
 * would contradict, which is the one thing this product must never do.
 */

/** The headline types itself, in two colours, one character at a time. */
export const HEADLINE = {
  /** Typed first, in the ink colour, so it reads as pressed into the page. */
  dark: "Nobody here can cheat.",
  /** Typed second, in the cream colour. The leading space is deliberate. */
  light: " Not even us.",
  /** Milliseconds per character. */
  speed: 35,
  /** How long to wait before the first character lands. */
  delay: 400,
};

export const HERO = {
  eyebrow: "// the game master is a contract",
  lede: "The rules, the rolls and your inventory live on chain. Validators resolve what you type against rules you can read.",
  primary: "Enter the world",
  secondary: "Read the chronicle",
};

export const FEATURES_INTRO = {
  eyebrow: "// what the contract guarantees",
  title: "Six promises made in code, before you type anything.",
  lede: "None of these are policy. Each one is a rule the network applies to every action, including the ones we would rather it did not.",
};

export const FEATURES: { title: string; body: string }[] = [
  {
    title: "Rolls anyone can recompute",
    body: "Seeded from the action and its timestamp, computed in the deterministic half, and published beside the outcome.",
  },
  {
    title: "Rules pinned to a version",
    body: "A region can publish new rules, but old chronicle lines stay pinned to the version they ran under.",
  },
  {
    title: "Items the studio cannot mint",
    body: "An item is an entry in contract storage with the line that granted it, not a row an operator can edit.",
  },
  {
    title: "Several strangers, one verdict",
    body: "Validators resolve your action against public criteria and the result only stands where they agree.",
  },
  {
    title: "Magnitude capped in code",
    body: "The model narrates. The region caps what that narration is allowed to spend, before it is applied.",
  },
  {
    title: "Failures published too",
    body: "An undecided action is published like any other line, and the energy it cost is refunded.",
  },
];

export const FAQ_INTRO = {
  eyebrow: "// questions",
  title: "The four we get asked first.",
  cta: "Read a real line instead",
};

export const FAQS: { question: string; meta: string; answer: string }[] = [
  {
    question: "How is a dice roll verified?",
    meta: "Rolls",
    answer:
      "Every line publishes its seed: the action, the timestamp the contract hashed and the line index. Hash them the way the contract does and you get the same number, or the line is wrong.",
  },
  {
    question: "What stops the studio minting a rare item?",
    meta: "Custody",
    answer:
      "There is no write path that skips the roll. An item exists because a resolved action granted it, and the line that did so is public and permanent.",
  },
  {
    question: "What happens when validators disagree?",
    meta: "Consensus",
    answer:
      "No result is issued. The line is published undecided, your energy is refunded, and the disagreement is visible - a world that hides its own failures is back to being a private server.",
  },
  {
    question: "Can the rules change under me?",
    meta: "Rules",
    answer:
      "A region can publish a new rules version, but the chronicle pins each line to the version it ran under, so a later rule change cannot rewrite an earlier result.",
  },
];

/**
 * WHERE the chips sit. Not who they are.
 *
 * The design hard-codes eight addresses and their stats. Those are mock data,
 * and a landing page that prints "0xd41e . 688 ACTIONS" beside a player count
 * read from the chain is inventing seven eighths of what it shows. On a live
 * world it would be inventing all of it.
 *
 * So this table is positions only, and the page fills them from the real
 * leaderboard, in order. Fewer players than slots means fewer chips.
 *
 * `ring` picks which circle a slot rides, `angle` is its position in degrees,
 * `delay` is when it flies in, and `detail` marks the slots big enough to
 * carry a second line. The delays climb from the innermost ring outwards,
 * which is why they do not read in source order.
 */
export const ORBIT_SLOTS: {
  ring: 0 | 1 | 2 | 3;
  angle: number;
  delay: number;
  detail: boolean;
}[] = [
  { ring: 0, angle: 270, delay: 0.6, detail: false },
  { ring: 1, angle: 60, delay: 0.9, detail: false },
  { ring: 1, angle: 180, delay: 1.1, detail: true },
  { ring: 1, angle: 300, delay: 1.3, detail: false },
  { ring: 2, angle: 130, delay: 1.5, detail: true },
  { ring: 3, angle: 30, delay: 1.7, detail: false },
  { ring: 3, angle: 95, delay: 1.9, detail: true },
  { ring: 3, angle: 220, delay: 2.1, detail: true },
];

/**
 * The four rings, outermost last.
 *
 * `size` is the diameter in the design's own coordinate space, which the whole
 * assembly is then scaled down from. `spin` is the direction and `seconds` the
 * period: neighbouring rings turn opposite ways, which is what stops the group
 * reading as one rotating image.
 */
export const ORBIT_RINGS: { size: number; spin: "l" | "r"; seconds: number }[] = [
  { size: 353, spin: "l", seconds: 30 },
  { size: 501, spin: "r", seconds: 40 },
  { size: 649, spin: "r", seconds: 50 },
  { size: 797, spin: "l", seconds: 60 },
];

/** The design's coordinate space. Everything above is measured inside it. */
export const ORBIT_BOX = 797;
