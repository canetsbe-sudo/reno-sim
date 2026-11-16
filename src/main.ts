import './style.css';
import {
  DEMO_COST,
  FINISHES,
  INSPECTION_COST,
  ITEMS,
  LABOR_RATE,
  SCENARIOS,
  STARTER_LAYOUT,
  WALL_ART,
  finishById,
  issueById,
  itemById,
  scenarioById,
  type FinishCategory,
  type WallSide,
  type Rot,
} from './data';
import {
  backToDesign,
  buildDays,
  buildDone,
  buildTick,
  clearDone,
  CHANNEL_SUFFIX,
  DEFAULT_PATCH_RISK,
  clearSave,
  demolish,
  designCost,
  finishRoom,
  fitProblem,
  fits,
  haulJunk,
  heldPatches,
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
  type FitProblem,
  type GameState,
  type IssueState,
  type Mode,
  type Placed,
  type Stage,
} from './state';
import { placedFromView, rotToWorld, toWorld, wallFromView, type View } from './view';
import { CANVAS_H, CANVAS_W, drawScene, pickTile, pickWall, snapshot, type SceneOpts } from './render';
import { icon, stars, type IconName } from './ui/icons';
import { artPreview, finishPreview, housePreview, itemPreview, roomClip } from './ui/previews';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>('#room');
const ctx = canvas.getContext('2d')!;
const panel = $('#panel');
const hud = $('#hud');
const modal = $('#modal');
const hint = $('#room-hint');
const tools = $('#tools');

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let state: GameState | undefined;

// UI-only state that is not saved.
type DesignTab = FinishCategory | 'furniture' | 'upgrades' | 'art';
const ui = {
  tab: 'floor' as DesignTab,
  placing: undefined as string | undefined,
  // Facing while placing, as seen on screen (0 faces the camera).
  placingRot: 0 as Rot,
  windowStyle: 'win-classic',
  artPick: WALL_ART[0].id,
  selected: undefined as number | undefined,
  hoverTile: undefined as { x: number; y: number } | undefined,
  hoverWall: undefined as { wall: WallSide; slot: number } | undefined,
  view: 0 as View,
  fading: new Map<number, number>(),
  undo: [] as Design[],
  buildTimer: undefined as number | undefined,
  // Whether the cost breakdown under the design panel is open.
  costsOpen: false,
  // Title screen picks.
  scenario: SCENARIOS[0].id,
  mode: 'budget' as Mode,
  inspect: false,
};

// ---------- Canvas ----------

// The room is drawn at the size it is shown, so it stays crisp on big screens.
let canvasScale = 0;
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const shown = canvas.getBoundingClientRect().width || CANVAS_W;
  const scale = Math.round(Math.min(3, Math.max(1, (shown / CANVAS_W) * dpr)) * 8) / 8;
  if (scale === canvasScale) return;
  canvasScale = scale;
  canvas.width = Math.round(CANVAS_W * scale);
  canvas.height = Math.round(CANVAS_H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
document.documentElement.style.setProperty('--room-ratio', `${CANVAS_W} / ${CANVAS_H}`);
canvas.style.clipPath = roomClip(0);

let drawQueued = false;
function draw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    if (!state) return;
    const o: SceneOpts = { fading: ui.fading, selectedUid: ui.selected };
    if (state.stage === 'design') {
      o.arrows = true;
      if (ui.placing && ui.hoverTile) {
        const p: Placed = { uid: -1, ...placedFromView(ui.view, ui.placing, ui.hoverTile.x, ui.hoverTile.y, rotToWorld(ui.view, ui.placingRot)) };
        o.ghost = { p, valid: fits(state.design.items, p, undefined, state.design.doors) };
      }
      if ((ui.tab === 'window' || ui.tab === 'art') && ui.hoverWall) o.hoverWall = ui.hoverWall;
    }
    if (state.stage === 'clear' && ui.hoverTile) {
      const t = worldTile(ui.hoverTile);
      if (state.junk.some((j) => j.x === t.x && j.y === t.y)) o.hoverTile = ui.hoverTile;
    }
    o.view = ui.view;
    drawScene(ctx, state, o);
  });
}

// The world tile under a view tile.
function worldTile(t: { x: number; y: number }) {
  const [x, y] = toWorld(ui.view, t.x + 0.5, t.y + 0.5);
  return { x: Math.floor(x), y: Math.floor(y) };
}

function turnView(step: number) {
  ui.view = ((ui.view + step + 4) % 4) as View;
  ui.hoverTile = undefined;
  ui.hoverWall = undefined;
  canvas.style.clipPath = roomClip(ui.view);
  draw();
}

$('#view-ctl').innerHTML =
  `<button class="dock-btn" data-turn="-1" title="Turn the room left (Q)" aria-label="Turn the room left">${icon('turnLeft')}</button>` +
  `<button class="dock-btn" data-turn="1" title="Turn the room right (E)" aria-label="Turn the room right">${icon('turnRight')}</button>`;
$('#view-ctl').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-turn]');
  if (b) turnView(Number(b.dataset.turn));
});

function canvasPoint(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * CANVAS_W, y: ((e.clientY - r.top) / r.height) * CANVAS_H };
}

canvas.addEventListener('pointermove', (e) => {
  if (!state) return;
  const p = canvasPoint(e);
  ui.hoverTile = pickTile(ui.view, p.x, p.y);
  ui.hoverWall = ui.hoverTile ? undefined : pickWall(ui.view, p.x, p.y);
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
  const tile = pickTile(ui.view, p.x, p.y);
  const wall = tile ? undefined : pickWall(ui.view, p.x, p.y);
  if (state.stage === 'clear' && tile) {
    const t = worldTile(tile);
    clickJunk(t.x, t.y, e);
  }
  if (state.stage === 'design') {
    if ((ui.tab === 'window' || ui.tab === 'art') && wall) {
      const w = wallFromView(ui.view, wall.wall, wall.slot);
      if (ui.tab === 'art') clickArt(w.wall, w.slot);
      else clickWindow(w.wall, w.slot);
    } else if (tile) clickDesignTile(tile.x, tile.y);
  }
});

// ---------- Helpers ----------

function commit() {
  if (!state) return;
  save(state);
  renderHud();
  renderPanel();
  renderTools();
  draw();
}

function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout((t as unknown as { _t: number })._t);
  (t as unknown as { _t: number })._t = window.setTimeout(() => t.classList.remove('show'), 2600);
}

// A little burst of dots where something satisfying just happened.
function sparkle(x: number, y: number, tone: 'dust' | 'fix' | 'sweep' = 'sweep') {
  const s = document.createElement('div');
  s.className = `burst ${tone}`;
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  s.innerHTML = Array.from({ length: 9 }, (_, i) => `<i style="--a:${i * 40 + Math.random() * 24}deg;--d:${26 + Math.random() * 26}px"></i>`).join('');
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 800);
}

function showModal(html: string, wide = false) {
  modal.innerHTML = `<div class="modal-card${wide ? ' wide' : ''}">${html}</div>`;
  modal.classList.remove('hidden');
}
function closeModal() {
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

const BEFORE_KEY = `reno-sim-before-v1${CHANNEL_SUFFIX}`;
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
  { id: 'clear', label: 'Clear out' },
  { id: 'fix', label: 'Fix up' },
  { id: 'design', label: 'Design' },
  { id: 'build', label: 'Build' },
  { id: 'reveal', label: 'Reveal' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const meter = (pct: number, over = false) => `<span class="meter${over ? ' over' : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;

function renderHud() {
  if (!state) return;
  const sc = scenarioById(state.scenario);
  const idx = STAGES.findIndex((x) => x.id === state!.stage);
  const left = remaining(state);
  const stats = isBudget(state)
    ? `<div class="stat"><span class="stat-k">Budget left</span><b class="stat-v${left < 0 ? ' neg' : ''}">${money(left)}</b>${meter((left / state.budget) * 100, left < 0)}</div>
       <div class="stat"><span class="stat-k">Day</span><b class="stat-v">${state.day}<small>move-in ${sc.targetDay}</small></b>${meter((state.day / sc.targetDay) * 100, state.day > sc.targetDay)}</div>`
    : `<div class="stat"><span class="stat-k">Mode</span><b class="stat-v">Freedom</b></div>`;
  hud.innerHTML = `
    <div class="hud-left">
      <button class="icon-btn" data-act="menu" title="Main menu" aria-label="Main menu">${icon('home')}</button>
      <div class="name">The Kitchen<small>${esc(sc.name)}</small></div>
    </div>
    <ol class="steps" aria-label="Progress">${STAGES.map(
      (s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"${i === idx ? ' aria-current="step"' : ''}><span class="dot">${i < idx ? icon('check', 12) : i + 1}</span><span class="lbl">${s.label}</span></li>`,
    ).join('')}</ol>
    <div class="stats">${stats}</div>`;
}

hud.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b?.dataset.act === 'menu') {
    stopBuild();
    showTitle();
  }
});

// ---------- Panel ----------

// The panel is a header, a body that scrolls and a footer that stays put. The body keeps
// its scroll position while you stay on the same page of it.
let panelKey = '';
let panelStage = '';
function setPanel(key: string, o: { title: string; lead: string; body: string; foot: string }) {
  const s = state!;
  const old = panel.querySelector('.p-body');
  const top = key === panelKey && old ? old.scrollTop : 0;
  const step = STAGES.findIndex((x) => x.id === s.stage) + 1;
  panel.innerHTML = `
    <div class="p-head"><span class="eyebrow">Step ${step} of ${STAGES.length}</span><h2>${o.title}</h2><p class="lead">${o.lead}</p></div>
    <div class="p-body">${o.body}</div>
    <div class="p-foot">${o.foot}</div>`;
  panel.querySelector('.p-body')!.scrollTop = top;
  panelKey = key;
  if (panelStage !== s.stage) {
    panelStage = s.stage;
    panel.classList.remove('fresh');
    void panel.offsetWidth;
    panel.classList.add('fresh');
  }
}

// What to do next, shown under the room. Keys are drawn as key caps.
function setHint(...hints: [keys: string, label: string][]) {
  hint.innerHTML = hints
    .map(
      ([keys, label]) =>
        `<span class="hint">${keys
          .split(' ')
          .filter(Boolean)
          .map((k) => `<kbd>${k}</kbd>`)
          .join('')}${esc(label)}</span>`,
    )
    .join('');
}

// Design tools that sit under the room, next to the turn buttons.
function renderTools() {
  if (!state || state.stage !== 'design') {
    tools.innerHTML = '';
    return;
  }
  const n = state.design.items.length;
  tools.innerHTML = `
    <button class="dock-btn" data-act="undo" ${ui.undo.length ? '' : 'disabled'} title="Undo (Ctrl+Z)">${icon('undo')}<span>Undo</span></button>
    <button class="dock-btn" data-act="starter" ${n ? 'disabled' : ''} title="Place a basic L-shaped kitchen">${icon('layout')}<span>Starter layout</span></button>
    <button class="dock-btn" data-act="clear-items" ${n ? '' : 'disabled'} title="Remove all furniture">${icon('trash')}<span>Clear</span></button>`;
}

function renderPanel() {
  if (!state) return;
  hint.innerHTML = '';
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

const note = (ic: IconName, title: string, items: string[], cls = '') =>
  `<div class="note ${cls}"><div class="note-head">${icon(ic, 16)}<b>${title}</b></div>${items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : ''}</div>`;

function hintsBlock(s: GameState) {
  const hidden = s.issues.filter((i) => i.status === 'hidden');
  if (!isBudget(s) || hidden.length === 0) return '';
  if (s.inspected) {
    return note(
      'eye',
      'Inspection report',
      hidden.map((i) => {
        const d = issueById(i.id);
        const proper = d.options.find((o) => !o.patch) ?? d.options[0];
        return `${esc(d.name)}: about ${money(proper.cost)} to fix properly`;
      }),
    );
  }
  const clues = hidden.map((i) => issueById(i.id).hint).filter(Boolean);
  if (clues.length === 0) return '';
  return note(
    'eye',
    'Things you noticed',
    clues.map((c) => esc(c!)),
  );
}

function renderClear(s: GameState) {
  const tasks = [
    { act: 'demo', go: 'Demo it', name: 'Demo the old kitchen', sub: `Cabinets and appliances out${isBudget(s) ? ` · ${money(DEMO_COST)} dumpster` : ''} · 1 day`, done: s.demoDone },
    { act: 'floor', go: 'Rip it up', name: 'Rip up the old floor', sub: '1 day', done: s.floorRipped },
    { act: 'walls', go: 'Strip them', name: 'Strip the walls', sub: '1 day', done: s.wallsStripped },
  ];
  if (s.junk.length) setHint(['Click', 'the junk to haul it away'], ['Q E', 'turn the room']);
  else setHint(['Q E', 'turn the room']);
  const tick = (done: boolean, n: number) => `<span class="tick">${done ? icon('check', 14) : n}</span>`;
  const count = tasks.filter((t) => t.done).length + (s.junk.length ? 0 : 1);
  setPanel('clear', {
    title: 'Clear it out',
    lead: 'Out with the old. Click junk in the room to haul it away, then tear out the tired kitchen.',
    body: `
      <div class="tasks">
        <div class="task ${s.junk.length ? '' : 'done'}">${tick(!s.junk.length, 1)}<div class="t-text"><span class="t-name">Haul away junk</span><small>${s.junk.length ? 'Click each piece in the room' : 'All clear'}</small></div>
          ${s.junk.length ? `<span class="pill">${s.junk.length} left</span>` : ''}</div>
        ${tasks
          .map(
            (t, i) => `<div class="task ${t.done ? 'done' : ''}">${tick(t.done, i + 2)}<div class="t-text"><span class="t-name">${t.name}</span><small>${t.done ? 'Done' : t.sub}</small></div>
            ${t.done ? '' : `<button class="btn" data-act="${t.act}">${t.go}</button>`}</div>`,
          )
          .join('')}
      </div>
      ${hintsBlock(s)}`,
    foot: `<div class="foot-meta"><span>${count} of 4 done</span>${meter((count / 4) * 100)}</div>
      <button class="primary next" data-act="to-fix" ${clearDone(s) ? '' : 'disabled'}>On to repairs${icon('arrow')}</button>`,
  });
}

function renderFix(s: GameState) {
  const open = openIssues(s);
  const fixed = s.issues.filter((i) => i.status === 'fixed' || i.status === 'patched');
  setHint(['Q E', 'turn the room']);
  setPanel('fix', {
    title: 'Fix it up',
    lead: 'Deal with what you found. A proper fix costs more now. A patch is a gamble: it might hold and save you money, or come back mid-build and cost more.',
    body: `
      ${open.map((i) => issueCard(s, i)).join('')}
      ${open.length === 0 && fixed.length === 0 ? note('check', 'Nothing to fix. Lucky house.', [], 'good') : ''}
      ${
        fixed.length
          ? note(
              'check',
              'Handled',
              fixed.map((i) => `${esc(issueById(i.id).name)}: ${i.status === 'patched' ? 'patched, fingers crossed' : 'fixed properly'}`),
              'good',
            )
          : ''
      }
      ${hintsBlock(s)}`,
    foot: `${open.length ? `<div class="foot-meta"><span>${plural(open.length, 'problem')} left to decide</span></div>` : ''}
      <button class="primary next" data-act="to-design" ${open.length ? 'disabled' : ''}>Start designing${icon('arrow')}</button>`,
  });
}

function issueCard(s: GameState, i: IssueState) {
  const d = issueById(i.id);
  const opts = issueOptions(i);
  return `<div class="issue">
    <div class="issue-head"><span class="badge warn">${icon('alert', 16)}</span><div><h4>${i.status === 'resurfaced' ? 'It came back: ' : ''}${esc(d.name)}</h4><p>${esc(d.found)}</p></div></div>
    ${opts
      .map((o, k) => {
        const risk = Math.round((o.risk ?? DEFAULT_PATCH_RISK) * 100);
        return `<button class="opt${o.patch ? ' gamble' : ''}" data-act="resolve" data-issue="${i.id}" data-opt="${k}">
          <span class="opt-main"><span class="opt-label">${esc(o.label)}</span>
            ${o.patch ? `<span class="patch">${icon('dice', 14)}Gamble: ${risk}% chance it comes back worse</span><span class="odds"><i style="width:${risk}%"></i></span>` : ''}</span>
          <span class="opt-cost">${isBudget(s) ? `<b>${money(o.cost)}</b>` : ''}<small>${plural(o.days, 'day')}</small></span></button>`;
      })
      .join('')}</div>`;
}

const TABS: { id: DesignTab; label: string; icon: IconName }[] = [
  { id: 'floor', label: 'Floors', icon: 'floor' },
  { id: 'wall', label: 'Walls', icon: 'wall' },
  { id: 'window', label: 'Windows', icon: 'window' },
  { id: 'cabinet', label: 'Cabinets', icon: 'cabinet' },
  { id: 'counter', label: 'Counters', icon: 'counter' },
  { id: 'backsplash', label: 'Backsplash', icon: 'backsplash' },
  { id: 'furniture', label: 'Furniture', icon: 'furniture' },
  { id: 'art', label: 'Wall art', icon: 'art' },
  { id: 'upgrades', label: 'Upgrades', icon: 'upgrades' },
  { id: 'lighting', label: 'Lighting', icon: 'lighting' },
];

const unitLabel: Record<FinishCategory, string> = {
  floor: '/tile',
  wall: '/wall',
  cabinet: '/cabinet',
  counter: '/counter',
  backsplash: '/counter on a wall',
  window: '/window',
  lighting: '',
};

function renderDesign(s: GameState) {
  const d = s.design;
  const sc = scenarioById(s.scenario);
  const budget = isBudget(s);
  const pick = (on: boolean) => (on ? `<span class="picked">${icon('check', 12)}</span>` : '');
  const styleTag = (styles: string[]) => (sc.style && styles.includes(sc.style) ? `<span class="style-tag">${sc.styleLabel}</span>` : '');
  let body = '';
  if (ui.tab === 'art') {
    body = `<p class="how">Pick a piece, then click a spot on either wall to hang it. Click it again to take it down.</p>
      <div class="item-list">${WALL_ART.map((a) => {
        const on = ui.artPick === a.id;
        return `<button class="item-btn ${on ? 'on' : ''}" data-act="art" data-art="${a.id}" aria-pressed="${on}">
          <span class="thumb wall ${artPreview(a.id)}"></span>
          <span class="it-text"><b>${esc(a.name)}</b>${a.blurb ? `<small>${esc(a.blurb)}</small>` : ''}${styleTag(a.styles)}</span>
          <span class="it-cost">${budget ? `<b>${money(a.cost)}</b>` : ''}</span>${pick(on)}</button>`;
      }).join('')}</div>`;
  } else if (ui.tab === 'furniture' || ui.tab === 'upgrades') {
    const list = ITEMS.filter((it) => (ui.tab === 'upgrades' ? it.kind === 'upgrade' : it.kind !== 'upgrade'));
    body = `<p class="how">Pick a piece, then click the floor to place it. Click anything in the room to move or remove it.</p>
      <div class="item-list">${list
        .map((it) => {
          const on = ui.placing === it.id;
          const extra = it.usesCabinet ? '+ cabinet finish' : it.usesCounter ? '+ counter' : '';
          return `<button class="item-btn ${on ? 'on' : ''}" data-act="place" data-item="${it.id}" aria-pressed="${on}">
            <span class="thumb ${itemPreview(it.id, d)}"></span>
            <span class="it-text"><b>${esc(it.name)}</b><small>${it.w}x${it.d}${it.blurb ? ' · ' + esc(it.blurb) : ''}</small></span>
            <span class="it-cost">${budget ? `<b>${money(it.cost)}</b>${extra ? `<small>${extra}</small>` : ''}` : ''}${it.labor ? `<small>${plural(it.labor, 'crew day')}</small>` : ''}</span>${pick(on)}</button>`;
        })
        .join('')}</div>`;
  } else {
    const cat = ui.tab as FinishCategory;
    const current = cat === 'window' ? ui.windowStyle : (d[cat as keyof Design] as string);
    const opts = FINISHES.filter((f) => f.category === cat && !f.old);
    body = `${cat === 'window' ? '<p class="how">Pick a style, then click a spot on either wall to add or replace a window. Click a window again to remove it.</p>' : ''}
      <div class="swatches">${opts
        .map((f) => {
          const on = current === f.id;
          const price = budget ? (f.cost ? money(f.cost) + unitLabel[cat] : 'Free') : '';
          const days = f.labor ? plural(f.labor, 'day') : '';
          return `<button class="swatch ${on ? 'on' : ''}" data-act="finish" data-finish="${f.id}" aria-pressed="${on}">
            <span class="sw-img ${finishPreview(f)}" style="background-color:${f.color}">${styleTag(f.styles)}${pick(on)}</span>
            <span class="s-name">${esc(f.name)}</span><small>${[price, days].filter(Boolean).join(' · ')}</small></button>`;
        })
        .join('')}</div>`;
  }

  const sel = ui.selected !== undefined ? d.items.find((p) => p.uid === ui.selected) : undefined;
  if (sel) {
    hint.innerHTML = `<div class="sel"><span class="sel-name">${esc(itemById(sel.id).name)}</span>
      <button class="dock-btn" data-act="rotate">${icon('rotate', 16)}<span>Rotate</span><kbd>R</kbd></button>
      <button class="dock-btn danger" data-act="remove">${icon('trash', 16)}<span>Remove</span><kbd>Del</kbd></button></div>`;
  } else if (ui.placing) setHint(['Click', 'place'], ['R', 'rotate'], ['Esc', 'stop'], ['Q E', 'turn the room']);
  else if (ui.tab === 'art') setHint(['Click', 'a wall to hang it'], ['Q E', 'turn the room to reach the other walls']);
  else if (ui.tab === 'window') setHint(['Click', 'a wall to place a window'], ['Q E', 'turn the room to reach the other walls']);
  else setHint(['Click', 'an item in the room to select it'], ['Q E', 'turn the room']);

  const c = designCost(d);
  const left = remaining(s);
  const r = rate(s);
  const over = budget && left < 0;
  const foot = budget
    ? `<button class="sum" data-act="toggle-costs" aria-expanded="${ui.costsOpen}">
        <span class="sum-cell"><span class="sum-k">Budget left</span><b class="sum-v${over ? ' neg' : ''}">${money(left)}</b></span>
        <span class="sum-cell"><span class="sum-k">Build time</span><b class="sum-v">${plural(c.laborDays, 'day')}</b></span>
        <span class="sum-more">${ui.costsOpen ? 'Hide' : 'Details'}${icon('chevron', 14)}</span>
      </button>
      ${
        ui.costsOpen
          ? `<div class="costs">
        <div class="row"><span>Materials</span><span>${money(c.materials)}</span></div>
        <div class="row"><span>Labor (${c.laborDays} crew days x ${money(LABOR_RATE)})</span><span>${money(c.laborCost)}</span></div>
        <div class="row"><span>Already spent</span><span>${money(s.spent)}</span></div>
        <div class="row total"><span>Budget left</span><span class="${over ? 'neg' : ''}">${money(left)}</span></div>
        <div class="row"><span>Done around</span><span>day ${s.day + c.laborDays} (move-in day ${sc.targetDay})</span></div>
      </div>`
          : ''
      }
      ${over ? '<div class="note warn slim">Over budget. You can still build, but you will earn fewer coins. Cheaper finishes or fewer upgrades will get you back under.</div>' : ''}`
    : `<div class="foot-meta"><span>Build time</span><b>${plural(c.laborDays, 'day')}</b></div>`;

  setPanel(`design:${ui.tab}`, {
    title: 'Design it',
    lead: `Make it yours. Nothing is permanent until the crew builds it.${sc.style ? ` Brief: <b>${sc.styleLabel}</b>.` : ''}`,
    body: `
      <nav class="tabs" aria-label="What to design">${TABS.map(
        (t) => `<button class="${ui.tab === t.id ? 'on' : ''}" data-act="tab" data-tab="${t.id}" aria-pressed="${ui.tab === t.id}">${icon(t.icon, 20)}<span>${t.label}</span></button>`,
      ).join('')}</nav>
      ${body}
      <div class="cozy"><div class="cozy-head"><b>Cozy preview</b>${stars(r.stars, 16)}</div>${r.tips.length ? `<ul>${r.tips.slice(0, 2).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>`,
    foot: `${foot}<button class="primary next" data-act="build">Start the build${icon('arrow')}</button>`,
  });
}

// Where the progress ring stood last time, so it can sweep on from there.
let ringFrom = 0;
function renderBuild(s: GameState) {
  const total = buildDays(s);
  const done = Math.min(s.buildProgress, total);
  const pct = Math.min(1, s.buildProgress / total);
  const left = remaining(s);
  const C = 2 * Math.PI * 52;
  setHint(['Q E', 'turn the room']);
  setPanel('build', {
    title: 'The crew is building',
    lead: "Sit back. They'll call you if they find anything.",
    body: `
      <div class="ring" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">
        <svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-bar" cx="60" cy="60" r="52" stroke-dasharray="${C}" style="--from:${C * (1 - Math.min(ringFrom, pct))};--to:${C * (1 - pct)}"/></svg>
        <div class="ring-text"><b>${done}</b><span>of ${plural(total, 'crew day')}</span></div>
      </div>
      <p class="crew"><span class="crew-ic">${icon('hammer', 16)}</span>Crew at work · Day ${s.day}</p>
      ${isBudget(s) && left < 0 ? `<div class="note warn">Surprises pushed you ${money(-left)} over budget. You can pause and rework the design to save money.</div>` : ''}`,
    foot: `<button class="next" data-act="rework">${icon('pause')}Pause and rework the design</button>`,
  });
  ringFrom = pct;
}

function renderRevealPanel(s: GameState) {
  setHint(['Q E', 'turn the room']);
  setPanel('reveal', {
    title: 'Kitchen finished',
    lead: 'Take a look around. You earned it.',
    body: `
      ${s.result ? `<div class="score">${stars(s.result.stars, 26)}<div class="score-coins">${icon('coin', 18)}<b>${s.result.coins.toLocaleString()}</b> coins earned</div></div>` : ''}
      <div class="note">More rooms are coming next: living room, bathroom, bedroom, an office or nursery, and the exterior.</div>`,
    foot: `<button class="primary next" data-act="show-reveal">See the before and after</button>
      <button class="next" data-act="new-game">Start a new house</button>`,
  });
}

// ---------- Actions ----------

// Buttons in the panel and under the room all come through here.
function onAction(e: Event) {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || !state || b.disabled) return;
  const s = state;
  const act = b.dataset.act;
  const r = b.getBoundingClientRect();
  switch (act) {
    case 'demo':
      demolish(s);
      sparkle(r.left + r.width / 2, r.top + r.height / 2, 'dust');
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
      sparkle(r.left + r.width / 2, r.top + r.height / 2, 'fix');
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
    case 'art':
      ui.artPick = b.dataset.art!;
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
    case 'toggle-costs':
      ui.costsOpen = !ui.costsOpen;
      break;
  }
  commit();
}
panel.addEventListener('click', onAction);
tools.addEventListener('click', onAction);
hint.addEventListener('click', onAction);

function announce(found: IssueState[]) {
  if (!state) return;
  commit();
  if (found.length === 0) {
    toast('All clear under there. Nice!');
    return;
  }
  showModal(`<span class="badge warn big">${icon('alert', 24)}</span><h2>Uh oh, you found something</h2>
    ${found.map((i) => `<p><b>${esc(issueById(i.id).name)}.</b> ${esc(issueById(i.id).found)}</p>`).join('')}
    <p class="muted">You'll decide how to handle it in the repair stage.</p>
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
  sparkle(e.clientX, e.clientY, 'sweep');
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

function clickWindow(wall: WallSide, slot: number) {
  const s = state!;
  if (s.design.doors.some((d) => d.wall === wall && d.slot === slot)) {
    toast("That's a doorway.");
    return;
  }
  pushUndo();
  const at = s.design.windows.findIndex((w) => w.wall === wall && w.slot === slot);
  if (at >= 0 && s.design.windows[at].finish === ui.windowStyle) s.design.windows.splice(at, 1);
  else if (at >= 0) s.design.windows[at].finish = ui.windowStyle;
  else {
    s.design.windows.push({ wall, slot, finish: ui.windowStyle });
    // A new window takes the place of anything hanging there.
    s.design.art = s.design.art.filter((a) => a.wall !== wall || a.slot !== slot);
  }
  commit();
}

function clickArt(wall: WallSide, slot: number) {
  const s = state!;
  if (s.design.doors.some((d) => d.wall === wall && d.slot === slot)) {
    toast("That's a doorway.");
    return;
  }
  if (s.design.windows.some((w) => w.wall === wall && w.slot === slot)) {
    toast("There's a window there.");
    return;
  }
  pushUndo();
  const at = s.design.art.findIndex((a) => a.wall === wall && a.slot === slot);
  if (at >= 0 && s.design.art[at].id === ui.artPick) s.design.art.splice(at, 1);
  else if (at >= 0) s.design.art[at].id = ui.artPick;
  else s.design.art.push({ wall, slot, id: ui.artPick });
  commit();
}

// Takes a view tile; items are stored in world space.
function clickDesignTile(vx: number, vy: number) {
  const s = state!;
  const { x, y } = worldTile({ x: vx, y: vy });
  const hit = itemAt(s.design.items, x, y);
  if (ui.placing) {
    const p: Placed = { uid: s.nextUid, ...placedFromView(ui.view, ui.placing, vx, vy, rotToWorld(ui.view, ui.placingRot)) };
    const problem = fitProblem(s.design.items, p, undefined, s.design.doors);
    // Clicking something that's already there selects it, so it can be moved or removed.
    if (problem === 'blocked' && hit) {
      ui.placing = undefined;
      ui.selected = hit.uid;
    } else if (problem) {
      toast(FIT_MESSAGES[problem]);
      return;
    } else {
      pushUndo();
      s.nextUid++;
      s.design.items.push(p);
    }
  } else {
    ui.selected = hit?.uid;
  }
  commit();
}

const FIT_MESSAGES: Record<FitProblem, string> = {
  outside: "That doesn't fit in the room there.",
  blocked: "Something's already there.",
  corner: "Appliance doors need room to open, so they can't sit in a corner between counters.",
  doorway: 'Keep the doorway clear so people can get in.',
};

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
  const problem = fitProblem(s.design.items, turned, p.uid, s.design.doors);
  if (problem) {
    toast(problem === 'corner' ? FIT_MESSAGES.corner : 'No room to rotate it there.');
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
  if (!state || !modal.classList.contains('hidden') || $('#game').classList.contains('hidden')) return;
  if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') {
    turnView(e.key.toLowerCase() === 'q' ? -1 : 1);
    return;
  }
  if (state.stage !== 'design') return;
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
    <p>The crew needs <b>${c.laborDays} days</b>${isBudget(s) ? ` and <b>${money(c.total)}</b>` : ''}.${isBudget(s) && left < 0 ? ` That's <b class="neg">${money(-left)} over budget</b>.` : ''}</p>
    ${warn.length ? `<div class="note warn"><ul>${warn.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <p class="muted">Old houses hide things. Keep a little money spare for surprises.</p>
    <div class="modal-actions"><button data-close>Keep designing</button><button class="primary" id="go-build">Start the build${icon('arrow')}</button></div>`);
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
      showModal(`<span class="badge warn big">${icon(surprise.status === 'resurfaced' ? 'alert' : 'phone', 24)}</span>
        <h2>${surprise.status === 'resurfaced' ? `It came back: ${esc(d.name)}` : `Call from the crew: ${esc(d.name)}`}</h2>
        <p>${surprise.status === 'resurfaced' ? 'That patch did not hold. It has to be fixed properly now, and it costs more than it would have.' : esc(d.found)}</p>
        ${issueCard(s, surprise)}
        ${isBudget(s) ? `<p class="muted small">Budget left before this: ${money(remaining(s))}</p>` : ''}`);
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
    `<span class="eyebrow">${esc(sc.name)}</span><h2>The big reveal</h2>
    <div class="ba" id="ba"><img src="${before}" alt="Kitchen before" style="clip-path:${roomClip(0)}"><div class="after"><img src="${after}" alt="Kitchen after" style="clip-path:${roomClip(0)}"></div><div class="bar"><span class="knob"></span></div>
      <span class="lbl" style="left:12px">Before</span><span class="lbl" style="right:12px">After</span></div>
    <div class="reveal-grid">
      <div class="score">${stars(res.stars, 30)}
        <div class="score-coins">${icon('coin', 18)}<b>${res.coins.toLocaleString()}</b> coins earned</div>
        ${
          isBudget(s)
            ? `<div class="tiles"><div class="tile"><span>Spent</span><b>${money(s.spent)}</b><small>of ${money(s.budget)}</small></div>
          <div class="tile"><span>Finished</span><b>Day ${res.finishedDay}</b><small>${res.finishedDay <= sc.targetDay ? 'ahead of move-in!' : `move-in was day ${sc.targetDay}`}</small></div></div>`
            : ''
        }</div>
      <div class="reveal-notes">${heldPatches(s)
        .map((i) => `<div class="note good"><b>Your gamble paid off.</b> The ${esc(issueById(i.id).name.toLowerCase())} patch held${isBudget(s) && i.saved ? `, saving you ${money(i.saved)}` : ''}.</div>`)
        .join('')}
        ${r.good.length ? `<h4>What people love</h4><ul class="loves">${r.good.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${r.tips.length ? `<h4>Next time</h4><ul>${r.tips.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}</div>
    </div>
    <div class="modal-actions"><button data-close>Admire it</button><button class="primary" data-act="new-game">New house${icon('arrow')}</button></div>`,
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
  const sel = scenarioById(ui.scenario);
  const budget = ui.mode === 'budget';
  const tile = (ic: IconName, k: string, v: string) => `<div class="tile">${icon(ic, 16)}<span>${k}</span><b>${v}</b></div>`;
  title.innerHTML = `
    <div class="t-shell${titleSeen ? '' : ' intro'}">
      <section class="t-left">
        <div class="wordmark"><span class="mark">${icon('home', 16)}</span>Reno Sim${CHANNEL_SUFFIX ? '<span class="dev-badge">Dev preview</span>' : ''}</div>
        <h1>Turn a tired old house into a <em>home</em>.</h1>
        <p class="tagline">One room at a time. Clear it out, fix what you find, then design it your way.</p>
        <span class="eyebrow">Pick a house</span>
        <div class="scenarios" role="radiogroup" aria-label="Pick a house">${SCENARIOS.map((sc) => {
          const on = ui.scenario === sc.id;
          return `<button class="scenario ${on ? 'on' : ''}" data-scenario="${sc.id}" role="radio" aria-checked="${on}">
            <span class="sc-thumb pv-house-${sc.id}"></span>
            <span class="sc-text"><b>${esc(sc.name)}</b><small>${budget ? `${money(sc.budget)} · move in by day ${sc.targetDay}` : 'Unlimited budget'}</small></span>
            <span class="picked">${icon('check', 12)}</span></button>`;
        }).join('')}</div>
      </section>
      <section class="t-right">
        <div class="t-card">
          <div class="t-preview pv-house-${sel.id}" role="img" aria-label="${esc(sel.name)} as you find it"><span class="lbl">As you find it</span></div>
          <div class="t-info">
            <h2>${esc(sel.name)}</h2>
            <p class="blurb">${esc(sel.blurb)}</p>
            <div class="tiles">
              ${budget ? tile('wallet', 'Kitchen budget', money(sel.budget)) + tile('calendar', 'Move in by', `Day ${sel.targetDay}`) : tile('infinity', 'Budget', 'Unlimited') + tile('calendar', 'Deadline', 'None')}
              ${sel.styleLabel ? tile('art', 'The brief', esc(sel.styleLabel)) : ''}
            </div>
            <div class="setup-row">
              <div class="toggle"><button data-mode="budget" class="${budget ? 'on' : ''}" aria-pressed="${budget}">Budget mode</button><button data-mode="freedom" class="${budget ? '' : 'on'}" aria-pressed="${!budget}">Freedom mode</button></div>
              <span class="mode-note">${budget ? 'Money, crew time, and hidden surprises all matter.' : 'Unlimited money, no surprises. Just decorate.'}</span>
            </div>
            ${
              budget
                ? `<label class="check"><input type="checkbox" id="inspect" ${ui.inspect ? 'checked' : ''}><span class="switch"></span><span>Pay ${money(INSPECTION_COST)} for a home inspection first</span></label>`
                : ''
            }
            <div class="title-actions">
              <button class="primary" data-start>Start renovating${icon('arrow')}</button>
              ${saved ? `<button data-continue>${icon('play', 14)}Continue: ${esc(scenarioById(saved.scenario).name)} (${saved.stage})</button>` : ''}
            </div>
          </div>
        </div>
      </section>
    </div>`;
  titleSeen = true;
  drawHouses();
}

// The entrance animation plays once, not every time a house is picked.
let titleSeen = false;

// House pictures take a moment each, so the picked one is drawn first and the rest follow.
function drawHouses() {
  const next = [ui.scenario, ...SCENARIOS.map((s) => s.id)];
  const step = () => {
    const id = next.shift();
    if (!id || $('#title-screen').classList.contains('hidden')) return;
    housePreview(id);
    setTimeout(step, 30);
  };
  setTimeout(step, 30);
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
// The room is resized by its container, not only by the window.
new ResizeObserver(() => {
  setupCanvas();
  draw();
}).observe(canvas);
showTitle();
