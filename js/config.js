'use strict';

// Cozy Racers — Keep CACHE in sw.js in sync: 'cozy-racers-' + GAME_VERSION
const GAME_VERSION = '1.1.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Cozy Racers';

const W = 390;
const H = 700;
const SAVE_KEY = 'cozy-racers-save-v1';

/**
 * Modes: race distance (world units), friend count, base speed, star goal.
 * Free = endless (distance 0, starGoal 0).
 */
const MODES = {
  free:    { id: 'free',    name: 'Free Cruise',  tagline: 'forever · stars', distance: 0,    friends: 1, speed: 160, starGoal: 0  },
  picnic:  { id: 'picnic',  name: 'Picnic Path',  tagline: 'short · cozy',    distance: 1400, friends: 1, speed: 150, starGoal: 8  },
  meadow:  { id: 'meadow',  name: 'Meadow Dash',  tagline: 'medium',         distance: 2200, friends: 2, speed: 175, starGoal: 12 },
  circuit: { id: 'circuit', name: 'Star Circuit', tagline: 'longer · stars',  distance: 3200, friends: 3, speed: 195, starGoal: 18 },
};
const MODE_ORDER = ['free', 'picnic', 'meadow', 'circuit'];

const ROAD_W = 210;
const ROAD_LEFT = (W - ROAD_W) / 2;
const ROAD_RIGHT = ROAD_LEFT + ROAD_W;
const ROAD_CENTER = W / 2;

const PLAYER_Y = H * 0.72;
const PLAYER_W = 48;
const PLAYER_H = 88;
const CAR_R = 28; // soft collision radius

const STAR_R = 16;
const HINT_AFTER = 6;

/** Seconds per countdown beat (3 · 2 · 1 · GO!) before the race rolls */
const COUNTDOWN_BEAT = 0.72;
/** Total beats including GO */
const COUNTDOWN_BEATS = 4;

const PRAISE = ['Zoom!', 'Yay!', 'Nice!', 'Star!', 'Wow!', 'Go!', 'Whee!', 'Yes!'];

/**
 * Car color presets → Kenney Racing Pack (CC0) sprite keys.
 * style 1–3 are different body shapes in the pack.
 */
const CAR_PALETTES = [
  { body: '#EF5350', dark: '#C62828', accent: '#FFD54F', name: 'Berry',  color: 'red',    style: 1 },
  { body: '#42A5F5', dark: '#1565C0', accent: '#81D4FA', name: 'Sky',    color: 'blue',   style: 1 },
  { body: '#66BB6A', dark: '#2E7D32', accent: '#C5E1A5', name: 'Leaf',   color: 'green',  style: 1 },
  { body: '#FFA726', dark: '#EF6C00', accent: '#FFE082', name: 'Honey',  color: 'yellow', style: 1 },
  { body: '#455A64', dark: '#263238', accent: '#B0BEC5', name: 'Shadow', color: 'black',  style: 1 },
  { body: '#29B6F6', dark: '#0277BD', accent: '#B3E5FC', name: 'Wave',   color: 'blue',   style: 2 },
];

const FRIEND_NAMES = ['Pip', 'Momo', 'Bop', 'Lulu', 'Nori', 'Zee'];
