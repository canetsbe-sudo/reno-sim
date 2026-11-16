import { describe, expect, it } from 'vitest';
import { tileSpace } from '../src/art/props';
import { rotDir } from '../src/view';
import type { Rot } from '../src/data';

describe('tileSpace', () => {
  it('keeps a piece inside its tile and points its front the way it faces', () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const l = tileSpace({ x: 3, y: 2, rot });
      const [cx, cy] = l(0.5, 0.5);
      expect([cx, cy]).toEqual([3.5, 2.5]);
      // The front of the piece is +y in its own space.
      const [fx, fy] = l(0.5, 1);
      const [dx, dy] = rotDir(rot);
      expect(fx - cx).toBeCloseTo(dx * 0.5);
      expect(fy - cy).toBeCloseTo(dy * 0.5);
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const [x, y] = l(a, b);
        expect(x).toBeGreaterThanOrEqual(3);
        expect(x).toBeLessThanOrEqual(4);
        expect(y).toBeGreaterThanOrEqual(2);
        expect(y).toBeLessThanOrEqual(3);
      }
    }
  });
});
