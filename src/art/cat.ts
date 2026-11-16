// The house cat: a long-haired brown tabby with tortie patches, a cream bib, green eyes,
// one ginger paw and a small collar. She is built from soft fur blobs set out in her own
// space (nose toward `rot`), so she keeps her shape from every side of the room, and her
// head is painted flat on top so she can look back at the camera.
import type { CatPose } from '../cat';
import type { Rot } from '../data';
import { rng } from './noise';
import { floorShadow, rgb, tint, type Kit } from './props';

type Pt = [number, number];

const C = {
  base: '#7b6751',
  dark: '#2d231a',
  light: '#a8916f',
  tan: '#c39a63',
  ginger: '#dba768',
  cream: '#f1e9dc',
  nose: '#b06a58',
  eye: '#a9b45c',
  ear: '#cfa58d',
  collar: '#d9826a',
};

// She is drawn a little larger than life so she reads at room scale.
const S = 1.25;
const DIRS: Pt[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

interface Coat {
  base: string;
  // 0 for plain fur, up to 1 for bold tabby bars.
  stripes: number;
  // Tan and ginger tortie patches.
  patches?: boolean;
  // How far the hair stands out past the outline, in pixels.
  fluff: number;
}

const TABBY: Coat = { base: C.base, stripes: 1, patches: true, fluff: 2.2 };
const BIB: Coat = { base: C.cream, stripes: 0, fluff: 2 };

// One soft, shaggy ellipse of fur in screen space.
function fur(ctx: CanvasRenderingContext2D, cx: number, cy: number, ra: number, rb: number, ang: number, coat: Coat, seed: number) {
  const R = rng(seed * 7919 + 13);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  // Hair standing out around the edge, longest underneath where it hangs.
  const n = Math.max(14, Math.round((ra + rb) * 5));
  for (let i = 0; i < n; i++) {
    const t = ((i + R() * 0.8) / n) * Math.PI * 2;
    const px = Math.cos(t) * ra;
    const py = Math.sin(t) * rb;
    const nl = Math.hypot(px / ra / ra, py / rb / rb) || 1;
    const nx = px / ra / ra / nl;
    const ny = py / rb / rb / nl;
    // Hair hangs: longer below than on top.
    const len = coat.fluff * (0.35 + R() * 0.65) * (0.75 + 0.35 * Math.sin(t + ang));
    const tone = R();
    ctx.strokeStyle = rgb(coat.base, tone < 0.3 ? 0.78 : tone < 0.75 ? 0.94 : 1.12);
    ctx.lineWidth = 0.55 + R() * 0.45;
    ctx.beginPath();
    ctx.moveTo(px * 0.8, py * 0.8);
    ctx.lineTo(px + nx * len + (R() - 0.5) * 0.9, py + ny * len + (R() - 0.5) * 0.9);
    ctx.stroke();
  }
  // The light comes from the upper left of the screen whichever way the blob lies.
  const lx = -0.35 * Math.cos(ang) - 0.5 * Math.sin(ang);
  const ly = 0.35 * Math.sin(ang) - 0.5 * Math.cos(ang);
  const g = ctx.createRadialGradient(lx * ra, ly * rb, 0, 0, 0, Math.max(ra, rb) * 1.08);
  g.addColorStop(0, tint(coat.base, 1.2));
  g.addColorStop(0.55, coat.base);
  g.addColorStop(1, tint(coat.base, 0.6));
  ctx.beginPath();
  ctx.ellipse(0, 0, ra, rb, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  if (coat.patches) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = rgb(R() < 0.5 ? C.tan : C.ginger, 1, 0.34 + R() * 0.2);
      ctx.beginPath();
      ctx.ellipse((R() - 0.5) * 1.5 * ra, (R() - 0.5) * 1.3 * rb, ra * (0.22 + R() * 0.22), rb * (0.25 + R() * 0.25), R() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (coat.stripes > 0) {
    // Tabby bars wrap across the body, broken and uneven.
    const bars = Math.max(3, Math.round(ra / 3.2));
    for (let i = 0; i < bars; i++) {
      const x = (-0.85 + (1.7 * (i + 0.5)) / bars) * ra + (R() - 0.5) * ra * 0.16;
      ctx.strokeStyle = rgb(C.dark, 1, (0.3 + R() * 0.3) * coat.stripes);
      ctx.lineWidth = 0.8 + ra * 0.05 + R() * 0.6;
      ctx.setLineDash([rb * (0.5 + R() * 0.5), rb * (0.1 + R() * 0.2)]);
      ctx.lineDashOffset = R() * rb;
      ctx.beginPath();
      ctx.moveTo(x + (R() - 0.5) * 2, -rb);
      ctx.quadraticCurveTo(x + (R() - 0.5) * ra * 0.5, 0, x + (R() - 0.5) * 2, rb);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // Fine hairs lying over everything.
  const hairs = Math.round(ra * rb * 0.28);
  for (let i = 0; i < hairs; i++) {
    const x = (R() - 0.5) * 2 * ra;
    const y = (R() - 0.5) * 2 * rb;
    ctx.strokeStyle = R() < 0.5 ? rgb(coat.base, 1.35, 0.3) : rgb(coat.base, 0.5, 0.26);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (R() - 0.5) * 1.6, y + 1.2 + R() * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

type HeadMode = 'awake' | 'asleep' | 'back';

// Her head, painted flat on the screen at (hx, hy). `turn` leans the face left or right.
function head(ctx: CanvasRenderingContext2D, hx: number, hy: number, R: number, mode: HeadMode, turn: number) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const t = turn * 0.16 * R;
  const tri = (pts: Pt[], fill: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const ln = (x0: number, y0: number, x1: number, y1: number, color: string, lw: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 * R, y0 * R);
    ctx.lineTo(x1 * R, y1 * R);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  // Tall tufted ears.
  for (const s of [-1, 1]) {
    tri([[s * 0.2, -0.7], [s * 0.84, -1.62], [s * 1.02, -0.25]], tint(C.base, 0.62));
    if (mode !== 'back') {
      tri([[s * 0.42, -0.74], [s * 0.8, -1.36], [s * 0.9, -0.5]], C.ear);
      // Pale hair spilling out of the ear.
      ln(s * 0.5, -0.66, s * 0.72, -1.05, rgb(C.cream, 1, 0.85), 0.7);
      ln(s * 0.62, -0.6, s * 0.8, -0.92, rgb(C.cream, 1, 0.7), 0.6);
    }
    ln(s * 0.84, -1.6, s * 0.87, -1.72, C.dark, 0.7);
  }
  // Skull and cheek ruff.
  fur(ctx, 0, 0.06 * R, 1.1 * R, 0.94 * R, 0, { base: C.base, stripes: 0, fluff: R * 0.34 }, 5);
  const blot = (x: number, y: number, rx: number, ry: number, fill: string) => {
    ctx.beginPath();
    ctx.ellipse(x * R, y * R, rx * R, ry * R, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  if (mode === 'back') {
    for (const i of [-1, 0, 1]) ln(i * 0.3, -0.75, i * 0.36, 0.5, rgb(C.dark, 1, 0.6), 1);
    blot(0.3, 0.2, 0.3, 0.25, rgb(C.tan, 1, 0.4));
    ctx.restore();
    return;
  }
  const u = t / R;
  // Paler fur round the eyes, a cream muzzle and chin.
  for (const s of [-1, 1]) blot(u + s * 0.44, -0.08, 0.36, 0.3, rgb(C.light, 1, 0.7));
  blot(u + 0.5, 0.3, 0.3, 0.24, rgb(C.tan, 1, 0.5));
  blot(u, 0.5, 0.46, 0.33, C.cream);
  blot(u, 0.8, 0.34, 0.2, C.cream);
  // The tabby M and cheek bars.
  for (const i of [-1, 0, 1]) ln(u * 0.6 + i * 0.24, -0.84, u + i * 0.15, -0.34, rgb(C.dark, 1, 0.8), 0.9);
  for (const s of [-1, 1]) {
    ln(u + s * 0.68, 0.02, s * 1.05, 0.14, rgb(C.dark, 1, 0.7), 0.8);
    ln(u + s * 0.62, 0.3, s * 0.98, 0.5, rgb(C.dark, 1, 0.55), 0.7);
  }
  for (const s of [-1, 1]) {
    const ex = u + s * 0.43;
    if (mode === 'asleep') {
      ctx.beginPath();
      ctx.arc(ex * R, -0.08 * R, 0.2 * R, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = C.dark;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      continue;
    }
    blot(ex, -0.02, 0.28, 0.235, C.dark);
    blot(ex, -0.02, 0.225, 0.185, C.eye);
    blot(ex + u * 0.3, -0.02, 0.085, 0.165, '#15100b');
    blot(ex - 0.08, -0.1, 0.05, 0.05, 'rgba(255,255,255,0.9)');
  }
  tri([[u - 0.11, 0.25], [u + 0.11, 0.25], [u, 0.38]], C.nose);
  ln(u, 0.38, u, 0.5, rgb(C.dark, 1, 0.6), 0.6);
  ln(u, 0.5, u - 0.13, 0.56, rgb(C.dark, 1, 0.5), 0.6);
  ln(u, 0.5, u + 0.13, 0.56, rgb(C.dark, 1, 0.5), 0.6);
  // Long white whiskers.
  for (const s of [-1, 1]) for (const j of [-1, 0, 1]) ln(u + s * 0.24, 0.5 + j * 0.04, u + s * 1.6, 0.36 + j * 0.2, 'rgba(255,255,255,0.85)', 0.45);
  ctx.restore();
}

interface Blob {
  c: [number, number, number];
  r: [number, number, number];
  coat: Coat;
}

export function drawCat(k: Kit, x: number, y: number, rot: Rot, pose: CatPose) {
  const { ctx } = k;
  const [fx, fy] = DIRS[rot];
  const sx = -fy;
  const sy = fx;
  // Her own space: `f` toward her nose, `s` to her side, z up. All in tiles.
  const at = (f: number, s: number, z = 0): Pt => k.iso(x + (fx * f + sx * s) * S, y + (fy * f + sy * s) * S, z * S);
  const o = at(0, 0, 0);
  const axis = (p: Pt): Pt => [p[0] - o[0], p[1] - o[1]];
  const ef = axis(at(1, 0, 0));
  const es = axis(at(0, 1, 0));
  const ez = axis(at(0, 0, 1));
  const depth = (f: number, s: number) => (fx + fy) * f + (sx + sy) * s;
  const facing = fx + fy > 0;
  const turn = Math.sign(ef[0]) * (facing ? 1 : -0.7);

  let seed = rot * 97 + (pose === 'sit' ? 1 : pose === 'loaf' ? 2 : 3) * 1009;
  const parts: { key: number; draw: () => void }[] = [];
  const blob = (b: Blob, lift = 0) => {
    const id = seed++;
    parts.push({
      key: depth(b.c[0], b.c[1]) + lift,
      draw: () => {
        // The outline of an ellipsoid seen from the camera is an ellipse.
        const cols = [ef, es, ez].map((e, i) => [e[0] * b.r[i], e[1] * b.r[i]]);
        const a = cols.reduce((n, c) => n + c[0] * c[0], 0);
        const d = cols.reduce((n, c) => n + c[1] * c[1], 0);
        const m = cols.reduce((n, c) => n + c[0] * c[1], 0);
        const mid = (a + d) / 2;
        const spread = Math.hypot((a - d) / 2, m);
        const [cx, cy] = at(...b.c);
        fur(ctx, cx, cy, Math.sqrt(mid + spread), Math.sqrt(Math.max(0.01, mid - spread)), 0.5 * Math.atan2(2 * m, a - d), b.coat, id);
      },
    });
  };
  // A plumed tail: a string of fluffy blobs with dark rings and a dark tip.
  const tail = (n: number, path: (t: number) => [number, number], r0: number, r1: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = r0 + (r1 - r0) * t;
      const [f, s] = path(t);
      blob({ c: [f, s, r], r: [r, r, r], coat: { base: i >= n - 2 ? tint(C.base, 0.55) : i % 3 === 1 ? tint(C.base, 0.74) : C.base, stripes: 0, fluff: 2.4 } });
    }
  };
  const paw = (f: number, s: number, color: string) => blob({ c: [f, s, 0.03], r: [0.05, 0.043, 0.032], coat: { base: color, stripes: 0, fluff: 0.25 } });
  const HR = 0.15 * Math.hypot(ez[0], ez[1]);
  const headAt = (f: number, s: number, z: number, mode: HeadMode, key: number, collar: boolean) =>
    parts.push({
      key,
      draw: () => {
        const [hx, hy] = at(f, s, z);
        head(ctx, hx, hy, HR, mode, turn);
        if (!collar || mode === 'back') return;
        // A thin collar under the ruff, with its tag.
        ctx.beginPath();
        ctx.ellipse(hx, hy + HR * 0.86, HR * 0.62, HR * 0.3, 0, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.strokeStyle = C.collar;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx + turn * HR * 0.12, hy + HR * 1.3, HR * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#d5d8dc';
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,46,0.6)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      },
    });

  if (pose === 'sit') {
    floorShadow(k, x, y, 0.3, 0.34);
    tail(11, (t) => [-0.22 + 0.14 * t * t, 0.06 + 0.36 * t], 0.075, 0.055);
    blob({ c: [-0.06, 0, 0.16], r: [0.2, 0.18, 0.17], coat: TABBY });
    blob({ c: [0.05, 0, 0.3], r: [0.14, 0.14, 0.18], coat: TABBY });
    for (const s of [-1, 1]) blob({ c: [0.15, s * 0.06, 0.11], r: [0.042, 0.046, 0.11], coat: { base: C.base, stripes: 0.8, fluff: 1 } });
    blob({ c: [0.14, 0, 0.29], r: [0.07, 0.1, 0.14], coat: BIB }, 0.01);
    paw(0.2, -0.06, C.ginger);
    paw(0.2, 0.06, C.cream);
    // Sitting, she always looks round at whoever is watching.
    headAt(0.11, 0, 0.53, 'awake', 99, true);
  } else if (pose === 'loaf') {
    floorShadow(k, x, y, 0.32, 0.34);
    tail(10, (t) => [-0.25 + 0.3 * t, 0.17 + 0.03 * Math.sin(Math.PI * t)], 0.06, 0.05);
    blob({ c: [-0.03, 0, 0.14], r: [0.24, 0.165, 0.14], coat: TABBY });
    blob({ c: [0.12, 0, 0.17], r: [0.13, 0.15, 0.15], coat: TABBY });
    blob({ c: [0.21, 0, 0.13], r: [0.07, 0.11, 0.1], coat: BIB });
    paw(0.27, -0.055, C.ginger);
    paw(0.27, 0.055, C.cream);
    headAt(0.2, 0, 0.34, facing ? 'awake' : 'back', 99, true);
  } else {
    // Curled up asleep, tail wrapped round to her nose.
    floorShadow(k, x, y, 0.32, 0.34);
    blob({ c: [0, 0, 0.1], r: [0.24, 0.2, 0.105], coat: TABBY });
    blob({ c: [-0.1, 0.04, 0.13], r: [0.13, 0.13, 0.1], coat: TABBY });
    tail(11, (t) => {
      const a = (190 + 150 * t) * (Math.PI / 180);
      return [Math.cos(a) * 0.25, Math.sin(a) * 0.21];
    }, 0.062, 0.05);
    paw(0.22, -0.03, C.cream);
    headAt(0.15, 0.13, 0.11, 'asleep', depth(0.15, 0.13) + 0.02, false);
  }
  parts.sort((a, b) => a.key - b.key);
  ctx.save();
  for (const p of parts) p.draw();
  ctx.restore();
}
