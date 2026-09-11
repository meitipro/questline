/**
 * The opening world: ten items and four regions.
 *
 * One copy, read by both ways of publishing it - scripts/seed.mjs from a
 * terminal, and /admin from a browser wallet. It used to live only inside the
 * seed script, so the only way to publish a world was a shell command holding
 * the owner's private key, and an owner who deployed through the Studio
 * interface had no key to hand it.
 *
 * A leaf module on purpose: no imports, so a .mjs script can load it with
 * Node's own type stripping and the parity suite can import it directly.
 *
 * Order matters in both lists. The registry is published before any region,
 * because a grant is refused against an empty registry. And regions[0] is where
 * every player enters, so the sunken archive has to be first.
 */

/** `name=note` pairs joined by `;`, exactly the shape register_items parses. */
export const OPENING_REGISTRY = [
  "rusted bar=bends under load, opens what hands cannot",
  "torn page=half a rule from a version nobody kept",
  "lantern, wet=lights on the third try, or the fourth",
  "brass key=warmer than the water around it",
  "salt rope=sings before it fails, which is a courtesy",
  "tin whistle=opens shutters that are not near you",
  "ledger fragment=a column of numbers and no header",
  "glass float=someone has written a number inside it in salt",
  "ferryman token=passage for one, once, in one direction",
  "a number in salt=not yours, and it knows it",
].join(";");

export interface OpeningRegion {
  name: string;
  description: string;
  rules: string;
  max_magnitude: number;
  depth: number;
  exits: string;
}

export const OPENING_REGIONS: OpeningRegion[] = [
  {
    name: "the sunken archive",
    description:
      "Water has taken the lower shelves. Three doors, one sealed. Fire does nothing here and water damage counts double.",
    rules:
      "Fire effects resolve as none. Water damage counts double. The sealed door opens only to a tool, never to hands. Speech carries, and the archive repeats the last word of anything read aloud.",
    max_magnitude: 4,
    depth: 2,
    exits: "the long stair, the drowned market",
  },
  {
    name: "the long stair",
    description:
      "Two hundred steps with no landing you can trust. What you carry is what you can hold with one hand.",
    rules:
      "Two handed actions resolve at half magnitude. A fall costs health equal to the magnitude rather than granting anything. Nothing can be gained while both hands are occupied.",
    max_magnitude: 3,
    depth: 1,
    exits: "the sunken archive, the ash terrace",
  },
  {
    name: "the ash terrace",
    description:
      "Open sky, and a crust that holds for two paces. The only region where fire behaves as you expect.",
    rules:
      "Fire behaves as expected here and nowhere else. Movement without a rope resolves as damage on a fail. The crust holds two paces, and a third is a fall.",
    max_magnitude: 6,
    depth: 3,
    exits: "the long stair",
  },
  {
    name: "the drowned market",
    description:
      "Stalls under four feet of water and a ferryman who trades in numbers. Speech is an action here.",
    rules:
      "Trades require an item listed in the registry. Speech is an action and costs energy like any other. The ferryman answers a question with a number, never with a name.",
    max_magnitude: 5,
    depth: 4,
    exits: "the sunken archive",
  },
];
