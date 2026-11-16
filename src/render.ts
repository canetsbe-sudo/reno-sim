// Isometric canvas renderer for one cutaway room.
import { ROOM_D, ROOM_W, finishById, itemById, issueById, type Finish, type Rot, type WallSide } from './data';
import { footprint, type Design, type GameState, type Placed } from './state';
import { designToView, placedToView, rotDir, toView, toWorld, viewDims, wallFromView, wallSpotToView, type View } from './view';
import { applianceFront, applianceSide, baseFront, cabLook, cabinetSide, cooktop, pantryFront, sinkBowl } from './art/fronts';
import { drawFurniture } from './art/furniture';
import { PX } from './art/surfaces';
import { drawJunk, tileSpace } from './art/props';
import { hash2 } from './art/noise';
import { drawArt } from './art/wallart';
import { COUNTER_PAD, applianceMaterial, cabinetMaterial, castShadow, counterTexture, floorTexture, grime, lightPool, onPlane, onWallSlot, onFloor, onWall, setMood, shadeFloor, shadeWall, splashTexture, sunPools, wallTexture, type Damage, type Mood, type Opening, type Project } from './art/scene';

export const TW = 72; // tile width on screen
export const TH = 36; // tile height on screen
export const ZS = 40; // pixels per world unit of height
export const WALL_H = 3;
const MARGIN = 24;

export const CANVAS_W = (ROOM_W + ROOM_D) * (TW / 2) + MARGIN * 2;
export const CANVAS_H = (ROOM_W + ROOM_D) * (TH / 2) + WALL_H * ZS + MARGIN * 2 + 12;
// Screen x of the room's back corner for a view. Picking computes this from the view it is
// given rather than reading OX, which only changes when a frame is drawn.
const originX = (v: View) => viewDims(v).d * (TW / 2) + MARGIN;

// Room size and origin for the current camera view (width and depth swap on odd turns).
let RW = ROOM_W;
let RD = ROOM_D;
let OX = originX(0);
let VIEW: View = 0;
function setView(v: View) {
  VIEW = v;
  const dims = viewDims(v);
  RW = dims.w;
  RD = dims.d;
  OX = originX(v);
}
const OY = WALL_H * ZS + MARGIN + 6;

type Pt = [number, number];

export const iso = (x: number, y: number, z = 0): Pt => [OX + (x - y) * (TW / 2), OY + (x + y) * (TH / 2) - z * ZS];

// A view-space floor point on screen, for a given camera view.
export const screenPoint = (v: View, x: number, y: number, z = 0): Pt => [originX(v) + (x - y) * (TW / 2), OY + (x + y) * (TH / 2) - z * ZS];

// A room (world) point on screen, for the view being drawn.
const PW: Project = (x, y, z = 0) => iso(...toView(VIEW, x, y), z);

// Screen point to floor tile, in view space.
export function pickTile(v: View, sx: number, sy: number): { x: number; y: number } | undefined {
  const { w: RW, d: RD } = viewDims(v);
  const OX = originX(v);
  const a = (sx - OX) / (TW / 2);
  const b = (sy - OY) / (TH / 2);
  const x = Math.floor((a + b) / 2);
  const y = Math.floor((b - a) / 2);
  if (x < 0 || y < 0 || x >= RW || y >= RD) return undefined;
  return { x, y };
}

// Screen point to a slot on one of the two full walls, in view space.
export function pickWall(v: View, sx: number, sy: number): { wall: WallSide; slot: number } | undefined {
  const { w: RW, d: RD } = viewDims(v);
  const OX = originX(v);
  const bx = (sx - OX) / (TW / 2);
  const bz = (bx * (TH / 2) - (sy - OY)) / ZS;
  if (bx > 0 && bx < RW && bz > 0 && bz < WALL_H) return { wall: 'back', slot: Math.floor(bx) };
  const ly = -(sx - OX) / (TW / 2);
  const lz = (ly * (TH / 2) - (sy - OY)) / ZS;
  if (ly > 0 && ly < RD && lz > 0 && lz < WALL_H) return { wall: 'left', slot: Math.floor(ly) };
  return undefined;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function wallPt(wall: WallSide, u: number, z: number): Pt {
  if (wall === 'front') return iso(u, RD, z);
  if (wall === 'right') return iso(RW, u, z);
  return wall === 'back' ? iso(u, 0, z) : iso(0, u, z);
}

// What the textured wall needs to know about the room it is in.
interface WallArt {
  P: Project;
  world: WallSide;
  cornerAtStart: boolean;
  dmg: Damage;
  openings: Opening[];
  mood: Mood;
}

function drawWall(ctx: CanvasRenderingContext2D, wall: 'back' | 'left', f: Finish, art: WallArt) {
  const len = wall === 'back' ? RW : RD;
  const tex = wallTexture(f, art.world, WALL_H, art.dmg);
  onWall(ctx, art.P, art.world, WALL_H, () => ctx.drawImage(tex, 0, 0));
  shadeWall(ctx, art.P, art.world, WALL_H, wall === 'back' ? 0.02 : 0.13, art.cornerAtStart, art.openings, art.mood.sun);
  // Baseboard and top edge.
  poly(ctx, [wallPt(wall, 0, 0), wallPt(wall, len, 0), wallPt(wall, len, 0.12), wallPt(wall, 0, 0.12)], shade(f.color, -0.3));
  line(ctx, wallPt(wall, 0, WALL_H), wallPt(wall, len, WALL_H), shade(f.color, -0.35), 2);
}

function drawWindow(ctx: CanvasRenderingContext2D, wall: WallSide, slot: number, f: Finish, light: string, sky: string) {
  const big = f.id === 'win-picture';
  const door = f.id === 'win-french';
  const u0 = slot + (big ? 0.06 : 0.18);
  const u1 = slot + (big ? 0.94 : 0.82);
  const z0 = door ? 0.12 : big ? 0.8 : 1.15;
  const z1 = door ? 2.35 : 2.45;
  const frame = f.color;
  poly(ctx, [wallPt(wall, u0 - 0.05, z0 - 0.08), wallPt(wall, u1 + 0.05, z0 - 0.08), wallPt(wall, u1 + 0.05, z1 + 0.08), wallPt(wall, u0 - 0.05, z1 + 0.08)], frame);
  const glass = f.old ? '#b9c8cf' : sky;
  poly(ctx, [wallPt(wall, u0, z0), wallPt(wall, u1, z0), wallPt(wall, u1, z1), wallPt(wall, u0, z1)], glass);
  // Sky glint, tinted by the room's light.
  poly(ctx, [wallPt(wall, u0 + 0.08, z1 - 0.1), wallPt(wall, u0 + 0.3, z1 - 0.1), wallPt(wall, u0 + 0.12, z0 + 0.2), wallPt(wall, u0 + 0.06, z0 + 0.2)], shade(light, 0.6));
  const um = (u0 + u1) / 2;
  const zm = (z0 + z1) / 2;
  line(ctx, wallPt(wall, um, z0), wallPt(wall, um, z1), frame, 2);
  if (!door) line(ctx, wallPt(wall, u0, zm), wallPt(wall, u1, zm), frame, 2);
  if (f.id === 'win-shutter') {
    for (const [a, b] of [[u0 - 0.28, u0 - 0.06], [u1 + 0.06, u1 + 0.28]]) {
      poly(ctx, [wallPt(wall, a, z0), wallPt(wall, b, z0), wallPt(wall, b, z1), wallPt(wall, a, z1)], frame, shade(frame, -0.3));
    }
  }
  if (!door) poly(ctx, [wallPt(wall, u0 - 0.08, z0 - 0.08), wallPt(wall, u1 + 0.08, z0 - 0.08), wallPt(wall, u1 + 0.08, z0 - 0.16), wallPt(wall, u0 - 0.08, z0 - 0.16)], shade(frame, -0.15));
}

// An open doorway: a dark passage with a trim frame.
function drawDoor(ctx: CanvasRenderingContext2D, wall: WallSide, slot: number, wallF: Finish) {
  const u0 = slot + 0.1;
  const u1 = slot + 0.9;
  const z1 = 2.4;
  const trim = shade(wallF.color, 0.35);
  poly(ctx, [wallPt(wall, u0 - 0.07, 0), wallPt(wall, u1 + 0.07, 0), wallPt(wall, u1 + 0.07, z1 + 0.1), wallPt(wall, u0 - 0.07, z1 + 0.1)], trim, shade(trim, -0.2));
  poly(ctx, [wallPt(wall, u0, 0), wallPt(wall, u1, 0), wallPt(wall, u1, z1), wallPt(wall, u0, z1)], '#4a3e35');
  // A hint of the next room's light.
  poly(ctx, [wallPt(wall, u0 + 0.1, 0), wallPt(wall, u1 - 0.1, 0), wallPt(wall, u1 - 0.25, z1 - 0.3), wallPt(wall, u0 + 0.25, z1 - 0.3)], 'rgba(255,230,190,0.12)');
}

const STUB_H = 0.3;
// Height of the middle of a piece of wall art.
export const ART_Z = 2.08;

// The front and right walls are cut down so you can see in, like a dollhouse.
function drawStubs(ctx: CanvasRenderingContext2D, d: Design, wallF: Finish) {
  const T = 0.12;
  for (const wall of ['front', 'right'] as const) {
    const len = wall === 'front' ? RW : RD;
    for (let slot = 0; slot < len; slot++) {
      if (d.doors.some((x) => x.wall === wall && x.slot === slot)) continue;
      const win = d.windows.find((w) => w.wall === wall && w.slot === slot);
      const col = wallF.color;
      if (wall === 'front') box(ctx, slot, RD, 0, 1, T, STUB_H, { top: win ? '#bfe0f2' : shade(col, 0.2), left: shade(col, -0.08), right: shade(col, -0.2) });
      else box(ctx, RW, slot, 0, T, 1, STUB_H, { top: win ? '#bfe0f2' : shade(col, 0.2), left: shade(col, -0.08), right: shade(col, -0.2) });
    }
  }
}

const SPLASH_H = 0.75;

// Which tiles along a wall (in view space) get backsplash: every one with a counter-height
// kitchen piece against it, whether or not that piece carries a countertop.
export function splashRun(items: Placed[], wall: 'back' | 'left', len: number): { run: boolean[]; z0: number } {
  const run: boolean[] = Array.from({ length: len }, () => false);
  let z0 = 0.95;
  for (const p of items) {
    const def = itemById(p.id);
    if (!(def.kind === 'cabinet' || def.kind === 'appliance' || def.kind === 'upgrade') || def.h > 1 || def.h < 0.8) continue;
    if (wall === 'back' ? p.y !== 0 : p.x !== 0) continue;
    const fp = footprint(p);
    const a = wall === 'back' ? p.x : p.y;
    for (let i = a; i < a + (wall === 'back' ? fp.w : fp.d); i++) run[i] = true;
    z0 = def.h;
  }
  return { run, z0 };
}

// Tile along the wall above every counter-height kitchen piece that sits against it:
// cabinets, the stove, the dishwasher. It stops at window frames, sills and doorways.
function drawBacksplash(ctx: CanvasRenderingContext2D, d: Design, openings: Opening[], doors: { wall: WallSide; slot: number }[]) {
  const f = finishById(d.backsplash);
  if (f.cost === 0) return;
  for (const wall of ['back', 'left'] as const) {
    const len = wall === 'back' ? RW : RD;
    const { run, z0 } = splashRun(d.items, wall, len);
    if (!run.some(Boolean)) continue;
    const z1 = z0 + SPLASH_H;
    const world = wallFromView(VIEW, wall, 0).wall;
    const along = world === 'back' || world === 'front' ? 0 : 1;
    const worldU = (u: number) => toWorld(VIEW, wall === 'back' ? u : 0, wall === 'back' ? 0 : u)[along];
    const tex = splashTexture(f, world, SPLASH_H);
    onWall(ctx, PW, world, z1, () => {
      const H = SPLASH_H * PX;
      for (let i = 0; i < len; i++) {
        if (!run[i]) continue;
        let j = i;
        while (j + 1 < len && run[j + 1]) j++;
        const x0 = Math.min(worldU(i), worldU(j + 1)) * PX;
        const x1 = Math.max(worldU(i), worldU(j + 1)) * PX;
        i = j;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, H);
        // Cut out anything set into the wall.
        const cut = (u0: number, u1: number, za: number, zb: number) => {
          const cx0 = Math.max(x0, u0 * PX);
          const cx1 = Math.min(x1, u1 * PX);
          const cy0 = Math.max(0, (z1 - zb) * PX);
          const cy1 = Math.min(H, (z1 - za) * PX);
          if (cx1 > cx0 && cy1 > cy0) ctx.rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
        };
        for (const o of openings) if (o.wall === world) cut(o.u0 - 0.08, o.u1 + 0.08, o.z0 - 0.16, o.z1 + 0.08);
        for (const x of doors) if (x.wall === world) cut(x.slot + 0.03, x.slot + 0.97, 0, 2.5);
        ctx.clip('evenodd');
        ctx.drawImage(tex, 0, 0);
        // The left wall sits in shade; the counter shades the bottom course.
        if (wall === 'left') {
          ctx.fillStyle = 'rgba(22,14,10,0.14)';
          ctx.fillRect(x0, 0, x1 - x0, H);
        }
        const g = ctx.createLinearGradient(0, H, 0, H - 0.2 * PX);
        g.addColorStop(0, 'rgba(22,14,10,0.3)');
        g.addColorStop(1, 'rgba(22,14,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, H);
        // A finished top edge and ends.
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x0, 0, x1 - x0, 1.6);
        ctx.fillStyle = 'rgba(40,26,14,0.45)';
        ctx.fillRect(x0, 1.6, x1 - x0, 1.4);
        ctx.fillRect(x0, 0, 1.6, H);
        ctx.fillRect(x1 - 1.6, 0, 1.6, H);
        ctx.restore();
      }
    });
  }
}

interface BoxColors {
  top: string;
  left: string; // face toward +y
  right: string; // face toward +x
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number, c: BoxColors) {
  const z1 = z + h;
  poly(ctx, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z1), iso(x, y + d, z1)], c.left, 'rgba(0,0,0,0.12)');
  poly(ctx, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z1), iso(x + w, y, z1)], c.right, 'rgba(0,0,0,0.12)');
  poly(ctx, [iso(x, y, z1), iso(x + w, y, z1), iso(x + w, y + d, z1), iso(x, y + d, z1)], c.top, 'rgba(0,0,0,0.12)');
}

const tones = (base: string, top?: string): BoxColors => ({ top: top ?? shade(base, 0.15), left: base, right: shade(base, -0.18) });

// Map (u along the face, v up the face) to screen for the item's front face.
function frontPt(x: number, y: number, w: number, d: number, h: number, frontX: boolean, u: number, v: number): Pt {
  return frontX ? iso(x + w, y + u * d, v * h) : iso(x + u * w, y + d, v * h);
}

function inset(ctx: CanvasRenderingContext2D, fp: (u: number, v: number) => Pt, u0: number, u1: number, v0: number, v1: number, fill?: string, stroke?: string) {
  poly(ctx, [fp(u0, v0), fp(u1, v0), fp(u1, v1), fp(u0, v1)], fill, stroke, 1);
}

export interface ItemOpts {
  ghost?: boolean;
  valid?: boolean;
  selected?: boolean;
  arrow?: 'faint' | 'strong';
  // The tired original kitchen: yellowed, rusty, chipped.
  aged?: boolean;
}

const hexMix = (a: string, b: string, t: number) => {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
};

// Dirt, rust and chips laid over the visible faces of an old piece. Seeds follow the
// piece's own faces, so each side keeps its marks as the camera turns.
function drawAge(ctx: CanvasRenderingContext2D, p: Placed, w: number, dep: number, h: number, metal: boolean) {
  const { x, y } = p;
  const kind = metal ? 'metal' : 'laminate';
  const seed = (face: number) => p.uid * 16 + ((face - p.rot + 4) % 4);
  onPlane(ctx, iso(x, y + dep, h), iso(x + 1, y + dep, h), iso(x, y + dep, h - 1), () => ctx.drawImage(grime(w, h, kind, seed(0)), 0, 0));
  onPlane(ctx, iso(x + w, y + dep, h), iso(x + w, y + dep - 1, h), iso(x + w, y + dep, h - 1), () => ctx.drawImage(grime(dep, h, kind, seed(1)), 0, 0));
  // The top is laid out in the piece's own space so its stains turn with it.
  const def = itemById(p.id);
  const l = tileSpace(p, w, dep);
  const c = (lx: number, ly: number) => iso(...l(lx + 0.5 - def.w / 2, ly + 0.5 - def.d / 2), h + 0.002);
  onPlane(ctx, c(0, 0), c(1, 0), c(0, 1), () => ctx.drawImage(grime(def.w, def.d, 'top', p.uid * 16 + 5), 0, 0));
}

// Draw on a piece's top in its own space: x across it, y from its back to its front.
function onTop(ctx: CanvasRenderingContext2D, p: Placed, w: number, dep: number, z: number, fn: () => void) {
  const def = itemById(p.id);
  const l = tileSpace(p, w, dep);
  const c = (lx: number, ly: number) => iso(...l(lx + 0.5 - def.w / 2, ly + 0.5 - def.d / 2), z);
  onPlane(ctx, c(0, 0), c(1, 0), c(0, 1), fn);
}

// Paint the two faces of a box that the camera sees. `fn` is given which of the piece's
// own sides it is painting (0 front, 1 right, 2 back, 3 left) and the face size in pixels.
function paintFaces(ctx: CanvasRenderingContext2D, p: Placed, w: number, dep: number, z0: number, z1: number, fn: (side: number, W: number, H: number) => void) {
  const { x, y } = p;
  const H = (z1 - z0) * PX;
  const face = (o: Pt, ax: Pt, ay: Pt, side: number, W: number, dim: number) =>
    onPlane(ctx, o, ax, ay, () => {
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      fn(side, W, H);
      // Contact shadow at the floor, and the side face turned from the light.
      const g = ctx.createLinearGradient(0, H, 0, H - 0.3 * PX);
      g.addColorStop(0, 'rgba(22,14,10,0.22)');
      g.addColorStop(1, 'rgba(22,14,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (dim) {
        ctx.fillStyle = `rgba(22,14,10,${dim})`;
        ctx.fillRect(0, 0, W, H);
      }
    });
  face(iso(x, y + dep, z1), iso(x + 1, y + dep, z1), iso(x, y + dep, z1 - 1), (4 - p.rot) % 4, w * PX, 0);
  face(iso(x + w, y + dep, z1), iso(x + w, y + dep - 1, z1), iso(x + w, y + dep, z1 - 1), (5 - p.rot) % 4, dep * PX, 0.2);
}

// Cut a face-sized piece out of a big sheet of material, a different piece for each face.
function sheet(ctx: CanvasRenderingContext2D, tex: HTMLCanvasElement, W: number, H: number, seed: number, side: number) {
  const ox = Math.floor(hash2(seed, side, 11) * Math.max(0, tex.width - W));
  const oy = Math.floor(hash2(seed, side, 12) * Math.max(0, tex.height - H));
  ctx.drawImage(tex, ox, oy, W, H, 0, 0, W, H);
}

// The countertop over a piece: the room-wide slab texture, cut to this piece's top.
function drawCounter(ctx: CanvasRenderingContext2D, f: Finish, aged: boolean, x: number, y: number, w: number, dep: number, z: number) {
  const o = 0.03;
  const t = 0.08;
  const c = aged ? hexMix(f.color, '#c2ad7c', 0.3) : f.color;
  box(ctx, x - o, y - o, z, w + o * 2, dep + o * 2, t, tones(shade(c, -0.08), c));
  const top = [iso(x - o, y - o, z + t), iso(x + w + o, y - o, z + t), iso(x + w + o, y + dep + o, z + t), iso(x - o, y + dep + o, z + t)];
  ctx.save();
  ctx.beginPath();
  top.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.clip();
  const tex = counterTexture(f);
  onPlane(ctx, PW(0, 0, z + t), PW(1, 0, z + t), PW(0, 1, z + t), () => ctx.drawImage(tex, -COUNTER_PAD * PX, -COUNTER_PAD * PX));
  if (aged) {
    ctx.fillStyle = 'rgba(194,173,124,0.3)';
    ctx.fill();
  }
  // Polished stone and sealed wood pick up a soft band of window light.
  if (!f.old && f.id !== 'ctr-concrete') {
    const g = ctx.createLinearGradient(top[0][0], top[0][1], top[2][0], top[2][1]);
    g.addColorStop(0, 'rgba(255,255,255,0.26)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    g.addColorStop(1, 'rgba(60,40,20,0.08)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
  // Rounded front edges catch the light.
  line(ctx, top[3], top[2], 'rgba(255,255,255,0.55)', 1);
  line(ctx, top[2], top[1], 'rgba(255,255,255,0.3)', 1);
}

// An arrow on top of an item pointing the way its front faces.
function drawArrow(ctx: CanvasRenderingContext2D, p: Placed, strong: boolean) {
  const { w, d } = footprint(p);
  const z = itemById(p.id).h + 0.02;
  const [dx, dy] = rotDir(p.rot as Rot);
  const cx = p.x + w / 2;
  const cy = p.y + d / 2;
  const len = 0.32;
  const wing = 0.16;
  // Perpendicular for the arrowhead.
  const px = -dy;
  const py = dx;
  const tip = iso(cx + dx * len, cy + dy * len, z);
  const back = iso(cx - dx * len * 0.6, cy - dy * len * 0.6, z);
  const l = iso(cx + dx * (len - 0.18) + px * wing, cy + dy * (len - 0.18) + py * wing, z);
  const r = iso(cx + dx * (len - 0.18) - px * wing, cy + dy * (len - 0.18) - py * wing, z);
  ctx.save();
  ctx.globalAlpha = strong ? 0.95 : 0.3;
  line(ctx, back, tip, 'rgba(40,30,20,0.55)', 5);
  line(ctx, back, tip, '#fff', 2.5);
  poly(ctx, [tip, l, r], '#fff', 'rgba(40,30,20,0.55)', 1.2);
  ctx.restore();
}

export function drawItem(ctx: CanvasRenderingContext2D, p: Placed, d: Design, opts: ItemOpts = {}) {
  const def = itemById(p.id);
  const { w, d: dep } = footprint(p);
  const { x, y } = p;
  const h = def.h;
  const frontX = p.rot % 2 === 1;
  // Fronts facing away from the camera are hidden, so their details are skipped.
  const facing = p.rot < 2;
  const fp = (u: number, v: number) => frontPt(x, y, w, dep, h, frontX, u, v);
  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.6;

  const cab = finishById(d.cabinet);
  const ctr = finishById(d.counter);
  const old = (c: string) => (opts.aged ? hexMix(c, '#c2ad7c', 0.3) : c);
  const sideBase = old(def.usesCabinet ? cab.color : def.side);

  if (def.kind === 'junk' && drawJunk({ ctx, iso }, p, def)) {
    // Drawn by hand in art/props.
  } else if (drawFurniture({ ctx, iso }, p, def, { w, d: dep })) {
    // Tables, chairs, plants and the rest are drawn by hand in art/furniture.
  } else {
    const aged = !!opts.aged;
    const bodyH = def.usesCounter ? h - 0.08 : h;
    const toeKick = def.usesCabinet ? 0.09 : 0;
    const look = cabLook(cab.id);
    // What the body is made of.
    const steel = def.essential === 'stove' || def.id === 'fridge' || def.id === 'dishwasher';
    const mat = def.usesCabinet
      ? cabinetMaterial(cab, look.wood)
      : def.id === 'coffee-bar'
        ? applianceMaterial('wood', def.side)
        : steel && !aged
          ? applianceMaterial('steel', def.side)
          : applianceMaterial('enamel', old(def.side));
    if (toeKick) box(ctx, x + 0.05, y + 0.05, 0, w - 0.1, dep - 0.1, toeKick, tones('#2a2019'));
    box(ctx, x, y, toeKick, w, dep, bodyH - toeKick, tones(sideBase, def.usesCabinet || def.usesCounter ? shade(sideBase, 0.1) : old(def.top)));
    paintFaces(ctx, p, w, dep, toeKick, bodyH, (side, W, H) => {
      sheet(ctx, mat, W, H, p.uid, side);
      if (def.usesCabinet) {
        if (aged) {
          ctx.fillStyle = 'rgba(194,173,124,0.3)';
          ctx.fillRect(0, 0, W, H);
        }
        if (side !== 0) cabinetSide(ctx, W, H);
        else if (aged) return;
        else if (def.id === 'tall-pantry') pantryFront(ctx, W, H, look);
        else baseFront(ctx, W, H, look, Math.max(1, Math.round(W / PX)));
      } else if (side !== 0 || !applianceFront(ctx, def.id, W, H)) applianceSide(ctx, W, H);
    });

    const door = shade(sideBase, -0.12);
    if (facing && aged && def.usesCabinet && def.id !== 'tall-pantry') {
      const n = Math.max(1, Math.round(frontX ? dep : w));
      for (let i = 0; i < n; i++) {
        const a = i / n + 0.06 / n;
        const b = (i + 1) / n - 0.06 / n;
        const wear = hash2(p.uid, i, 3);
        if (wear < 0.3) {
          // A door long gone: the dark inside and a sagging shelf.
          inset(ctx, fp, a, b, 0.2, 0.72, '#33261b', door);
          line(ctx, fp(a, 0.47), fp(b, 0.44), '#6b5238', 2);
          continue;
        }
        if (wear < 0.6) {
          // A door hanging off its top hinge.
          poly(ctx, [fp(a, 0.17), fp(b, 0.22), fp(b, 0.74), fp(a, 0.72)], shade(sideBase, -0.05), shade(sideBase, -0.4), 1.2);
          continue;
        }
        inset(ctx, fp, a, b, 0.2, 0.72, undefined, door);
        line(ctx, fp(a + (b - a) * 0.15, 0.82), fp(b - (b - a) * 0.15, 0.82), door, 2);
      }
    } else if (facing && aged && def.id === 'tall-pantry') {
      inset(ctx, fp, 0.08, 0.92, 0.06, 0.62, undefined, door);
      inset(ctx, fp, 0.08, 0.92, 0.66, 0.96, undefined, door);
    }

    if (def.usesCounter) drawCounter(ctx, ctr, aged, x, y, w, dep, bodyH);
    if (def.essential === 'stove') onTop(ctx, p, w, dep, h + 0.002, () => cooktop(ctx, def.w * PX, def.d * PX));
    if (def.essential === 'sink') {
      onTop(ctx, p, w, dep, h + 0.002, () => sinkBowl(ctx, def.w * PX, def.d * PX));
      // A gooseneck tap rising from the back of the bowl and arcing over it.
      const l = tileSpace(p, w, dep);
      const base = iso(...l(0.5, 0.17), h);
      const tip = iso(...l(0.5, 0.42), h + 0.22);
      const crown = iso(...l(0.5, 0.26), h + 0.5);
      for (const [col, lw] of [['#6d757c', 3.4], ['#dfe4e8', 1.4]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(base[0], base[1]);
        ctx.lineTo(base[0], base[1] - 9);
        ctx.quadraticCurveTo(crown[0], crown[1] - 4, tip[0], tip[1]);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }

  if (opts.aged && def.kind !== 'junk' && (def.kind === 'cabinet' || def.kind === 'appliance')) drawAge(ctx, p, w, dep, h, def.kind === 'appliance');

  if (opts.arrow) drawArrow(ctx, p, opts.arrow === 'strong');

  if (opts.ghost || opts.selected) {
    const col = opts.ghost ? (opts.valid ? 'rgba(80,170,110,0.9)' : 'rgba(210,80,70,0.9)') : 'rgba(255,190,70,0.95)';
    poly(ctx, [iso(x, y), iso(x + w, y), iso(x + w, y + dep), iso(x, y + dep)], opts.ghost ? col.replace('0.9', '0.25') : undefined, col, 2.5);
  }
  ctx.restore();
}

export interface SceneOpts {
  view?: View;
  // Ghost and items are in world space; hover targets are in view space.
  ghost?: { p: Placed; valid: boolean };
  selectedUid?: number;
  arrows?: boolean;
  hoverWall?: { wall: WallSide; slot: number };
  hoverTile?: { x: number; y: number };
  // Junk that is being hauled away fades out.
  fading?: Map<number, number>;
}

const depth = (p: Placed) => {
  const f = footprint(p);
  return p.x + p.y + (f.w + f.d) / 2 + (itemById(p.id).h < 0.1 ? -10 : 0);
};

export function drawScene(ctx: CanvasRenderingContext2D, s: GameState, o: SceneOpts = {}) {
  const v = o.view ?? 0;
  setView(v);
  const d = designToView(v, s.design);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Soft shadow under the room.
  ctx.fillStyle = 'rgba(70,50,30,0.12)';
  poly(ctx, [iso(-0.3, -0.3), iso(RW + 0.4, -0.3), iso(RW + 0.4, RD + 0.4), iso(-0.3, RD + 0.4)], 'rgba(70,50,30,0.12)');

  const wallF = finishById(d.wall);
  const light = finishById(d.lighting);
  const mood = setMood(light.id);
  const P: Project = (x, y, z = 0) => iso(...toView(v, x, y), z);
  // Trouble shows as a hint in the walls before it is found, and in full once it is.
  // What is under the floor stays out of sight until the floor comes up.
  const dmg: Damage = {};
  for (const i of s.issues) {
    if (i.status === 'found' || i.status === 'resurfaced') dmg[i.id] = 2;
    else if (i.status === 'hidden' && issueById(i.id).trigger === 'walls') dmg[i.id] = 1;
  }
  const openings: Opening[] = s.design.windows.map((w) => {
    const big = w.finish === 'win-picture';
    const door = w.finish === 'win-french';
    return { wall: w.wall, u0: w.slot + (big ? 0.06 : 0.18), u1: w.slot + (big ? 0.94 : 0.82), z0: door ? 0.12 : big ? 0.8 : 1.15, z1: door ? 2.35 : 2.45 };
  });
  for (const wall of ['back', 'left'] as const) {
    const world = wallFromView(v, wall, 0).wall;
    drawWall(ctx, wall, wallF, { P, world, cornerAtStart: wallSpotToView(v, world, 0).u < 0.5, dmg, openings, mood });
  }
  drawBacksplash(ctx, d, openings, s.design.doors);
  for (const w of d.windows) if (w.wall === 'back' || w.wall === 'left') drawWindow(ctx, w.wall, w.slot, finishById(w.finish), light.color, mood.glass);
  for (const x of d.doors) if (x.wall === 'back' || x.wall === 'left') drawDoor(ctx, x.wall, x.slot, wallF);
  // Wall art hangs at eye level on whichever walls are showing.
  for (const a of s.design.art) {
    const side = wallSpotToView(v, a.wall, a.slot + 0.5).wall;
    if (side !== 'back' && side !== 'left') continue;
    onWallSlot(ctx, P, a.wall, a.slot, ART_Z, () => {
      // The left wall sits in shade, so what hangs on it is a touch dimmer.
      if (side === 'left') ctx.filter = 'brightness(0.9)';
      ctx.scale(1.15, 1.15);
      drawArt(ctx, a.id);
    });
  }
  if (o.hoverWall) {
    const { wall, slot } = o.hoverWall;
    poly(ctx, [wallPt(wall, slot + 0.05, 0.2), wallPt(wall, slot + 0.95, 0.2), wallPt(wall, slot + 0.95, WALL_H - 0.15), wallPt(wall, slot + 0.05, WALL_H - 0.15)], 'rgba(255,200,90,0.18)', 'rgba(230,160,50,0.9)', 2);
  }

  const floorF = finishById(d.floor);
  const floorTex = floorTexture(floorF, dmg);
  onFloor(ctx, P, () => ctx.drawImage(floorTex, 0, 0));
  shadeFloor(ctx, P);
  sunPools(ctx, P, openings, mood.sun, mood.power);
  // Lamps and fires warm the floor around them; the old tube just flattens everything.
  if (mood.tube) lightPool(ctx, P, ROOM_W / 2, ROOM_D / 2, 3.4, '214,236,206', 0.5);
  for (const p of s.design.items) {
    const f = footprint(p);
    if (p.id === 'lamp') lightPool(ctx, P, p.x + 0.5, p.y + 0.5, 2.3, '255,206,130', mood.lamp);
    if (p.id === 'fireplace') lightPool(ctx, P, p.x + f.w / 2, p.y + f.d / 2, 1.9, '255,150,70', mood.lamp * 0.9);
  }
  if (o.hoverTile) {
    const { x, y } = o.hoverTile;
    poly(ctx, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], 'rgba(255,255,255,0.25)', 'rgba(230,160,50,0.8)', 1.5);
  }
  const all: { p: Placed; opts: ItemOpts; alpha?: number }[] = [
    ...d.items.map((p) => {
      const selected = p.uid === o.selectedUid;
      return { p, opts: { selected, aged: !s.demoDone, arrow: o.arrows ? (selected ? 'strong' : 'faint') : undefined } as ItemOpts };
    }),
    ...s.junk.map((p) => ({ p: placedToView(v, p), opts: {}, alpha: o.fading?.get(p.uid) })),
  ];
  if (o.ghost) all.push({ p: placedToView(v, o.ghost.p), opts: { ghost: true, valid: o.ghost.valid, arrow: 'strong' } });
  all.sort((a, b) => depth(a.p) - depth(b.p));
  // Junk pools its own shadows, shaped to each pile.
  for (const p of s.design.items) {
    const f = footprint(p);
    castShadow(ctx, P, p.x, p.y, f.w, f.d, itemById(p.id).h);
  }
  for (const it of all) {
    ctx.save();
    if (it.alpha !== undefined) ctx.globalAlpha = it.alpha;
    drawItem(ctx, it.p, d, it.opts);
    ctx.restore();
  }
  drawStubs(ctx, d, wallF);

  // Room lighting mood: a colour wash over everything drawn, then the glow of each lamp
  // and fire laid back on top, so they stand out as the room dims.
  if (mood.wash) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = mood.wash;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const p of d.items) {
      if (p.id !== 'lamp' && p.id !== 'fireplace') continue;
      const lamp = p.id === 'lamp';
      const [gx, gy] = iso(p.x + 0.5, p.y + 0.5, lamp ? 1.4 : 0.5);
      const r = lamp ? 150 : 110;
      const g = ctx.createRadialGradient(gx, gy, 4, gx, gy, r);
      const a = (lamp ? 0.42 : 0.34) * mood.lamp;
      g.addColorStop(0, `rgba(255,214,140,${a})`);
      g.addColorStop(0.4, `rgba(255,190,110,${a * 0.4})`);
      g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}

// Draw a snapshot of the room to an image URL, for the before/after reveal.
export function snapshot(s: GameState, scale = 2): string {
  const c = document.createElement('canvas');
  c.width = CANVAS_W * scale;
  c.height = CANVAS_H * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawScene(ctx, s);
  return c.toDataURL('image/png');
}

export const issueName = (id: string) => issueById(id).name;
