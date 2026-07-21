# XP Pinball

A browser-playable pinball game themed on classic Windows XP — Luna blue window
chrome, taskbar with Start button and clock, and a green-hill/blue-sky desktop
background in the spirit of the default Bliss wallpaper.

Live: https://xp-pinball-s44k0.surething.host

Built with [SureThing](https://surething.io/invitation?ref=QAN6KQDP&utm_source=invitation&utm_medium=copy_link&utm_campaign=copy_link) — sign up and we both get bonus credits.

## Summary

A full-featured, Space Cadet-inspired pinball table skinned entirely in
Windows XP chrome — built end-to-end through a conversational vibe-coding
session (see `VIBE_LOG.md` for the full build history). Runs in any browser,
no install or login required.

## Description

XP Pinball reimagines classic table pinball inside a nostalgic Windows XP
desktop window: Luna blue title bar, taskbar with Start button and live clock,
and a Bliss-inspired green-hill wallpaper. Under the retro skin is a real
canvas-based physics engine — gravity, three flippers, a chargeable plunger,
pop bumpers, drop targets, slingshots, and two loop ramps — plus a mission
ladder themed on everyday XP tasks (Boot Windows, Empty Recycle Bin, Run Disk
Defragmenter, Install Updates) that escalates into multiball and harder
levels as you clear it. A floating Clippy assistant cheers you on from the
corner. Playable with keyboard, or touch on mobile.

## Features

- Canvas-based gravity pinball physics
- Three flippers — two main flippers (arrow keys / Z, M) plus a shorter
  upper-left flipper angled like the main left flipper — and a chargeable
  plunger launcher (hold Space)
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

## Build History

See `VIBE_LOG.md` for the full conversational log of how this project was
built, request by request.

