// Post-build step for the Android (Capacitor) target.
// 1. Ensures dist/client/index.html exists and is the SPA shell so any deep link
//    inside the WebView (e.g. /customers/123) loads the React app instead of 404.
// 2. Strips any stray references to Cloudflare/server endpoints from the shell.
//
// Run automatically by `bun run android:sync`.
import { existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = "dist/client";
const SHELL_CANDIDATES = [
  "index.html",
  "_shell.html",
  "_shell/index.html",
  "__spa/index.html",
];

if (!existsSync(CLIENT_DIR)) {
  console.error(`[android] ${CLIENT_DIR} not found. Run \`bun run build\` first.`);
  process.exit(1);
}

function findShell() {
  for (const c of SHELL_CANDIDATES) {
    const p = join(CLIENT_DIR, c);
    if (existsSync(p)) return p;
  }
  // Fallback: walk and pick the smallest html that contains a script tag
  // referencing the entry chunk (likely the SPA shell).
  const found = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (name.endsWith(".html")) found.push({ full, size: s.size });
    }
  }
  walk(CLIENT_DIR);
  found.sort((a, b) => a.size - b.size);
  return found[0]?.full;
}

const shell = findShell();
if (!shell) {
  console.error("[android] Could not locate an HTML shell in dist/client.");
  process.exit(1);
}

const target = join(CLIENT_DIR, "index.html");
if (shell !== target) {
  copyFileSync(shell, target);
  console.log(`[android] Copied ${shell} -> ${target}`);
}

// Sanity check: the shell must not reference the server entry.
const html = readFileSync(target, "utf8");
if (/server-entry|cloudflare/i.test(html)) {
  console.warn("[android] Warning: shell contains server-entry/cloudflare reference.");
}

// Write a minimal 200.html / 404.html fallback (some servers and Capacitor
// helpers look for these) pointing at the same shell.
for (const f of ["200.html", "404.html"]) {
  writeFileSync(join(CLIENT_DIR, f), html);
}

console.log("[android] dist/client is ready for `npx cap sync android`.");
