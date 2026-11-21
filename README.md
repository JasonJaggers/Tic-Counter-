# Sterling Specialty · 3.2.7

Compact, offline-ready shift counters at
https://jasonjaggers.github.io/Tic-Counter-/ (GitHub Pages, main branch).
No runtime packages, backend, embedded spreadsheet, API key or OAuth secret.

## Native iPhone app

The [Sterling iOS source and Xcode setup](ios/README.md) live under `ios/`.

## Report

Choose **Report** from the menu, then type or use your keyboard microphone.
**Submit** opens ChatGPT with “Sterling report” followed by your text in the
composer. Send it from ChatGPT.

## Retained features and daily dots

Mix 1–3, AA/NA/AN unloads, hold weight/AMD, four tank levels, share/SMS, undo,
CSV export, reset snapshots, conversion, BBS, maintenance,
Vector, ADP and calendar are retained. BBS and Report use small selection dots;
they do not attest that a third-party form was submitted or a sheet was written.
Dots follow the existing 06:10 America/Chicago workday boundary, including DST.
Conversion keeps the original pounds input to avoid repeated conversion.

Existing tank-counter-v1, sterling-line1-levels-v1, sterling-v2-archives,
sterling-v21-reports and sterling-v21-draft storage keys migrate in place. Storage
failures stop count changes/resets from silently dropping readings. Reset requires
a saved pre-reset snapshot. Stored reports and reset snapshots remain in the existing storage keys. Reset snapshots retain the previous
120-record cap.

## Offline, speed and updating

The critical app shell is precached atomically. Only named same-origin static
assets are cached; Google, ChatGPT, authenticated requests and other APIs are not.
Navigation falls back to the cached shell after a short network deadline. Asset
version keys and a matching HTML revision prevent incompatible offline bundles.
The new worker retires old app caches without clearing localStorage.

The calendar is always expanded and loads when a connection is available. System fonts and inline icons avoid font/icon network dependencies.
Counters keep working offline. ChatGPT needs a connection.

## Development checks

```sh
node --test tests/*.test.cjs
node --check app.js
node --check report.js
node --check sw.js
python3 -m http.server 8775 --bind 127.0.0.1
node tests/browser.cjs
```

Browser checks require Chromium and Node.js with the built-in WebSocket API. They use an isolated profile, synthetic fixtures and mocked
ChatGPT handoff; no live report is submitted. Screenshots and
results go to /tmp/sterling-qa. They verify migration, daily dots, report text, reset/save failure, the menu, offline reload and
320/375/390/768/1280px layouts. Pure tests verify Central/DST dates, schema handling,
exact sheet mapping, blank versus zero, safe CSV and service-worker cache boundaries.

## Deployment and rollback

Use a reviewed pull request to main; the existing GitHub Pages branch deployment
publishes it. Keep the same origin/path so device storage is preserved. Verify the
Pages build and the deployed HTML/asset revision. Revert the PR to roll back code;
local records remain in the preserved keys. Never clear device storage as an
update procedure. The workstation's automatic documentation merger is a separate
repository/tool and is not the Sterling app deployment path.
