'use strict';

// Cozy Racers — Keep CACHE in sw.js in sync: 'cozy-racers-' + GAME_VERSION
const GAME_VERSION = '1.0.000';
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
const PLAYER_W = 44;
const PLAYER_H = 58;
const CAR_R = 26; // soft collision radius

const STAR_R = 16;
const HINT_AFTER = 6;

const PRAISE = ['Zoom!', 'Yay!', 'Nice!', 'Star!', 'Wow!', 'Go!', 'Whee!', 'Yes!'];

/** Cute car color presets for player + friends */
const CAR_PALETTES = [
  { body: '#EF5350', dark: '#C62828', accent: '#FFD54F', name: 'Berry' },
  { body: '#42A5F5', dark: '#1565C0', accent: '#81D4FA', name: 'Sky' },
  { body: '#66BB6A', dark: '#2E7D32', accent: '#C5E1A5', name: 'Leaf' },
  { body: '#FFA726', dark: '#EF6C00', accent: '#FFE082', name: 'Honey' },
  { body: '#AB47BC', dark: '#6A1B9A', accent: '#E1BEE7', name: 'Plum' },
  { body: '#26C6DA', dark: '#00838F', accent: '#B2EBF2', name: 'Teal' },
];

const FRIEND_NAMES = ['Pip', 'Momo', 'Bop', 'Lulu', 'Nori', 'Zee'];
