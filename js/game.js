'use strict';

/** @type {'menu'|'play'|'win'} */
let state = 'menu';

let modeId = 'picnic';
/** Distance traveled along the track (world units) */
let distance = 0;
/** Race length; 0 = endless free cruise */
let raceDistance = 0;
/** Stars collected this run */
let sessionStars = 0;
/** Target stars for modes that care (soft goal for HUD; finish is distance-based) */
let starGoal = 0;

/** Player horizontal position (screen x) */
let playerX = ROAD_CENTER;
/** Desired steer target from input */
let steerTarget = ROAD_CENTER;
/** Soft lateral velocity for bounce */
let playerVx = 0;
/** Current forward speed */
let speed = 150;
/** Base mode speed */
let baseSpeed = 150;
/** Palette index for player car */
let playerPalette = 0;
/** Wiggle / bounce visual */
let playerBob = 0;
let shake = 0;

/** @type {{ worldY: number, x: number, vx: number, palette: number, name: string, bob: number }[]} */
let friends = [];
/** @type {{ worldY: number, x: number, kind: 'star'|'flower'|'balloon', taken: boolean, phase: number }[]} */
let pickups = [];

let skyPhase = 0;
let winFlash = 0;
let hintTimer = 0;
let showHint = false;
let engineTimer = 0;
/** Soft input: pointer down for steering */
let steering = false;
let lastSteerX = ROAD_CENTER;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleWith(arr, rng) {
  const a = arr.slice();
  const r = rng || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentMode() {
  return MODES[modeId] || MODES.picnic;
}

/**
 * Soft road bounds for car center x (keeps wheels mostly on road).
 * @param {number} [pad=18]
 */
function roadBounds(pad = 18) {
  return { min: ROAD_LEFT + pad, max: ROAD_RIGHT - pad };
}

/**
 * Is a car center fully off the cozy road? Soft — margins allowed.
 * @param {number} x
 */
function isOffRoad(x) {
  return x < ROAD_LEFT - 8 || x > ROAD_RIGHT + 8;
}

/**
 * Soft collision response: separate two circles, return new positions + impulse.
 * @returns {{ ax: number, bx: number, hit: boolean }}
 */
function softCollide(ax, ay, bx, by, radius) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy) || 0.01;
  const minD = radius * 2;
  if (dist >= minD) return { ax, bx, hit: false };
  const push = (minD - dist) / 2;
  const nx = dx / dist;
  return {
    ax: ax - nx * push,
    bx: bx + nx * push,
    hit: true,
  };
}

/**
 * Circle hit test (pickup vs player).
 * @param {number} px
 * @param {number} py
 * @param {number} ox
 * @param {number} oy
 * @param {number} r
 */
function circleHit(px, py, ox, oy, r) {
  const dx = px - ox;
  const dy = py - oy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * World Y → screen Y given camera distance (player fixed at PLAYER_Y).
 * Objects ahead have higher worldY than distance.
 */
function worldToScreenY(worldY, camDistance) {
  return PLAYER_Y - (worldY - camDistance);
}

/**
 * Screen Y → approximate world Y
 */
function screenToWorldY(screenY, camDistance) {
  return camDistance + (PLAYER_Y - screenY);
}

/**
 * Progress 0–1 for finite races; free cruise returns 0.
 * @param {number} dist
 * @param {number} total
 */
function raceProgress(dist, total) {
  if (!total || total <= 0) return 0;
  return clamp(dist / total, 0, 1);
}

/**
 * Did the racer finish?
 * @param {number} dist
 * @param {number} total
 */
function hasFinished(dist, total) {
  if (!total || total <= 0) return false;
  return dist >= total;
}

/**
 * Build friend racers for a mode.
 * @param {number} count
 * @param {() => number} [rng]
 */
function spawnFriends(count, rng) {
  const r = rng || Math.random;
  const n = Math.max(0, count | 0);
  const pals = shuffleWith(FRIEND_NAMES.slice(), r);
  const palsIdx = shuffleWith(
    CAR_PALETTES.map((_, i) => i).filter(i => i !== (save.carIndex | 0)),
    r
  );
  const bounds = roadBounds(28);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = r();
    out.push({
      worldY: 180 + i * 220 + r() * 80,
      x: lerp(bounds.min, bounds.max, t),
      vx: 0,
      palette: palsIdx[i % palsIdx.length] | 0,
      name: pals[i % pals.length],
      bob: r() * Math.PI * 2,
      speedMul: 0.85 + r() * 0.25,
    });
  }
  return out;
}

/**
 * Scatter pickups along the track.
 * @param {number} totalDist - race length (or a window for free)
 * @param {number} count
 * @param {() => number} [rng]
 */
function spawnPickups(totalDist, count, rng) {
  const r = rng || Math.random;
  const n = Math.max(0, count | 0);
  const bounds = roadBounds(24);
  const span = Math.max(800, totalDist || 2400);
  const out = [];
  const kinds = ['star', 'star', 'star', 'flower', 'star', 'balloon'];
  for (let i = 0; i < n; i++) {
    out.push({
      worldY: 120 + (span * (i + 0.5) / n) + (r() - 0.5) * 40,
      x: lerp(bounds.min, bounds.max, r()),
      kind: kinds[i % kinds.length],
      taken: false,
      phase: r() * Math.PI * 2,
    });
  }
  return out;
}

/**
 * Apply collection for one pickup if overlapping player.
 * Pure: returns new state flags without side effects.
 * @returns {'star'|'flower'|'balloon'|null}
 */
function tryCollectPickup(pickup, px, py, camDistance) {
  if (!pickup || pickup.taken) return null;
  const sy = worldToScreenY(pickup.worldY, camDistance);
  if (sy < -40 || sy > H + 40) return null;
  const r = pickup.kind === 'balloon' ? 22 : STAR_R + 10;
  if (!circleHit(px, py, pickup.x, sy, r + CAR_R * 0.55)) return null;
  return pickup.kind;
}

/**
 * Steer target from pointer x — full road with soft clamp.
 * @param {number} x
 */
function steerFromPointer(x) {
  const b = roadBounds(14);
  return clamp(x, b.min - 10, b.max + 10);
}

/**
 * Advance player x toward target with soft velocity + road bounce.
 * @returns {{ x: number, vx: number, off: boolean }}
 */
function stepSteer(x, vx, target, dt) {
  const pull = (target - x) * 8;
  let nvx = vx * 0.82 + pull * dt;
  nvx = clamp(nvx, -420, 420);
  let nx = x + nvx * dt;
  const b = roadBounds(12);
  let off = false;
  if (nx < b.min - 20 || nx > b.max + 20) off = true;
  // Soft wall at wide margin — never hard stop off-screen
  if (nx < 30) { nx = 30; nvx = Math.abs(nvx) * 0.3; }
  if (nx > W - 30) { nx = W - 30; nvx = -Math.abs(nvx) * 0.3; }
  // Gentle spring back toward road if far off
  if (nx < b.min) nvx += (b.min - nx) * 6 * dt;
  if (nx > b.max) nvx += (b.max - nx) * 6 * dt;
  return { x: nx, vx: nvx, off };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

function enterMenu() {
  state = 'menu';
  clearParticles();
  steering = false;
}

function enterPlay(forceMode) {
  state = 'play';
  modeId = forceMode || save.mode || 'picnic';
  const m = currentMode();
  raceDistance = m.distance | 0;
  starGoal = m.starGoal | 0;
  baseSpeed = m.speed || 150;
  speed = baseSpeed;
  distance = 0;
  sessionStars = 0;
  playerX = ROAD_CENTER;
  steerTarget = ROAD_CENTER;
  playerVx = 0;
  playerBob = 0;
  shake = 0;
  playerPalette = save.carIndex | 0;
  winFlash = 0;
  hintTimer = 0;
  showHint = false;
  engineTimer = 0;
  steering = false;

  const span = raceDistance > 0 ? raceDistance : 2800;
  const starCount = raceDistance > 0
    ? Math.max(starGoal + 4, 12)
    : 24;
  friends = spawnFriends(m.friends | 0);
  pickups = spawnPickups(span, starCount);
  clearParticles();

  setTimeout(() => {
    if (state === 'play') speakCheer('Ready, set, go!');
  }, 280);
}

function enterWin() {
  state = 'win';
  winFlash = 1.6;
  steering = false;
  sfxFinish();
  spawnBurst(W / 2, H * 0.35, '#FFD54F', 30);
  spawnBurst(W / 2, H * 0.4, '#EF5350', 16);
  spawnPraise(W / 2, H * 0.28, 'Finish!');
  recordRace();
  speakCheer('You finished! Great race!');
}

// ---------------------------------------------------------------------------
// Input + gameplay
// ---------------------------------------------------------------------------

function setSteerX(x) {
  steerTarget = steerFromPointer(x);
  lastSteerX = steerTarget;
  steering = true;
  hintTimer = 0;
  showHint = false;
}

function clearSteer() {
  steering = false;
}

/**
 * Collect pickup at index with side effects (audio/particles/save).
 * @returns {boolean}
 */
function collectAt(i) {
  const p = pickups[i];
  if (!p || p.taken) return false;
  const kind = tryCollectPickup(p, playerX, PLAYER_Y, distance);
  if (!kind) return false;
  p.taken = true;
  const sy = worldToScreenY(p.worldY, distance);

  if (kind === 'star') {
    sessionStars++;
    recordStar(1);
    sfxStar();
    spawnBurst(p.x, sy, '#FFD54F', 12);
    spawnPraise(p.x, sy - 20, PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  } else if (kind === 'flower') {
    sfxFlower();
    spawnBurst(p.x, sy, '#F48FB1', 10);
    spawnPraise(p.x, sy - 18, 'Pretty!');
  } else if (kind === 'balloon') {
    sfxStar();
    speed = Math.min(baseSpeed * 1.35, speed + 40);
    spawnBurst(p.x, sy, '#42A5F5', 14);
    spawnPraise(p.x, sy - 18, 'Boost!');
  }
  return true;
}

function updatePlay(dt) {
  if (state !== 'play') return;

  skyPhase += dt;
  playerBob += dt * 10;
  engineTimer += dt;
  hintTimer += dt;

  // Soft engine putter
  if (engineTimer > 0.35 && !save.reducedMotion) {
    engineTimer = 0;
    sfxEngineTick();
  }

  // Speed: soft off-road slowdown, ease back to base
  const off = isOffRoad(playerX);
  const targetSpd = off ? baseSpeed * 0.72 : baseSpeed;
  speed = lerp(speed, targetSpd, 1 - Math.pow(0.001, dt));
  // Balloon boost decay
  if (speed > baseSpeed) speed = lerp(speed, baseSpeed, 1 - Math.pow(0.05, dt));

  distance += speed * dt;

  // Steering
  if (!steering) {
    // Gentle auto-center toward road middle when not touching — still free
    steerTarget = lerp(steerTarget, ROAD_CENTER, 1 - Math.pow(0.15, dt));
  }
  const stepped = stepSteer(playerX, playerVx, steerTarget, dt);
  playerX = stepped.x;
  playerVx = stepped.vx;

  // Exhaust trail
  if (!save.reducedMotion && Math.random() < 0.4) {
    spawnTrail(playerX, PLAYER_Y + 24, 'rgba(255,255,255,0.35)');
  }

  // Friends AI — wander softly on road, match race pace
  const b = roadBounds(22);
  for (const f of friends) {
    f.bob += dt * 8;
    // Move forward relative to track (their worldY increases)
    f.worldY += speed * f.speedMul * 0.92 * dt;
    // Gentle lateral wander
    f.vx += (Math.sin(f.bob * 0.35 + f.worldY * 0.01) * 40 - f.vx) * dt * 2;
    f.x += f.vx * dt;
    f.x = clamp(f.x, b.min, b.max);

    // Soft collide with player (screen space)
    const fy = worldToScreenY(f.worldY, distance);
    if (fy > -80 && fy < H + 80) {
      const hit = softCollide(playerX, PLAYER_Y, f.x, fy, CAR_R * 0.85);
      if (hit.hit) {
        playerX = hit.ax;
        f.x = clamp(hit.bx, b.min, b.max);
        playerVx *= 0.5;
        f.vx *= -0.4;
        shake = 0.12;
        sfxBump();
      }
    }
  }

  // Friend vs friend soft separation
  for (let i = 0; i < friends.length; i++) {
    for (let j = i + 1; j < friends.length; j++) {
      const a = friends[i];
      const b2 = friends[j];
      const ay = worldToScreenY(a.worldY, distance);
      const by = worldToScreenY(b2.worldY, distance);
      const hit = softCollide(a.x, ay, b2.x, by, CAR_R * 0.8);
      if (hit.hit) {
        a.x = clamp(hit.ax, b.min, b.max);
        b2.x = clamp(hit.bx, b.min, b.max);
      }
    }
  }

  // Pickups
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i];
    if (p.taken) continue;
    p.phase += dt * 3;
    collectAt(i);
  }

  // Free mode: recycle pickups ahead when far behind
  if (!raceDistance) {
    for (const p of pickups) {
      if (p.taken && p.worldY < distance - 100) {
        p.taken = false;
        p.worldY = distance + 600 + Math.random() * 900;
        p.x = lerp(b.min, b.max, Math.random());
        p.kind = Math.random() < 0.7 ? 'star' : (Math.random() < 0.5 ? 'flower' : 'balloon');
      }
    }
    // Recycle friends
    for (const f of friends) {
      if (f.worldY < distance - 200) {
        f.worldY = distance + 400 + Math.random() * 600;
        f.x = lerp(b.min, b.max, Math.random());
      }
    }
  }

  if (shake > 0) shake = Math.max(0, shake - dt);

  // Hint: nudge to touch after idle
  if (hintTimer > HINT_AFTER && !steering) showHint = true;

  // Finish line
  if (hasFinished(distance, raceDistance)) {
    enterWin();
  }

  updateParticles(dt);
}

function updateWin(dt) {
  skyPhase += dt;
  winFlash = Math.max(0, winFlash - dt);
  updateParticles(dt);
  if (!save.reducedMotion && Math.random() < 0.08) {
    spawnBurst(40 + Math.random() * (W - 80), 80 + Math.random() * 200, '#FFD54F', 6);
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawSky(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#87CEEB');
  g.addColorStop(0.45, '#B3E5FC');
  g.addColorStop(1, '#C8E6C9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft sun
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#FFF59D';
  ctx.beginPath();
  ctx.arc(W - 56, 54 + Math.sin(skyPhase * 0.4) * 2, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Clouds
  const drawCloud = (cx, cy, s) => {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 22 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 16 * s, cy + 2, 14 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 16 * s, cy + 3, 14 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const drift = (skyPhase * 12) % (W + 80);
  drawCloud(-40 + drift, 70, 1.1);
  drawCloud(-40 + (drift + 160) % (W + 80), 110, 0.85);
  drawCloud(-40 + (drift + 280) % (W + 80), 55, 0.7);
}

function drawMeadowSides(ctx) {
  // Left / right grass
  ctx.fillStyle = '#81C784';
  ctx.fillRect(0, 0, ROAD_LEFT - 2, H);
  ctx.fillRect(ROAD_RIGHT + 2, 0, W - ROAD_RIGHT, H);

  // Grass blades / flowers scrolling with distance
  const scroll = distance % 40;
  for (let y = -40; y < H + 40; y += 28) {
    const yy = y + scroll;
    // Left flowers
    const fx = 18 + ((Math.floor((distance + y) / 28) * 17) % 40);
    ctx.fillStyle = (Math.floor((distance + y) / 28) % 3 === 0) ? '#F48FB1' : '#FFD54F';
    ctx.beginPath();
    ctx.arc(fx, yy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Right
    const fx2 = W - 18 - ((Math.floor((distance + y) / 28) * 13) % 36);
    ctx.fillStyle = (Math.floor((distance + y) / 28) % 2 === 0) ? '#CE93D8' : '#FFF176';
    ctx.beginPath();
    ctx.arc(fx2, yy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft bushes
  ctx.fillStyle = '#66BB6A';
  for (let i = 0; i < 6; i++) {
    const yy = ((i * 130 + distance * 0.4) % (H + 80)) - 40;
    ctx.beginPath();
    ctx.ellipse(22, yy, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W - 22, yy + 40, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoad(ctx) {
  // Road body
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(ROAD_LEFT, 0, ROAD_W, H);

  // Soft edge lines
  ctx.strokeStyle = '#FFF8E1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ROAD_LEFT + 3, 0);
  ctx.lineTo(ROAD_LEFT + 3, H);
  ctx.moveTo(ROAD_RIGHT - 3, 0);
  ctx.lineTo(ROAD_RIGHT - 3, H);
  ctx.stroke();

  // Dashed center
  const dashH = 28;
  const gap = 22;
  const period = dashH + gap;
  const offset = distance % period;
  ctx.strokeStyle = 'rgba(255,248,225,0.85)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let y = -period + offset; y < H + period; y += period) {
    ctx.beginPath();
    ctx.moveTo(ROAD_CENTER, y);
    ctx.lineTo(ROAD_CENTER, y + dashH);
    ctx.stroke();
  }

  // Finish line stripe band
  if (raceDistance > 0) {
    const fy = worldToScreenY(raceDistance, distance);
    if (fy > -60 && fy < H + 60) {
      ctx.fillStyle = '#FFF8E1';
      ctx.fillRect(ROAD_LEFT, fy - 10, ROAD_W, 20);
      const cells = 10;
      const cw = ROAD_W / cells;
      for (let i = 0; i < cells; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#212121' : '#FFF8E1';
        ctx.fillRect(ROAD_LEFT + i * cw, fy - 10, cw, 20);
      }
      ctx.fillStyle = '#FF7043';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', ROAD_CENTER, fy - 18);
    }
  }
}

/**
 * Draw a cute rounded kart facing up the road.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} paletteIndex
 * @param {{ scale?: number, bob?: number, name?: string, isPlayer?: boolean }} [opts]
 */
function drawCar(ctx, x, y, paletteIndex, opts = {}) {
  const pal = CAR_PALETTES[paletteIndex % CAR_PALETTES.length];
  const scale = opts.scale || 1;
  const bob = opts.bob || 0;
  const w = PLAYER_W * scale;
  const h = PLAYER_H * scale;
  const dy = Math.sin(bob) * 2 * scale;

  ctx.save();
  ctx.translate(x, y + dy);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.42, w * 0.42, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  bodyGrad.addColorStop(0, pal.body);
  bodyGrad.addColorStop(1, pal.dark);
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, -w / 2, -h / 2, w, h * 0.85, 12 * scale);
  ctx.fill();

  // Cabin / windshield
  ctx.fillStyle = 'rgba(227,242,253,0.95)';
  roundRect(ctx, -w * 0.28, -h * 0.38, w * 0.56, h * 0.32, 8 * scale);
  ctx.fill();

  // Accent stripe
  ctx.fillStyle = pal.accent;
  roundRect(ctx, -w * 0.12, -h * 0.08, w * 0.24, h * 0.35, 4 * scale);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#37474F';
  const wr = 7 * scale;
  ctx.beginPath();
  ctx.arc(-w * 0.38, h * 0.22, wr, 0, Math.PI * 2);
  ctx.arc(w * 0.38, h * 0.22, wr, 0, Math.PI * 2);
  ctx.arc(-w * 0.38, -h * 0.28, wr * 0.9, 0, Math.PI * 2);
  ctx.arc(w * 0.38, -h * 0.28, wr * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#90A4AE';
  ctx.beginPath();
  ctx.arc(-w * 0.38, h * 0.22, wr * 0.4, 0, Math.PI * 2);
  ctx.arc(w * 0.38, h * 0.22, wr * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Cute face on hood
  ctx.fillStyle = '#5D4037';
  ctx.beginPath();
  ctx.arc(-6 * scale, h * 0.08, 2.2 * scale, 0, Math.PI * 2);
  ctx.arc(6 * scale, h * 0.08, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.arc(0, h * 0.14, 5 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Player halo
  if (opts.isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.55, h * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Name plate for friends
  if (opts.name) {
    ctx.font = `bold ${11 * scale}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(opts.name, 1, -h * 0.52 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(opts.name, 0, -h * 0.52);
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPickup(ctx, p) {
  if (p.taken) return;
  const sy = worldToScreenY(p.worldY, distance);
  if (sy < -50 || sy > H + 50) return;
  const bob = Math.sin(p.phase) * 4;

  ctx.save();
  ctx.translate(p.x, sy + bob);

  if (p.kind === 'star') {
    ctx.fillStyle = '#FFD54F';
    ctx.strokeStyle = '#F9A825';
    ctx.lineWidth = 2;
    drawStarPath(ctx, 0, 0, 5, 14, 6);
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'flower') {
    const cols = ['#F48FB1', '#CE93D8', '#FFCC80'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 7, Math.sin(a) * 7, 6, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFEE58';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // balloon
    ctx.fillStyle = '#42A5F5';
    ctx.beginPath();
    ctx.ellipse(0, -4, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(4, 18, 0, 24);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStarPath(ctx, cx, cy, spikes, outer, inner) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
  }
  ctx.closePath();
}

function drawHud(ctx) {
  // Top bar
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, 56, 10, W - 112, 52, 14);
  ctx.fill();

  ctx.fillStyle = '#FFD54F';
  ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ ' + sessionStars, 72, 36);

  if (raceDistance > 0) {
    const prog = raceProgress(distance, raceDistance);
    const barX = 150;
    const barW = W - 220;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, barX, 28, barW, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#81C784';
    roundRect(ctx, barX, 28, Math.max(8, barW * prog), 14, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = '#E8F5E9';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Free cruise', W / 2 + 20, 36);
  }
  ctx.restore();

  if (showHint) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(skyPhase * 4) * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, W / 2 - 110, H - 90, 220, 36, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Drag left & right to steer', W / 2, H - 72);
    ctx.restore();
  }
}

function drawPlay(ctx) {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
  }

  drawSky(ctx);
  drawMeadowSides(ctx);
  drawRoad(ctx);

  // Pickups behind cars
  const sortedPickups = pickups.slice().sort((a, b) => b.worldY - a.worldY);
  for (const p of sortedPickups) drawPickup(ctx, p);

  // Friends sorted by depth (far first)
  const sorted = friends.slice().sort((a, b) => b.worldY - a.worldY);
  for (const f of sorted) {
    const sy = worldToScreenY(f.worldY, distance);
    if (sy < -80 || sy > H + 80) continue;
    drawCar(ctx, f.x, sy, f.palette, { bob: f.bob, name: f.name, scale: 0.92 });
  }

  // Player
  drawCar(ctx, playerX, PLAYER_Y, playerPalette, {
    bob: playerBob,
    isPlayer: true,
    scale: 1,
  });

  drawHud(ctx);
  drawParticles(ctx);
  ctx.restore();
}

function drawMenuBackdrop(ctx) {
  drawSky(ctx);
  drawMeadowSides(ctx);
  drawRoad(ctx);
  // Parade of cars
  const t = skyPhase;
  drawCar(ctx, ROAD_CENTER + Math.sin(t) * 20, H * 0.55, save.carIndex | 0, {
    bob: t * 6,
    isPlayer: true,
    scale: 1.15,
  });
  drawCar(ctx, ROAD_LEFT + 50, H * 0.38, 1, { bob: t * 5 + 1, name: 'Pip', scale: 0.85 });
  drawCar(ctx, ROAD_RIGHT - 50, H * 0.42, 2, { bob: t * 5 + 2, name: 'Momo', scale: 0.85 });
  // Floating stars
  ctx.fillStyle = '#FFD54F';
  for (let i = 0; i < 5; i++) {
    const x = 50 + i * 70;
    const y = 100 + Math.sin(t * 2 + i) * 10;
    drawStarPath(ctx, x, y, 5, 10, 4);
    ctx.fill();
  }
  updateParticles(0);
  drawParticles(ctx);
}

function drawWinScene(ctx) {
  drawSky(ctx);
  drawMeadowSides(ctx);
  drawRoad(ctx);
  drawCar(ctx, ROAD_CENTER, H * 0.5, playerPalette, {
    bob: skyPhase * 8,
    isPlayer: true,
    scale: 1.2,
  });
  // Friends cheer
  friends.slice(0, 3).forEach((f, i) => {
    drawCar(ctx, 70 + i * 120, H * 0.68, f.palette, {
      bob: skyPhase * 6 + i,
      name: f.name,
      scale: 0.8,
    });
  });
  drawParticles(ctx);

  // Stars badge
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, W / 2 - 70, 90, 140, 40, 12);
  ctx.fill();
  ctx.fillStyle = '#FFD54F';
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ ' + sessionStars + ' stars', W / 2, 110);
  ctx.restore();
}
