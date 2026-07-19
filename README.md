# Cozy Racers

Steer a cute kart down a sunny meadow road — collect stars with soft friends, gentle bumps only, **zero fail.** Built for ages **4–6**.

**Play:** https://jmitchell238.github.io/cozy-racers/

Part of [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

---

## Modes

| Mode | Track | Friends | Notes |
|------|-------|---------|-------|
| Free Cruise | Endless | 1 | Collect stars forever |
| Picnic Path | Short | 1 | Cozy first race |
| Meadow Dash | Medium | 2 | A little more zoom |
| Star Circuit | Longer | 3 | More stars & friends |

## Features

- **Drag** left/right (or ← → / A D) to steer
- Auto-forward on a warm dirt road through the meadow
- Collect **stars**, flowers, and boost balloons
- Soft friend racers — bumps bounce gently, no knock-outs
- Off-road only slows you; soft spring back — never a crash screen
- Pick a kart color (Berry, Sky, Leaf, Honey, Plum, Teal)
- Sound mute + reduced motion
- Installable PWA (offline after first visit)

## Stack

Static HTML / CSS / Canvas. No build step.

| Path | Purpose |
|------|---------|
| `index.html` | Shell + menu chrome |
| `css/style.css` | Layout / kid-friendly UI |
| `js/config.js` | Version, modes, car palettes |
| `js/game.js` | Race sim, drawing, pickups |
| `js/main.js` | Input, screens, SW register |
| `manifest.webmanifest` + `sw.js` | PWA |

## Tests

```bash
node tests/run.mjs
```

## Versioning

- `GAME_VERSION` in `js/config.js` — `MAJOR.MINOR.PATCH` (patch zero-padded to 3 digits)
- Keep `CACHE` in `sw.js` in sync: `'cozy-racers-' + GAME_VERSION`

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Service workers need **http://localhost** or **https**.

## Parents

- No lives, ads, accounts, or fail screens
- Soft competition only — finish is always a celebration
- Use **Calm motion** if animations are too busy
- **Sound off** for quiet car rides

## License

Personal project for family Arcade Hub.
