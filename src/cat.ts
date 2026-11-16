// The house cat. It is only company: it never blocks a tile, costs nothing and is not
// saved. Where it sits is worked out fresh from the room and a slow clock, so it wanders
// to a new spot every so often and gets out of the way when something lands on it.
import { ROOM_D, ROOM_W, itemById, type Rot } from './data';
import { hash2 } from './art/noise';
import { doorTile, footprint, type GameState } from './state';

export type CatPose = 'sit' | 'loaf' | 'sleep';

export interface CatSpot {
  // The floor tile it is on, in room (world) space.
  x: number;
  y: number;
  rot: Rot;
  pose: CatPose;
  // Why it likes it here.
  cozy: boolean;
}

const key = (x: number, y: number) => y * ROOM_W + x;

// Tiles the cat cannot settle on: anything with furniture, cabinets or junk on it, and
// the tile just inside each doorway. Rugs are fair game.
export function catBlocked(s: GameState): Set<number> {
  const out = new Set<number>();
  for (const p of [...s.design.items, ...s.junk]) {
    if (itemById(p.id).h < 0.1) continue;
    const f = footprint(p);
    for (let x = p.x; x < p.x + f.w; x++) for (let y = p.y; y < p.y + f.d; y++) out.add(key(x, y));
  }
  for (const d of s.design.doors) {
    const t = doorTile(d);
    out.add(key(t.x, t.y));
  }
  return out;
}

// How much the cat likes each tile: sun through a window, a rug, the warmth of the stove.
export function catLikes(s: GameState): Map<number, number> {
  const like = new Map<number, number>();
  const add = (x: number, y: number, n: number) => {
    if (x < 0 || y < 0 || x >= ROOM_W || y >= ROOM_D) return;
    like.set(key(x, y), (like.get(key(x, y)) ?? 0) + n);
  };
  // The sun comes in over the back-left corner and lands a step or two into the room.
  for (const w of s.design.windows) {
    for (const n of [1, 2]) {
      if (w.wall === 'back') add(w.slot + 1, n, 3);
      if (w.wall === 'left') add(n, w.slot + 1, 3);
    }
  }
  for (const p of s.design.items) {
    const f = footprint(p);
    if (p.id === 'rug') for (let x = p.x; x < p.x + f.w; x++) for (let y = p.y; y < p.y + f.d; y++) add(x, y, 2.5);
    if (p.id === 'fireplace') for (let x = p.x - 1; x <= p.x + 1; x++) for (let y = p.y - 1; y <= p.y + 1; y++) add(x, y, 3);
  }
  return like;
}

// Where the cat is at a given tick of its clock, or nowhere if the room is packed solid.
export function catSpot(s: GameState, tick: number): CatSpot | undefined {
  const blocked = catBlocked(s);
  const like = catLikes(s);
  let best: { x: number; y: number; score: number } | undefined;
  // Each tile draws its own lot, so changing one corner of the room does not send the
  // cat running from another.
  for (let x = 0; x < ROOM_W; x++) {
    for (let y = 0; y < ROOM_D; y++) {
      if (blocked.has(key(x, y))) continue;
      // A tile she likes four times as much is four times as likely to win.
      const score = Math.pow(hash2(x, y, tick * 7 + 3), 1 / (1 + (like.get(key(x, y)) ?? 0)));
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) return undefined;
  const cozy = (like.get(key(best.x, best.y)) ?? 0) > 0;
  const r = hash2(best.x + tick, best.y - tick, 41);
  // Warm spots are for napping; anywhere else it mostly sits and watches the work.
  const pose: CatPose = cozy ? (r < 0.5 ? 'sleep' : r < 0.8 ? 'loaf' : 'sit') : r < 0.5 ? 'sit' : r < 0.8 ? 'loaf' : 'sleep';
  const rot = Math.floor(hash2(best.x, best.y, tick * 13 + 5) * 4) as Rot;
  return { x: best.x, y: best.y, rot, pose, cozy };
}
