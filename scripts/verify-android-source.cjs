const fs = require('node:fs');

const required = [
  ['src/main.mobile.tsx', /<AndroidApp \/>/, 'mobile entry must render AndroidApp directly'],
  ['src/mobile/AndroidApp.tsx', /type Screen = "home" \| "parties" \| "record" \| "expenses" \| "reports" \| "settings";/, 'Android screens must stay in the Android-first SPA'],
  ['src/mobile/AndroidApp.tsx', /window\.localStorage/, 'Android data must use local device storage only'],
  ['src/styles.css', /color-scheme:\s*light/, 'runtime dark mode must stay disabled'],
  ['vite.config.mobile.ts', /base:\s*"\.\/"/, 'APK assets must be relative'],
  ['android/app/src/main/AndroidManifest.xml', /android:windowSoftInputMode="adjustNothing"/, 'keyboard must not resize/pan the WebView'],
  ['android/app/src/main/java/app/lovable/hisaabkitaab/MainActivity.java', /FORCE_DARK_OFF/, 'native force-dark must be disabled'],
];

const forbidden = [
  ['src/main.mobile.tsx', /@tanstack\/react-router|RouterProvider|routeTree/, 'mobile entry must not use web routing'],
  ['src/main.mobile.tsx', /ThemeProvider|useTheme|matchMedia|prefers-color-scheme/, 'mobile entry must not use runtime theme switching'],
  ['src/mobile/AndroidApp.tsx', /ThemeProvider|useTheme|matchMedia|prefers-color-scheme|classList\.toggle\("dark"/, 'Android app must not use runtime theme switching'],
  ['src/mobile/AndroidApp.tsx', /onTouchStart|onTouchEnd|onMouseDown|onMouseUp/, 'Android app must not mix touch and mouse handlers'],
  ['src/mobile/AndroidApp.tsx', /useLiveQuery|dexie-react-hooks|Dexie/, 'Android app must not use old Dexie live queries'],
  ['vite.config.mobile.ts', /tanstackRouter|tanstackStart/, 'mobile build must not use web/router build plugins'],
  ['android/app/src/main/AndroidManifest.xml', /uiMode|adjustPan|adjustResize/, 'manifest must not use crash-prone uiMode or keyboard modes'],
  ['android/app/src/main/java/app/lovable/hisaabkitaab/MainActivity.java', /FORCE_DARK_ON/, 'native force-dark must never be enabled'],
];

const errors = [];
for (const [file, pattern, message] of required) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!pattern.test(text)) errors.push(`${file}: missing ${message}`);
}
for (const [file, pattern, message] of forbidden) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (pattern.test(text)) errors.push(`${file}: forbidden ${message}`);
}

if (errors.length) {
  console.error('\nAndroid source verification FAILED:\n');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('Android source OK');
