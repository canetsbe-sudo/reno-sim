import './style.css';
import {
  DEMO_COST,
  FINISHES,
  INSPECTION_COST,
  ITEMS,
  LABOR_RATE,
  SCENARIOS,
  STARTER_LAYOUT,
  finishById,
  issueById,
  itemById,
  scenarioById,
  type FinishCategory,
  type Rot,
} from './data';
import {
  backToDesign,
  buildDays,
  buildDone,
  buildTick,
  clearDone,
  clearSave,
  demolish,
  designCost,
  finishRoom,
  fits,
  haulJunk,
  isBudget,
  issueOptions,
  itemAt,
  load,
  newGame,
  openIssues,
  rate,
  remaining,
  resolveIssue,
  ripFloor,
  save,
  startBuild,
  stripWalls,
  type Design,
  type GameState,
  type IssueState,
  type Mode,
  type Placed,
  type Stage,
} from './state';
import { CANVAS_H, CANVAS_W, drawScene, pickTile, pickWall, snapshot, type SceneOpts } from './render';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>('#room');
const ctx = canvas.getContext('2d')!;
const panel = $('#panel');
const hud = $('#hud');
const modal = $('#modal');
const hint = $('#room-hint');

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let state: GameState | undefined;

// UI-only state that is not saved.
type DesignTab = FinishCategory | 'furniture' | 'upgrades';
const ui = {
  tab: 'floor' as DesignTab,
  placing: undefined as string | undefined,
  placingRot: 0 as Rot,
  windowStyle: 'win-classic',
  selected: undefined as number | undefined,
  hoverTile: undefined as { x: number; y: number } | undefined,
  hoverWall: undefined as { wall: 'back' | 'left'; slot: number } | undefined,
  fading: new Map<number, number>(),
  undo: [] as Design[],
  buildTimer: undefined as number | undefined,
  // Title screen picks.
  scenario: SCENARIOS[0].id,
  mode: 'budget' as Mode,
  inspect: false,
};

// ---------- Canvas ----------

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let drawQueued = false;
function draw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    if (!state) return;
    const o: SceneOpts = { fading: ui.fading, selectedUid: ui.selected };
    if (state.stage === 'design') {
      if (ui.placing && ui.hoverTile) {
        const p: Placed = { uid: -1, id: ui.placing, x: ui.hoverTile.x, y: ui.hoverTile.y, rot: ui.placingRot };
        o.ghost = { p, valid: fits(state.design.items, p) };
      }
      if (ui.tab === 'window' && ui.hoverWall) o.hoverWall = ui.hoverWall;
    }
    if (state.stage === 'clear' && ui.hoverTile && state.junk.some((j) => j.x === ui.hoverTile!.x && j.y === ui.hoverTile!.y)) o.hoverTile = ui.hoverTile;
    drawScene(ctx, state, o);
  });
}

function canvasPoint(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * CANVAS_W, y: ((e.clientY - r.top) / r.height) * CANVAS_H };
}

canvas.addEventListener('pointermove', (e) => {
  if (!state) return;
  const p = canvasPoint(e);
  ui.hoverTile = pickTile(p.x, p.y);
  ui.hoverWall = ui.hoverTile ? undefined : pickWall(p.x, p.y);
  draw();
});
canvas.addEventListener('pointerleave', () => {
  ui.hoverTile = undefined;
  ui.hoverWall = undefined;
  draw();
});
canvas.addEventListener('pointerdown', (e) => {
  if (!state) return;
  const p = canvasPoint(e);
  const tile = pickTile(p.x, p.y);
  const wall = tile ? undefined : pickWall(p.x, p.y);
  if (state.stage === 'clear' && tile) clickJunk(tile.x, tile.y, e);
  if (state.stage === 'design') {
    if (ui.tab === 'window' && wall) clickWindow(wall.wall, wall.slot);
    else if (tile) clickDesignTile(tile.x, tile.y);
  }
});

// ---------- Helpers ----------

function commit() {
  if (!state) return;
  save(state);
  renderHud();
  renderPanel();
  draw();
}

function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout((t as unknown as { _t: number })._t);
  (t as unknown as { _t: number })._t = window.setTimeout(() => t.classList.remove('show'), 2600);
}

function sparkle(x: number, y: number, ch = '✨') {
  const s = document.createElement('div');
  s.className = 'sparkle';
  s.textContent = ch;
  s.style.left = `${x - 10}px`;
  s.style.top = `${y - 10}px`;
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 900);
}

function showModal(html: string, wide = false) {
  modal.innerHTML = `<div class="modal-card${wide ? ' wide' : ''}">${html}</div>`;
  modal.classList.remove('hidden');
}
function closeModal() {
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

const BEFORE_KEY = 'reno-sim-before-v1';
function storeBefore(url: string) {
  try {
    localStorage.setItem(BEFORE_KEY, url);
  } catch {
    // Too big or storage blocked; the reveal falls back to the current render.
  }
  beforeImg = url;
}
let beforeImg: string | undefined;
try {
  beforeImg = localStorage.getItem(BEFORE_KEY) ?? undefined;
} catch {
  beforeImg = undefined;
}

// ---------- HUD ----------

const STAGES: { id: Stage; label: string }[] = [
  { id: 'clear', label: '1 Clear out' },
  { id: 'fix', label: '2 Fix up' },
  { id: 'design', label: '3 Design' },
  { id: 'build', label: '4 Build' },
  { id: 'reveal', label: '5 Reveal' },
];

function renderHud() {
  if (!state) return;
  const sc = scenarioById(state.scenario);
  const idx = STAGES.findIndex((x) => x.id === state!.stage);
  const left = remaining(state);
  const budgetStats = isBudget(state)
    ? `<div>Budget left<b class="${left < 0 ? 'neg' : ''}">${money(left)}</b></div>
       <div>Day<b>${state.day} <small style="font-size:12px;color:var(--ink-2)">/ move-in ${sc.targetDay}</small></b></div>`
    : `<div>Mode<b>Freedom</b></div>`;
  hud.innerHTML = `
    <div class="name">The Kitchen<small>${esc(sc.name)}</small></div>
    <div class="steps">${STAGES.map((s, i) => `<span class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${s.label}</span>`).join('')}</div>
    <div class="stats">${budgetStats}</div>
    <button class="menu-btn" data-act="menu" title="Main menu">☰</button>`;
}

hud.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b?.dataset.act === 'menu') {
    stopBuild();
    showTitle();
  }
});

// ---------- Panel ----------

function renderPanel() {
  if (!state) return;
  hint.textContent = '';
  switch (state.stage) {
    case 'clear':
      return renderClear(state);
    case 'fix':
      return renderFix(state);
    case 'design':
      return renderDesign(state);
    case 'build':
      return renderBuild(state);
    case 'reveal':
      return renderRevealPanel(state);
  }
}

function hintsBlock(s: GameState) {
  const hidden = s.issues.filter((i) => i.status === 'hidden');
  if (!isBudget(s) || hidden.length === 0) return '';
  if (s.inspected) {
    return `<div class="note"><b>Inspection report</b><ul>${hidden
      .map((i) => {
        const d = issueById(i.id);
        const proper = d.options.find((o) => !o.patch) ?? d.options[0];
        return `<li>${esc(d.name)}: about ${money(proper.cost)} to fix properly</li>`;
      })
      .join('')}</ul></div>`;
  }
  const clues = hidden.map((i) => issueById(i.id).hint).filter(Boolean);
  if (clues.length === 0) return '';
  return `<div class="note"><b>Things you noticed</b><ul>${clues.map((c) => `<li>${esc(c!)}</li>`).join('')}</ul></div>`;
}

function renderClear(s: GameState) {
  const tasks = [
    { act: 'demo', name: 'Demo the old kitchen', sub: `Cabinets and appliances out${isBudget(s) ? ` · ${money(DEMO_COST)} dumpster` : ''} · 1 day`, done: s.demoDone },
    { act: 'floor', name: 'Rip up the old floor', sub: '1 day', done: s.floorRipped },
    { act: 'walls', name: 'Strip the walls', sub: '1 day', done: s.wallsStripped },
  ];
  hint.textContent = s.junk.length ? 'Click the junk to haul it away' : '';
  panel.innerHTML = `
    <h2>Clear it out</h2>
    <p class="lead">Out with the old. Click junk in the room to haul it away, then tear out the tired kitchen.</p>
    <div class="task ${s.junk.length ? '' : 'done'}"><div><span class="t-name">Haul away junk</span><small>${s.junk.length ? `${s.junk.length} pieces left` : 'All clear'}</small></div></div>
    ${tasks
      .map(
        (t) => `<div class="task ${t.done ? 'done' : ''}"><div><span class="t-name">${t.name}</span><small>${t.sub}</small></div>
        <button data-act="${t.act}" ${t.done ? 'disabled' : ''}>${t.done ? 'Done' : 'Go'}</button></div>`,
      )
      .join('')}
    ${hintsBlock(s)}
    <button class="primary next" data-act="to-fix" ${clearDone(s) ? '' : 'disabled'}>On to repairs</button>`;
}

function renderFix(s: GameState) {
  const open = openIssues(s);
  const fixed = s.issues.filter((i) => i.status === 'fixed' || i.status === 'patched');
  panel.innerHTML = `
    <h2>Fix it up</h2>
    <p class="lead">Deal with what you found. A proper fix costs more now; a patch is cheaper but might come back to bite you.</p>
    ${open.map((i) => issueCard(s, i)).join('')}
    ${
      fixed.length
        ? `<div class="note"><b>Handled</b><ul>${fixed.map((i) => `<li>${esc(issueById(i.id).name)}: ${i.status === 'patched' ? 'patched' : 'fixed properly'}</li>`).join('')}</ul></div>`
        : ''
    }
    ${hintsBlock(s)}
    <button class="primary next" data-act="to-design" ${open.length ? 'disabled' : ''}>Start designing</button>`;
}

function issueCard(s: GameState, i: IssueState) {
  const d = issueById(i.id);
  const opts = issueOptions(i);
  return `<div class="issue"><h4>${i.status === 'resurfaced' ? 'It came back: ' : ''}${esc(d.name)}</h4><p>${esc(d.found)}</p>
    ${opts
      .map(
        (o, k) => `<button class="opt" data-act="resolve" data-issue="${i.id}" data-opt="${k}">
          <span>${esc(o.label)}${o.patch ? '<span class="patch">Might come back later</span>' : ''}</span>
          <small>${isBudget(s) ? money(o.cost) + ' · ' : ''}${o.days} day${o.days === 1 ? '' : 's'}</small></button>`,
      )
      .join('')}</div>`;
}

const TABS: { id: DesignTab; label: string }[] = [
  { id: 'floor', label: 'Floors' },
  { id: 'wall', label: 'Walls' },
  { id: 'window', label: 'Windows' },
  { id: 'cabinet', label: 'Cabinets' },
  { id: 'counter', label: 'Counters' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'lighting', label: 'Lighting' },
];

const unitLabel: Record<FinishCategory, string> = {
  floor: '/tile',
  wall: '/wall',
  cabinet: '/cabinet',
  counter: '/counter',
  window: '/window',
  lighting: '',
};

function renderDesign(s: GameState) {
  const d = s.design;
  const sc = scenarioById(s.scenario);
  const budget = isBudget(s);
  let body = '';
  if (ui.tab === 'furniture' || ui.tab === 'upgrades') {
    const list = ITEMS.filter((it) => (ui.tab === 'upgrades' ? it.kind === 'upgrade' : it.kind !== 'upgrade'));
    body = `<div class="item-list">${list
      .map((it) => {
        const extra = it.usesCabinet ? ' + cabinet finish' : it.usesCounter ? ' + counter' : '';
        return `<button class="item-btn ${ui.placing === it.id ? 'on' : ''}" data-act="place" data-item="${it.id}">
          <span><b>${esc(it.name)}</b><small>${it.w}x${it.d}${it.blurb ? ' · ' + esc(it.blurb) : ''}</small></span>
          <small>${budget ? money(it.cost) + extra : ''}${it.labor ? `<br>${it.labor} crew day${it.labor === 1 ? '' : 's'}` : ''}</small></button>`;
      })
      .join('')}</div>`;
  } else {
    const cat = ui.tab as FinishCategory;
    const current = cat === 'window' ? ui.windowStyle : (d[cat as keyof Design] as string);
    const opts = FINISHES.filter((f) => f.category === cat && !f.old);
    body = `${cat === 'window' ? '<p class="lead">Pick a style, then click a spot on either wall to add or replace a window. Click a window again to remove it.</p>' : ''}
      <div class="swatches">${opts
        .map((f) => {
          const styleTag = sc.style && f.styles.includes(sc.style) ? `<span class="style-tag">${sc.styleLabel}</span>` : '';
          const bg = f.accent ? `linear-gradient(135deg, ${f.color} 55%, ${f.accent} 55%)` : f.color;
          return `<button class="swatch ${current === f.id ? 'on' : ''}" data-act="finish" data-finish="${f.id}">
            <span class="chip" style="background:${bg}"></span>
            <span><span class="s-name">${esc(f.name)}</span>${styleTag}<small>${budget && f.cost ? money(f.cost) + unitLabel[cat] : budget ? 'Free' : ''}${f.labor ? ` · ${f.labor}d` : ''}</small></span></button>`;
        })
        .join('')}</div>`;
  }

  const sel = ui.selected !== undefined ? d.items.find((p) => p.uid === ui.selected) : undefined;
  const selCard = sel
    ? `<div class="selected-card"><b>${esc(itemById(sel.id).name)}</b><span><button data-act="rotate">Rotate (R)</button> <button data-act="remove">Remove</button></span></div>`
    : '';

  const c = designCost(d);
  const left = remaining(s);
  const costs = budget
    ? `<div class="costs">
        <div class="row"><span>Materials</span><span>${money(c.materials)}</span></div>
        <div class="row"><span>Labor (${c.laborDays} crew days x ${money(LABOR_RATE)})</span><span>${money(c.laborCost)}</span></div>
        <div class="row"><span>Already spent</span><span>${money(s.spent)}</span></div>
        <div class="row total"><span>Budget left</span><span class="${left < 0 ? 'neg' : ''}">${money(left)}</span></div>
        ${left < 0 ? '<div class="note warn">Over budget. You can still build, but you will earn fewer coins. Cheaper finishes or fewer upgrades will get you back under.</div>' : ''}
        <div class="row"><span>Build time</span><span>${c.laborDays} days, done around day ${s.day + c.laborDays} (move-in day ${sc.targetDay})</span></div>
      </div>`
    : `<div class="costs"><div class="row"><span>Build time</span><span>${c.laborDays} days</span></div></div>`;

  if (ui.placing) hint.textContent = 'Click to place · R to rotate · Esc to stop';
  else if (ui.tab === 'window') hint.textContent = 'Click a wall to place a window';
  else hint.textContent = 'Click an item in the room to select it';

  const r = rate(s);
  panel.innerHTML = `
    <h2>Design it</h2>
    <p class="lead">Make it yours. Nothing is permanent until the crew builds it.${sc.style ? ` Brief: <b>${sc.styleLabel}</b>.` : ''}</p>
    <div class="tabs">${TABS.map((t) => `<button class="${ui.tab === t.id ? 'on' : ''}" data-act="tab" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
    ${selCard}
    ${body}
    <div class="tools">
      <button data-act="undo" ${ui.undo.length ? '' : 'disabled'}>Undo</button>
      <button data-act="starter" ${d.items.length ? 'disabled' : ''} title="Place a basic L-shaped kitchen">Starter layout</button>
      <button data-act="clear-items" ${d.items.length ? '' : 'disabled'}>Clear furniture</button>
    </div>
    <div class="note">Cozy preview: <b>${'★'.repeat(Math.floor(r.stars))}${r.stars % 1 ? '½' : ''}</b>${r.tips.length ? `<ul>${r.tips.slice(0, 2).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>
    ${costs}
    <button class="primary next" data-act="build">Start the build</button>`;
}

function renderBuild(s: GameState) {
  const total = buildDays(s);
  const pct = Math.min(100, (s.buildProgress / total) * 100);
  const left = remaining(s);
  panel.innerHTML = `
    <h2>The crew is building</h2>
    <p class="lead">Sit back. They'll call you if they find anything.</p>
    <div class="crew">🔨</div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <p style="text-align:center;margin:0">Crew day ${Math.min(s.buildProgress, total)} of ${total} · Day ${s.day}</p>
    ${isBudget(s) && left < 0 ? `<div class="note warn">Surprises pushed you ${money(-left)} over budget. You can pause and rework the design to save money.</div>` : ''}
    <button class="next" data-act="rework">Pause and rework the design</button>`;
}

function renderRevealPanel(s: GameState) {
  panel.innerHTML = `<h2>Kitchen finished</h2>
    <p class="lead">${s.result ? `${'★'.repeat(Math.floor(s.result.stars))}${s.result.stars % 1 ? '½' : ''} · ${s.result.coins} coins earned` : ''}</p>
    <button class="primary next" data-act="show-reveal">See the before and after</button>
    <button class="next" data-act="new-game">Start a new house</button>
    <div class="note">More rooms are coming next: living room, bathroom, bedroom, an office or nursery, and the exterior.</div>`;
}

// ---------- Actions ----------

panel.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || !state || b.disabled) return;
  const s = state;
  const act = b.dataset.act;
  const r = b.getBoundingClientRect();
  switch (act) {
    case 'demo':
      demolish(s);
      sparkle(r.left + r.width / 2, r.top, '💥');
      break;
    case 'floor':
      announce(ripFloor(s));
      break;
    case 'walls':
      announce(stripWalls(s));
      break;
    case 'to-fix':
      s.stage = 'fix';
      break;
    case 'resolve': {
      resolveIssue(s, b.dataset.issue!, Number(b.dataset.opt));
      sparkle(r.left + r.width / 2, r.top, '🔧');
      if (s.stage === 'build') {
        closeModal();
        runBuild();
      }
      break;
    }
    case 'to-design':
      s.stage = 'design';
      ui.tab = 'floor';
      break;
    case 'tab':
      ui.tab = b.dataset.tab as DesignTab;
      ui.placing = undefined;
      break;
    case 'finish':
      applyFinish(b.dataset.finish!);
      break;
    case 'place':
      ui.placing = ui.placing === b.dataset.item ? undefined : b.dataset.item;
      ui.placingRot = 0;
      ui.selected = undefined;
      break;
    case 'rotate':
      rotateSelected();
      break;
    case 'remove':
      removeSelected();
      break;
    case 'undo':
      undo();
      break;
    case 'starter':
      pushUndo();
      for (const p of STARTER_LAYOUT) s.design.items.push({ uid: s.nextUid++, ...p });
      break;
    case 'clear-items':
      pushUndo();
      s.design.items = [];
      ui.selected = undefined;
      break;
    case 'build':
      confirmBuild();
      return;
    case 'rework':
      stopBuild();
      backToDesign(s);
      break;
    case 'show-reveal':
      showReveal();
      return;
    case 'new-game':
      showTitle();
      return;
  }
  commit();
});

function announce(found: IssueState[]) {
  if (!state) return;
  commit();
  if (found.length === 0) {
    toast('All clear under there. Nice!');
    return;
  }
  showModal(`<div class="big">😬</div><h2>Uh oh, you found something</h2>
    ${found.map((i) => `<p><b>${esc(issueById(i.id).name)}.</b> ${esc(issueById(i.id).found)}</p>`).join('')}
    <p style="color:var(--ink-2)">You'll decide how to handle it in the repair stage.</p>
    <div class="modal-actions"><button class="primary" data-close>Got it</button></div>`);
}

modal.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-close]')) {
    closeModal();
    return;
  }
  // Issue choices during the build reuse the panel's handler.
  const b = t.closest('button');
  if (b?.dataset.act === 'resolve' && state) {
    resolveIssue(state, b.dataset.issue!, Number(b.dataset.opt));
    closeModal();
    commit();
    runBuild();
  }
  if (b?.dataset.act === 'new-game') showTitle();
});

function clickJunk(x: number, y: number, e: PointerEvent) {
  const s = state!;
  const j = s.junk.find((p) => p.x === x && p.y === y);
  if (!j || ui.fading.has(j.uid)) return;
  sparkle(e.clientX, e.clientY, '🧹');
  const start = performance.now();
  const step = (t: number) => {
    const a = 1 - (t - start) / 300;
    if (a <= 0) {
      ui.fading.delete(j.uid);
      haulJunk(s, j.uid);
      commit();
      return;
    }
    ui.fading.set(j.uid, a);
    draw();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function pushUndo() {
  if (!state) return;
  ui.undo.push(structuredClone(state.design));
  if (ui.undo.length > 60) ui.undo.shift();
}

function undo() {
  const prev = ui.undo.pop();
  if (prev && state) {
    state.design = prev;
    ui.selected = undefined;
  }
}

function applyFinish(id: string) {
  const s = state!;
  const f = finishById(id);
  if (f.category === 'window') {
    ui.windowStyle = id;
    return;
  }
  pushUndo();
  (s.design as unknown as Record<string, string>)[f.category] = id;
}

function clickWindow(wall: 'back' | 'left', slot: number) {
  const s = state!;
  pushUndo();
  const at = s.design.windows.findIndex((w) => w.wall === wall && w.slot === slot);
  if (at >= 0 && s.design.windows[at].finish === ui.windowStyle) s.design.windows.splice(at, 1);
  else if (at >= 0) s.design.windows[at].finish = ui.windowStyle;
  else s.design.windows.push({ wall, slot, finish: ui.windowStyle });
  commit();
}

function clickDesignTile(x: number, y: number) {
  const s = state!;
  if (ui.placing) {
    const p: Placed = { uid: s.nextUid, id: ui.placing, x, y, rot: ui.placingRot };
    if (!fits(s.design.items, p)) {
      toast("That doesn't fit there.");
      return;
    }
    pushUndo();
    s.nextUid++;
    s.design.items.push(p);
  } else {
    ui.selected = itemAt(s.design.items, x, y)?.uid;
  }
  commit();
}

function rotateSelected() {
  const s = state!;
  if (ui.placing) {
    ui.placingRot = ((ui.placingRot + 1) % 4) as Rot;
    draw();
    return;
  }
  const p = s.design.items.find((x) => x.uid === ui.selected);
  if (!p) return;
  const turned: Placed = { ...p, rot: ((p.rot + 1) % 4) as Rot };
  if (!fits(s.design.items, turned, p.uid)) {
    toast('No room to rotate it there.');
    return;
  }
  pushUndo();
  p.rot = turned.rot;
}

function removeSelected() {
  const s = state!;
  if (ui.selected === undefined) return;
  pushUndo();
  s.design.items = s.design.items.filter((p) => p.uid !== ui.selected);
  ui.selected = undefined;
}

document.addEventListener('keydown', (e) => {
  if (!state || state.stage !== 'design' || !modal.classList.contains('hidden')) return;
  if (e.key === 'r' || e.key === 'R') rotateSelected();
  else if (e.key === 'Escape') {
    ui.placing = undefined;
    ui.selected = undefined;
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selected !== undefined) removeSelected();
  else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) undo();
  else return;
  e.preventDefault();
  commit();
});

function confirmBuild() {
  const s = state!;
  const r = rate(s);
  const c = designCost(s.design);
  const left = remaining(s);
  const warn = r.tips.filter((t) => t.includes('need') || t.includes('still'));
  showModal(`<h2>Ready to build?</h2>
    <p>The crew needs <b>${c.laborDays} days</b>${isBudget(s) ? ` and <b>${money(c.total)}</b>` : ''}.${isBudget(s) && left < 0 ? ` That's <b style="color:var(--bad)">${money(-left)} over budget</b>.` : ''}</p>
    ${warn.length ? `<div class="note warn"><ul>${warn.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <p style="color:var(--ink-2)">Old houses hide things. Keep a little money spare for surprises.</p>
    <div class="modal-actions"><button data-close>Keep designing</button><button class="primary" id="go-build">Start the build</button></div>`);
  $('#go-build').addEventListener('click', () => {
    closeModal();
    ui.placing = undefined;
    ui.selected = undefined;
    startBuild(s);
    commit();
    runBuild();
  });
}

function stopBuild() {
  if (ui.buildTimer) clearInterval(ui.buildTimer);
  ui.buildTimer = undefined;
}

function runBuild() {
  stopBuild();
  const s = state!;
  ui.buildTimer = window.setInterval(() => {
    if (s.stage !== 'build') return stopBuild();
    if (buildDone(s)) {
      stopBuild();
      finishRoom(s);
      commit();
      showReveal();
      return;
    }
    const surprise = buildTick(s);
    commit();
    if (surprise) {
      stopBuild();
      const d = issueById(surprise.id);
      showModal(`<div class="big">${surprise.status === 'resurfaced' ? '😩' : '📞'}</div>
        <h2>${surprise.status === 'resurfaced' ? `It came back: ${esc(d.name)}` : `Call from the crew: ${esc(d.name)}`}</h2>
        <p>${surprise.status === 'resurfaced' ? 'That patch did not hold. It has to be fixed properly now, and it costs more than it would have.' : esc(d.found)}</p>
        ${issueCard(s, surprise)}
        ${isBudget(s) ? `<p style="color:var(--ink-2);font-size:13px">Budget left before this: ${money(remaining(s))}</p>` : ''}`);
    }
  }, 550);
}

function showReveal() {
  const s = state!;
  const after = snapshot(s);
  const before = beforeImg ?? after;
  const res = s.result!;
  const r = rate(s);
  const sc = scenarioById(s.scenario);
  showModal(
    `<h2>The big reveal</h2>
    <div class="ba" id="ba"><img src="${before}" alt="Kitchen before"><div class="after"><img src="${after}" alt="Kitchen after"></div><div class="bar"></div>
      <span class="lbl" style="left:10px">Before</span><span class="lbl" style="right:10px">After</span></div>
    <div class="reveal-grid">
      <div><div class="stars">${'★'.repeat(Math.floor(res.stars))}${res.stars % 1 ? '½' : ''}<span style="color:#e3d7c5">${'★'.repeat(5 - Math.ceil(res.stars))}</span></div>
        <b>${res.coins.toLocaleString()} coins earned</b>
        ${isBudget(s) ? `<p style="margin:4px 0;font-size:14px">Spent ${money(s.spent)} of ${money(s.budget)} · finished day ${res.finishedDay}${res.finishedDay <= sc.targetDay ? ', ahead of move-in!' : ` (move-in was day ${sc.targetDay})`}</p>` : ''}</div>
      <div>${r.good.length ? `<b>What people love</b><ul>${r.good.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${r.tips.length ? `<b>Next time</b><ul>${r.tips.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}</div>
    </div>
    <div class="modal-actions"><button data-close>Admire it</button><button class="primary" data-act="new-game">New house</button></div>`,
    true,
  );
  const ba = $('#ba');
  const set = (clientX: number) => {
    const rect = ba.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    (ba.querySelector('.after') as HTMLElement).style.clipPath = `inset(0 0 0 ${pct}%)`;
    (ba.querySelector('.bar') as HTMLElement).style.left = `${pct}%`;
  };
  let dragging = false;
  ba.addEventListener('pointerdown', (e) => {
    dragging = true;
    ba.setPointerCapture(e.pointerId);
    set(e.clientX);
  });
  ba.addEventListener('pointermove', (e) => dragging && set(e.clientX));
  ba.addEventListener('pointerup', () => (dragging = false));
  // A little sweep so people notice it's interactive.
  let t = 0;
  const sweep = () => {
    t += 1;
    const rect = ba.getBoundingClientRect();
    const pct = 50 + Math.sin(t / 18) * 35 * Math.max(0, 1 - t / 110);
    set(rect.left + (rect.width * pct) / 100);
    if (t < 110 && !dragging) requestAnimationFrame(sweep);
  };
  requestAnimationFrame(sweep);
}

// ---------- Title screen ----------

function showTitle() {
  stopBuild();
  closeModal();
  $('#game').classList.add('hidden');
  const title = $('#title-screen');
  title.classList.remove('hidden');
  const saved = load();
  title.innerHTML = `
    <h1>Reno Sim</h1>
    <p class="tagline">Turn a tired old house into a home, one room at a time.</p>
    <h3>Pick a house</h3>
    <div class="scenarios">${SCENARIOS.map(
      (sc) => `<button class="scenario ${ui.scenario === sc.id ? 'on' : ''}" data-scenario="${sc.id}">
        <h3>${esc(sc.name)}</h3><p>${esc(sc.blurb)}</p>
        <div class="meta">${ui.mode === 'budget' ? `${money(sc.budget)} kitchen budget · move in by day ${sc.targetDay}` : 'Unlimited budget'}</div></button>`,
    ).join('')}</div>
    <div class="setup-row">
      <div class="toggle"><button data-mode="budget" class="${ui.mode === 'budget' ? 'on' : ''}">Budget mode</button><button data-mode="freedom" class="${ui.mode === 'freedom' ? 'on' : ''}">Freedom mode</button></div>
      <span style="color:var(--ink-2);font-size:14px">${ui.mode === 'budget' ? 'Money, crew time, and hidden surprises all matter.' : 'Unlimited money, no surprises. Just decorate.'}</span>
      ${ui.mode === 'budget' ? `<label class="check"><input type="checkbox" id="inspect" ${ui.inspect ? 'checked' : ''}> Pay ${money(INSPECTION_COST)} for a home inspection first</label>` : ''}
    </div>
    <div class="title-actions">
      <button class="primary" data-start>Start renovating</button>
      ${saved ? `<button data-continue>Continue: ${esc(scenarioById(saved.scenario).name)} (${saved.stage})</button>` : ''}
    </div>`;
}

$('#title-screen').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const sc = t.closest<HTMLElement>('[data-scenario]');
  const md = t.closest<HTMLElement>('[data-mode]');
  if (sc) ui.scenario = sc.dataset.scenario!;
  if (md) ui.mode = md.dataset.mode as Mode;
  if (t.id === 'inspect') ui.inspect = (t as HTMLInputElement).checked;
  if (t.closest('[data-start]')) {
    clearSave();
    startGame(newGame(ui.scenario, ui.mode, ui.inspect), true);
    return;
  }
  if (t.closest('[data-continue]')) {
    const saved = load();
    if (saved) startGame(saved, false);
    return;
  }
  if (sc || md) showTitle();
});

function startGame(s: GameState, fresh: boolean) {
  state = s;
  ui.undo = [];
  ui.selected = undefined;
  ui.placing = undefined;
  ui.tab = 'floor';
  $('#title-screen').classList.add('hidden');
  $('#game').classList.remove('hidden');
  if (fresh) storeBefore(snapshot(s));
  commit();
  if (s.stage === 'build') runBuild();
}

setupCanvas();
window.addEventListener('resize', () => {
  setupCanvas();
  draw();
});
showTitle();
