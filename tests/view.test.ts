import { describe, expect, it } from 'vitest';
import { ROOM_D, ROOM_W } from '../src/data';
import { footprint } from '../src/state';
import { placedFromView, placedToView, rotToView, rotToWorld, toView, toWorld, wallFromView, wallToView, type View } from '../src/view';

const views: View[] = [0, 1, 2, 3];

describe('camera rotation', () => {
  it('round-trips points', () => {
    for (const v of views) {
      for (const [x, y] of [[0, 0], [3, 2], [ROOM_W, ROOM_D]]) expect(toWorld(v, ...toView(v, x, y))).toEqual([x, y]);
    }
  });

  it('brings the left wall to the back after one turn', () => {
    expect(wallToView(1, 'left', 0).wall).toBe('back');
    expect(wallToView(1, 'back', 0).wall).toBe('right');
    expect(wallToView(2, 'front', 0).wall).toBe('back');
    expect(wallToView(3, 'right', 0).wall).toBe('back');
  });

  it('round-trips wall slots', () => {
    for (const v of views) {
      for (const [wall, slot] of [['back', 3], ['left', 1], ['front', 6], ['right', 5]] as const) {
        const view = wallToView(v, wall, slot);
        expect(wallFromView(v, view.wall, view.slot)).toEqual({ wall, slot });
      }
    }
  });

  it('round-trips placed items, footprint and facing', () => {
    for (const v of views) {
      const p = { uid: 1, id: 'table', x: 2, y: 3, rot: 1 as const };
      const vp = placedToView(v, p);
      const back = placedFromView(v, p.id, vp.x, vp.y, p.rot);
      expect(back).toEqual({ id: p.id, x: p.x, y: p.y, rot: p.rot });
      const vf = footprint(vp);
      const f = footprint(p);
      expect(v % 2 ? [vf.d, vf.w] : [vf.w, vf.d]).toEqual([f.w, f.d]);
    }
  });

  it('round-trips facing', () => {
    for (const v of views) for (const r of [0, 1, 2, 3] as const) expect(rotToView(v, rotToWorld(v, r))).toBe(r);
    // Facing the camera with the front wall at the back means facing -y in the room.
    expect(rotToWorld(2, 0)).toBe(2);
  });

  it('turns an item facing into the room toward the camera when its wall is at the back', () => {
    // A cabinet on the left wall faces +x; after one turn the left wall is the back, so it faces +y (rot 0).
    expect(placedToView(1, { uid: 1, id: 'base-cabinet', x: 0, y: 2, rot: 1 }).rot).toBe(0);
  });
});
