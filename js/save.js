'use strict';

const defaultSave = () => ({
  muted: false,
  reducedMotion: false,
  stars: 0,
  races: 0,
  wins: 0,
  mode: 'picnic',
  carIndex: 0,
});

let save = defaultSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { save = defaultSave(); return save; }
    save = Object.assign(defaultSave(), JSON.parse(raw));
    if (!MODE_ORDER.includes(save.mode)) save.mode = 'picnic';
    const n = CAR_PALETTES.length;
    save.carIndex = ((save.carIndex | 0) % n + n) % n;
  } catch { save = defaultSave(); }
  return save;
}

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* */ }
}

function recordStar(n = 1) {
  save.stars = (save.stars | 0) + (n | 0);
  persistSave();
}

function recordRace() {
  save.races = (save.races | 0) + 1;
  persistSave();
}

function recordWin() {
  save.wins = (save.wins | 0) + 1;
  persistSave();
}

function setMuted(v) { save.muted = !!v; persistSave(); }
function setReducedMotion(v) { save.reducedMotion = !!v; persistSave(); }
function setMode(id) {
  if (MODE_ORDER.includes(id)) { save.mode = id; persistSave(); }
}
function setCarIndex(i) {
  const n = CAR_PALETTES.length;
  save.carIndex = ((i | 0) % n + n) % n;
  persistSave();
}

loadSave();
