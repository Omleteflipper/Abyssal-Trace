# Required final asset integration

The supplied plan explicitly allows placeholders during the first build. No approved production images, numbered layout-reference screenshots, or final sound files accompanied this task. The previous four generated creatures are not treated as approved. This document separates required integration from optional polish.

## Required visual targets

| Target | Replacement path / control | Contract |
|---|---|---|
| Office background | `public/assets/backgrounds/office.png` | 1920×1080; devices and door composed together, no baked interactive text. Update `assets.office`. |
| Exterior background | `public/assets/backgrounds/exterior.png` | 1920×1080; visitor left 40–45%, dialogue right. Update `assets.exterior`. |
| Combined title/logo | `public/assets/title.png` | Transparent PNG, title and emblem in one image; accessible HTML title remains. |
| Four visitor portraits | `public/assets/characters/{mira,vela,rook,nacre}.png` | Original species-readable designs, transparent background, consistent crop. Portrait placement is adjustable in the manifest. |
| Three device hover overlays | `public/assets/overlays/{recovery,signal,compare}.png` | Transparent full 1920×1080 canvases registered exactly to the office background. See full-canvas integration note below. |
| Three source scenes | `public/assets/evidence-sources/` | 8-bit RGB/RGBA non-interlaced PNGs; around 512×384 or 512×512. Junction needs both pre-repair and repaired variants. |

The thirteen production images in the proposal are target assets, not existing approved deliverables. Current original SVG versions and procedural PNG source scenes keep all gameplay functional.

## Placement and crops

`src/game/assets.ts` centralizes background paths, portrait width/height/left/top, object fit/origin, device rectangles, and door position. Percentages are relative to the 16:9 scene. Inspect at 1366×768 and 1920×1080 and confirm label readability, portrait scale, and every clickable rectangle against the approved image. Do not move the dialogue panel merely to fit an oversized portrait; adjust the portrait crop first.

Use broad flat shadows, economical contours, selected cyan/mint highlights, and restrained bloom. Do not turn the squid into the only visually threatening character. Every species may look strained or strange. No gore, glossy 3D modeling, mascot tracing, or uniform teal wash is needed.

Final full-canvas overlays are rendered by the office’s full-stage overlay layer using the exact source dimensions. Set each device's `overlay` path in the manifest. Current temporary device illumination uses CSS on the hotspot itself. Do not shrink a full-room overlay into a device rectangle. Align overlays and hit rectangles together after the final room is approved.

## Evidence replacement procedure

1. Place approved sources as `junction-approved.png`, `junction-repaired-approved.png`, `pump-approved.png`, and `corridor-approved.png` in `public/assets/evidence-sources/`. The two junction images must clearly show the before/after copper bridge. The repaired variant currently requires 8-bit RGB.
2. Run `npm run fixtures`. This creates metadata, LSB payloads, deterministic padding, archive references, and the fixture manifest. Never resize, repaint, or recompress the finished encoded evidence afterward.
3. Run `npm test` and `npm run build`. Rook and Nacre must remain byte-identical to the C7 archive; Mira’s repaired image must differ from J4’s old reference; Vela’s RGB message must still decode.
4. Play the four cases, inspect the images at their actual instrument-preview size, and confirm that visual context agrees with the station records.

Critical times and text are code-authored, not image-generated. The archive receipt is independent authored station data. Existing `*-provisional.png` files are retained for reproducibility and may be removed from final packaging only after approved sources are verified.

## Audio integration

Set licensed bundled audio paths in `src/audio/mixer.ts`; null paths remain silent or use a small procedural tone. Current ambience uses a low synthesized oscillator. No missing null asset is fetched. Each event has a category and feeds the master gain. Test both currently playing loops and future effects while moving sliders. Bound voice overlap and stop or fade old scene loops during transitions.

Required groups: office/exterior ambience, optional music, radio static; arrival, door and intake; interface hover/click/close/preview/dialogue; separate instrument focus sounds; scan/working/found/channel/decode/compare/empty/error; record/notebook; four optional voice hooks; confirmation/admission/denial/occupancy/endings. Several events may share one supplied recording.

## Required checks after replacement

- Inspect all portrait crops, label contrast, title legibility, and hotspot/hover alignment at laptop size.
- Check both scene transitions, muted play, reduced motion, rapid navigation, and missing-image fallback.
- Rehearse the demo within two minutes; measure a first-player full shift before claiming an 8–12 minute duration.
- Check deployed asset paths and local production preview. Update credits with actual authors, licenses, and AI assistance.

Optional later work: alternate expressions, bespoke ending paintings, custom cursor, advanced particles, larger pixel zoom controls, separate music, full voices, slide deck, and backup recording. These are separate from the required asset pass.
