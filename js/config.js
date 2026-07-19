'use strict';

// Cozy Racers — Keep CACHE in sw.js in sync: 'cozy-racers-' + GAME_VERSION
const GAME_VERSION = '1.3.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Cozy Racers';

const W = 390;
const H = 700;
const SAVE_KEY = 'cozy-racers-save-v1';

/**
 * Modes: race distance (world units), friend count, base speed, star goal.
 * Free = endless (distance 0, starGoal 0).
 * Player is slightly faster than friends so they can pass the pack and win.
 */
const MODES = {
  free:    { id: 'free',    name: 'Free Cruise',  tagline: 'forever · stars', distance: 0,     friends: 2, speed: 165, starGoal: 0  },
  picnic:  { id: 'picnic',  name: 'Picnic Path',  tagline: 'cozy race',       distance: 7200,  friends: 3, speed: 160, starGoal: 14 },
  meadow:  { id: 'meadow',  name: 'Meadow Dash',  tagline: 'medium race',     distance: 11000, friends: 3, speed: 170, starGoal: 20 },
  circuit: { id: 'circuit', name: 'Star Circuit', tagline: 'long race',       distance: 16000, friends: 4, speed: 180, starGoal: 28 },
};
const MODE_ORDER = ['free', 'picnic', 'meadow', 'circuit'];

/**
 * Player cruise = mode.speed * PLAYER_SPEED_MUL (a little faster than the pack).
 * Friends cruise at mode.speed * [FRIEND_SPEED_MIN..MAX] — start ahead, you pass them.
 */
const PLAYER_SPEED_MUL = 1.10;
const FRIEND_SPEED_MIN = 0.88;
const FRIEND_SPEED_MAX = 0.97;

/** Temporary slow from bump / oil (seconds, speed multiplier) */
const SLOW_DURATION = 1.15;
const SLOW_MUL = 0.55;
/** Temporary nitro boost (seconds, speed multiplier) */
const BOOST_DURATION = 1.15;
const BOOST_MUL = 1.55;

const ROAD_W = 210;
const ROAD_LEFT = (W - ROAD_W) / 2;
const ROAD_RIGHT = ROAD_LEFT + ROAD_W;
const ROAD_CENTER = W / 2;

const PLAYER_Y = H * 0.72;
const PLAYER_W = 48;
const PLAYER_H = 88;
const CAR_R = 28; // soft collision radius

const STAR_R = 16;
const PICKUP_R = 20;
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

/** Weighted pickups/hazards along the track */
const PICKUP_KINDS = [
  'star', 'star', 'star', 'star',
  'nitro', 'nitro', 'nitro',
  'oil', 'oil',
  'flower',
];
