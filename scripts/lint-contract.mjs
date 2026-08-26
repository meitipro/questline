/**
 * Run genvm-lint over the contract.
 *
 *   npm run lint:contract
 *
 * Wrapped rather than called directly, because two Windows details turn a
 * passing contract into a failing one:
 *
 *  1. The linter prints a U+2713 tick and dies on it under the cp1252 stdout a
 *     child process inherits, so the child needs PYTHONIOENCODING=utf-8. The
 *     crash lands ON THE SUCCESS CHARACTER, so it looks like a broken contract
 *     when it is a passing one.
 *  2. Never spawn it through a shell. These repos live under "GenLayer Works"
 *     and the shell splits the path on the space, so the linter reports
 *     `unrecognized arguments: Works\...\questline.py` for every file.
 *
 * `check` runs both halves: the AST pass, and the deeper one that loads the
 * contract against the SDK. The second half is the one that only started
 * working once the contract class was renamed off `Contract` - the validator
 * cannot find a class by that name, and reports "No contract class found" for
 * a contract that is completely fine.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = join(HERE, "..", "contracts", "questline.py");

const result = spawnSync("genvm-lint", ["check", CONTRACT], {
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  // No `shell: true`. See the note above.
  shell: false,
});

if (result.error) {
  console.error(
    `\n  Could not run genvm-lint: ${result.error.message}\n` +
      "  Install it with:  pip install genvm-linter\n",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
