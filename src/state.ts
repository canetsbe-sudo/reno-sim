// Game state and the rules that act on it. No DOM in here, so it is easy to test.
import {
  DEMO_COST,
  INSPECTION_COST,
  ISSUES,
  ITEMS,
  LABOR_RATE,
  OLD_LAYOUT,
  OLD_WINDOWS,
  ROOM_D,
  ROOM_W,
  finishById,
  issueById,
  itemById,
  scenarioById,
  type IssueTrigger,
  type Rot,
} from './data';

export type Mode = 'budget' | 'freedom';
export type Stage = 'clear' | 'fix' | 'design' | 'build' | 'reveal';
export type Rng = () => number;

export interface Placed {
  uid: number;
  id: string;
  x: number;
  y: number;
  rot: Rot;
}

export interface WindowSlot {
  wall: 'back' | 'left';
  slot: number;
  finish: string;
}

export interface Design {
  floor: string;
  wall: string;
  cabinet: string;
  counter: string;
  lighting: string;
  windows: WindowSlot[];
  items: Placed[];
}

export type IssueStatus = 'hidden' | 'found' | 'fixed' | 'patched' | 'resurfaced';

export interface IssueState {
  id: string;
  status: IssueStatus;
  // Patched issues that will come back during the build (rolled when the build starts).
  willResurface?: boolean;
}

export interface GameState {
  version: 1;
  scenario: string;
  mode: Mode;
  stage: Stage;
  budget: number;
  // Money already paid out (demolition, repairs, the finished build).
  spent: number;
  day: number;
  inspected: boolean;
  junk: Placed[];
  demoDone: boolean;
  floorRipped: boolean;
  wallsStripped: boolean;
  issues: IssueState[];
  design: Design;
  // Crew days completed on the current build.
  buildProgress: number;
  // Set once the build is paid for, so going back to design does not double count.
  buildPaid: number;
  nextUid: number;
  result?: RoomResult;
}

export interface RoomResult {
  stars: number;
  notes: string[];
  coins: number;
  finishedDay: number;
}

export const isBudget = (s: GameState) => s.mode === 'budget';

export function newGame(scenarioId: string, mode: Mode, inspect: boolean, rng: Rng = Math.random): GameState {
  const sc = scenarioById(scenarioId);
  let uid = 1;
  const issues: IssueState[] = ISSUES.filter((i) => i.trigger === 'start').map((i) => ({ id: i.id, status: 'found' }));
  if (mode === 'budget') {
    const rolled = sc.issuePool.filter((p) => rng() < p.chance).map((p) => p.id);
    // Every house hides at least one surprise.
    if (rolled.length === 0) rolled.push(sc.issuePool[0].id);
    for (const id of rolled) issues.push({ id, status: 'hidden' });
  }
  const state: GameState = {
    version: 1,
    scenario: sc.id,
    mode,
    stage: 'clear',
    budget: mode === 'budget' ? sc.budget : 0,
    spent: mode === 'budget' && inspect ? INSPECTION_COST : 0,
    day: 1,
    inspected: mode === 'budget' && inspect,
    junk: sc.junk.map((j) => ({ uid: uid++, id: j.id, x: j.x, y: j.y, rot: 0 })),
    demoDone: false,
    floorRipped: false,
    wallsStripped: false,
    issues,
    design: {
      ...sc.start,
      windows: OLD_WINDOWS.map((w) => ({ ...w, finish: sc.start.window })),
      items: OLD_LAYOUT.map((p) => ({ uid: uid++, ...p })),
    },
    buildProgress: 0,
    buildPaid: 0,
    nextUid: uid,
  };
  return state;
}

// ---- Clear stage ----

export function haulJunk(s: GameState, uid: number): void {
  s.junk = s.junk.filter((j) => j.uid !== uid);
}

export function demolish(s: GameState): void {
  if (s.demoDone) return;
  s.design.items = [];
  s.demoDone = true;
  s.day += 1;
  if (isBudget(s)) s.spent += DEMO_COST;
}

// Returns the issues this action uncovered.
export function ripFloor(s: GameState): IssueState[] {
  if (s.floorRipped) return [];
  s.floorRipped = true;
  s.design.floor = 'floor-subfloor';
  s.day += 1;
  return reveal(s, 'floor');
}

export function stripWalls(s: GameState): IssueState[] {
  if (s.wallsStripped) return [];
  s.wallsStripped = true;
  s.design.wall = 'wall-drywall';
  s.day += 1;
  return reveal(s, 'walls');
}

function reveal(s: GameState, trigger: IssueTrigger): IssueState[] {
  const found = s.issues.filter((i) => i.status === 'hidden' && issueById(i.id).trigger === trigger);
  for (const i of found) i.status = 'found';
  return found;
}

export const clearDone = (s: GameState) => s.junk.length === 0 && s.demoDone && s.floorRipped && s.wallsStripped;

// ---- Fix stage ----

export const openIssues = (s: GameState) => s.issues.filter((i) => i.status === 'found' || i.status === 'resurfaced');

// Options for an issue right now. A resurfaced patch can only be fixed properly, at a premium.
export function issueOptions(i: IssueState) {
  const def = issueById(i.id);
  if (i.status === 'resurfaced') {
    const proper = def.options.find((o) => !o.patch) ?? def.options[0];
    return [{ ...proper, cost: Math.round(proper.cost * 1.25), label: `${proper.label} (it's worse now)` }];
  }
  return def.options;
}

export function resolveIssue(s: GameState, issueId: string, optionIndex: number): void {
  const i = s.issues.find((x) => x.id === issueId);
  if (!i) return;
  const opt = issueOptions(i)[optionIndex];
  if (!opt) return;
  if (isBudget(s)) s.spent += opt.cost;
  s.day += opt.days;
  i.status = opt.patch ? 'patched' : 'fixed';
}

// ---- Design stage ----

export const footprint = (p: Placed) => {
  const def = itemById(p.id);
  return p.rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
};

export function fits(items: Placed[], cand: Placed, ignoreUid?: number): boolean {
  const a = footprint(cand);
  if (cand.x < 0 || cand.y < 0 || cand.x + a.w > ROOM_W || cand.y + a.d > ROOM_D) return false;
  const flat = itemById(cand.id).h < 0.1;
  return items.every((o) => {
    if (o.uid === ignoreUid) return true;
    // Rugs sit under furniture, so they only collide with other rugs.
    if (flat !== itemById(o.id).h < 0.1) return true;
    const b = footprint(o);
    return cand.x + a.w <= o.x || o.x + b.w <= cand.x || cand.y + a.d <= o.y || o.y + b.d <= cand.y;
  });
}

export const itemAt = (items: Placed[], x: number, y: number): Placed | undefined => {
  // Prefer furniture over rugs when both cover the tile.
  const hits = items.filter((p) => {
    const f = footprint(p);
    return x >= p.x && x < p.x + f.w && y >= p.y && y < p.y + f.d;
  });
  return hits.sort((a, b) => itemById(b.id).h - itemById(a.id).h)[0];
};

export interface CostLine {
  label: string;
  materials: number;
  labor: number;
}

export interface DesignCost {
  lines: CostLine[];
  materials: number;
  laborDays: number;
  laborCost: number;
  total: number;
}

export function designCost(d: Design): DesignCost {
  const lines: CostLine[] = [];
  const floor = finishById(d.floor);
  if (!floor.old) lines.push({ label: floor.name, materials: floor.cost * ROOM_W * ROOM_D, labor: floor.labor });
  const wall = finishById(d.wall);
  if (!wall.old) lines.push({ label: wall.name, materials: wall.cost * 2, labor: wall.labor });

  const cabinets = d.items.filter((p) => itemById(p.id).usesCabinet).length;
  const cab = finishById(d.cabinet);
  if (cabinets > 0 && !cab.old) lines.push({ label: `${cab.name} cabinets x${cabinets}`, materials: cab.cost * cabinets, labor: cab.labor });
  const counters = d.items.filter((p) => itemById(p.id).usesCounter).length;
  const ctr = finishById(d.counter);
  if (counters > 0 && !ctr.old) lines.push({ label: `${ctr.name} counters x${counters}`, materials: ctr.cost * counters, labor: ctr.labor });

  for (const w of d.windows) {
    const f = finishById(w.finish);
    if (!f.old) lines.push({ label: `${f.name} window`, materials: f.cost, labor: f.labor });
  }
  for (const p of d.items) {
    const def = itemById(p.id);
    if (def.cost > 0 || def.labor > 0) lines.push({ label: def.name, materials: def.cost, labor: def.labor });
  }

  const materials = lines.reduce((a, l) => a + l.materials, 0);
  const laborDays = Math.ceil(lines.reduce((a, l) => a + l.labor, 0));
  const laborCost = laborDays * LABOR_RATE;
  return { lines, materials, laborDays, laborCost, total: materials + laborCost };
}

// Money left after what is spent plus what the current design would cost.
export function remaining(s: GameState): number {
  // Before the design stage the room still holds the old kitchen, which is free.
  const pending = s.stage === 'design' && !s.buildPaid ? designCost(s.design).total : 0;
  return s.budget - s.spent - pending;
}

// ---- Build stage ----

export function startBuild(s: GameState, rng: Rng = Math.random): void {
  s.stage = 'build';
  s.buildProgress = 0;
  if (isBudget(s) && !s.buildPaid) {
    const c = designCost(s.design);
    s.spent += c.total;
    s.buildPaid = c.total;
  }
  for (const i of s.issues) {
    if (i.status === 'patched' && i.willResurface === undefined) i.willResurface = rng() < 0.4;
  }
}

// Leave a build to rework the design: the build is refunded and starts over.
export function backToDesign(s: GameState): void {
  if (s.buildPaid) {
    s.spent -= s.buildPaid;
    s.buildPaid = 0;
  }
  s.buildProgress = 0;
  s.stage = 'design';
}

export const buildDays = (s: GameState) => Math.max(1, designCost(s.design).laborDays);

// Advance one crew day. Returns any surprise that halts the crew.
export function buildTick(s: GameState): IssueState | undefined {
  s.buildProgress += 1;
  s.day += 1;
  const total = buildDays(s);
  if (s.buildProgress >= Math.ceil(total / 3)) {
    const hidden = s.issues.find((i) => i.status === 'hidden' && issueById(i.id).trigger === 'build');
    if (hidden) {
      hidden.status = 'found';
      return hidden;
    }
  }
  if (s.buildProgress >= Math.ceil((total * 2) / 3)) {
    const back = s.issues.find((i) => i.status === 'patched' && i.willResurface);
    if (back) {
      back.status = 'resurfaced';
      back.willResurface = false;
      return back;
    }
  }
  return undefined;
}

export const buildDone = (s: GameState) => s.buildProgress >= buildDays(s) && openIssues(s).length === 0;

// ---- Reveal ----

export interface Rating {
  stars: number;
  good: string[];
  tips: string[];
}

export function rate(s: GameState): Rating {
  const d = s.design;
  const good: string[] = [];
  const tips: string[] = [];
  let pts = 0;
  const kinds = d.items.map((p) => itemById(p.id));
  const has = (pred: (k: (typeof kinds)[number]) => boolean) => kinds.some(pred);

  const missing = (['fridge', 'stove', 'sink'] as const).filter((e) => !has((k) => k.essential === e));
  if (missing.length === 0) {
    pts += 2;
    good.push('A working kitchen: fridge, stove, and sink.');
  } else tips.push(`A kitchen needs a ${missing.join(', ')}.`);

  const newWindows = d.windows.filter((w) => !finishById(w.finish).old).length;
  if (newWindows >= 2) {
    pts += 1;
    good.push('Lots of natural light.');
  } else if (newWindows === 1) {
    pts += 0.5;
    tips.push('Another new window would brighten it up.');
  } else tips.push('New windows let the light in.');

  if (!finishById(d.lighting).old) pts += 0.5;
  else tips.push('That flickering tube light has to go.');
  if (has((k) => k.kind === 'lamp')) {
    pts += 0.5;
    good.push('A lamp adds a warm glow.');
  }

  if (has((k) => k.kind === 'plant')) {
    pts += 1;
    good.push('Plants make it feel alive.');
  } else tips.push('Add a plant or some herbs.');

  if (has((k) => k.kind === 'seating')) {
    pts += 1;
    good.push('Somewhere to sit and have coffee.');
  } else tips.push('Add a chair or stools.');

  if (has((k) => k.kind === 'decor')) {
    pts += 1;
    good.push('Nice finishing touches.');
  } else tips.push('A rug or cart adds personality.');

  const tones = [d.floor, d.wall, d.cabinet, d.counter].map((id) => finishById(id).tone).filter((t) => t !== 'neutral');
  const clash = tones.includes('warm') && tones.includes('cool');
  if (!clash) {
    pts += 1;
    good.push('The colors work together.');
  } else {
    pts += 0.5;
    tips.push('Mixing warm and cool finishes feels a little busy.');
  }

  const area = d.items.filter((p) => itemById(p.id).h >= 0.1).reduce((a, p) => a + footprint(p).w * footprint(p).d, 0);
  const fill = area / (ROOM_W * ROOM_D);
  if (fill >= 0.15 && fill <= 0.5) pts += 1;
  else if (fill > 0.5) tips.push('It feels crowded. Leave room to move.');
  else tips.push('It feels a bit empty.');

  if (has((k) => k.id === 'fireplace')) {
    pts += 1;
    good.push('A wood stove. Instant cozy.');
  } else if (has((k) => k.kind === 'upgrade')) {
    pts += 0.5;
    good.push('A splurge that makes the room special.');
  }

  for (const cat of ['floor', 'wall'] as const) {
    if (finishById(d[cat]).old) {
      pts -= 2;
      tips.push(`The ${cat === 'floor' ? 'floor' : 'walls'} still need finishing.`);
    }
  }
  if (d.items.some((p) => itemById(p.id).usesCabinet) && finishById(d.cabinet).old) {
    pts -= 1;
    tips.push('Pick a cabinet finish.');
  }

  const sc = scenarioById(s.scenario);
  if (sc.style) {
    const picks = [d.floor, d.wall, d.cabinet, d.counter, ...d.windows.map((w) => w.finish)];
    const match = picks.filter((id) => finishById(id).styles.includes(sc.style!)).length;
    if (match >= 4) {
      pts += 1.5;
      good.push(`Nails the ${sc.styleLabel} brief.`);
    } else tips.push(`Lean into ${sc.styleLabel} finishes for the brief (${match} of 4 so far).`);
  }

  const patched = s.issues.filter((i) => i.status === 'patched').length;
  if (patched > 0) {
    pts -= 0.5 * patched;
    tips.push(`${patched} patched problem${patched > 1 ? 's' : ''} lower the house rating.`);
  }

  return { stars: clampStars(pts), good, tips: tips.slice(0, 4) };
}

// 10 points maps to 5 stars, in half-star steps.
const clampStars = (pts: number) => Math.min(5, Math.max(1, Math.round(pts) / 2));

export function finishRoom(s: GameState): RoomResult {
  const r = rate(s);
  const sc = scenarioById(s.scenario);
  let coins = r.stars * 300;
  if (isBudget(s)) {
    coins += Math.max(0, Math.round((s.budget - s.spent) * 0.1));
    if (s.day <= sc.targetDay) coins += 500;
  }
  s.stage = 'reveal';
  s.result = { stars: r.stars, notes: [...r.good, ...r.tips], coins, finishedDay: s.day };
  return s.result;
}

// ---- Saving ----

// The dev preview shares the site's storage, so it keeps its own save.
export const CHANNEL_SUFFIX = import.meta.env.VITE_CHANNEL === 'dev' ? '-dev' : '';
const SAVE_KEY = `reno-sim-save-v1${CHANNEL_SUFFIX}`;

export function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Private windows can block storage; the game still plays.
  }
}

export function load(): GameState | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 ? s : undefined;
  } catch {
    return undefined;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export const catalog = () => ITEMS;
