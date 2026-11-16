// Procedural surface textures, painted once per finish and cached. Each texture is a flat
// image in the surface's own space (floor: x right, y down; wall: u right, z up), which
// the renderer maps onto the isometric face with an affine transform.
import { clamp01, fbm, hexRgb, noise2, rng, smoothstep } from './noise';

// Texture pixels per world unit.
export const PX = 96;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ---- Wood planks ----

interface Plank {
  x0: number;
  x1: number;
  tone: number; // lightness shift
  warm: number; // hue shift toward red
  seed: number;
  knot?: { x: number; y: number; r: number };
}

export interface WoodOpts {
  light: string;
  dark: string;
  plankW?: number; // world units across a plank
  worn?: number; // 0 new, 1 badly worn
  seed?: number;
}

export function woodPlanks(w: number, d: number, o: WoodOpts): HTMLCanvasElement {
  const W = w * PX;
  const H = d * PX;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  const px = img.data;
  const R = rng(o.seed ?? 1);
  const pw = (o.plankW ?? 0.25) * PX;
  const rows = Math.ceil(H / pw);
  const L = hexRgb(o.light);
  const D = hexRgb(o.dark);
  const worn = o.worn ?? 0;

  // Lay planks row by row with staggered joints.
  const layout: Plank[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Plank[] = [];
    let x = -R() * 1.6 * PX;
    while (x < W) {
      const len = (1.1 + R() * 1.9) * PX;
      const p: Plank = { x0: x, x1: x + len, tone: (R() - 0.5) * 0.16, warm: (R() - 0.5) * 0.08, seed: Math.floor(R() * 1e6) };
      if (R() < 0.18) p.knot = { x: x + len * (0.2 + R() * 0.6), y: r * pw + pw * (0.25 + R() * 0.5), r: pw * (0.12 + R() * 0.12) };
      row.push(p);
      x += len;
    }
    layout.push(row);
  }

  for (let y = 0; y < c.height; y++) {
    const r = Math.floor(y / pw);
    const ly = (y - r * pw) / pw; // 0..1 across the plank
    const row = layout[r];
    let k = 0;
    for (let x = 0; x < c.width; x++) {
      while (k < row.length - 1 && x >= row[k].x1) k++;
      const p = row[k];
      const lx = (x - p.x0) / PX; // world units along the plank
      const s = p.seed;
      // Growth rings: stretched along the plank, bent by low noise into cathedral shapes.
      const bend = fbm(lx * 0.55 + s, ly * 0.8, 3, s) * 3.2;
      let t = ly * 2.2 + bend + Math.sin(lx * 0.9 + s) * 0.35;
      let knotDark = 0;
      if (p.knot) {
        const dx = (x - p.knot.x) / p.knot.r;
        const dy = (y - p.knot.y) / (p.knot.r * 0.7);
        const dist = Math.sqrt(dx * dx + dy * dy);
        t += 1.6 / (dist + 0.6);
        knotDark = smoothstep(1.1, 0.2, dist) * 0.55;
      }
      const ring = t * 3.2 - Math.floor(t * 3.2);
      const late = smoothstep(0.55, 0.92, ring) * (1 - smoothstep(0.92, 1, ring));
      // Fine fibres running the length of the board.
      const fibre = noise2(lx * 3, ly * 60 + s, s + 3);
      const pore = noise2(lx * 40, ly * 90, s + 5);
      let m = 0.2 + p.tone + late * 0.2 + (fibre - 0.5) * 0.13 + (pore < 0.1 ? 0.07 : 0) + knotDark;
      // Wear: lighter, flatter grain where feet go.
      if (worn) m = m * (1 - worn * 0.35 * fbm(x / PX * 0.6, y / PX * 0.6, 2, 9));
      m = clamp01(m);
      let cr = L[0] + (D[0] - L[0]) * m;
      let cg = L[1] + (D[1] - L[1]) * m;
      let cb = L[2] + (D[2] - L[2]) * m;
      cr *= 1 + p.warm;
      cb *= 1 - p.warm;
      // Bevelled edges: dark seam, then a faint highlight on the lit side.
      const ex = Math.min(x - p.x0, p.x1 - x);
      const ey = Math.min(y - r * pw, (r + 1) * pw - y);
      const e = Math.min(ex, ey);
      let edge = 1;
      if (e < 1) edge = 0.7;
      else if (e < 2.2) edge = 0.9;
      else if (ey < 4 && y - r * pw < 4) edge = 1.07;
      const i = (y * c.width + x) * 4;
      px[i] = cr * edge;
      px[i + 1] = cg * edge;
      px[i + 2] = cb * edge;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---- Painted plaster ----

export interface PaintOpts {
  color: string;
  grime?: number; // 0 clean, 1 filthy
  seed?: number;
}

// A painted wall `len` units long and `h` units high. Image y runs down from the top.
export function paintedWall(len: number, h: number, o: PaintOpts): HTMLCanvasElement {
  const c = makeCanvas(len * PX, h * PX);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  const px = img.data;
  const [r0, g0, b0] = hexRgb(o.color);
  const s = o.seed ?? 2;
  const grime = o.grime ?? 0;
  for (let y = 0; y < c.height; y++) {
    const zFrac = 1 - y / c.height; // 0 at the floor
    for (let x = 0; x < c.width; x++) {
      const u = x / PX;
      const v = y / PX;
      // Roller texture: soft vertical bands and a fine orange-peel stipple.
      const roll = fbm(u * 1.2, v * 0.25, 3, s) - 0.5;
      const stip = noise2(x * 0.9, y * 0.9, s + 1) - 0.5;
      let k = 1 + roll * 0.05 + stip * 0.035;
      if (grime) {
        const g = fbm(u * 0.8, v * 0.8, 4, s + 7);
        k -= grime * (0.12 * g + 0.1 * smoothstep(0.35, 0, zFrac));
      }
      const i = (y * c.width + x) * 4;
      px[i] = r0 * k;
      px[i + 1] = g0 * k;
      px[i + 2] = b0 * k;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---- Damage decals, painted into a surface texture ----

// Black mold on a damp wall: a tea-coloured moisture bloom with a tide line, then
// clustered colonies that are densest at the wettest point and fray at the edges.
// (cx, cy) and r are in texture pixels.
export function paintMold(c: HTMLCanvasElement, cx: number, cy: number, r: number, seed = 5) {
  const ctx = c.getContext('2d')!;
  const x0 = Math.max(0, Math.floor(cx - r * 1.6));
  const y0 = Math.max(0, Math.floor(cy - r * 1.6));
  const x1 = Math.min(c.width, Math.ceil(cx + r * 1.6));
  const y1 = Math.min(c.height, Math.ceil(cy + r * 1.9));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x0, y0, w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x + x0;
      const gy = y + y0;
      // Damp spreads down the wall more than up.
      const dx = (gx - cx) / r;
      const dy = (gy - cy) / (gy > cy ? r * 1.35 : r);
      const warp = fbm(gx / 40, gy / 40, 4, seed) - 0.5;
      const field = 1 - Math.sqrt(dx * dx + dy * dy) + warp * 0.9;
      if (field < -0.15) continue;
      const i = (y * w + x) * 4;
      let R = px[i];
      let G = px[i + 1];
      let B = px[i + 2];
      // Moisture bloom: yellow-brown stain, darkest at its drying edge.
      const bloom = smoothstep(-0.15, 0.25, field);
      const tide = smoothstep(-0.12, -0.04, field) * (1 - smoothstep(-0.04, 0.06, field));
      const drip = gy > cy ? smoothstep(0.55, 0.8, noise2(gx / 5, gy / 90, seed + 3)) * bloom * 0.25 : 0;
      const stain = bloom * 0.3 + tide * 0.3 + drip;
      R = R * (1 - stain) + 120 * stain;
      G = G * (1 - stain) + 88 * stain;
      B = B * (1 - stain) + 40 * stain;
      // Colonies: speckles that merge into solid patches where it is wettest.
      const n1 = fbm(gx / 9, gy / 9, 3, seed + 11);
      const n2 = noise2(gx / 2.2, gy / 2.2, seed + 13);
      const dens = field * 1.25 + (n1 - 0.5) * 1.3;
      const spot = smoothstep(0.62, 0.22, n2 - dens * 0.55);
      const core = smoothstep(0.38, 0.8, dens);
      const a = clamp01(spot * smoothstep(0.0, 0.3, dens) * 0.8 + core * (0.55 + n2 * 0.4));
      if (a > 0) {
        // Mostly sooty green-black, with olive and grey-green at the young edges.
        const young = 1 - core;
        const mr = 26 + young * 52;
        const mg = 32 + young * 50;
        const mb = 22 + young * 26;
        R = R * (1 - a) + mr * a;
        G = G * (1 - a) + mg * a;
        B = B * (1 - a) + mb * a;
      }
      px[i] = R;
      px[i + 1] = G;
      px[i + 2] = B;
    }
  }
  ctx.putImageData(img, x0, y0);
  // Fuzzy halo dots at the frontier, where new spores are taking hold.
  const Rn = rng(seed + 21);
  for (let k = 0; k < r * 0.9; k++) {
    const ang = Rn() * Math.PI * 2;
    const dist = r * (0.55 + Rn() * 0.5);
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist * (Math.sin(ang) > 0 ? 1.3 : 1);
    const rad = 0.5 + Rn() * 1.1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.2);
    g.addColorStop(0, 'rgba(30,36,26,0.75)');
    g.addColorStop(0.45, 'rgba(45,52,38,0.35)');
    g.addColorStop(1, 'rgba(60,66,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad * 2.2, y - rad * 2.2, rad * 4.4, rad * 4.4);
  }
}

// ---- Age: grime, rust and wear, as a see-through layer over a face ----

export type GrimeKind = 'metal' | 'laminate' | 'top';

// A w x h (world units) transparent layer of dirt for one face of an old appliance or
// cabinet. Image y runs down from the top of the face.
export function grimeLayer(w: number, h: number, kind: GrimeKind, seed: number): HTMLCanvasElement {
  const c = makeCanvas(w * PX, h * PX);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  const px = img.data;
  const W = c.width;
  const H = c.height;
  const R = rng(seed);
  // Ring stains and a scorch for tops.
  const rings = kind === 'top' ? [0].map(() => ({ x: (0.2 + R() * 0.6) * W, y: (0.2 + R() * 0.6) * H, r: (0.1 + R() * 0.07) * PX })) : [];
  const burn = { x: (0.2 + R() * 0.6) * W, y: (0.2 + R() * 0.6) * H, r: (0.1 + R() * 0.08) * PX };
  for (let y = 0; y < H; y++) {
    const zf = 1 - y / H; // 0 at the bottom of the face
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const over = (cr: number, cg: number, cb: number, al: number) => {
        if (al <= 0) return;
        al = al > 1 ? 1 : al;
        const na = al + a * (1 - al);
        r = (cr * al + r * a * (1 - al)) / na;
        g = (cg * al + g * a * (1 - al)) / na;
        b = (cb * al + b * a * (1 - al)) / na;
        a = na;
      };
      const u = x / PX;
      const v = y / PX;
      const edge = Math.min(x, W - 1 - x, y, H - 1 - y) / PX;
      const n = fbm(u * 2.2, v * 2.2, 4, seed);
      if (kind === 'metal') {
        // Yellowed film of old grease, heavier low down and in streaks.
        over(150, 118, 58, 0.1 + n * 0.2);
        over(58, 44, 30, smoothstep(0.5, 0, zf) * 0.3 * (0.5 + n));
        const streak = smoothstep(0.62, 0.9, noise2(x / 3.5, seed, seed + 2)) * fbm(u * 1.5, v * 0.4, 2, seed + 4);
        over(84, 60, 34, streak * 0.4);
        // Rust blooming from the base and the edges, with pitted darker centres.
        const f = fbm(u * 4.5, v * 4.5, 4, seed + 9) + smoothstep(0.3, 0, zf) * 0.36 + smoothstep(0.1, 0, edge) * 0.2;
        const rust = smoothstep(0.7, 0.79, f);
        const pit = smoothstep(0.8, 0.9, f);
        over(146 - pit * 70, 72 - pit * 38, 30 - pit * 12, rust * 0.9);
        // A halo of stain around and below each rust patch.
        over(140, 84, 38, smoothstep(0.58, 0.72, f) * 0.28);
        // Fine scratches.
        if (noise2(x / 40 + y / 3, y / 50, seed + 14) > 0.93) over(235, 235, 230, 0.25);
      } else if (kind === 'laminate') {
        over(96, 70, 40, 0.06 + n * 0.16);
        // Water swelling up from the floor, with a tide line.
        const f = 0.42 - zf * 1.5 + (n - 0.5) * 0.9;
        over(74, 50, 28, smoothstep(-0.1, 0.3, f) * 0.4);
        over(60, 38, 20, smoothstep(-0.12, -0.03, f) * (1 - smoothstep(-0.03, 0.06, f)) * 0.22);
        // Laminate chipped away at the edges, showing the particle board.
        const chip = noise2(x / 9, y / 9, seed + 21) + smoothstep(0.09, 0, edge) * 0.5;
        if (chip > 0.93) {
          const grain = noise2(x * 0.9, y * 0.9, seed + 23);
          over(176 + grain * 30, 146 + grain * 26, 100 + grain * 20, 0.95);
        } else if (chip > 0.9) over(50, 34, 20, 0.6);
        // Greasy fingermarks around where the handles are.
        over(70, 52, 34, smoothstep(0.62, 0.8, fbm(u * 3, v * 3, 3, seed + 30)) * smoothstep(0.5, 0.9, zf) * 0.3);
      } else {
        over(110, 82, 44, 0.05 + smoothstep(0.45, 0.75, n) * 0.3);
        for (const k of rings) {
          const dd = Math.abs(Math.hypot(x - k.x, y - k.y) - k.r);
          over(92, 58, 30, smoothstep(2.4, 0.6, dd) * noise2(x / 9, y / 9, seed) * 0.6);
        }
        const bd = Math.hypot(x - burn.x, y - burn.y) / burn.r + (n - 0.5) * 0.8;
        over(36, 24, 16, smoothstep(1, 0.2, bd) * 0.4);
        if (noise2(x / 1.7, y / 1.7, seed + 40) > 0.95) over(60, 44, 30, 0.3);
        over(40, 30, 22, smoothstep(0.06, 0, edge) * 0.3);
      }
      const i = (y * W + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Fill a w x h (world units) canvas one pixel at a time. `fn` writes r, g, b into `out`.
export function pixels(w: number, h: number, fn: (x: number, y: number, out: number[]) => void): HTMLCanvasElement {
  const c = makeCanvas(w * PX, h * PX);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  const px = img.data;
  const out = [0, 0, 0];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      fn(x, y, out);
      const i = (y * c.width + x) * 4;
      px[i] = out[0];
      px[i + 1] = out[1];
      px[i + 2] = out[2];
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Repaint an existing canvas one pixel at a time. `fn` edits r, g, b in `io`.
export function repaint(c: HTMLCanvasElement, fn: (x: number, y: number, io: number[]) => void) {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const io = [0, 0, 0];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      io[0] = px[i];
      io[1] = px[i + 1];
      io[2] = px[i + 2];
      fn(x, y, io);
      px[i] = io[0];
      px[i + 1] = io[1];
      px[i + 2] = io[2];
    }
  }
  ctx.putImageData(img, 0, 0);
}
