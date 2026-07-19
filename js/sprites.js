'use strict';

/**
 * Kenney Racing Pack (CC0) sprite loader.
 * See assets/CREDITS.md
 */

const SPRITE_PATHS = {
  // Cars: color_style
  car_red_1: 'assets/cars/car_red_1.png',
  car_red_2: 'assets/cars/car_red_2.png',
  car_red_3: 'assets/cars/car_red_3.png',
  car_blue_1: 'assets/cars/car_blue_1.png',
  car_blue_2: 'assets/cars/car_blue_2.png',
  car_blue_3: 'assets/cars/car_blue_3.png',
  car_green_1: 'assets/cars/car_green_1.png',
  car_green_2: 'assets/cars/car_green_2.png',
  car_green_3: 'assets/cars/car_green_3.png',
  car_yellow_1: 'assets/cars/car_yellow_1.png',
  car_yellow_2: 'assets/cars/car_yellow_2.png',
  car_yellow_3: 'assets/cars/car_yellow_3.png',
  car_black_1: 'assets/cars/car_black_1.png',
  car_black_2: 'assets/cars/car_black_2.png',
  car_black_3: 'assets/cars/car_black_3.png',
  // World
  road_strip: 'assets/tiles/road_strip.png',
  grass: 'assets/tiles/grass.png',
  grass2: 'assets/tiles/grass2.png',
  tree_small: 'assets/objects/tree_small.png',
  tree_large: 'assets/objects/tree_large.png',
  cone: 'assets/objects/cone.png',
  tires: 'assets/objects/tires.png',
  barrel: 'assets/objects/barrel_red.png',
  oil: 'assets/objects/oil.png',
  nitro: 'assets/objects/nitro.png',
};

/** @type {Record<string, HTMLImageElement>} */
const sprites = {};
let spritesReady = false;
let spritesFailed = 0;

function loadSprites() {
  const keys = Object.keys(SPRITE_PATHS);
  let left = keys.length;
  if (!left) { spritesReady = true; return Promise.resolve(); }

  return new Promise(resolve => {
    keys.forEach(key => {
      const img = new Image();
      img.onload = () => {
        sprites[key] = img;
        left--;
        if (left <= 0) { spritesReady = true; resolve(); }
      };
      img.onerror = () => {
        spritesFailed++;
        left--;
        if (left <= 0) { spritesReady = true; resolve(); }
      };
      img.src = SPRITE_PATHS[key];
    });
  });
}

/** Player palette index → Kenney car sprite key */
function carSpriteKey(paletteIndex, style = 1) {
  const colors = ['red', 'blue', 'green', 'yellow', 'black', 'blue'];
  const styles = [1, 1, 1, 1, 1, 2];
  const i = ((paletteIndex | 0) % colors.length + colors.length) % colors.length;
  const st = style != null ? style : styles[i];
  return 'car_' + colors[i] + '_' + st;
}

function getSprite(key) {
  return sprites[key] || null;
}

/**
 * Draw a loaded sprite centered at (x,y), optionally scaled.
 * Falls back to nothing if missing (caller may draw vector car).
 */
function drawSprite(ctx, key, x, y, opts = {}) {
  const img = sprites[key];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const scale = opts.scale != null ? opts.scale : 1;
  const w = (opts.w != null ? opts.w : img.naturalWidth) * scale;
  const h = (opts.h != null ? opts.h : img.naturalHeight) * scale;
  const rot = opts.rot || 0;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

// Kick off load early (browser only)
if (typeof Image !== 'undefined' && typeof document !== 'undefined') {
  loadSprites();
}
