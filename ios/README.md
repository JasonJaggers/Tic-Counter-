# Sterling iOS

Native SwiftUI companion to Sterling Specialty 3.2.7, based on web commit aa783e8.
The web app stays available at https://jasonjaggers.github.io/Tic-Counter-/.
The native deployment target is iOS and iPadOS 17.0.

## Build

Use Apple's Xcode 26.3 on macOS Sequoia 15.6 or newer. Download it from
https://developer.apple.com/download/all/?q=Xcode%2026.3 after signing in.
Expand the signed archive and open Xcode once to complete its setup.
Open Sterling.xcodeproj and choose a scheme.

| Scheme | Use | Signing |
| --- | --- | --- |
| Sterling Personal | Run the native app and interactive counter widgets on your own device | Free Apple Account and Personal Team |
| Sterling | Native app and widgets for device testing and distribution | Developer Program team with App Groups |

For Sterling Personal, select your Personal Team in the Signing & Capabilities panels for
Sterling Personal and SterlingShortcuts, connect your iPhone and choose it as the destination. Apple
Personal Team profiles expire after seven days. If Xcode reports a bundle
identifier conflict, choose a unique app identifier and update the widget identifier
to start with it. Both Personal targets use the same App Group. Keep their entitlements and the
Shift.personalGroup constant in sync if you change the group. Open the app once
after updating to move existing readings into the shared store. The original
file is retained. Add Sterling Counters in medium or large. The six plus buttons
save directly to the same counters without opening the app. The large widget
has a keypad that shows kilograms as you enter pounds. It uses the app's
existing round-up rule. The medium widget uses Conversion pounds in Edit Widget
and the Convert button. The Lock Screen widget opens Sterling.

For Sterling, select the same paid team on both targets and register the App
Group shown by Xcode. If the identifier is unavailable, change the group in both
entitlements files and the Shift.group constant. Keep the widget bundle ID
prefixed with the app bundle ID. Sign both targets and build on a real iPhone
before archiving. Add a small or medium Sterling Counters widget from the Home
Screen gallery or the Open Sterling shortcut from the Lock Screen gallery.
Widget writes and app writes use the same locked, atomically saved local file.

## Siri and Messages

After installing the updated app, open it once. Try "Siri, add one to Mix 2 in
Sterling" and "Siri, get my Sterling totals." Use the installed app's name if
Siri recognizes a different display name. Counting writes to the shared shift
file and supports the existing Undo action.

Create these in Apple's Shortcuts app once on your iPhone:

| Shortcut name to say to Siri | Sterling action | Send Message recipient |
| --- | --- | --- |
| Text Sterling totals to Jamie | Get Sterling Totals, Tank Levels Only off | Select the intended Jamie from Contacts |
| Text Sterling tank totals | Get Sterling Totals, Tank Levels Only on | Ask Each Time, or pass the result of Select Contact |

Set the Send Message text to the output of Get Sterling Totals. Try each
shortcut manually with a test recipient before enabling hands-free delivery.
To send directly where iOS permits, turn off Show When Run in Send Message.
iOS may prompt for permission the first time. Empty totals stop the shortcut
with an error. Tank totals use the existing tank-level share format.

## Inviting people

Use App Store Connect to create the app record, archive the Sterling scheme and
upload the build. Start with an external TestFlight group and email invitations
if access should be limited to specific people. Apple's first external beta
review is required and each TestFlight build expires after 90 days.
The Apple Developer Program is US$99/year and the app has no hosting fees.
For regular long-term distribution, consider Apple's unlisted App Store route.
Its link can be forwarded. Invite-only access outside TestFlight would require
an additional sign-in or an eligible organization-managed distribution method.

No App Store record, signing profiles, invitations, or release have been created.
The App Store review submission will also need its own listing materials,
privacy disclosures, and review access details for any authenticated links.

## Changes for iPhone

- Interactive widgets for mix and unload counts, a Lock Screen shortcut, and
  haptic confirmation when adding counts inside the app.
- Offline counters, hold readings, tank levels, undo, reset snapshots, conversion,
  native share sheet and CSV. Use Messages from the share sheet for SMS.
- The familiar menu links for Maintenance, Vector, BBS, Report, Google Calendar
  and ADP. Those services keep their own authentication and availability.
- A native agenda at the bottom. After granting calendar access, select your work
  calendar in Sterling. The agenda queries only the selected calendar. A Google
  work calendar must be synced to iOS before it appears in the picker. Calendar
  events never enter the widget.
- A local report draft and handoff to the ChatGPT composer. Sending the draft
  remains a separate step in ChatGPT. The daily dots indicate selection or URL
  handoff, and they roll over at 6:10 a.m. Central.
- Reset snapshot viewing and JSON backup export/import. Each installation keeps
  its own readings. Inviting someone gives them a copy of the app, with their
  own local workspace.

## Moving existing records

Safari and Home Screen web apps have separate storage from native apps. Keep
the web app installed until you've verified the import. Import supports an
empty native workspace and preserves current counters/readings, reset snapshots,
and the two daily selection dates. Historical browser-only report keys and
older draft keys remain in the web app.

WebBackup.js is an export helper for a web developer to run in the original
Sterling page's JavaScript context, using the exact browser/web app profile
that holds the records. It reads a fixed list of Sterling keys and saves a
local JSON file. It can also be integrated into a reviewed web release as an
Export backup menu item for ordinary phone users. That web change has not
been published. After export, transfer the JSON through Files or AirDrop and
choose Import backup from the native menu. A JSON exported by Sterling Personal
can likewise be imported into an empty widget-enabled install.

## Validation

Run the model and migration checks without Xcode from this directory.

```sh
swiftc Sources/Shared/Shift.swift Sources/App/LegacyBackup.swift Checks/ShiftChecks.swift -o /tmp/sterling-check
/tmp/sterling-check
```

Before inviting testers, build both schemes in full Xcode. Verify on-device
launch, VoiceOver, offline counting, Home Screen widget writes while the app
is closed, Lock Screen launch, backup round-trip, native share, calendar
permission, and a synthetic ChatGPT composer handoff.


## Editing from your iPhone

Open Codex in ChatGPT on iOS and start a cloud task with access to
JasonJaggers/Tic-Counter-. Ask Codex to edit the iOS app in `ios/`.
Pull the approved GitHub changes on your Mac and open
`ios/Sterling.xcodeproj`. Use the Sterling Personal scheme, your Personal Team
on both targets, and your paired iPhone as the run destination. Xcode can
install over the local network after pairing when it sees the phone.
Keep the bundle identifiers and shared App Group stable when updating an
existing installation so local readings carry forward. Free signing lasts
seven days and can be renewed by running the same scheme in Xcode.
