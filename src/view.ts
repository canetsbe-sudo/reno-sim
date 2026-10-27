// Camera rotation. The renderer always draws the back and left walls in full and the
// front and right walls cut down, so turning the camera means mapping the room into
// "view space" where a different wall sits at the back.
import { ROOM_D, ROOM_W, type Rot, type WallSide } from './data';
import { footprint, type Design, type Door, type Placed } from './state';

// Quarter turns of the camera, clockwise.
export type View = 0 | 1 | 2 | 3;

export const viewDims = (v: View) => (v % 2 ? { w: ROOM_D, d: ROOM_W } : { w: ROOM_W, d: ROOM_D });

// A point on the floor, world to view. One turn brings the left wall to the back.
export function toView(v: View, x: number, y: number): [number, number] {
  switch (v) {
    case 0:
      return [x, y];
    case 1:
      return [ROOM_D - y, x];
    case 2:
      return [ROOM_W - x, ROOM_D - y];
    case 3:
      return [y, ROOM_W - x];
  }
}

export function toWorld(v: View, x: number, y: number): [number, number] {
  switch (v) {
    case 0:
      return [x, y];
    case 1:
      return [y, ROOM_D - x];
    case 2:
      return [ROOM_W - x, ROOM_D - y];
    case 3:
      return [ROOM_W - y, x];
  }
}

// Front direction for each rotation: +y, +x, -y, -x.
const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];
export const rotDir = (r: Rot) => DIRS[r];

function rotTo(v: View, r: Rot, inverse: boolean): Rot {
  const [dx, dy] = DIRS[r];
  const [ax, ay] = inverse ? toWorld(v, dx, dy) : toView(v, dx, dy);
  const [ox, oy] = inverse ? toWorld(v, 0, 0) : toView(v, 0, 0);
  const i = DIRS.findIndex(([x, y]) => x === ax - ox && y === ay - oy);
  return i as Rot;
}

// Facing as seen on screen to facing in the room, and back.
export const rotToWorld = (v: View, r: Rot) => rotTo(v, r, true);
export const rotToView = (v: View, r: Rot) => rotTo(v, r, false);

// Map an axis-aligned rectangle and return its new top-left corner.
function rectTo(map: (x: number, y: number) => [number, number], x: number, y: number, w: number, d: number) {
  const [x0, y0] = map(x, y);
  const [x1, y1] = map(x + w, y + d);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1) };
}

export function placedToView(v: View, p: Placed): Placed {
  const f = footprint(p);
  const at = rectTo((x, y) => toView(v, x, y), p.x, p.y, f.w, f.d);
  return { ...p, ...at, rot: rotTo(v, p.rot, false) };
}

// The world placement for an item whose top-left corner sits on a view tile.
export function placedFromView(v: View, id: string, vx: number, vy: number, worldRot: Rot): Omit<Placed, 'uid'> {
  const f = footprint({ uid: 0, id, x: 0, y: 0, rot: worldRot });
  const vw = v % 2 ? f.d : f.w;
  const vd = v % 2 ? f.w : f.d;
  const at = rectTo((x, y) => toWorld(v, x, y), vx, vy, vw, vd);
  return { id, x: at.x, y: at.y, rot: worldRot };
}

// The midpoint of a wall slot, on the floor.
function slotMid(side: WallSide, slot: number, w: number, d: number): [number, number] {
  if (side === 'back') return [slot + 0.5, 0];
  if (side === 'front') return [slot + 0.5, d];
  if (side === 'left') return [0, slot + 0.5];
  return [w, slot + 0.5];
}

function sideAt(x: number, y: number, d: number): { wall: WallSide; slot: number } {
  const e = 1e-6;
  if (Math.abs(y) < e) return { wall: 'back', slot: Math.floor(x) };
  if (Math.abs(y - d) < e) return { wall: 'front', slot: Math.floor(x) };
  if (Math.abs(x) < e) return { wall: 'left', slot: Math.floor(y) };
  return { wall: 'right', slot: Math.floor(y) };
}

export function wallToView(v: View, side: WallSide, slot: number) {
  const [mx, my] = slotMid(side, slot, ROOM_W, ROOM_D);
  const [vx, vy] = toView(v, mx, my);
  const dims = viewDims(v);
  return sideAt(vx, vy, dims.d);
}

export function wallFromView(v: View, side: WallSide, slot: number) {
  const dims = viewDims(v);
  const [mx, my] = slotMid(side, slot, dims.w, dims.d);
  const [wx, wy] = toWorld(v, mx, my);
  return sideAt(wx, wy, ROOM_D);
}

export function designToView(v: View, d: Design): Design {
  if (v === 0) return d;
  const wall = <T extends Door>(x: T): T => ({ ...x, ...wallToView(v, x.wall, x.slot) });
  return {
    ...d,
    items: d.items.map((p) => placedToView(v, p)),
    windows: d.windows.map(wall),
    doors: d.doors.map(wall),
  };
}
