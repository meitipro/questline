/**
 * Installs the resolve hook. Loaded by `npm test` through --import, which runs
 * it before the first test file is resolved.
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
