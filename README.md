# XP Pinball

A browser-playable pinball game themed on classic Windows XP — Luna blue window
chrome, taskbar with Start button and clock, and a green-hill/blue-sky desktop
background in the spirit of the default Bliss wallpaper.

Live: https://xp-pinball-s44k0.surething.host

## Features

- Canvas-based gravity pinball physics
- Two flippers (arrow keys / Z, M) and a chargeable plunger launcher (hold Space)
- Pop bumpers, drop targets, slingshots, combo scoring, persistent high score
- Synthesized sound effects (Web Audio) with a mute toggle
- Touch controls for mobile

## Development

```bash
bun install
bun run dev     # local dev server
bun run build   # production build to dist/
```

Built with Vite + TypeScript.
