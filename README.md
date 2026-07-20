# XP Pinball

A browser-playable pinball game themed on classic Windows XP — Luna blue window
chrome, taskbar with Start button and clock, and a green-hill/blue-sky desktop
background in the spirit of the default Bliss wallpaper.

Live: https://xp-pinball-s44k0.surething.host

## Features

- Canvas-based gravity pinball physics
- Three flippers — two main flippers (arrow keys / Z, M) plus a shared upper
  "apex" flipper — and a chargeable plunger launcher (hold Space)
- Two loop/ramp shots (Recycle Ramp, Update Ramp) that capture the ball on an
  upward hit and re-launch it near the top of the field
- Pop bumpers, a persistent drop-target bank, slingshots, combo scoring
- A 4-mission ladder per level (Boot Windows → Empty Recycle Bin → Run Disk
  Defragmenter → Install Updates); clearing it awards a big bonus, levels up,
  and triggers a 2-ball multiball
- Per-ball drain bonus, persistent high score
- Synthesized sound effects (Web Audio) with a mute toggle
- Touch controls for mobile
- Floating Clippy assistant with random pep-talk speech bubbles

## Development

```bash
bun install
bun run dev     # local dev server
bun run build   # production build to dist/
```

Built with Vite + TypeScript.
