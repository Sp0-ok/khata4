// Verifies the mobile bundle was built and copied into the Android assets folder
// with relative asset paths. Run this after `npm run android:sync` and before
// building the APK in Android Studio.
const fs = require("node:fs");
const path = require("node:path");

const errors = [];

function check(file, description, validator) {
  if (!fs.existsSync(file)) {
    errors.push(`MISSING: ${file} (${description})`);
    return;
  }
  if (validator) {
    const content = fs.readFileSync(file, "utf8");
    const err = validator(content);
    if (err) errors.push(`${file}: ${err}`);
  }
}

const distHtml = "dist-mobile/index.html";
const androidHtml = "android/app/src/main/assets/public/index.html";

check(distHtml, "vite mobile build output", (c) => {
  if (!/<script[^>]+src=["']\.\/assets\//.test(c)) {
    return "expected relative ./assets/ script src — run `npm run build:mobile` again";
  }
  return null;
});

check(androidHtml, "copied Capacitor web assets", (c) => {
  if (!/<script[^>]+src=["']\.\/assets\//.test(c)) {
    return "expected relative ./assets/ script src — run `npx cap sync android` again";
  }
  return null;
});

if (errors.length) {
  console.error("\nAndroid bundle verification FAILED:\n");
  for (const e of errors) console.error("  - " + e);
  console.error("\nFix: run `npm run android:sync` and try again.\n");
  process.exit(1);
}
console.log("Android bundle OK:", path.resolve(androidHtml));
