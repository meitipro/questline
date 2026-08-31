/**
 * Lets a parity test import a real app module that imports its own siblings.
 *
 * TypeScript and the Next bundler both resolve `./format` to `./format.ts`.
 * Node does not: its resolver is exact, so a test importing lib/sample.ts died
 * on ERR_MODULE_NOT_FOUND for lib/format long before any assertion ran.
 *
 * The workaround until now was to only ever parity test a LEAF module - one
 * with no sibling value imports - which quietly put the seeded world, the
 * console and anything else composed from several files out of reach of the
 * test suite. Those are exactly the files where a wrong constant ships.
 *
 * So: resolve normally, and only when that fails try the extensions the
 * bundler would have tried. A specifier that resolves on its own is untouched,
 * and a genuinely missing module still throws - the original error, not this
 * hook's, because the fallback only runs after the real attempt has failed.
 */

const TRIES = [".ts", ".tsx", "/index.ts"];

/** A relative specifier whose last segment carries no extension. */
function bare(specifier) {
  if (!specifier.startsWith(".")) return false;
  const last = specifier.slice(specifier.lastIndexOf("/") + 1);
  return !last.includes(".");
}

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (!bare(specifier)) throw error;
    for (const ext of TRIES) {
      try {
        return await next(specifier + ext, context);
      } catch {
        // Try the next one; if none work, the original error is the honest one.
      }
    }
    throw error;
  }
}
