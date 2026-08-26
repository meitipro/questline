/**
 * The two typefaces, self hosted.
 *
 * They used to be a runtime <link> to fonts.googleapis.com, which is wrong in
 * three separate ways: it hands every visitor's IP to a third party, it makes
 * first paint wait on a network the site does not control, and on any machine
 * that cannot reach Google the whole page silently falls back to system-ui -
 * which does not look like a bug, it just looks worse.
 *
 * next/font/local reads the files from @fontsource at build time and serves
 * them from this origin, so there is no third party request at all. It is
 * next/font/local rather than next/font/google on purpose: the /google variant
 * fetches during the build, which turns an unreachable Google into a failed
 * build rather than a slow page.
 */

import localFont from "next/font/local";

// Written out in full on purpose: next/font parses this file statically at
// build time and rejects any value it cannot read as a literal, so a constant
// for the shared directory prefix fails the build.
export const sans = localFont({
  src: [
    { path: "../node_modules/@fontsource/archivo/files/archivo-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/archivo/files/archivo-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/archivo/files/archivo-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../node_modules/@fontsource/archivo/files/archivo-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const mono = localFont({
  src: [
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
