# Cozy Racers

Drive a little kart down a sunny meadow road, collect stars and pass your friends. Bumps only slow you down, and every race ends with a celebration. Made for ages 4–6.

Play at https://jmitchell238.github.io/cozy-racers/. It's one of the games in [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

## Modes

| Mode | Length | Other karts | Notes |
|------|--------|-------------|-------|
| Free Cruise | Endless | 2 | Just collect stars |
| Picnic Path | ~45s | 3 | Short race |
| Meadow Dash | ~60s | 3 | Medium race |
| Star Circuit | ~90s | 4 | Longer race with more stars |

Every race starts with a 3-2-1 countdown, and you start in last place. Your kart is a bit faster than the others, so you can always catch up.

## Controls and pickups

- Drag left/right, or use ← → / A D, to steer
- Nitro (cyan): a short speed boost
- Oil slick: slows you down for a moment
- Bumping another kart: you both bounce and slow down for a moment
- Stars: collect them along the way. Your current place is shown on screen.

## For parents

- No lives, ads, accounts or fail screens. Finishing in any place gets a celebration.
- Calm motion tones the animation down.
- Turn the sound off for quiet car rides.

## Art

Cars, road, trees and oil slicks are from Kenney's [Racing Pack](https://kenney.nl/assets/racing-pack), which is CC0 (public domain). See `assets/CREDITS.md`.

## Files

| Path | Contents |
|------|----------|
| `index.html` | Page and menus |
| `css/style.css` | Styles |
| `js/config.js` | Version, modes, kart colors |
| `js/game.js` | Race logic, drawing, pickups |
| `js/main.js` | Input, screens, service worker registration |
| `manifest.webmanifest`, `sw.js` | PWA |

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker needs `localhost` or HTTPS.

Plain HTML, CSS and canvas with no build step. Installable as a PWA.

## Tests

```bash
node tests/run.mjs
```

## Versioning

When you bump `GAME_VERSION` in `js/config.js`, set `CACHE` in `sw.js` to `'cozy-racers-' + GAME_VERSION`.

## License

Personal project for the family.
