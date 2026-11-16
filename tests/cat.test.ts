import { describe, expect, it } from 'vitest';
import { catBlocked, catSpot } from '../src/cat';
import { ROOM_D, ROOM_W } from '../src/data';
import { designCost, doorTile, footprint, newGame, rate, type GameState } from '../src/state';

const ticks = Array.from({ length: 200 }, (_, i) => i);
const covered = (s: GameState, x: number, y: number) =>
  [...s.design.items, ...s.junk].some((p) => {
    const f = footprint(p);
    return p.id !== 'rug' && x >= p.x && x < p.x + f.w && y >= p.y && y < p.y + f.d;
  });

describe('the cat', () => {
  it('always settles on a free tile inside the room, out of the doorways', () => {
    const s = newGame('fixer', 'budget', false, () => 0.5);
    for (const t of ticks) {
      const c = catSpot(s, t)!;
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(ROOM_W);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(ROOM_D);
      expect(covered(s, c.x, c.y)).toBe(false);
      for (const d of s.design.doors) expect(doorTile(d)).not.toEqual({ x: c.x, y: c.y });
    }
  });

  it('is in the same place for the same tick and wanders as the clock moves on', () => {
    const s = newGame('fixer', 'freedom', false, () => 0.5);
    expect(catSpot(s, 7)).toEqual(catSpot(s, 7));
    const seen = new Set(ticks.map((t) => `${catSpot(s, t)!.x},${catSpot(s, t)!.y}`));
    expect(seen.size).toBeGreaterThan(8);
    const poses = new Set(ticks.map((t) => catSpot(s, t)!.pose));
    expect([...poses].sort()).toEqual(['loaf', 'sit', 'sleep']);
  });

  it('gets out of the way when something lands on her, and stays put otherwise', () => {
    const s = newGame('fixer', 'freedom', false, () => 0.5);
    s.junk = [];
    s.design.items = [];
    const c = catSpot(s, 3)!;
    // Something placed elsewhere does not disturb her.
    const far = { x: (c.x + 4) % ROOM_W, y: (c.y + 3) % ROOM_D };
    s.design.items.push({ uid: 1, id: 'lamp', x: far.x, y: far.y, rot: 0 });
    expect(catSpot(s, 3)).toMatchObject({ x: c.x, y: c.y });
    s.design.items.push({ uid: 2, id: 'lamp', x: c.x, y: c.y, rot: 0 });
    const moved = catSpot(s, 3)!;
    expect([moved.x, moved.y]).not.toEqual([c.x, c.y]);
  });

  it('may nap on a rug, and prefers rugs, sun and the stove', () => {
    const s = newGame('fixer', 'freedom', false, () => 0.5);
    s.junk = [];
    s.design.items = [{ uid: 1, id: 'rug', x: 3, y: 2, rot: 0 }];
    s.design.windows = [];
    expect(catBlocked(s).size).toBe(s.design.doors.length);
    const onRug = ticks.filter((t) => catSpot(s, t)!.cozy).length;
    // Four tiles of forty-eight would be about 17 of 200 by chance.
    expect(onRug).toBeGreaterThan(30);
  });

  it('has nowhere to go in a room packed solid', () => {
    const s = newGame('fixer', 'freedom', false, () => 0.5);
    s.design.items = [];
    let uid = 1;
    for (let x = 0; x < ROOM_W; x++) for (let y = 0; y < ROOM_D; y++) s.design.items.push({ uid: uid++, id: 'lamp', x, y, rot: 0 });
    expect(catSpot(s, 0)).toBeUndefined();
  });

  it('changes nothing about the game: no cost, no rating, nothing saved', () => {
    const s = newGame('fixer', 'budget', false, () => 0.5);
    const before = JSON.stringify(s);
    const cost = designCost(s.design);
    const stars = rate(s).stars;
    for (const t of ticks) catSpot(s, t);
    expect(JSON.stringify(s)).toBe(before);
    expect(designCost(s.design)).toEqual(cost);
    expect(rate(s).stars).toBe(stars);
  });
});
