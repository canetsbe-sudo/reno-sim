// Materials for the new kitchen: cabinet woods and paints, countertops, appliance metal
// and backsplash tile. Like the floors and walls these are painted a pixel at a time and
// cached by the scene.
import { clamp01, fbm, hash2, hexRgb, noise2, smoothstep } from './noise';
import { PX, pixels } from './surfaces';

type RGB = [number, number, number];
const lerp = (a: RGB, b: RGB, t: number, out: number[]) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
};
const mul = (out: number[], k: number) => {
  out[0] *= k;
  out[1] *= k;
  out[2] *= k;
};

// ---- Cabinet bodies ----

// Veneer with the grain running up the face: long cathedral arches and fine pores.
export function woodGrain(w: number, h: number, light: string, dark: string, seed = 1): HTMLCanvasElement {
  const L = hexRgb(light) as RGB;
  const D = hexRgb(dark) as RGB;
  return pixels(w, h, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const bend = fbm(u * 1.3, v * 0.35, 3, seed) * 3;
    const t = u * 3.4 + bend + Math.sin(v * 0.8 + seed) * 0.2;
    const ring = t * 2.6 - Math.floor(t * 2.6);
    const late = smoothstep(0.5, 0.9, ring) * (1 - smoothstep(0.9, 1, ring));
    const fibre = noise2(u * 70, v * 2.5, seed + 3);
    const pore = noise2(u * 95, v * 30, seed + 5);
    const broad = fbm(u * 0.9, v * 0.5, 2, seed + 7);
    const m = clamp01(0.12 + late * 0.42 + (fibre - 0.5) * 0.2 + (pore < 0.12 ? 0.12 : 0) + (broad - 0.5) * 0.3);
    lerp(L, D, m, out);
  });
}

// Sprayed or brushed paint: nearly flat, with the faintest brush drag and sheen.
export function paintedPanel(w: number, h: number, color: string, seed = 1): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  return pixels(w, h, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const drag = noise2(u * 60, v * 1.6, seed) - 0.5;
    const cloud = fbm(u * 1.2, v * 1.2, 3, seed + 2) - 0.5;
    const k = 1 + drag * 0.035 + cloud * 0.06;
    out[0] = C[0] * k;
    out[1] = C[1] * k;
    out[2] = C[2] * k;
  });
}

// Tired wood-look laminate: a printed grain that repeats a little too neatly.
export function oldLaminate(w: number, h: number, color: string, accent: string, seed = 1): HTMLCanvasElement {
  const L = hexRgb(color) as RGB;
  const D = hexRgb(accent) as RGB;
  return pixels(w, h, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const streak = noise2(u * 26, v * 0.9, seed);
    const tick = noise2(u * 80, v * 9, seed + 4) > 0.8 ? 0.25 : 0;
    lerp(L, D, clamp01(streak * 0.7 + tick), out);
    mul(out, 0.96 + fbm(u * 2, v * 2, 2, seed + 8) * 0.08);
  });
}

// ---- Appliances ----

// Brushed stainless: fine horizontal brushing with broad soft reflections.
export function brushedSteel(w: number, h: number, color: string, seed = 1): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  return pixels(w, h, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const brush = noise2(u * 2.2, v * 150, seed) - 0.5;
    const fine = noise2(u * 9, v * 260, seed + 2) - 0.5;
    // Vertical bands of reflected room.
    const band = Math.sin(u * 5.2 + fbm(u * 0.8, v * 0.3, 2, seed + 5) * 2.4) * 0.5 + 0.5;
    const k = 0.9 + brush * 0.1 + fine * 0.06 + band * 0.2;
    out[0] = Math.min(255, C[0] * k);
    out[1] = Math.min(255, C[1] * k);
    out[2] = Math.min(255, C[2] * k * 1.01);
  });
}

// Glossy enamel or powder coat: smooth colour with a soft vertical sheen.
export function enamel(w: number, h: number, color: string, seed = 1): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  return pixels(w, h, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const sheen = smoothstep(0.35, 0, Math.abs(((u * 0.9 + seed * 0.37) % 1) - 0.3)) * 0.14;
    const k = 0.97 + fbm(u * 1.5, v * 1.5, 2, seed) * 0.06 + sheen;
    out[0] = Math.min(255, C[0] * k);
    out[1] = Math.min(255, C[1] * k);
    out[2] = Math.min(255, C[2] * k);
  });
}

// Cast iron: near black, rough, catching a little light on its grain.
export function castIron(w: number, h: number, color: string, seed = 1): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  return pixels(w, h, (x, y, out) => {
    const n = noise2(x / 1.6, y / 1.6, seed);
    const k = 0.82 + n * 0.3 + fbm(x / PX * 3, y / PX * 3, 2, seed + 1) * 0.16;
    out[0] = C[0] * k;
    out[1] = C[1] * k;
    out[2] = C[2] * k;
  });
}

// ---- Countertops (painted room-sized so veins run on across neighbouring cabinets) ----

export function marble(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  const V = hexRgb(accent) as RGB;
  return pixels(w, d, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const wx = fbm(u * 0.9, v * 0.9, 3, 11) * 2.2;
    const wy = fbm(u * 0.9 + 7, v * 0.9, 3, 12) * 2.2;
    // Thin veins where a warped field crosses its midline, in two weights.
    const a = Math.abs(fbm(u * 0.8 + wx, v * 0.8 + wy, 4, 13) - 0.5);
    const b = Math.abs(fbm(u * 2.1 + wy, v * 2.1 - wx, 3, 14) - 0.5);
    const vein = smoothstep(0.03, 0, a) * 0.75 + smoothstep(0.012, 0, b) * 0.3 + smoothstep(0.12, 0, a) * 0.16;
    const cloud = fbm(u * 1.6, v * 1.6, 3, 15);
    lerp(C, V, clamp01(vein + (cloud - 0.5) * 0.3), out);
    // A touch of warmth in the veins.
    out[0] += vein * 6;
    out[2] -= vein * 8;
  });
}

export function butcherBlock(w: number, d: number, color: string): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  const strip = 0.11 * PX;
  return pixels(w, d, (x, y, out) => {
    const row = Math.floor(y / strip);
    // Staves of different lengths glued end to end in each strip.
    const off = hash2(row, 1, 3) * 2 * PX;
    const stave = Math.floor((x + off) / (0.9 * PX) + hash2(row, 2, 3));
    const tone = hash2(row, stave, 5);
    const lx = (x + off) / PX;
    const ly = (y - row * strip) / strip;
    const s = row * 31 + stave * 7;
    const t = ly * 1.4 + fbm(lx * 0.8, ly, 2, s) * 2.4;
    const ring = t * 2.4 - Math.floor(t * 2.4);
    const late = smoothstep(0.5, 0.9, ring) * (1 - smoothstep(0.9, 1, ring));
    const fibre = noise2(lx * 3, y * 0.8, s + 2) - 0.5;
    let k = 0.86 + tone * 0.26 - late * 0.12 + fibre * 0.06;
    // Glue lines between strips and staves.
    const ey = Math.min(y - row * strip, (row + 1) * strip - y);
    const sx = (x + off) / (0.9 * PX) + hash2(row, 2, 3);
    const ex = Math.min(sx - Math.floor(sx), Math.ceil(sx) - sx) * 0.9 * PX;
    if (Math.min(ex, ey) < 0.9) k *= 0.8;
    out[0] = Math.min(255, C[0] * k * (1 + (tone - 0.5) * 0.06));
    out[1] = Math.min(255, C[1] * k);
    out[2] = Math.min(255, C[2] * k * (1 - (tone - 0.5) * 0.1));
  });
}

export function concrete(w: number, d: number, color: string): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  return pixels(w, d, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const cloud = fbm(u * 1.4, v * 1.4, 4, 21) - 0.5;
    const trowel = fbm(u * 0.5 + v * 2.2, v * 0.4, 3, 22) - 0.5;
    const grit = noise2(x / 1.5, y / 1.5, 23) - 0.5;
    const hole = noise2(x / 2.6, y / 2.6, 24) > 0.93 ? -0.16 : 0;
    const k = 1 + cloud * 0.22 + trowel * 0.12 + grit * 0.06 + hole;
    out[0] = C[0] * k;
    out[1] = C[1] * k;
    out[2] = C[2] * k;
  });
}

export function terrazzo(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  const chips: RGB[] = [hexRgb(accent) as RGB, [92, 98, 104], [214, 170, 96], [246, 242, 236], [150, 172, 160], [58, 54, 56]];
  const cell = 0.085 * PX;
  return pixels(w, d, (x, y, out) => {
    out[0] = C[0];
    out[1] = C[1];
    out[2] = C[2];
    mul(out, 0.97 + noise2(x / 2, y / 2, 31) * 0.06);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    // Each cell may hold one angular chip; check neighbours so chips can cross cell lines.
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i;
        const gy = cy + j;
        const h = hash2(gx, gy, 33);
        if (h > 0.62) continue;
        const px = (gx + 0.2 + hash2(gx, gy, 34) * 0.6) * cell;
        const py = (gy + 0.2 + hash2(gx, gy, 35) * 0.6) * cell;
        const r = (0.16 + hash2(gx, gy, 36) * 0.36) * cell;
        const ang = hash2(gx, gy, 37) * Math.PI;
        const dx = (x - px) * Math.cos(ang) + (y - py) * Math.sin(ang);
        const dy = -(x - px) * Math.sin(ang) + (y - py) * Math.cos(ang);
        // A lopsided polygon: the max of a few half-planes.
        const dist = Math.max(Math.abs(dx) * 0.8 + dy * 0.5, Math.abs(dy) * 1.1 - dx * 0.2, -dy * 0.9 + dx * 0.4);
        if (dist < r) {
          const col = chips[Math.floor(hash2(gx, gy, 38) * chips.length)];
          lerp(col, col, 0, out);
          mul(out, 0.94 + noise2(x / 3, y / 3, 39) * 0.1);
        }
      }
    }
  });
}

// Plain or flecked laminate; `worn` rubs the pattern through near the front.
export function laminate(w: number, d: number, color: string, worn = false): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  return pixels(w, d, (x, y, out) => {
    const fleck = noise2(x / 1.8, y / 1.8, 41);
    let k = 1 + (fleck > 0.78 ? 0.07 : fleck < 0.2 ? -0.07 : 0) + (fbm(x / PX, y / PX, 2, 42) - 0.5) * 0.06;
    if (worn) {
      // Boomerang flecks of old formica, and dull rubbed patches.
      const b = noise2(x / 7, y / 3.5, 43);
      if (b > 0.86) k *= 0.82;
      k *= 1 - smoothstep(0.55, 0.8, fbm(x / PX * 1.3, y / PX * 1.3, 3, 44)) * 0.14;
    }
    out[0] = Math.min(255, C[0] * k);
    out[1] = Math.min(255, C[1] * k);
    out[2] = Math.min(255, C[2] * k);
  });
}

// ---- Backsplash tile ----

export type TileKind = 'subway' | 'zellige' | 'herringbone' | 'cement';

// A strip of wall tile `len` long and `h` high. y runs down from the top of the strip.
export function wallTile(len: number, h: number, kind: TileKind, color: string, accent: string, seed = 1): HTMLCanvasElement {
  const C = hexRgb(color) as RGB;
  const G = hexRgb(accent) as RGB;
  const grout: RGB = kind === 'zellige' ? [G[0] * 0.8, G[1] * 0.8, G[2] * 0.8] : kind === 'cement' ? [C[0] * 0.8, C[1] * 0.8, C[2] * 0.8] : G;
  const H = h * PX;
  return pixels(len, h, (x, y, out) => {
    const yb = H - y; // up from the counter, so a full course sits on it
    let tx = 0; // tile id
    let ty = 0;
    let a = 0; // position inside the tile, 0..1
    let b = 0;
    let tw = 1; // tile size in px
    let th = 1;
    if (kind === 'subway') {
      tw = 0.5 * PX;
      th = 0.125 * PX;
      ty = Math.floor(yb / th);
      const sx = x + (ty % 2 ? tw / 2 : 0);
      tx = Math.floor(sx / tw);
      a = sx / tw - tx;
      b = yb / th - ty;
    } else if (kind === 'zellige') {
      tw = th = 0.125 * PX;
      tx = Math.floor(x / tw);
      ty = Math.floor(yb / th);
      a = x / tw - tx;
      b = yb / th - ty;
    } else if (kind === 'cement') {
      tw = th = 0.375 * PX;
      tx = Math.floor(x / tw);
      ty = Math.floor(yb / th);
      a = x / tw - tx;
      b = yb / th - ty;
    } else {
      // Herringbone: 1 x 3 bricks laid on the diagonal.
      const n = 3;
      const W = 0.068 * PX;
      const rx = (x + yb) * 0.7071;
      const ry = (yb - x) * 0.7071;
      const cx = Math.floor(rx / W);
      const cy = Math.floor(ry / W);
      const k = (((cx - cy) % (2 * n)) + 2 * n) % (2 * n);
      if (k < n) {
        tx = cx - k;
        ty = cy;
        a = (rx / W - tx) / n;
        b = ry / W - cy;
      } else {
        tx = cx + 1000;
        ty = cy - (2 * n - 1 - k);
        a = (ry / W - ty) / n;
        b = rx / W - cx;
      }
      tw = W * n;
      th = W;
    }
    const ex = Math.min(a, 1 - a) * tw;
    const ey = Math.min(b, 1 - b) * th;
    const e = Math.min(ex, ey);
    const id = hash2(tx, ty, seed);
    const id2 = hash2(tx, ty, seed + 1);
    const wob = kind === 'zellige' ? 0.7 + noise2(x / 5, y / 5, seed + 2) * 1.1 : kind === 'cement' ? 0.9 : 1.2;
    if (e < wob) {
      out[0] = grout[0];
      out[1] = grout[1];
      out[2] = grout[2];
      mul(out, 0.94 + noise2(x / 2, y / 2, seed + 3) * 0.1);
      return;
    }
    out[0] = C[0];
    out[1] = C[1];
    out[2] = C[2];
    if (kind === 'subway') {
      // Even factory glaze: a soft pillowed edge and a highlight along the top.
      mul(out, 0.985 + id * 0.03);
      const top = (1 - b) * th;
      if (top < 3.4) mul(out, 1.05);
      else if (b * th < 3) mul(out, 0.9);
      else if (ex < 3) mul(out, 0.95);
      const glint = smoothstep(0.7, 1, noise2(x / 34 + ty * 3.1, y / 9, seed + 6));
      out[0] += glint * 10;
      out[1] += glint * 10;
      out[2] += glint * 10;
    } else if (kind === 'zellige') {
      // Hand-cut and hand-dipped: every tile its own shade, pooled glaze, chipped corners.
      const pool = fbm(x / 14 + tx * 9, y / 14 + ty * 5, 3, seed + 7);
      mul(out, 0.86 + id * 0.34 + (pool - 0.5) * 0.3);
      out[0] *= 1 + (id2 - 0.5) * 0.12;
      out[2] *= 1 - (id2 - 0.5) * 0.14;
      // Wet-looking highlight across one corner of each tile.
      const hx = a - (0.25 + id2 * 0.3);
      const hy = 1 - b - (0.2 + id * 0.25);
      const hl = smoothstep(0.2, 0, Math.abs(hx + hy * 0.6)) * smoothstep(0.34, 0.05, Math.hypot(hx, hy));
      out[0] += hl * 90;
      out[1] += hl * 90;
      out[2] += hl * 90;
      if (e < wob + 1.2) mul(out, 0.84);
    } else if (kind === 'herringbone') {
      // Honed marble strips, each cut from a different part of the slab.
      const vein = Math.abs(fbm(a * 2.2 + id * 40, b * 0.9 + id2 * 40, 3, seed + 8) - 0.5);
      const t = smoothstep(0.05, 0, vein) * 0.5 + id * 0.16;
      lerp(C, G, clamp01(t), out);
      mul(out, 0.97 + id2 * 0.05);
      if (e < 2.2) mul(out, 0.95);
    } else {
      // Encaustic cement tile: quarter rings that join into circles, and a centre star.
      const qa = Math.min(a, 1 - a);
      const qb = Math.min(b, 1 - b);
      const corner = Math.hypot(qa, qb);
      const centre = Math.abs(a - 0.5) + Math.abs(b - 0.5);
      const petal = Math.hypot(Math.abs(a - 0.5) - 0.5, b - 0.5) < 0.2 || Math.hypot(a - 0.5, Math.abs(b - 0.5) - 0.5) < 0.2;
      const ink = (corner < 0.42 && corner > 0.3) || corner < 0.16 || centre < 0.15 || (centre < 0.27 && centre > 0.22) || petal;
      if (ink) lerp(C, G, 0.92, out);
      // Chalky, matte, slightly uneven print.
      mul(out, 0.93 + fbm(x / 20, y / 20, 3, seed + 9) * 0.12 + (id - 0.5) * 0.04);
    }
    out[0] = Math.min(255, out[0]);
    out[1] = Math.min(255, out[1]);
    out[2] = Math.min(255, out[2]);
  });
}
