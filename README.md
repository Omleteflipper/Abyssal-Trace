# Abyssal Trace

A playable initial build of the underwater inspection-survival game in the supplied October 17, 2026 plan. Four arrivals, two views, three real forensic instruments, consequential decisions, two endings, an evidence debrief, a separate Expo Demo, and an independent file workspace.

**Art status:** provisional original SVG environments, portraits, and title; procedural environmental PNGs and synthesized audio placeholders. This is the initial implementation milestone, not the visually finished submission. Approved final assets, supplied sounds, and actual laptop visual/playthrough rehearsal remain required integration work.

## Run locally

Requires Node.js 22.12+ or a current compatible release. This build was checked with Node 24.14.0. From this folder:

```sh
npm ci
npm run dev
```

Open the Local URL printed in the terminal. For the production presentation backup:

```sh
npm run build
npm run preview
```

Do not open `dist/index.html` directly with a file URL: browser workers, evidence loading, and Web Crypto need HTTP on localhost or HTTPS. The `dist` folder is a portable static build with relative asset paths. No API keys, paid services, game server, database, runtime AI, accounts, saves, analytics, or service worker are used by the game. Hosting may separately control who can access the preview.

```sh
npm run fixtures       # deterministically regenerate real evidence
npm test               # forensic, decision, and connected-interface tests
npm run build          # TypeScript check and production bundle
```

## Play

- **New Shift:** read the brief, use the rear airlock to question each arrival and receive a recorder. Return to the office and use its instruments. Record observations to unlock follow-up questions. Independently stored station records are always in the notebook. Choose Admit or Deny and confirm. There is no timer or mandatory tool checklist.
- **Expo Demo:** one fresh Nacre encounter using the same components and byte-analysis functions. No discoveries are precomputed. Completing it opens Encounter Review, not a full-shift ending.
- **Open Instruments:** inspect bundled samples or local uploads and export original recovered PNGs or decoded text. Files stay in memory in the browser and are never uploaded by game code.
- **Settings:** master, ambience, effects, and voice gains; instant text; reduced motion. Category gain multiplies master gain. Settings and game state reset on reload.

Ending rules: secure until dawn if no Echo is admitted and at least one genuine arrival is admitted. The refuge falls if the Echo enters or all genuine arrivals are denied. All sixteen combinations are covered by tests. Decisions never produce an immediate identity verdict.

## What the instruments really do

**Recovery Cradle:** scans eight-byte PNG signatures, walks bounded declared chunk lengths, checks IHDR, chunk CRCs, IDAT and IEND structure, then validates decoding with fast-png. Lists valid and rejected candidates. Only intact embedded PNGs are recovered; missing or fragmented pixels are not reconstructed.

**Signal Scope:** reads 8-bit non-interlaced RGB/RGBA PNG pixels in row order, ignoring alpha. One least-significant bit per chosen color component; bits assemble MSB-first. Supported framing: ASCII `P9LSB1`, two-byte unsigned big-endian UTF-8 byte length, then the message. RGB is the station default; R/G/B are exploratory alternatives. A missing header does not establish that an image has no other hidden information. LSB is concealment, not encryption.

**Trace Comparator:** calculates SHA-256 on both original inputs through Web Crypto, checks byte counts, and reports identical or different bytes. The station receipt is separately authored data. A duplicate is not an identity verdict; recompression or metadata changes can change bytes without changing a picture's meaning.

Uploads are capped at 8 MiB; PNGs at 4 million pixels, 64 candidate signatures, 4,096 chunks per candidate, and a 16-million-pixel aggregate scan budget. Parsing runs in a disposable worker with a 10-second deadline. Unsupported, corrupt, and truncated files produce explicit statuses. Text renders through React as text, never injected HTML.

## Where to change things

| Purpose | File |
|---|---|
| Screen routing, shared in-memory state | `src/app/App.tsx`, `src/app/state.ts` |
| Typed encounters, dialogue, records, endings | `src/game/content.ts` |
| Asset paths, portrait placement, device bounds | `src/game/assets.ts` |
| Reusable device panels, sources, previews, exports | `src/components/Instruments.tsx` |
| Pure forensic functions and worker | `src/tools/` |
| Audio event manifest, category gains, scene cleanup | `src/audio/mixer.ts` |
| Visual tokens, rooms, overlays, responsive layout | `src/styles/main.css` |
| Deterministic binary evidence construction | `scripts/generate-evidence.ts` |
| Generated fixtures and manifest | `public/evidence/` |
| Original provisional art | `public/assets/` |

The same instrument component and worker-backed pure functions serve the full shift, demo, and independent workspace. Story identities never enter the analysis functions. Story follow-up triggers require a recorded relevant observation on an actual received module; local-file experiments cannot fabricate a case discovery.

See `docs/ASSET-INTEGRATION.md`, `docs/DEMO-SCRIPT.md`, `docs/IMPLEMENTATION-HANDOFF.md`, and `docs/VALIDATION.md` for the remaining integration pass and handoff.

## Sources and licenses

Implementation references: [PNG specification](https://www.w3.org/TR/png-3/), [fast-png API](https://github.com/image-js/fast-png), [Web Crypto digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest), [Vite static deployment](https://vite.dev/guide/static-deploy.html).

Fonts are bundled IBM Plex Sans and IBM Plex Mono, SIL OFL-1.1. Runtime dependencies React, React DOM, and fast-png use MIT licenses. All installed dependency notices are bundled in `public/THIRD_PARTY_NOTICES.txt`. `scripts/prepare-notices.mjs` regenerates notices and pins installed package versions in both package manifests.

No reference game's characters, dialogue, or artwork are copied. Provisional original code, dialogue, procedural images, and SVG illustrations were created with OpenAI Codex; disclose that assistance in submission materials.
