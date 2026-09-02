// Lightweight, dependency-free diagnostic logging for page-to-page navigation.
// Safe to leave in — it's just console.log calls with timing info, no
// behavioral effect. Client-side logs show in the browser DevTools console
// (works on the deployed site too, since it runs in the browser). Logs added
// to proxy.ts run on the server and show in the terminal for `next dev` /
// `next start`, or in the Vercel "Functions" logs for a deployed site.

function ts(): string {
  const d = new Date();
  return d.toISOString().slice(11, 23); // HH:MM:SS.mmm
}

const navStarts = new Map<string, number>();

/** Call when a nav link/button is clicked, before the route change starts. */
export function logNavClick(href: string): void {
  navStarts.set(href, performance.now());
  console.log(`[nav ${ts()}] click → ${href}`);
}

/** Call once the new pathname has committed (e.g. in a usePathname() effect). */
export function logNavCommitted(pathname: string): void {
  const start = navStarts.get(pathname);
  if (start != null) {
    const ms = Math.round(performance.now() - start);
    console.log(`[nav ${ts()}] ${pathname} committed in ${ms}ms (click → render)`);
    navStarts.delete(pathname);
  } else {
    console.log(`[nav ${ts()}] ${pathname} committed (no click mark — initial load or back/forward)`);
  }
}

/** Generic "X took Yms" logger for cache/fetch operations. */
export function logTiming(label: string, startMs: number, detail?: Record<string, unknown>): void {
  const ms = Math.round(performance.now() - startMs);
  console.log(`[perf ${ts()}] ${label} — ${ms}ms${detail ? ' ' + JSON.stringify(detail) : ''}`);
}

export function now(): number {
  return performance.now();
}
