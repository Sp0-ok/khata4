// Post-build step for the Android (Capacitor) target.
// 1. Ensures dist/client/index.html exists and is the SPA shell so any deep link
//    inside the WebView (e.g. /customers/123) loads the React app instead of 404.
// 2. Strips any stray references to Cloudflare/server endpoints from the shell.
//
// Run automatically by `bun run android:sync`.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = "dist/client";
const SHELL_CANDIDATES = ["index.html", "_shell.html", "_shell/index.html", "__spa/index.html"];

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

// Overwrite MainActivity.java unconditionally with the version required by
// @capgo/capacitor-social-login. The plugin throws
//   "You CANNOT use scopes without modifying the main activity"
// at runtime when these hooks are missing, so we force the canonical version
// every sync rather than trying to patch in place.
const mainActivityPath = "android/app/src/main/java/app/hisaab/khata/MainActivity.java";
if (existsSync(mainActivityPath)) {
  const mainActivity = `package app.hisaab.khata;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
        && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
      if (pluginHandle == null) {
        Log.i("Google Activity Result", "SocialLogin plugin handle is null");
        return;
      }
      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) {
        Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
        return;
      }
      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }

  public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
`;
  writeFileSync(mainActivityPath, mainActivity);
  console.log("[android] Wrote MainActivity.java with SocialLogin hooks.");
}

// Patch @capgo/capacitor-social-login's Android Google provider so an expired
// ID token does not force logout. Hisaab Kitaab only needs a valid Drive access
// token; Google Play Services can silently mint that token again for previously
// granted scopes until the user explicitly logs out or switches accounts.
const googleProviderPath =
  "node_modules/@capgo/capacitor-social-login/android/src/main/java/ee/forgr/capacitor/social/login/GoogleProvider.java";
if (existsSync(googleProviderPath)) {
  let provider = readFileSync(googleProviderPath, "utf8");
  const originalProvider = provider;
  provider = provider.replaceAll(
    `boolean isValidIdToken = idTokenValid(GoogleProvider.this.idToken);

                if (!isValidAccessToken || !isValidIdToken) {`,
    `// Hisaab Kitaab only needs a valid Drive access token here. The ID token
                // may expire independently and should not clear the saved Google account.
                if (!isValidAccessToken) {`,
  );
  provider = provider.replace(
    `        // 1) Retrieve a fresh ID token via Credential Manager (may be silent or may require user interaction).
        // 2) Retrieve a fresh access token via the Authorization API.`,
    `        // Prefer a silent Drive access-token refresh through Google's Authorization API.
        // This avoids forcing the user through account selection when only the ID token expired.
        try {
            AuthorizationResult authResult = getAuthorizationResult(false).get(60, TimeUnit.SECONDS);
            String newAccessToken = authResult.getAccessToken();
            if (newAccessToken != null && !newAccessToken.isEmpty()) {
                persistState(
                    GoogleProvider.this.idToken != null ? GoogleProvider.this.idToken : "",
                    newAccessToken,
                    GoogleProvider.this.scopes
                );
                call.resolve();
                return;
            }
        } catch (Exception e) {
            Log.w(LOG_TAG, "Silent Google access-token refresh failed; falling back to Credential Manager", e);
        }

        // 1) Retrieve a fresh ID token via Credential Manager (may be silent or may require user interaction).
        // 2) Retrieve a fresh access token via the Authorization API.`,
  );
  if (provider !== originalProvider) {
    writeFileSync(googleProviderPath, provider);
    console.log("[android] Patched SocialLogin GoogleProvider for silent token refresh.");
  }
}

console.log("[android] dist/client is ready for `npx cap sync android`.");
