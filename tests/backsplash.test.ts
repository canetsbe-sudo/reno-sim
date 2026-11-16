import { describe, expect, it } from 'vitest';
import { splashRun } from '../src/render';
import type { Placed } from '../src/state';

const at = (id: string, x: number, y: number, uid: number): Placed => ({ uid, id, x, y, rot: 0 });

describe('splashRun', () => {
  it('tiles behind the stove and dishwasher as well as cabinets, with no gaps', () => {
    const items = [at('base-cabinet', 1, 0, 1), at('stove', 2, 0, 2), at('sink-cabinet', 3, 0, 3), at('dishwasher', 4, 0, 4), at('stove-pro', 5, 0, 5)];
    expect(splashRun(items, 'back', 8).run).toEqual([false, true, true, true, true, true, true, false]);
  });

  it('skips tall pieces, furniture and anything not against the wall', () => {
    const items = [at('fridge', 0, 0, 1), at('tall-pantry', 1, 0, 2), at('table', 2, 0, 3), at('base-cabinet', 4, 1, 4)];
    expect(splashRun(items, 'back', 8).run.some(Boolean)).toBe(false);
  });

  it('follows the left wall too', () => {
    const items = [at('stove', 0, 2, 1), at('base-cabinet', 0, 3, 2)];
    expect(splashRun(items, 'left', 6).run).toEqual([false, false, true, true, false, false]);
  });
});
