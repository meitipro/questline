"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "questline-theme";

/**
 * Applied to <html> in <head>, before the browser paints anything.
 *
 * Without this a dark reader gets a white flash on every single navigation,
 * because the stylesheet's default cannot be known until React runs. It is
 * deliberately tiny, synchronous, and wrapped in try/catch: localStorage throws
 * outright in a locked-down browser, and a theme preference is not worth taking
 * the page down for.
 *
 * prefers-color-scheme is consulted here and nowhere else, and only when there
 * is no stored choice. Once someone has picked, their pick wins - an OS that
 * flips to dark at sunset should not overrule a person who chose light.
 */
export const THEME_BOOT = `(function(){try{
var k=${JSON.stringify(THEME_KEY)};
var s=localStorage.getItem(k);
var t=s==="light"||s==="dark"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function ThemeToggle() {
  // Starts as null rather than a guess. The server has no idea which theme this
  // reader stored, so rendering a label before mount would either be wrong or
  // cause a hydration mismatch; the button holds its width and stays quiet for
  // one frame instead.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(readTheme()), []);

  function toggle() {
    const next: Theme = readTheme() === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* A reader who blocks storage still gets the switch, just not the memory. */
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={
        theme === null
          ? "Switch theme"
          : `Switch to the ${theme === "light" ? "dark" : "light"} theme`
      }
      title="Switch theme"
    >
      {/* A pill with the knob on the side the current theme sits on. The knob
          carries the glyph rather than a label beside it, so the control keeps
          one width in both states and the header does not shift when it flips. */}
      <span
        aria-hidden
        className="theme-knob"
        style={{ marginLeft: theme === "light" ? "auto" : 0 }}
      >
        {theme === null ? "" : theme === "light" ? "☾" : "☀"}
      </span>
    </button>
  );
}
