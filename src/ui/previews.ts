// Small pictures for the interface, made from the game's own art: finish swatches,
// furniture cut-outs, wall art and a look at each house. Each one is drawn once and
// handed to the page as a CSS class, so redrawing a panel never redraws a picture.
import { PX } from '../art/surfaces';
import { floorTexture, wallTexture } from '../art/scene';
import { drawArt } from '../art/wallart';
import { SCENARIOS, finishById, itemById, type Finish } from '../data';
import { CANVAS_H, CANVAS_W, WALL_H, drawItem, drawScene, screenPoint } from '../render';
import { newGame, type Design, type GameState } from '../state';
import { viewDims, type View } from '../view';

const done = new Set<string>();
let sheet: CSSStyleSheet | undefined;

function publish(cls: string, c: HTMLCanvasElement) {
  if (!sheet) {
    const el = document.createElement('style');
    document.head.appendChild(el);
    sheet = el.sheet!;
  }
  // Browsers that cannot write WebP hand back a PNG instead.
  sheet.insertRule(`.${cls}{background-image:url(${c.toDataURL('image/webp', 0.92)})}`, sheet.cssRules.length);
}

// Runs `make` the first time a class is asked for, and returns the class either way.
function once(cls: string, make: () => HTMLCanvasElement): string {
  if (!done.has(cls)) {
    done.add(cls);
    try {
      publish(cls, make());
    } catch {
      // A picture that fails to draw leaves the plain tile behind it.
    }
  }
  return cls;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// A clean, finished room to show finishes in.
const SHOW: Design = {
  floor: 'floor-oak',
  wall: 'wall-white',
  cabinet: 'cab-shaker-white',
  counter: 'ctr-butcher',
  backsplash: 'bs-none',
  lighting: 'light-daylight',
  windows: [],
  doors: [],
  art: [],
  items: [],
};

function showroom(over: Partial<Design>): GameState {
  const s = newGame(SCENARIOS[0].id, 'freedom', false);
  s.junk = [];
  s.issues = [];
  s.demoDone = s.floorRipped = s.wallsStripped = true;
  s.design = { ...SHOW, ...over };
  return s;
}

const RUN: Design['items'] = [1, 2, 3, 4, 5].map((x, i) => ({ uid: 900 + i, id: x === 3 ? 'sink-cabinet' : 'base-cabinet', x, y: 0, rot: 0 }));

// The room's silhouette on the canvas for a camera view, with a little room for its shadow.
// The scene tints the whole canvas with the lighting mood, so everything outside this
// outline is trimmed away to let the room sit straight on the page.
export function roomOutline(v: View): [number, number][] {
  const { w, d } = viewDims(v);
  const top = WALL_H + 0.04;
  return [
    screenPoint(v, -0.04, d, top),
    screenPoint(v, -0.04, -0.04, top),
    screenPoint(v, w, -0.04, top),
    screenPoint(v, w + 0.04, -0.04, 0),
    screenPoint(v, w + 0.45, -0.35, 0),
    screenPoint(v, w + 0.45, d + 0.45, 0),
    screenPoint(v, -0.35, d + 0.45, 0),
    screenPoint(v, -0.04, d + 0.04, 0),
  ];
}

// The same outline as a CSS clip-path for anything showing the whole canvas.
export const roomClip = (v: View) =>
  `polygon(${roomOutline(v)
    .map(([x, y]) => `${((x / CANVAS_W) * 100).toFixed(2)}% ${((y / CANVAS_H) * 100).toFixed(2)}%`)
    .join(',')})`;

function trimToRoom(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  for (const [x, y] of roomOutline(0)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const SCENE_SCALE = 2;
const SW = 336;
const SH = 216;

// Draws the room and keeps a patch of it `width` screen pixels across, centred on a point in the room.
function sceneCrop(s: GameState, [x, y, z]: [number, number, number], width: number): HTMLCanvasElement {
  const full = canvas(CANVAS_W * SCENE_SCALE, CANVAS_H * SCENE_SCALE);
  const fctx = full.getContext('2d')!;
  fctx.scale(SCENE_SCALE, SCENE_SCALE);
  drawScene(fctx, s);
  const [cx, cy] = screenPoint(0, x, y, z);
  const height = (width * SH) / SW;
  const out = canvas(SW, SH);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#efe9df';
  ctx.fillRect(0, 0, SW, SH);
  ctx.drawImage(full, (cx - width / 2) * SCENE_SCALE, (cy - height / 2) * SCENE_SCALE, width * SCENE_SCALE, height * SCENE_SCALE, 0, 0, SW, SH);
  return out;
}

function textureCrop(tex: HTMLCanvasElement, tiles: number): HTMLCanvasElement {
  const out = canvas(SW, SH);
  const w = Math.min(tex.width, tiles * PX);
  const h = Math.min(tex.height, (w * SH) / SW);
  out.getContext('2d')!.drawImage(tex, (tex.width - w) / 2, (tex.height - h) / 2, w, h, 0, 0, SW, SH);
  return out;
}

// The class that paints a finish's swatch.
export function finishPreview(f: Finish): string {
  return once(`pv-${f.id}`, () => {
    switch (f.category) {
      case 'floor':
        return textureCrop(floorTexture(f), 3.2);
      case 'wall':
        return textureCrop(wallTexture(f, 'back', WALL_H), 2.6);
      case 'cabinet':
        return sceneCrop(showroom({ cabinet: f.id, counter: 'ctr-laminate', items: RUN }), [3, 0.5, 0.5], 150);
      case 'counter':
        return sceneCrop(showroom({ counter: f.id, items: RUN }), [3.2, 0.5, 0.95], 104);
      case 'backsplash':
        return sceneCrop(showroom({ backsplash: f.id, items: RUN }), [3.4, 0, 1.3], 112);
      case 'window':
        return sceneCrop(showroom({ wall: 'wall-cream', windows: [{ wall: 'back', slot: 3, finish: f.id }] }), [3.5, 0, 1.4], 196);
      case 'lighting':
        return sceneCrop(showroom({ lighting: f.id, wall: 'wall-cream', items: RUN, windows: [{ wall: 'back', slot: 3, finish: 'win-classic' }] }), [3.3, 1, 1], 300);
    }
  });
}

const ITEM_PX = 168;
let primed = false;

// A cut-out of a piece of furniture, wearing the cabinet and counter finishes in use.
export function itemPreview(id: string, d: Design): string {
  const def = itemById(id);
  const cab = def.usesCabinet ? d.cabinet : '';
  const ctr = def.usesCounter ? d.counter : '';
  return once(`pv-${id}${cab && `_${cab}`}${ctr && `_${ctr}`}`, () => {
    // Items are placed with the camera unturned; one room drawn that way sets that up.
    if (!primed) {
      drawScene(canvas(1, 1).getContext('2d')!, showroom({}));
      primed = true;
    }
    const at = { x: 3, y: 2 };
    const corners = [0, 1].flatMap((i) => [0, 1].flatMap((j) => [0, def.h].map((z) => screenPoint(0, at.x + i * def.w, at.y + j * def.d, z))));
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const b = { l: Math.min(...xs), t: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const pad = 8;
    const k = Math.min((ITEM_PX - pad * 2) / b.w, (ITEM_PX - pad * 2) / b.h, 2.6);
    const out = canvas(ITEM_PX, ITEM_PX);
    const ctx = out.getContext('2d')!;
    ctx.translate(ITEM_PX / 2, ITEM_PX / 2);
    ctx.scale(k, k);
    ctx.translate(-(b.l + b.w / 2), -(b.t + b.h / 2));
    drawItem(ctx, { uid: -1, id, ...at, rot: 0 }, { ...SHOW, cabinet: finishById(d.cabinet).old ? SHOW.cabinet : d.cabinet, counter: finishById(d.counter).old ? SHOW.counter : d.counter });
    return out;
  });
}

export function artPreview(id: string): string {
  return once(`pv-${id}`, () => {
    const out = canvas(ITEM_PX, ITEM_PX);
    const ctx = out.getContext('2d')!;
    ctx.translate(ITEM_PX / 2, ITEM_PX / 2);
    ctx.scale(1.55, 1.55);
    drawArt(ctx, id);
    return out;
  });
}

// The house as you find it, for the title screen.
export function housePreview(id: string): string {
  return once(`pv-house-${id}`, () => {
    const scale = 2.5;
    const out = canvas(CANVAS_W * scale, CANVAS_H * scale);
    const ctx = out.getContext('2d')!;
    ctx.scale(scale, scale);
    drawScene(ctx, newGame(id, 'freedom', false));
    trimToRoom(ctx);
    return out;
  });
}
