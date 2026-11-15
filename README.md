# Sterling Specialty · 3.0

Compact, offline-ready shift counters at
https://jasonjaggers.github.io/Tic-Counter-/ (GitHub Pages, main branch).
No runtime packages, backend, embedded spreadsheet, API key or OAuth secret.

## Report by speaking naturally

Tap **Report**. The app prepares the current counts, tank readings, workday/shift
hint and a stable record ID, then opens ChatGPT. Dictate the actual settings,
operator and handoff there; there is no settings form to complete. Optional notes
can also be dictated on the app's report page with supported browser speech
recognition or the phone keyboard microphone.

The packet identifies the existing shift workbook and verified column mappings
for App Reports 2.1 (A:W) and Shift Log History (B:I; headers at row 7). It tells
ChatGPT to wait for the spoken report, use current metadata, distinguish old draft
references from current readings, honor explicit corrections, avoid duplicate IDs
and matching shifts, preserve formulas, and verify writes by readback.

**ChatGPT must have the user's Google Drive/Sheets connection available.** The
static app does not silently write the sheet, inherit this development chat, or
receive a save callback. An opened/prepared report is never marked synced by the
app. A successful sheet write is confirmed in the connected ChatGPT conversation.
ChatGPT URL prefill can vary by client: the same packet is copied on handoff and
is available in the app's copy panel if it needs to be pasted. Long packets use
this copy path instead of truncating notes. No fabricated report was written to
the real workbook for testing.

## Retained features and daily dots

Mix 1–3, AA/NA/AN unloads, hold weight/AMD, four tank levels, share/SMS, undo,
CSV export, reset snapshots, history exports, conversion, BBS, maintenance,
Vector, ADP and calendar are retained. BBS and Report use small selection dots;
they do not attest that a third-party form was submitted or a sheet was written.
Dots follow the existing 06:10 America/Chicago workday boundary, including DST.
Conversion keeps the original pounds input to avoid repeated conversion.

Existing tank-counter-v1, sterling-line1-levels-v1, sterling-v2-archives,
sterling-v21-reports and sterling-v21-draft storage keys migrate in place. Storage
failures stop count changes/resets from silently dropping readings. Reset requires
a saved pre-reset snapshot. Backups include current counts/levels, reports,
legacy notes and draft; JSON restore rolls back failed storage writes and stops
page-exit autosave from overwriting the restored draft. Reports are capped at 500
without silently dropping unsent records. Reset snapshots retain the previous
120-record cap. Daily-marker exports are reference metadata, not replayed on import.

## Offline, speed and updating

The critical app shell is precached atomically. Only named same-origin static
assets are cached; Google, ChatGPT, authenticated requests and other APIs are not.
Navigation falls back to the cached shell after a short network deadline. Asset
version keys and a matching HTML revision prevent incompatible offline bundles.
The new worker retires old app caches without clearing localStorage.

The calendar iframe loads only after expansion. The unconfigured Google OAuth
script and dead sync controls were replaced by the voice-first connected-chat
handoff. System fonts and inline icons avoid font/icon network dependencies.
New versions show **Update ready · reload**; draft notes are persisted before
reload. Counters keep working offline; dictation services and ChatGPT may need a
connection. No claim of physical iPhone microphone testing is made.

## Development checks

```sh
node --test tests/*.test.cjs
node --check app.js
node --check report.js
node --check sw.js
python3 -m http.server 8775 --bind 127.0.0.1
node tests/browser.cjs
```

Browser checks require Chromium and the ws Node package (available in the laptop's
Debian environment). They use an isolated profile, synthetic fixtures and mocked
ChatGPT/clipboard/speech handoff; no live report is submitted. Screenshots and
results go to /tmp/sterling-qa. They verify migration, daily dots, record reuse,
transcript handling, reset/save failure, backup restoration, offline reload and
320/375/390/768/1280px layouts. Pure tests verify Central/DST dates, schema handling,
exact sheet mapping, blank versus zero, safe CSV and service-worker cache boundaries.

## Deployment and rollback

Use a reviewed pull request to main; the existing GitHub Pages branch deployment
publishes it. Keep the same origin/path so device storage is preserved. Verify the
Pages build and the deployed HTML/asset revision. Revert the PR to roll back code;
local records remain in the preserved keys. Never clear device storage as an
update procedure. The workstation's automatic documentation merger is a separate
repository/tool and is not the Sterling app deployment path.

## iPhone mix widget

Open **iOS mix widget** on Home. Install [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188), copy the widget script into a new Scriptable script named exactly **Sterling Mix**, then add a small or medium Scriptable Home Screen widget and select that script. Return to the Sterling app you normally use and tap **Update widget** to share Mix 1–3.

This is a manual, one-way snapshot, stored locally in Scriptable. Browser storage cannot be read by the widget. Updates show their timestamp; older snapshots are highlighted and missing counts display dashes. Tapping the widget opens its Scriptable preview. iOS controls Home Screen refresh timing, so sending a snapshot does not guarantee an immediate refresh. No account, server, API key or spreadsheet access is required.

The script and transfer validation are tested on Debian with mocked Scriptable APIs; installation and native widget rendering require checking on an iPhone. [Scriptable URL scheme](https://docs.scriptable.app/urlscheme/) · [Widget refresh documentation](https://docs.scriptable.app/listwidget/).
