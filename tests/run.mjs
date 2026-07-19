#!/usr/bin/env node
/**
 * Cozy Racers — unit + shell tests (no browser / no deps).
 * Run: node tests/run.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    process.stdout.write('.');
    return;
  }
  failed++;
  failures.push(msg);
  console.error('\n  ✗', msg);
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function assertClose(a, b, eps, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (got ${a}, expected ~${b} ±${eps})`);
}

function section(name) {
  process.stdout.write('\n• ' + name + ' ');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGame(opts = {}) {
  const files = [
    'js/config.js',
    'js/save.js',
    'js/audio.js',
    'js/particles.js',
    'js/game.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_NAME, W, H, MODES, MODE_ORDER, CAR_PALETTES, FRIEND_NAMES,
      ROAD_W, ROAD_LEFT, ROAD_RIGHT, ROAD_CENTER, PLAYER_Y, CAR_R, STAR_R, HINT_AFTER,
      SAVE_KEY, PRAISE,
      clamp, lerp, shuffle, shuffleWith, currentMode, roadBounds, isOffRoad,
      softCollide, circleHit, worldToScreenY, screenToWorldY, raceProgress, hasFinished,
      spawnFriends, spawnPickups, tryCollectPickup, steerFromPointer, stepSteer,
      enterPlay, enterMenu, enterWin, updatePlay, collectAt, setSteerX, clearSteer,
      state: () => state,
      modeId: () => modeId,
      distance: () => distance,
      setDistance: (d) => { distance = d; },
      raceDistance: () => raceDistance,
      sessionStars: () => sessionStars,
      setSessionStars: (n) => { sessionStars = n; },
      playerX: () => playerX,
      setPlayerX: (x) => { playerX = x; },
      steerTarget: () => steerTarget,
      playerVx: () => playerVx,
      speed: () => speed,
      friends: () => friends,
      pickups: () => pickups,
      showHint: () => showHint,
      setHintTimer: (t) => { hintTimer = t; },
      save,
      setMode, setMuted, setReducedMotion, setCarIndex,
      recordStar, recordRace,
      loadSave, persistSave, defaultSave,
    };
  `;

  const sandbox = {
    console,
    setTimeout: opts.immediateTimeout
      ? (fn) => { fn(); return 0; }
      : setTimeout,
    clearTimeout,
    Math,
    performance: { now: () => Date.now() },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; },
    },
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; },
    },
    window: {},
    globalThis: {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    speechSynthesis: undefined,
    SpeechSynthesisUtterance: undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { filename: 'cozy-racers-test.js' });
  return sandbox.__TEST__;
}

// =====================================================================
section('PWA shell files');
{
  for (const f of [
    'index.html', 'css/style.css', 'js/config.js', 'js/save.js', 'js/audio.js',
    'js/particles.js', 'js/game.js', 'js/main.js',
    'manifest.webmanifest', 'sw.js', 'README.md',
  ]) {
    assert(exists(f), `exists ${f}`);
  }
  for (const f of [
    'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
    'apple-touch-icon.png', 'art/cover.jpg',
  ]) {
    assert(exists(f), `exists ${f}`);
  }
}

// =====================================================================
section('version / SW cache sync');
{
  const cfg = read('js/config.js');
  const sw = read('sw.js');
  const m = cfg.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  assert(!!m, 'GAME_VERSION present');
  const ver = m[1];
  assert(/^\d+\.\d+\.\d{3}$/.test(ver), `version format (${ver})`);
  assert(sw.includes(`cozy-racers-${ver}`), `sw CACHE matches cozy-racers-${ver}`);
  assert(cfg.includes('SAVE_KEY'), 'SAVE_KEY defined');
  assert(cfg.includes('cozy-racers-save'), 'SAVE_KEY namespaced');
}

// =====================================================================
section('script order + manifest');
{
  const html = read('index.html');
  let last = -1;
  for (const s of ['config.js', 'save.js', 'audio.js', 'particles.js', 'game.js', 'main.js']) {
    const i = html.indexOf(s);
    assert(i > last, `order ${s}`);
    last = i;
  }
  assert(html.includes('manifest.webmanifest'), 'html links manifest');
  assert(html.includes('sw.js') || read('js/main.js').includes('serviceWorker'), 'SW registration path');
  const man = JSON.parse(read('manifest.webmanifest'));
  assert(man.display === 'standalone', 'manifest standalone');
  assert(man.name === 'Cozy Racers', 'manifest name');
  assert(Array.isArray(man.icons) && man.icons.length >= 2, 'manifest icons');
  assert(man.orientation === 'portrait', 'portrait orientation');
}

// =====================================================================
section('config integrity');
{
  const T = loadGame();
  assertEq(T.W, 390, 'W');
  assertEq(T.H, 700, 'H');
  assert(T.MODE_ORDER.length === 4, '4 modes');
  assert(T.MODE_ORDER.every(id => T.MODES[id]), 'MODE_ORDER keys valid');
  assertEq(T.MODES.free.distance, 0, 'free endless');
  assertEq(T.MODES.free.starGoal, 0, 'free no star goal');
  assert(T.MODES.picnic.distance > 0, 'picnic has distance');
  assert(T.MODES.meadow.distance > T.MODES.picnic.distance, 'meadow longer');
  assert(T.MODES.circuit.distance > T.MODES.meadow.distance, 'circuit longest');
  assert(T.CAR_PALETTES.length >= 6, '6 car colors');
  assert(T.FRIEND_NAMES.length >= 4, 'friend names');
  assert(T.ROAD_W > 100, 'road width');
  assert(T.HINT_AFTER > 0, 'HINT_AFTER positive');
}

// =====================================================================
section('clamp / lerp / raceProgress / hasFinished');
{
  const T = loadGame();
  assertEq(T.clamp(5, 0, 10), 5, 'clamp mid');
  assertEq(T.clamp(-1, 0, 10), 0, 'clamp lo');
  assertEq(T.clamp(99, 0, 10), 10, 'clamp hi');
  assertClose(T.lerp(0, 10, 0.5), 5, 0.001, 'lerp half');
  assertEq(T.raceProgress(0, 1000), 0, 'prog 0');
  assertEq(T.raceProgress(500, 1000), 0.5, 'prog half');
  assertEq(T.raceProgress(1000, 1000), 1, 'prog done');
  assertEq(T.raceProgress(50, 0), 0, 'prog free');
  assert(T.hasFinished(1400, 1400) === true, 'finished exact');
  assert(T.hasFinished(1399, 1400) === false, 'not finished');
  assert(T.hasFinished(9999, 0) === false, 'free never finishes by distance');
}

// =====================================================================
section('road bounds / off-road / steer');
{
  const T = loadGame();
  const b = T.roadBounds(18);
  assert(b.min > T.ROAD_LEFT, 'min inside road');
  assert(b.max < T.ROAD_RIGHT, 'max inside road');
  assert(T.isOffRoad(T.ROAD_CENTER) === false, 'center on road');
  assert(T.isOffRoad(-50) === true, 'far left off');
  assert(T.isOffRoad(T.W + 50) === true, 'far right off');

  const s = T.steerFromPointer(T.ROAD_CENTER);
  assertClose(s, T.ROAD_CENTER, 1, 'steer center');
  const far = T.steerFromPointer(-1000);
  assert(far > 0, 'steer clamps left');
  const farR = T.steerFromPointer(9999);
  assert(farR < T.W, 'steer clamps right');
}

// =====================================================================
section('stepSteer soft motion');
{
  const T = loadGame();
  let x = T.ROAD_CENTER;
  let vx = 0;
  for (let i = 0; i < 30; i++) {
    const s = T.stepSteer(x, vx, T.ROAD_CENTER + 80, 1 / 60);
    x = s.x;
    vx = s.vx;
  }
  assert(x > T.ROAD_CENTER, 'moves toward target');
  assert(x < T.ROAD_CENTER + 90, 'does not overshoot wildly');

  // Screen edge bounce
  const edge = T.stepSteer(5, -200, 0, 0.05);
  assert(edge.x >= 30, 'screen left clamp');
}

// =====================================================================
section('softCollide / circleHit');
{
  const T = loadGame();
  const miss = T.softCollide(0, 0, 100, 0, 10);
  assert(miss.hit === false, 'no hit far');
  const hit = T.softCollide(0, 0, 10, 0, 20);
  assert(hit.hit === true, 'hit close');
  assert(hit.ax < 0, 'a pushed left');
  assert(hit.bx > 10, 'b pushed right');

  assert(T.circleHit(0, 0, 5, 0, 10) === true, 'circle hit');
  assert(T.circleHit(0, 0, 50, 0, 10) === false, 'circle miss');
}

// =====================================================================
section('worldY mapping');
{
  const T = loadGame();
  const cam = 100;
  // Object at player world Y should map to PLAYER_Y
  assertClose(T.worldToScreenY(cam, cam), T.PLAYER_Y, 0.01, 'same world = player Y');
  assert(T.worldToScreenY(cam + 100, cam) < T.PLAYER_Y, 'ahead is higher on screen (smaller y)');
  assertClose(T.screenToWorldY(T.PLAYER_Y, cam), cam, 0.01, 'inverse at player');
}

// =====================================================================
section('spawnFriends / spawnPickups');
{
  const T = loadGame();
  const rng = mulberry32(42);
  const fs = T.spawnFriends(3, rng);
  assertEq(fs.length, 3, '3 friends');
  assert(fs.every(f => f.name), 'names');
  assert(fs.every(f => f.worldY > 0), 'worldY positive');
  assert(fs.every(f => f.x >= T.ROAD_LEFT && f.x <= T.ROAD_RIGHT), 'on road');

  const fs2 = T.spawnFriends(3, mulberry32(42));
  assertEq(fs[0].name, fs2[0].name, 'deterministic friends');

  const ps = T.spawnPickups(1400, 10, mulberry32(7));
  assertEq(ps.length, 10, '10 pickups');
  assert(ps.every(p => !p.taken), 'not taken');
  assert(ps.some(p => p.kind === 'star'), 'has stars');
  assert(ps.every(p => p.worldY > 0), 'pickup worldY');
}

// =====================================================================
section('tryCollectPickup');
{
  const T = loadGame();
  const p = {
    worldY: 100,
    x: T.ROAD_CENTER,
    kind: 'star',
    taken: false,
    phase: 0,
  };
  // Player at distance 100, pickup at world 100 → screen PLAYER_Y
  const kind = T.tryCollectPickup(p, T.ROAD_CENTER, T.PLAYER_Y, 100);
  assertEq(kind, 'star', 'collect star at same pos');
  p.taken = true;
  assertEq(T.tryCollectPickup(p, T.ROAD_CENTER, T.PLAYER_Y, 100), null, 'already taken');
  p.taken = false;
  p.x = 0;
  p.worldY = 100;
  assertEq(T.tryCollectPickup(p, T.ROAD_CENTER, T.PLAYER_Y, 100), null, 'too far sideways');
}

// =====================================================================
section('enterPlay + modes');
{
  const T = loadGame();
  T.enterPlay('picnic');
  assertEq(T.state(), 'play', 'state play');
  assertEq(T.modeId(), 'picnic', 'mode picnic');
  assert(T.raceDistance() > 0, 'picnic distance');
  assertEq(T.sessionStars(), 0, 'stars 0');
  assertEq(T.distance(), 0, 'distance 0');
  assert(T.friends().length === T.MODES.picnic.friends, 'friend count');
  assert(T.pickups().length > 0, 'has pickups');
  assertClose(T.playerX(), T.ROAD_CENTER, 1, 'start center');

  T.enterPlay('free');
  assertEq(T.raceDistance(), 0, 'free endless');
  assert(T.friends().length === 1, 'free 1 friend');

  T.enterPlay('circuit');
  assert(T.friends().length === 3, 'circuit 3 friends');
  assert(T.raceDistance() === T.MODES.circuit.distance, 'circuit dist');

  T.enterMenu();
  assertEq(T.state(), 'menu', 'menu state');
}

// =====================================================================
section('updatePlay advances distance + finish');
{
  const T = loadGame();
  T.enterPlay('picnic');
  const d0 = T.distance();
  for (let i = 0; i < 10; i++) T.updatePlay(0.05);
  assert(T.distance() > d0, 'distance advances');

  // Force finish
  T.setDistance(T.raceDistance() + 1);
  T.updatePlay(0.016);
  assertEq(T.state(), 'win', 'wins after finish distance');
}

// =====================================================================
section('steering input');
{
  const T = loadGame();
  T.enterPlay('picnic');
  T.setSteerX(T.ROAD_CENTER + 60);
  assert(T.steerTarget() > T.ROAD_CENTER, 'steer target right');
  for (let i = 0; i < 20; i++) T.updatePlay(0.016);
  assert(T.playerX() > T.ROAD_CENTER, 'player moves right');
  T.clearSteer();
}

// =====================================================================
section('collect stars via update');
{
  const T = loadGame();
  T.enterPlay('picnic');
  // Place a star on the player
  const p = T.pickups()[0];
  p.worldY = T.distance();
  p.x = T.playerX();
  p.kind = 'star';
  p.taken = false;
  const before = T.save.stars | 0;
  T.updatePlay(0.016);
  assert(p.taken === true, 'pickup taken');
  assertEq(T.sessionStars(), 1, 'session star +1');
  assertEq(T.save.stars, before + 1, 'save star +1');
}

// =====================================================================
section('hint after idle');
{
  const T = loadGame();
  T.enterPlay('picnic');
  assert(T.showHint() === false, 'no hint initially');
  T.setHintTimer(T.HINT_AFTER + 0.1);
  T.updatePlay(0.016);
  assert(T.showHint() === true, 'hint after idle');
}

// =====================================================================
section('save helpers');
{
  const T = loadGame();
  T.setMode('circuit');
  assertEq(T.save.mode, 'circuit', 'setMode circuit');
  T.setMode('nope');
  assertEq(T.save.mode, 'circuit', 'invalid mode ignored');
  T.setMuted(true);
  assert(T.save.muted === true, 'muted');
  T.setMuted(false);
  T.setReducedMotion(true);
  assert(T.save.reducedMotion === true, 'reduced motion');
  T.setCarIndex(3);
  assertEq(T.save.carIndex, 3, 'car index');
  T.setCarIndex(99);
  assert(T.save.carIndex >= 0 && T.save.carIndex < T.CAR_PALETTES.length, 'car wraps');

  const s0 = T.save.stars | 0;
  T.recordStar(2);
  assertEq(T.save.stars, s0 + 2, 'recordStar');
  const r0 = T.save.races | 0;
  T.recordRace();
  assertEq(T.save.races, r0 + 1, 'recordRace');
}

// =====================================================================
section('kid-safe design markers');
{
  const game = read('js/game.js');
  const html = read('index.html');
  assert(!/game\s*over/i.test(game), 'no game over string');
  assert(!/\blives\b/i.test(game), 'no lives system');
  assert(html.includes('never a fail') || read('README.md').includes('fail'), 'fail-safe messaging');
  assert(game.includes('softCollide') || game.includes('soft'), 'soft collision present');
  assert(game.includes('isOffRoad'), 'off-road soft handling');
}

// =====================================================================
section('SW ASSETS list');
{
  const sw = read('sw.js');
  for (const a of [
    'index.html', 'css/style.css', 'js/config.js', 'js/game.js', 'js/main.js',
    'manifest.webmanifest', 'icons/icon-192.png', 'art/cover.jpg',
  ]) {
    assert(sw.includes(a), `SW lists ${a}`);
  }
}

// =====================================================================
console.log('\n');
if (failed) {
  console.error(`Failed: ${failed}  Passed: ${passed}`);
  for (const f of failures) console.error('  •', f);
  process.exit(1);
}
console.log(`Passed: ${passed}  Failed: 0`);
console.log('All Cozy Racers tests passed.');
process.exit(0);
