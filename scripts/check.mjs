/**
 * House style, as a check that fails.
 *
 *   npm run check
 *
 * One connector: the spaced hyphen. Nine characters are banned outright, and
 * intending to remember is not a strategy - this repo was written with 253 of
 * them in it and no way to notice.
 *
 * TWO THINGS TO GET RIGHT IF THIS IS EVER EDITED, both learned the hard way:
 *
 *  1. THE PATTERNS ARE BUILT FROM ESCAPE SEQUENCES, never written as literal
 *     characters. Written literally, this file's own source contains every
 *     character it bans and it reports itself on every clean run, which is how
 *     a check becomes noise that people skip.
 *  2. IT SCANS SOURCES, and sources are not the whole story. An html entity is
 *     plain ascii here and a dash once rendered, so ENTITIES below covers those
 *     as well. Dependencies ship their own characters, so the target is zero OF
 *     OURS rather than zero absolute.
 *
 * The replacements are all plain ASCII and are substitutions, never deletions.
 * Deleting a character that was carrying meaning is how a truncated address
 * once turned into valid hex that read as a whole one.
 *
 * The live contract check lives in scripts/verify.mjs, which asks a different
 * question: this one asks whether the repo reads right, that one asks whether
 * the deployed world still agrees with the app's arithmetic.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath, not `.pathname`: this repo lives under a directory with a
   space in its name, and the raw pathname keeps it percent-encoded. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** [the character, what to call it, what to write instead] */
const BANNED = [
  ["\u2014", "em dash", " - "],
  ["\u2013", "en dash", " - "],
  ["\u2010", "hyphen", "-"],
  ["\u2012", "figure dash", "-"],
  ["\u2015", "horizontal bar", "-"],
  ["\u2212", "minus sign", "-"],
  ["\u00B7", "middle dot", " . "],
  ["\u2022", "bullet", "-"],
  ["\u2026", "ellipsis", "..."],
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "build",
  "__pycache__",
]);

const EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".css",
  ".py",
  ".md",
  ".json",
  ".html",
  ".svg",
];

/**
 * Files where one of these characters is doing a job.
 *
 * Exempted BY EXACT PATH rather than by pattern, so a new use anywhere else
 * still fails and adding a tenth is a decision somebody makes on purpose.
 */
const EXEMPT = new Set([
  // Nothing yet. This file itself does not need exempting, because every
  // banned character in it is written as an escape sequence.
]);

/**
 * The same nine characters, spelled as html entities.
 *
 * This is the hole the note at the top warns about: a source scan sees an
 * entity as seven ascii letters and passes it, and the browser renders an em
 * dash anyway. One was sitting in app/world/page.tsx doing exactly that,
 * through several passes of this repo, because nothing was looking for it.
 *
 * The numeric forms are included because they render the same character and
 * are what a paste out of a word processor tends to leave behind.
 */
const AMP = String.fromCharCode(38);
const ENTITIES = [
  ["mdash;|#8212;|#x2014;", "em dash entity", " - "],
  ["ndash;|#8211;|#x2013;", "en dash entity", " - "],
  ["hellip;|#8230;|#x2026;", "ellipsis entity", "..."],
  ["bull;|#8226;|#x2022;", "bullet entity", "-"],
  ["middot;|#183;|#xB7;", "middle dot entity", " . "],
  ["minus;|#8722;|#x2212;", "minus sign entity", "-"],
].map(([alts, name, instead]) => [
  // Built from a fromCharCode ampersand for the same reason the characters
  // above are escape sequences: written out, this table would contain every
  // entity it bans and the check would report itself on every clean run.
  new RegExp(alts.split("|").map((a) => AMP + a).join("|"), "gi"),
  name,
  instead,
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full;
  }
}

let files = 0;
let total = 0;
const hits = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split("/").join(sep);
  if (EXEMPT.has(rel)) continue;
  files += 1;
  const source = readFileSync(file, "utf8");
  for (const [char, name] of BANNED) {
    let index = source.indexOf(char);
    while (index !== -1) {
      total += 1;
      hits.push({ rel, line: source.slice(0, index).split("\n").length, name });
      index = source.indexOf(char, index + 1);
    }
  }
  for (const [pattern, name] of ENTITIES) {
    for (const match of source.matchAll(pattern)) {
      total += 1;
      const line = source.slice(0, match.index).split("\n").length;
      hits.push({ rel, line, name });
    }
  }
}

if (total === 0) {
  console.log(`\n  House style: clean. ${files} files, none of the nine.\n`);
  process.exit(0);
}

const byFile = new Map();
for (const hit of hits) {
  if (!byFile.has(hit.rel)) byFile.set(hit.rel, []);
  byFile.get(hit.rel).push(hit);
}

// `files` counts everything scanned; byFile.size is what actually offends.
// Reporting "253 across 72 files" when 72 was the scan count reads as far worse
// than it is, and a check that overstates gets argued with instead of fixed.
console.error(
  `
  House style: ${total} banned characters in ${byFile.size} of ${files} files.
`,
);

for (const [rel, found] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${rel}  (${found.length})`);
  const counts = new Map();
  for (const f of found) counts.set(f.name, (counts.get(f.name) ?? 0) + 1);
  for (const [name, n] of counts) {
    const row =
      BANNED.find(([, label]) => label === name) ??
      ENTITIES.find(([, label]) => label === name);
    const instead = row[2];
    console.error(`      ${n} ${name}  ->  write "${instead}"`);
  }
}

console.error("");
process.exit(1);
