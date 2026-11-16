import { describe, expect, it } from 'vitest';
import { WALL_ART, artById } from '../src/data';
import { designCost, newGame, rate } from '../src/state';
import { designToView, wallFromView, type View } from '../src/view';

describe('wall art', () => {
  it('starts with bare walls and costs what the piece costs, with no crew time', () => {
    const s = newGame('fixer', 'budget', false, () => 0.99);
    expect(s.design.art).toEqual([]);
    const before = designCost(s.design);
    s.design.art.push({ wall: 'back', slot: 6, id: 'art-clock' });
    const after = designCost(s.design);
    expect(after.materials - before.materials).toBe(artById('art-clock').cost);
    expect(after.laborDays).toBe(before.laborDays);
  });

  it('counts as a finishing touch', () => {
    const s = newGame('fixer', 'freedom', false);
    const tip = (t: string) => rate(s).tips.concat(rate(s).good).some((x) => x.includes(t));
    expect(tip('lived in')).toBe(false);
    s.design.art.push({ wall: 'left', slot: 1, id: WALL_ART[0].id });
    expect(tip('lived in')).toBe(true);
  });

  it('turns with the room and comes back to the same slot', () => {
    const s = newGame('fixer', 'freedom', false);
    s.design.art.push({ wall: 'back', slot: 6, id: 'art-mirror' });
    for (const v of [0, 1, 2, 3] as View[]) {
      const a = designToView(v, s.design).art[0];
      expect(wallFromView(v, a.wall, a.slot)).toEqual({ wall: 'back', slot: 6 });
    }
  });
});
