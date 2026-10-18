# Validation record

## Verified by automated tests

Current result: **43 tests passing across four suites**, plus a successful TypeScript check and Vite production build.

- Real nonzero-offset PNG recovery; multiple images in Mira’s module; incomplete candidate visibility.
- False signatures, invalid chunk lengths, malformed CRC including IEND, truncation, unsupported depth/color/interlace, empty/oversized data, and dimension bounds.
- Actual Vela RGB message; wrong channels; no-header language; newly encoded visitor-independent RGBA/UTF-8 example; impossible length and invalid UTF-8 rejection.
- Runtime SHA-256 equality for Rook/Nacre and C7; changed-byte mismatch; Mira repaired/old mismatch; original-byte export round trip.
- All sixteen full-shift ending combinations; fresh full/demo resets; no initial demo findings; decisions do not immediately reveal identity.
- Category gain × master gain, live gain updates, old ambience cleanup, asynchronous working-loop cancellation, and graceful operation with unavailable audio hardware (audio-graph test doubles; listening checks still pending).
- Mira's old image cannot unlock the repaired-image follow-up; selected image metadata survives closing and reopening the instrument.

## Interface verification approach

The local-preview browser control was blocked by browser security policy. No alternate browser automation was used to bypass it. Connected-interface tests render the real React app in a DOM test environment and exercise the actual forensic functions through a worker adapter. File fetches read the bundled binary fixtures. Audio is isolated in these tests.

The public HTTPS deployment was subsequently tested in the in-app browser. Its actual Web Worker recovered Nacre's PNG at byte 173, Web Crypto matched it against C7-004, recording both findings unlocked the contradictory-claim question, and denial reached Encounter Review. The independent Signal Scope decoded the real 69-byte Vela message. Menu, office, exterior, and instrument views received browser inspection. The desktop instrument columns were adjusted to scroll independently so reaching comparison controls does not scroll away the result panel.

The connected-interface suite covers the full successful shift, Echo-admitted failure, fresh Expo Demo with real recovery/comparison and unlocked contradiction, upload/export round trip, wrong-channel status, settings, keyboard Escape, canceled decisions, and fresh mount reset.

## Required remaining manual checks

- Visual composition, portrait cropping, device hotspot fit, text contrast, mouse and keyboard at 1366×768 and 1920×1080.
- Actual browser download/upload picker round trip (the DOM round trip and actual browser worker execution passed separately).
- Listen to muted/unmuted play and live slider effects; verify supplied sound integrations later.
- Rapid scene changes, reduced-motion transitions, reload resets, and absence of an input-blocking overlay.
- Time the two-minute demo route and a first-player full shift. The 8–12-minute length remains a design target.
- After approved artwork arrives, regenerate fixtures and repeat source-image/context checks.
- Verify deployment and local production fallback on the presenting laptop.

Passing a DOM test is not a substitute for final artwork approval or an actual timed playthrough. Public deployment: https://abyssal-trace.citrusmule33.chatgpt.site
