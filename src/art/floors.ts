// Floor textures other than wood planks: glazed and clay tile, slate, and the tired
// floors a house starts with. All are painted in room space, x right and y down.
import { fbm, hash2, hexRgb, noise2, rng, smoothstep } from './noise';
import { PX, pixels } from './surfaces';

type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const put = (out: number[], c: RGB, k = 1) => {
  out[0] = c[0] * k;
  out[1] = c[1] * k;
  out[2] = c[2] * k;
};

// Which tile a pixel is in, where it sits inside it (0..1), and how far it is from the
// tile's edge in pixels.
function grid(x: number, y: number, size: number) {
  const tx = Math.floor(x / size);
  const ty = Math.floor(y / size);
  const px = x - tx * size;
  const py = y - ty * size;
  return { tx, ty, lx: px / size, ly: py / size, e: Math.min(px, py, size - px, size - py), nearTopLeft: px < size - px && py < size - py ? Math.min(px, py) : 99 };
}

// Glazed ceramic in two colours.
export function checkerTile(w: number, d: number, light: string, dark: string): HTMLCanvasElement {
  const A = hexRgb(light);
  const B = hexRgb(dark);
  const grout: RGB = [168, 162, 150];
  const size = PX / 2;
  return pixels(w, d, (x, y, out) => {
    const g = grid(x, y, size);
    if (g.e < 1.4) return put(out, grout, 0.9 + noise2(x / 2, y / 2, 3) * 0.2);
    const isDark = (g.tx + g.ty) % 2 === 1;
    const base = isDark ? B : A;
    // Each tile sits a hair differently, so it catches the light a little differently.
    let k = 1 + (hash2(g.tx, g.ty, 7) - 0.5) * 0.06;
    k += (0.5 - (g.lx + g.ly) / 2) * (isDark ? 0.28 : 0.07);
    k += (fbm(x / 30, y / 30, 3, 5) - 0.5) * 0.05;
    // Rounded glazed edge: a highlight on the lit sides, a shade on the others.
    if (g.e < 3.4) k *= g.nearTopLeft < 3.4 ? 1.08 : 0.86;
    // Fine scuffs show most on the dark tiles.
    if (noise2(x / 26 + y / 5, y / 34, 11) > 0.9) k += isDark ? 0.16 : -0.04;
    put(out, base, k);
  });
}

// Hand-made clay tile: uneven colour, soft worn edges, wide sandy grout.
export function terracotta(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const B = hexRgb(accent);
  const pale: RGB = [226, 168, 122];
  const bloom: RGB = [236, 214, 192];
  const grout: RGB = [178, 160, 136];
  const size = PX / 2;
  return pixels(w, d, (x, y, out) => {
    const g = grid(x, y, size);
    const u = x / PX;
    const v = y / PX;
    if (g.e + (noise2(x / 5, y / 5, 2) - 0.5) * 2.4 < 2.6) return put(out, grout, 0.82 + noise2(x / 1.6, y / 1.6, 3) * 0.3);
    const h = hash2(g.tx, g.ty, 5);
    let c = h < 0.5 ? mix(A, B, h * 1.6) : mix(A, pale, (h - 0.5) * 0.9);
    // Kiln marks: cloudy patches that differ tile to tile.
    const cloud = fbm(u * 5 + g.tx * 3.3, v * 5 + g.ty * 1.7, 4, 9);
    let k = 0.86 + cloud * 0.28;
    k -= smoothstep(0.58, 0.8, fbm(u * 2.2 + g.tx, v * 2.2 + g.ty, 3, 12)) * 0.16;
    c = mix(c, bloom, smoothstep(0.55, 0.8, fbm(u * 3.1, v * 3.1, 4, 21)) * 0.2);
    // Pits and grit in the clay.
    const grit = noise2(x / 1.4, y / 1.4, 30);
    if (grit < 0.07) k *= 0.8;
    else if (grit > 0.95) k *= 1.08;
    if (g.e < 6) k *= g.nearTopLeft < 6 ? 1.05 : 0.9;
    put(out, c, k);
  });
}

// Natural cleft slate: each tile its own shade, with layered ridges across the face.
export function slate(w: number, d: number, color: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const tints: RGB[] = [
    [84, 100, 98],
    [116, 100, 90],
    [72, 80, 94],
    [100, 106, 112],
  ];
  const grout: RGB = [50, 52, 54];
  const size = PX / 2;
  return pixels(w, d, (x, y, out) => {
    const g = grid(x, y, size);
    if (g.e < 1.6) return put(out, grout, 0.9 + noise2(x / 2, y / 2, 3) * 0.2);
    const h = hash2(g.tx, g.ty, 5);
    const c = mix(A, tints[Math.floor(hash2(g.tx, g.ty, 8) * 4)], 0.25 + h * 0.4);
    // Height of the split stone, lit from the back-left.
    const a = x / 34 + g.tx * 5.1;
    const b = y / 34 + g.ty * 3.7;
    const h1 = fbm(a, b, 4, 14);
    const h2 = fbm(a + 0.05, b + 0.05, 4, 14);
    let k = 0.92 + (h - 0.5) * 0.14 + (h2 - h1) * 5.5;
    // Where one layer breaks to the next.
    const step = h1 * 6 - Math.floor(h1 * 6);
    if (step < 0.07) k *= 0.82;
    else if (step < 0.14) k *= 1.07;
    // Rusty mineral veins here and there.
    const rust = smoothstep(0.7, 0.85, fbm(x / 60, y / 60, 3, 40));
    const cc = mix(c, [136, 98, 70], rust * 0.4);
    if (g.e < 3.6) k *= g.nearTopLeft < 3.6 ? 1.1 : 0.8;
    put(out, cc, k);
  });
}

// Sheet linoleum with a dated printed pattern, worn through where people walked.
export function oldLino(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const B = hexRgb(accent);
  const motif: RGB = [168, 110, 58];
  const backing: RGB = [128, 108, 78];
  const W = w * PX;
  const D = d * PX;
  const size = PX / 2;
  return pixels(w, d, (x, y, out) => {
    const g = grid(x, y, size);
    const u = x / PX;
    const v = y / PX;
    // The print: fake tiles with a border, a diamond and corner dots.
    let c: RGB = A;
    const dx = Math.abs(g.lx - 0.5);
    const dy = Math.abs(g.ly - 0.5);
    if (g.e < 2.2) c = B;
    else if (dx + dy < 0.2) c = motif;
    else if (dx + dy < 0.25) c = B;
    else if (Math.hypot(dx - 0.5, dy - 0.5) < 0.14) c = mix(A, motif, 0.6);
    // Print wears away along the routes through the room.
    const path = 1 - Math.min(Math.abs(y - D * 0.55) / (D * 0.5), 1);
    const wear = smoothstep(0.48, 0.7, fbm(u * 0.8, v * 0.8, 4, 6) * 0.7 + path * 0.38);
    c = mix(c, mix(A, backing, 0.35), wear * 0.75);
    // Yellowing, ground-in dirt and scuffs.
    c = mix(c, [150, 120, 60], 0.08 + fbm(u * 0.5, v * 0.5, 3, 15) * 0.2);
    let k = 0.94 + (noise2(x / 1.5, y / 1.5, 2) - 0.5) * 0.06 - smoothstep(0.55, 0.8, fbm(u * 1.6, v * 1.6, 4, 19)) * 0.16;
    if (noise2(x / 34 + y / 6, y / 44, 23) > 0.91) k *= 0.84;
    // The seam between two sheets has lifted and filled with grime.
    const seam = Math.abs(x - W / 2 + Math.sin(y / 40) * 1.5);
    if (seam < 1.3) k *= 0.5;
    else if (seam < 3.2) k *= 1.1;
    // Tears where the backing shows through, with a curled pale lip.
    const tear = fbm(u * 1.2, v * 1.2, 5, 31) + (noise2(x / 4, y / 4, 33) - 0.5) * 0.06;
    if (tear > 0.76) {
      c = backing;
      k = 0.62 + noise2(x / 2, y / 2, 35) * 0.3;
    } else if (tear > 0.745) k *= 1.2;
    put(out, c, k);
  });
}

// Old wall-to-wall carpet: matted pile, traffic lanes and a history of spills.
export function oldCarpet(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const B = hexRgb(accent);
  const R = rng(77);
  const D = d * PX;
  const tones: RGB[] = [
    [70, 46, 26],
    [96, 44, 40],
    [48, 44, 40],
    [196, 186, 160],
    [86, 70, 34],
  ];
  const stains = tones.map((c, i) => ({ c, x: (0.12 + R() * 0.76) * w * PX, y: (0.15 + R() * 0.7) * D, r: (0.3 + R() * 0.45) * PX, s: 50 + i }));
  return pixels(w, d, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    // Tufts: two scales of fibre noise, with the pile brushed in different directions.
    const tuft = noise2(x / 1.3, y / 1.3, 1) * 0.6 + noise2(x / 3.1, y / 3.1, 2) * 0.4;
    const lay = fbm(u * 1.3, v * 1.3, 3, 4);
    const path = 1 - Math.min(Math.abs(y - D * 0.55) / (D * 0.45), 1);
    const matted = smoothstep(0.45, 0.8, path * 0.6 + fbm(u * 0.7, v * 0.7, 3, 6) * 0.6);
    let c = mix(A, B, 0.35 + (tuft - 0.5) * (0.9 - matted * 0.5) + matted * 0.3);
    let k = 1.04 + (lay - 0.5) * 0.24 + (tuft - 0.5) * 0.3;
    for (const s of stains) {
      const f = 1 - Math.hypot(x - s.x, y - s.y) / s.r + (fbm(x / 26, y / 26, 4, s.s) - 0.5) * 0.9;
      if (f < -0.05) continue;
      const body = smoothstep(0, 0.25, f) * 0.42;
      const ring = smoothstep(-0.05, 0.02, f) * (1 - smoothstep(0.02, 0.1, f)) * 0.3;
      c = mix(c, s.c, body + ring);
    }
    // Cigarette burns.
    if (fbm(u * 5, v * 5, 2, 90) > 0.88) k *= 0.45;
    put(out, c, k);
  });
}

// Plywood subfloor after the old floor comes up: sheets, nails, and trowel marks of old
// glue.
export function subfloor(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const B = hexRgb(accent);
  const SW = 4 * PX; // sheet length
  const SH = 2 * PX; // sheet width
  return pixels(w, d, (x, y, out) => {
    const row = Math.floor(y / SH);
    const xo = x + (row % 2) * SW * 0.5;
    const col = Math.floor(xo / SW);
    const lx = xo - col * SW;
    const ly = y - row * SH;
    const e = Math.min(lx, ly, SW - lx, SH - ly);
    if (e < 1.2) return put(out, [70, 52, 34]);
    const s = col * 13 + row * 7;
    const u = lx / PX;
    const v = ly / PX;
    // Rotary-cut face veneer: broad, wandering figure.
    const t = v * 2.4 + fbm(u * 0.5 + s, v * 1.1, 3, s) * 5;
    const ring = t * 1.6 - Math.floor(t * 1.6);
    const band = smoothstep(0.5, 0.9, ring) * (1 - smoothstep(0.9, 1, ring));
    const fibre = noise2(u * 5, ly / 1.6 + s, 3);
    let c = mix(A, B, 0.15 + band * 0.75 + (fibre - 0.5) * 0.35 + (hash2(col, row, 4) - 0.5) * 0.3);
    let k = 1;
    // Football-shaped patches the mill puts in.
    const pu = (u * 1.3 + hash2(col, row, 6) * 3) % 1.9;
    const pv = (v * 2 + hash2(col, row, 7)) % 1.6;
    if (Math.hypot((pu - 0.5) / 0.26, (pv - 0.5) / 0.1) < 1) c = mix(c, A, 0.6);
    // Old adhesive, combed on with a notched trowel in sweeping arcs.
    const gx = x / PX;
    const gy = y / PX;
    const glue = smoothstep(0.56, 0.68, fbm(gx * 0.9, gy * 0.9, 4, 61));
    if (glue > 0) {
      const sweep = Math.hypot(gx - 3 + fbm(gx, gy, 2, 63) * 2, gy + 1.5) * 26;
      const ridge = Math.sin(sweep) > 0.2 ? 1 : 0.25;
      c = mix(c, [112, 84, 44], glue * ridge * 0.34);
    }
    // Water marks.
    k -= smoothstep(0.6, 0.75, fbm(gx * 0.7, gy * 0.7, 4, 70)) * 0.14;
    // Nails along every edge and across the joists.
    const nx = lx % (PX * 0.67);
    const ny = ly % (PX * 0.5);
    const onEdgeRow = ly < 9 || ly > SH - 9;
    const nd = Math.hypot(nx - PX * 0.33, onEdgeRow ? (ly < 9 ? ly - 5 : SH - ly - 5) : ny - PX * 0.25);
    if (nd < 1.5) return put(out, [58, 54, 50]);
    if (nd < 2.6) k *= 0.82;
    if (e < 2.4) k *= 0.85;
    put(out, c, k);
  });
}
