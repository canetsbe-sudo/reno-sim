// Glue between the procedural textures and the isometric renderer: caches textures per
// finish, maps them onto floor and wall planes, and paints light and shadow in room
// (world) space so everything turns with the camera.
import { ROOM_D, ROOM_W, type Finish, type WallSide } from '../data';
import { checkerTile, oldCarpet, oldLino, slate, subfloor, terracotta } from './floors';
import { hexRgb } from './noise';
import { drywall, floralPaper, shiplap, stripePaper } from './walls';
import { PX, grimeLayer, paintMold, paintedWall, woodPlanks, type GrimeKind } from './surfaces';

export type Pt = [number, number];
// Room (world) point to screen, for the current camera view.
export type Project = (x: number, y: number, z?: number) => Pt;

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}

const mix = (hex: string, to: number, amt: number) => {
  const [r, g, b] = hexRgb(hex).map((c) => Math.round(c + (to - c) * amt));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

// Draw in a plane's own pixel space: `o` is the plane's origin on screen, `ax` and `ay`
// are one world unit along its texture axes.
export function onPlane(ctx: CanvasRenderingContext2D, o: Pt, ax: Pt, ay: Pt, fn: () => void) {
  ctx.save();
  ctx.transform((ax[0] - o[0]) / PX, (ax[1] - o[1]) / PX, (ay[0] - o[0]) / PX, (ay[1] - o[1]) / PX, o[0], o[1]);
  fn();
  ctx.restore();
}

export const onFloor = (ctx: CanvasRenderingContext2D, P: Project, fn: () => void) => onPlane(ctx, P(0, 0), P(1, 0), P(0, 1), fn);

const wallXY = (wall: WallSide, u: number): Pt => (wall === 'back' ? [u, 0] : wall === 'front' ? [u, ROOM_D] : wall === 'left' ? [0, u] : [ROOM_W, u]);
export const wallLen = (wall: WallSide) => (wall === 'back' || wall === 'front' ? ROOM_W : ROOM_D);

// Wall plane: x runs along the wall, y runs down from the top.
export function onWall(ctx: CanvasRenderingContext2D, P: Project, wall: WallSide, wallH: number, fn: () => void) {
  const a = wallXY(wall, 0);
  const b = wallXY(wall, 1);
  onPlane(ctx, P(a[0], a[1], wallH), P(b[0], b[1], wallH), P(a[0], a[1], wallH - 1), fn);
}

// ---- Floor ----

export function floorTexture(f: Finish): HTMLCanvasElement {
  return cached(`floor:${f.id}`, () => {
    const accent = f.accent ?? f.color;
    switch (f.id) {
      case 'floor-terracotta':
        return terracotta(ROOM_W, ROOM_D, f.color, accent);
      case 'floor-slate':
        return slate(ROOM_W, ROOM_D, f.color);
      case 'floor-old-lino':
        return oldLino(ROOM_W, ROOM_D, f.color, accent);
      case 'floor-old-carpet':
        return oldCarpet(ROOM_W, ROOM_D, f.color, accent);
      case 'floor-subfloor':
        return subfloor(ROOM_W, ROOM_D, f.color, accent);
    }
    if (f.pattern === 'checker') return checkerTile(ROOM_W, ROOM_D, f.color, accent);
    if (f.pattern === 'tile') return terracotta(ROOM_W, ROOM_D, f.color, accent);
    if (f.pattern === 'speckle') return oldLino(ROOM_W, ROOM_D, f.color, accent);
    if (f.pattern === 'planks') {
      // Vinyl planks are wider and flatter than real boards.
      const vinyl = f.id === 'floor-vinyl';
      return woodPlanks(ROOM_W, ROOM_D, { light: mix(f.color, 255, 0.12), dark: mix(accent, 0, vinyl ? 0.18 : 0.32), plankW: vinyl ? 0.34 : 0.25, seed: f.id.length * 7919 });
    }
    return paintedWall(ROOM_W, ROOM_D, { color: f.color });
  });
}

// ---- Walls ----

// How far the mold has got: 0 none, 1 a first hint, 2 the full colony.
export type MoldLevel = 0 | 1 | 2;
const MOLD = { wall: 'left' as WallSide, u: 1.45, z: 1.75 };

const WALL_SEED: Record<WallSide, number> = { back: 31, left: 62, front: 93, right: 124 };

function wallBase(f: Finish, wall: WallSide, wallH: number): HTMLCanvasElement {
  const len = wallLen(wall);
  const accent = f.accent ?? f.color;
  if (f.id === 'wall-drywall') return drywall(len, wallH, f.color);
  if (f.pattern === 'stripes') return stripePaper(len, wallH, f.color, accent);
  if (f.pattern === 'planks') return shiplap(len, wallH, f.color, accent);
  if (f.pattern === 'floral') return floralPaper(len, wallH, f.color, accent, WALL_SEED[wall]);
  return paintedWall(len, wallH, { color: f.color, grime: f.old ? 0.8 : 0, seed: WALL_SEED[wall] });
}

export function wallTexture(f: Finish, wall: WallSide, wallH: number, mold: MoldLevel): HTMLCanvasElement {
  const m = wall === MOLD.wall ? mold : 0;
  return cached(`wall:${f.id}:${wall}:${m}`, () => {
    const c = wallBase(f, wall, wallH);
    if (m === 1) paintMold(c, MOLD.u * PX, (wallH - MOLD.z - 0.35) * PX, 0.26 * PX, 5);
    if (m === 2) {
      paintMold(c, MOLD.u * PX, (wallH - MOLD.z) * PX, 0.62 * PX, 5);
      paintMold(c, (MOLD.u + 0.75) * PX, (wallH - MOLD.z + 0.55) * PX, 0.34 * PX, 8);
    }
    return c;
  });
}

// ---- Light ----

// The sun sits behind the back-left corner, so it comes in through back and left windows.
// A point z units up a wall lands SUN[0] * z across and SUN[1] * z into the room.
export const SUN: Pt = [0.5, 1.05];

export interface Opening {
  wall: WallSide;
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

const BLUR = (ctx: CanvasRenderingContext2D, px: number) => {
  if ('filter' in ctx) ctx.filter = `blur(${px}px)`;
};

function quad(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * PX, y * PX) : ctx.moveTo(x * PX, y * PX)));
  ctx.closePath();
  ctx.fill();
}

// Where a wall point at height z lands on the floor.
function sunHit(wall: WallSide, u: number, z: number): Pt | undefined {
  if (wall === 'back') return [u + SUN[0] * z, SUN[1] * z];
  if (wall === 'left') return [SUN[1] * z, u + SUN[0] * z];
  return undefined;
}

// Ambient shading on the floor: darker into corners and along the walls, brighter where
// daylight reaches.
export function shadeFloor(ctx: CanvasRenderingContext2D, P: Project, strength = 1) {
  onFloor(ctx, P, () => {
    const W = ROOM_W * PX;
    const D = ROOM_D * PX;
    const edge = (x0: number, y0: number, x1: number, y1: number, a: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(30,18,8,${a * strength})`);
      g.addColorStop(0.35, `rgba(30,18,8,${a * 0.35 * strength})`);
      g.addColorStop(1, 'rgba(30,18,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, D);
    };
    edge(0, 0, 0, 0.9 * PX, 0.34);
    edge(0, 0, 0.9 * PX, 0, 0.34);
    edge(0, D, 0, D - 0.5 * PX, 0.16);
    edge(W, 0, W - 0.5 * PX, 0, 0.16);
    // Gentle falloff away from the sunny corner.
    const g = ctx.createLinearGradient(0, 0, W, D);
    g.addColorStop(0, 'rgba(255,236,200,0.06)');
    g.addColorStop(1, 'rgba(20,14,30,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, D);
  });
}

// Pools of sunlight thrown across the floor by each window, with the muntin's shadow.
export function sunPools(ctx: CanvasRenderingContext2D, P: Project, openings: Opening[], color = '255,238,200') {
  onFloor(ctx, P, () => {
    ctx.beginPath();
    ctx.rect(0, 0, ROOM_W * PX, ROOM_D * PX);
    ctx.clip();
    for (const o of openings) {
      if (!sunHit(o.wall, 0, 0)) continue;
      const um = (o.u0 + o.u1) / 2;
      const zm = (o.z0 + o.z1) / 2;
      const g = 0.035;
      const pane = (ua: number, ub: number, za: number, zb: number): Pt[] => [sunHit(o.wall, ua, za)!, sunHit(o.wall, ub, za)!, sunHit(o.wall, ub, zb)!, sunHit(o.wall, ua, zb)!];
      const panes = [pane(o.u0, um - g, o.z0, zm - g), pane(um + g, o.u1, o.z0, zm - g), pane(o.u0, um - g, zm + g, o.z1), pane(um + g, o.u1, zm + g, o.z1)];
      // Wide soft bounce first, then the crisp panes.
      ctx.globalCompositeOperation = 'soft-light';
      BLUR(ctx, 16);
      ctx.fillStyle = `rgba(${color},0.5)`;
      quad(ctx, pane(o.u0 - 0.2, o.u1 + 0.2, o.z0 - 0.2, o.z1 + 0.3));
      ctx.globalCompositeOperation = 'overlay';
      BLUR(ctx, 1.6);
      ctx.fillStyle = `rgba(${color},0.5)`;
      for (const p of panes) quad(ctx, p);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${color},0.2)`;
      for (const p of panes) quad(ctx, p);
    }
  });
}

// Soft contact shadow and a longer cast shadow for a box standing on the floor.
export function castShadow(ctx: CanvasRenderingContext2D, P: Project, x: number, y: number, w: number, d: number, h: number, alpha = 1) {
  if (h < 0.1) return;
  const len = Math.min(h, 1.6) * 0.55;
  const sx = SUN[0] * len;
  const sy = SUN[1] * len;
  onFloor(ctx, P, () => {
    ctx.beginPath();
    ctx.rect(0, 0, ROOM_W * PX, ROOM_D * PX);
    ctx.clip();
    BLUR(ctx, 7);
    ctx.fillStyle = `rgba(28,16,8,${0.3 * alpha})`;
    // The footprint swept along the sun direction.
    quad(ctx, [[x, y], [x + w, y], [x + w + sx, y + sy], [x + w + sx, y + d + sy], [x + sx, y + d + sy], [x, y + d]]);
    BLUR(ctx, 3);
    ctx.fillStyle = `rgba(28,16,8,${0.38 * alpha})`;
    quad(ctx, [[x - 0.03, y - 0.03], [x + w + 0.05, y - 0.03], [x + w + 0.05, y + d + 0.05], [x - 0.03, y + d + 0.05]]);
  });
}

// Shading on a wall: darker toward the corner, floor and ceiling line, plus the glow of
// light spilling around each window.
export function shadeWall(ctx: CanvasRenderingContext2D, P: Project, wall: WallSide, wallH: number, base: number, cornerAtStart: boolean, openings: Opening[]) {
  onWall(ctx, P, wall, wallH, () => {
    const L = wallLen(wall) * PX;
    const H = wallH * PX;
    ctx.fillStyle = `rgba(22,14,10,${base})`;
    ctx.fillRect(0, 0, L, H);
    const grad = (x0: number, y0: number, x1: number, y1: number, a: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(22,14,10,${a})`);
      g.addColorStop(1, 'rgba(22,14,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, L, H);
    };
    if (cornerAtStart) grad(0, 0, 1.1 * PX, 0, 0.26);
    else grad(L, 0, L - 1.1 * PX, 0, 0.26);
    grad(0, H, 0, H - 0.7 * PX, 0.2);
    grad(0, 0, 0, 0.5 * PX, 0.1);
    ctx.globalCompositeOperation = 'soft-light';
    for (const o of openings) {
      if (o.wall !== wall) continue;
      const cx = ((o.u0 + o.u1) / 2) * PX;
      const cy = (wallH - (o.z0 + o.z1) / 2) * PX;
      const g = ctx.createRadialGradient(cx, cy, 0.3 * PX, cx, cy, 1.5 * PX);
      g.addColorStop(0, 'rgba(255,240,205,0.5)');
      g.addColorStop(1, 'rgba(255,240,205,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 1.5 * PX, cy - 1.5 * PX, 3 * PX, 3 * PX);
    }
  });
}

// ---- Age ----

export const grime = (w: number, h: number, kind: GrimeKind, seed: number) => cached(`grime:${kind}:${w}:${h}:${seed}`, () => grimeLayer(w, h, kind, seed));
