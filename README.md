# Cozy Racers

Steer a cute kart down a sunny meadow road — collect stars with soft friends, gentle bumps only, **zero fail.** Built for ages **4–6**.

**Play:** https://jmitchell238.github.io/cozy-racers/

Part of [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

---

## Modes

| Mode | Track | Friends | Notes |
|------|-------|---------|-------|
| Free Cruise | Endless | 2 | Collect stars forever |
| Picnic Path | ~45s | 3 | Start last, pass friends |
| Meadow Dash | ~60s | 3 | Medium race |
| Star Circuit | ~90s | 4 | Longer race, more stars |

You start at the **back**. Your kart is a bit faster so you can pass everyone. **Nitro** speeds you up; **oil** and **bumps** slow you down briefly.

## Features

- **Countdown** (3 · 2 · 1 · GO!) — then chase the pack from the back
- **Drag** left/right (or ← → / A D) to steer; your kart is a little faster
- **Nitro** pills (cyan) = short speed boost
- **Oil slicks** (Kenney) = temporary slowdown
- **Bump** a friend = bounce + temporary slowdown
- Collect stars along the way; place shows on the HUD
- **Kenney Racing Pack** (CC0) cars, road, trees, oil
- Never a fail screen — finish is always a celebration
- Sound mute + reduced motion · installable PWA

## Assets

[Kenney Racing Pack](https://kenney.nl/assets/racing-pack) — **CC0** public domain. See `assets/CREDITS.md`.

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
