# Abyssal Trace

**Four visitors. One underwater refuge. Who can you trust?**

Abyssal Trace is an underwater mystery and investigation game where you play as the last operator of Pelagic-9, a damaged refuge deep in the ocean.

Four deep-sea creatures arrive looking for shelter, but one is an Echo pretending to be someone else. Question each visitor, investigate their digital evidence, and decide whether to admit or deny them. Your decisions determine the fate of the refuge.

## Features

- Four unique visitors with their own stories and evidence.
- Three interactive digital forensic instruments.
- Dialogue and investigation mechanics that influence your decisions.
- Multiple endings based on who you admit or deny.
- An evidence notebook to track your discoveries.
- A separate Expo Demo for a shorter investigation.
- A standalone instrument workspace for experimenting with forensic tools.

## Digital Forensic Tools

**Recovery Cradle** — Recovers intact PNG images embedded in binary files, introducing file carving and data recovery.

**Signal Scope** — Examines image data and extracts messages using supported least-significant-bit (LSB) encoding.

**Trace Comparator** — Uses SHA-256 hashes to compare files with station archives and identify identical data.

These tools demonstrate real forensic techniques. However, the results don't automatically determine whether a visitor is trustworthy. Players must interpret the evidence and compare it with each visitor's claims.

## How to Play

1. Start a new shift and read the station briefing.
2. Meet visitors outside the refuge and question their stories.
3. Return to the office and use forensic instruments to examine their evidence.
4. Compare your findings with station records and ask follow-up questions.
5. Decide whether to admit or deny each visitor.

Your decisions affect the ending of the game.

## Built With

- **React and TypeScript** — Game interface, dialogue, and state management.
- **Vite** — Development and build tooling.
- **HTML, CSS, and SVG** — Artwork, interface, and animations.
- **fast-png** — PNG processing and file recovery.
- **Web Crypto API** — SHA-256 file hashing.
- **Web Audio API** — Sound effects and audio controls.

## Running Locally

Requires Node.js 22.12+ or a compatible newer version.

Clone the repository and install dependencies:

```bash
git clone https://github.com/Omleteflipper/Abyssal-Trace.git
cd Abyssal-Trace
npm ci
npm run dev
```

Open the local URL displayed in your terminal.

To create a production build:

```bash
npm run build
npm run preview
```

To run the tests:

```bash
npm test
```

## What's Next

I plan to expand Abyssal Trace with more visitors, additional forensic techniques, and more complicated investigations. I'd also like to continue improving the artwork, sound design, and educational aspects of the game.

## Credits

Created for **Technica 2026**.

Built using React, TypeScript, Vite, fast-png, and browser APIs. IBM Plex Sans and IBM Plex Mono are used under the SIL Open Font License. Third-party dependency notices are available in `public/THIRD_PARTY_NOTICES.txt`.

OpenAI tools were used to assist with development and visual assets. The game itself does not use a generative AI model or API during gameplay.
