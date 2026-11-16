import { describe, expect, it } from 'vitest';
import { pickTile, pickWall, screenPoint, WALL_H } from '../src/render';
import { viewDims, type View } from '../src/view';

const views: View[] = [0, 1, 2, 3];

describe('picking', () => {
  it('finds every floor tile in every view without drawing first', () => {
    for (const v of views) {
      const { w, d } = viewDims(v);
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < d; y++) expect(pickTile(v, ...screenPoint(v, x + 0.5, y + 0.5))).toEqual({ x, y });
      }
      expect(pickTile(v, ...screenPoint(v, w + 0.5, 0.5))).toBeUndefined();
    }
  });

  it('uses the view it is given, not the last one drawn', () => {
    // The far corner of an 8-deep turned room is off the floor in the unturned view.
    const p = screenPoint(1, 0.5, 7.5);
    expect(pickTile(1, ...p)).toEqual({ x: 0, y: 7 });
    expect(pickTile(0, ...p)).toBeUndefined();
  });

  it('finds wall slots on the back and left walls in every view', () => {
    for (const v of views) {
      const { w, d } = viewDims(v);
      expect(pickWall(v, ...screenPoint(v, w - 0.5, 0, WALL_H / 2))).toEqual({ wall: 'back', slot: w - 1 });
      expect(pickWall(v, ...screenPoint(v, 0, d - 0.5, WALL_H / 2))).toEqual({ wall: 'left', slot: d - 1 });
    }
  });
});
