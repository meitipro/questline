import dns from "node:dns";

/* Studio sits behind Cloudflare on both stacks and its AAAA addresses time out.
 * Node tries IPv6 first by default, so every server-side read burns ten seconds
 * before falling back - which does not look like a network problem, it looks
 * like the contract is unreadable and the whole site quietly serves seeded data.
 *
 * This has to be here as well as in the scripts: next.config.mjs is the earliest
 * module the server evaluates, and a fix applied later is applied too late. */
dns.setDefaultResultOrder("ipv4first");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  env: {
    /* Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every build, but it is a
     * server only variable, so the browser bundle would inline it as undefined.
     * lib/chain.ts reads the NEXT_PUBLIC_ copy because ORIGIN is used in client
     * components too - it is the host printed inside every chronicle permalink
     * and share card.
     *
     * Mapping it here is what makes a first Vercel deploy produce correct links
     * with nothing configured at all. An explicit NEXT_PUBLIC_ORIGIN still wins,
     * for a real domain. Empty string rather than undefined: Next rejects
     * undefined values here, and "" is falsy so the fallback chain still works.
     */
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
  },
};

export default nextConfig;
