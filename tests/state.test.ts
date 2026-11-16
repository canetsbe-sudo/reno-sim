import { describe, expect, it } from 'vitest';
import { DEMO_COST, INSPECTION_COST, LABOR_RATE, ROOM_D, ROOM_W, SCENARIOS, STARTER_LAYOUT, issueById, itemById, scenarioById } from '../src/data';
import {
  backToDesign,
  buildDays,
  buildDone,
  buildTick,
  clearDone,
  demolish,
  designCost,
  finishRoom,
  heldPatches,
  cornered,
  fitProblem,
  fits,
  haulJunk,
  newGame,
  openIssues,
  rate,
  remaining,
  resolveIssue,
  ripFloor,
  startBuild,
  stripWalls,
  type GameState,
} from '../src/state';

// Rolls below every chance, so every issue in the pool is in the house.
const always = () => 0;
const never = () => 0.99;

function clearRoom(s: GameState) {
  for (const j of [...s.junk]) haulJunk(s, j.uid);
  demolish(s);
  ripFloor(s);
  stripWalls(s);
}

function niceKitchen(s: GameState) {
  s.design.floor = 'floor-oak';
  s.design.wall = 'wall-cream';
  s.design.cabinet = 'cab-shaker-white';
  s.design.counter = 'ctr-butcher';
  s.design.lighting = 'light-warm';
  s.design.windows = [
    { wall: 'back', slot: 3, finish: 'win-classic' },
    { wall: 'left', slot: 4, finish: 'win-classic' },
  ];
  let uid = 100;
  s.design.items = STARTER_LAYOUT.map((p) => ({ uid: uid++, ...p }));
  s.design.items.push({ uid: uid++, id: 'chair', x: 4, y: 3, rot: 0 });
  s.design.items.push({ uid: uid++, id: 'plant', x: 7, y: 5, rot: 0 });
  s.design.items.push({ uid: uid++, id: 'rug', x: 3, y: 2, rot: 0 });
}

describe('new game', () => {
  it('rolls hidden issues in budget mode and charges for the inspection', () => {
    const s = newGame('fixer', 'budget', true, always);
    expect(s.spent).toBe(INSPECTION_COST);
    expect(s.issues.filter((i) => i.status === 'hidden').map((i) => i.id)).toEqual(['dry-rot', 'termites', 'mold', 'ceiling-leak', 'out-of-square']);
  });

  it('always hides at least one surprise', () => {
    const s = newGame('fixer', 'budget', false, never);
    expect(s.issues.filter((i) => i.status === 'hidden')).toHaveLength(1);
  });

  it('has no surprises or budget in freedom mode', () => {
    const s = newGame('fixer', 'freedom', true, always);
    expect(s.issues.every((i) => i.status === 'found')).toBe(true);
    expect(s.spent).toBe(0);
    expect(s.inspected).toBe(false);
  });
});

describe('clearing out', () => {
  it('reveals floor and wall issues and tracks days and money', () => {
    const s = newGame('fixer', 'budget', false, always);
    for (const j of [...s.junk]) haulJunk(s, j.uid);
    demolish(s);
    expect(s.spent).toBe(DEMO_COST);
    expect(ripFloor(s).map((i) => i.id)).toEqual(['dry-rot', 'termites']);
    expect(stripWalls(s).map((i) => i.id)).toEqual(['mold']);
    expect(clearDone(s)).toBe(true);
    expect(s.day).toBe(4);
    // Build issues stay hidden until the crew starts.
    expect(s.issues.find((i) => i.id === 'ceiling-leak')!.status).toBe('hidden');
  });
});

describe('repairs', () => {
  it('a patch is cheaper now', () => {
    const s = newGame('fixer', 'budget', false, always);
    clearRoom(s);
    const before = s.spent;
    resolveIssue(s, 'dry-rot', 1);
    expect(s.spent - before).toBe(600);
    expect(s.issues.find((i) => i.id === 'dry-rot')!.status).toBe('patched');
  });
});

describe('design', () => {
  it('blocks overlapping furniture but lets rugs sit under it', () => {
    const items = [{ uid: 1, id: 'table', x: 2, y: 2, rot: 0 as const }];
    expect(fits(items, { uid: 2, id: 'chair', x: 3, y: 2, rot: 0 })).toBe(false);
    expect(fits(items, { uid: 2, id: 'chair', x: 4, y: 2, rot: 0 })).toBe(true);
    expect(fits(items, { uid: 2, id: 'rug', x: 2, y: 2, rot: 0 })).toBe(true);
    expect(fits(items, { uid: 2, id: 'table', x: 7, y: 0, rot: 0 })).toBe(false);
    expect(fits(items, { uid: 2, id: 'table', x: 7, y: 0, rot: 1 })).toBe(true);
  });

  it('keeps appliance doors out of counter corners', () => {
    const run = [
      { uid: 1, id: 'base-cabinet', x: 1, y: 0, rot: 0 as const },
      { uid: 2, id: 'base-cabinet', x: 0, y: 1, rot: 1 as const },
    ];
    expect(fitProblem(run, { uid: 3, id: 'fridge', x: 0, y: 0, rot: 0 })).toBe('corner');
    expect(fitProblem(run, { uid: 3, id: 'base-cabinet', x: 0, y: 0, rot: 0 })).toBeUndefined();
    // Adding a counter that boxes in an existing fridge is blocked too.
    const fridge = [{ uid: 1, id: 'fridge', x: 0, y: 0, rot: 0 as const }, { uid: 2, id: 'base-cabinet', x: 1, y: 0, rot: 0 as const }];
    expect(fitProblem(fridge, { uid: 3, id: 'base-cabinet', x: 0, y: 1, rot: 1 })).toBe('corner');
    // A fridge at the end of a straight run is fine.
    expect(cornered([...fridge])).toBe(false);
    const sc = newGame('grandma', 'budget', false, never);
    expect(cornered(sc.design.items)).toBe(false);
    expect(cornered(STARTER_LAYOUT.map((p, i) => ({ uid: i, ...p })))).toBe(false);
  });

  it('prices a backsplash per counter against a wall', () => {
    const s = newGame('grandma', 'budget', false, never);
    s.design.windows = [];
    s.design.items = [
      { uid: 1, id: 'base-cabinet', x: 2, y: 0, rot: 0 },
      { uid: 2, id: 'base-cabinet', x: 0, y: 3, rot: 1 },
      { uid: 3, id: 'island', x: 3, y: 3, rot: 0 },
    ];
    const without = designCost(s.design).materials;
    s.design.backsplash = 'bs-subway';
    expect(designCost(s.design).materials - without).toBe(90 * 2);
  });

  it('prices materials plus crew labor', () => {
    const s = newGame('grandma', 'budget', false, never);
    // The old kitchen costs nothing before the design stage.
    expect(remaining(s)).toBe(s.budget);
    clearRoom(s);
    s.stage = 'design';
    s.design.windows = [];
    s.design.floor = 'floor-vinyl';
    const c = designCost(s.design);
    expect(c.materials).toBe(18 * 48);
    expect(c.laborDays).toBe(1);
    expect(c.laborCost).toBe(LABOR_RATE);
    expect(remaining(s)).toBe(s.budget - s.spent - c.total);
  });

  it('rates a complete, matching kitchen highly and a bare room low', () => {
    const s = newGame('grandma', 'budget', false, never);
    clearRoom(s);
    expect(rate(s).stars).toBe(1);
    niceKitchen(s);
    expect(rate(s).stars).toBeGreaterThanOrEqual(4);
  });

  it('does not lower the rating for a patch that holds', () => {
    const s = newGame('fixer', 'budget', false, always);
    clearRoom(s);
    niceKitchen(s);
    const before = rate(s).stars;
    resolveIssue(s, 'dry-rot', 1);
    expect(rate(s).stars).toBe(before);
  });
});

describe('build', () => {
  it('pauses for surprises and resurfaced patches, then finishes', () => {
    const s = newGame('fixer', 'budget', false, always);
    clearRoom(s);
    resolveIssue(s, 'leaky-sink', 0);
    resolveIssue(s, 'flicker', 0);
    resolveIssue(s, 'dry-rot', 1, always);
    resolveIssue(s, 'termites', 0);
    resolveIssue(s, 'mold', 0);
    expect(openIssues(s)).toHaveLength(0);
    niceKitchen(s);
    const quoted = designCost(s.design).total;
    const spentBefore = s.spent;
    startBuild(s);
    expect(s.spent - spentBefore).toBe(quoted);

    const surprises: string[] = [];
    for (let guard = 0; guard < 50 && !buildDone(s); guard++) {
      const hit = buildTick(s);
      if (hit) {
        surprises.push(`${hit.id}:${hit.status}`);
        resolveIssue(s, hit.id, 0);
      }
    }
    expect(surprises).toEqual(['ceiling-leak:found', 'out-of-square:found', 'dry-rot:resurfaced']);
    expect(s.buildProgress).toBeGreaterThanOrEqual(buildDays(s));
    const res = finishRoom(s);
    expect(s.stage).toBe('reveal');
    expect(res.coins).toBeGreaterThan(0);
  });

  it('a patch that holds saves money and is reported', () => {
    const s = newGame('fixer', 'budget', false, always);
    clearRoom(s);
    resolveIssue(s, 'dry-rot', 1, never);
    expect(heldPatches(s).map((i) => [i.id, i.saved])).toEqual([['dry-rot', 1200]]);
    resolveIssue(s, 'termites', 1, always);
    expect(heldPatches(s)).toHaveLength(1);
  });

  it('refunds the build when going back to design', () => {
    const s = newGame('grandma', 'budget', false, never);
    clearRoom(s);
    niceKitchen(s);
    const spent = s.spent;
    startBuild(s);
    backToDesign(s);
    expect(s.spent).toBe(spent);
    expect(s.stage).toBe('design');
  });
});

describe('the beach shack', () => {
  it('always has the paint trouble', () => {
    const s = newGame('beach-shack', 'budget', false, never);
    expect(s.issues.filter((i) => i.status === 'hidden').map((i) => i.id)).toContain('peeling-paint');
  });

  it('surfaces paint, rust, and dry rot at the right moment', () => {
    const s = newGame('beach-shack', 'budget', false, always);
    expect(ripFloor(s).map((i) => i.id)).toEqual(['dry-rot', 'rusty-water-line']);
    expect(stripWalls(s).map((i) => i.id)).toEqual(['peeling-paint', 'salt-rust', 'mold']);
  });

  it('paint, rust, and dry rot can all be fixed properly', () => {
    const s = newGame('beach-shack', 'budget', false, always);
    clearRoom(s);
    for (const id of ['peeling-paint', 'salt-rust', 'dry-rot']) {
      expect(s.issues.find((i) => i.id === id)!.status).toBe('found');
      resolveIssue(s, id, 0);
      expect(s.issues.find((i) => i.id === id)!.status).toBe('fixed');
    }
  });
});

describe('the mountain cabin', () => {
  it('always has the burst pipe', () => {
    const s = newGame('mountain-cabin', 'budget', false, never);
    expect(s.issues.filter((i) => i.status === 'hidden').map((i) => i.id)).toContain('burst-pipe');
  });

  it('reveals the winter damage at the right moment', () => {
    const s = newGame('mountain-cabin', 'budget', false, always);
    expect(ripFloor(s).map((i) => i.id)).toEqual(['burst-pipe', 'dry-rot']);
    expect(stripWalls(s).map((i) => i.id)).toEqual(['chimney-creosote', 'mold']);
    // The mice only show up when the crew is in the walls.
    expect(s.issues.find((i) => i.id === 'mice-in-walls')!.status).toBe('hidden');
  });

  it('is winnable when every issue is fixed properly', () => {
    const s = newGame('mountain-cabin', 'budget', true, always);
    clearRoom(s);
    for (const i of [...s.issues]) {
      if (i.status !== 'found') continue;
      resolveIssue(s, i.id, 0);
    }
    niceKitchen(s);
    startBuild(s);
    for (let guard = 0; guard < 50 && !buildDone(s); guard++) {
      const hit = buildTick(s);
      if (hit) resolveIssue(s, hit.id, 0);
    }
    expect(buildDone(s)).toBe(true);
    const res = finishRoom(s);
    expect(s.budget - s.spent).toBeGreaterThan(0);
    expect(res.finishedDay).toBeLessThanOrEqual(scenarioById('mountain-cabin').targetDay);
    expect(res.coins).toBeGreaterThan(0);
  });

  it('offers a cheaper patch gamble on every new issue', () => {
    for (const id of ['burst-pipe', 'chimney-creosote', 'mice-in-walls']) {
      const [proper, patch] = issueById(id).options;
      expect(patch.patch).toBe(true);
      expect(patch.cost).toBeLessThan(proper.cost);
      expect(patch.risk ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('scenario data', () => {
  it('pools only real issues that surface during the work', () => {
    for (const sc of SCENARIOS) {
      const ids = sc.issuePool.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of sc.issuePool) {
        // A start-trigger issue is already in every house, so pooling one would double it up.
        expect(issueById(p.id).trigger).not.toBe('start');
        expect(p.chance).toBeGreaterThan(0);
        expect(p.chance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('hauls only real junk that sits inside the room', () => {
    for (const sc of SCENARIOS) {
      for (const j of sc.junk) {
        expect(itemById(j.id).kind).toBe('junk');
        expect(j.x).toBeGreaterThanOrEqual(0);
        expect(j.y).toBeGreaterThanOrEqual(0);
        expect(j.x).toBeLessThan(ROOM_W);
        expect(j.y).toBeLessThan(ROOM_D);
      }
    }
  });
});
