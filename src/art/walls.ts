// Wall coverings other than plain paint. Textures are `len` units along the wall and `h`
// units high, with image y running down from the ceiling.
import { fbm, hash2, hexRgb, noise2, rng, smoothstep } from './noise';
import { PX, makeCanvas, pixels, repaint } from './surfaces';

type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const put = (out: number[], c: RGB, k = 1) => {
  out[0] = c[0] * k;
  out[1] = c[1] * k;
  out[2] = c[2] * k;
};

// Width of a roll of wallpaper, in world units.
const ROLL = 0.55 * PX;

// Ticking stripe wallpaper: a bold stripe flanked by two fine ones, on woven paper.
export function stripePaper(len: number, h: number, color: string, accent: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const B = hexRgb(accent);
  const period = PX * 0.22;
  return pixels(len, h, (x, y, out) => {
    const p = Math.abs((x % period) - period / 2);
    let c = A;
    if (p < 2.6) c = B;
    else if (p > 5 && p < 6.2) c = mix(A, B, 0.8);
    // Woven texture and the faint difference between one roll and the next.
    const weave = (noise2(x / 1.2, y / 6, 3) - 0.5) * 0.035 + (noise2(x / 6, y / 1.2, 4) - 0.5) * 0.035;
    let k = 1 + weave + (hash2(Math.floor(x / ROLL), 0, 8) - 0.5) * 0.025;
    if (x % ROLL < 1) k *= 0.95;
    put(out, c, k);
  });
}

// Painted horizontal boards with a shadow gap between them.
export function shiplap(len: number, h: number, color: string, accent: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const B = hexRgb(accent);
  const board = PX * 0.2;
  return pixels(len, h, (x, y, out) => {
    const row = Math.floor(y / board);
    const ly = y - row * board;
    if (ly < 1.6) return put(out, B, 0.62);
    // Boards butt together at random points along the wall.
    const joint = (hash2(row, 1, 5) * 3 + 1.2) * PX;
    const jx = (x + hash2(row, 2, 5) * joint) % joint;
    if (jx < 1) return put(out, B, 0.78);
    let k = 1 + (hash2(row, Math.floor((x + hash2(row, 2, 5) * joint) / joint), 6) - 0.5) * 0.035;
    // Brushed paint over wood grain, and a soft light along each board's top edge.
    k += (noise2(x / 22, y / 1.3 + row * 9, 3) - 0.5) * 0.04;
    if (ly < 3.4) k *= 1.04;
    else if (ly > board - 2.2) k *= 0.95;
    // Filled nail holes.
    const nx = x % (PX * 0.67);
    if (Math.hypot(nx - PX * 0.33, ly - board * 0.5) < 1.5) k *= 0.93;
    put(out, A, k);
  });
}

// Bare drywall: grey paper, taped and mudded joints, dabs over every screw, and scraps of
// whatever used to be on the wall.
export function drywall(len: number, h: number, color: string): HTMLCanvasElement {
  const A = hexRgb(color);
  const mud: RGB = [240, 238, 231];
  const scrap: RGB = [178, 152, 112];
  const H = h * PX;
  const sheet = PX * 2.67;
  return pixels(len, h, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    let c: RGB = A;
    let k = 1 + (noise2(x / 1.4, y / 1.4, 2) - 0.5) * 0.03 + (fbm(u, v, 3, 4) - 0.5) * 0.04;
    // Joint compound: one long seam at mid height, staggered butt joints, the ceiling line.
    const wob = (noise2(x / 14, y / 14, 6) - 0.5) * 7;
    const top = y < H / 2;
    const dSeam = Math.abs(y - H / 2) + wob;
    const dButt = Math.abs(((x + (top ? 0 : sheet / 2)) % sheet) - sheet / 2) + wob;
    const band = Math.max(smoothstep(11, 5, dSeam), smoothstep(10, 4, dButt), smoothstep(9, 3, y + wob));
    // Screw dabs on every stud.
    const sx = (x % (PX * 0.67)) - PX * 0.33;
    const sy = ((top ? y : y - H / 2) % (H / 8)) - H / 16;
    const dab = smoothstep(5.5, 2.5, Math.hypot(sx, sy * 0.8) + wob * 0.3);
    const m = Math.max(band, dab);
    if (m > 0) {
      // Knife and sanding marks along the mud.
      c = mix(c, mud, m * (0.82 + (noise2(x / 30, y / 2.2, 9) - 0.5) * 0.25));
    }
    // Paper and paste left behind when the old covering came off.
    const left = fbm(u * 1.7, v * 1.7, 4, 12) + (noise2(x / 3, y / 3, 13) - 0.5) * 0.05;
    if (left > 0.7) c = mix(c, scrap, 0.6 + noise2(x / 2, y / 2, 14) * 0.25);
    else if (left > 0.66) c = mix(c, scrap, 0.2);
    put(out, c, k);
  });
}

// Faded floral wallpaper: a printed half-drop repeat, then decades of sun, damp and
// neglect, and a strip or two coming away from the wall.
export function floralPaper(len: number, h: number, color: string, accent: string, seed: number): HTMLCanvasElement {
  const c = makeCanvas(len * PX, h * PX);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  const leaf = '#8a9468';
  const cell = PX * 0.5;
  const petal = (cx: number, cy: number, r: number, a: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.62, r * 0.42, a, 0, Math.PI * 2);
    ctx.fill();
  };
  const sprig = (cx: number, cy: number, flip: number) => {
    // Stem and leaves.
    ctx.strokeStyle = leaf;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + flip * 6, cy + 10, cx - flip * 3, cy + 19);
    ctx.stroke();
    for (const [dx, dy, a] of [[7, 8, 0.6], [-6, 13, 2.4], [-9, -2, 3.4]] as const) {
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(cx + flip * dx, cy + dy, 5.5, 2.4, flip * a, 0, Math.PI * 2);
      ctx.fill();
    }
    // A cabbage rose: outer petals, inner petals, a dark heart.
    for (let i = 0; i < 6; i++) petal(cx, cy, 8, (i / 6) * Math.PI * 2, accent);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) petal(cx, cy, 5, (i / 5) * Math.PI * 2 + 0.5, '#f2e2d0');
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7d4a40';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.9, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = -1; i * cell < c.width + cell; i++) {
    for (let j = -1; j * cell < c.height + cell; j++) {
      const x = i * cell + cell / 2;
      const y = j * cell + (i % 2 ? cell / 2 : 0) + cell / 2;
      sprig(x, y, i % 2 ? 1 : -1);
      // A bud between the roses.
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell * 0.25, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(x + cell / 2 + 3, y + cell * 0.25 + 3, 3, 1.4, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const base = hexRgb(color);
  const H = c.height;
  repaint(c, (x, y, io) => {
    const u = x / PX;
    const v = y / PX;
    // Sun-bleached patches where the print has nearly gone.
    const fade = 0.25 + smoothstep(0.35, 0.75, fbm(u * 0.6, v * 0.6, 3, seed)) * 0.5;
    let r = lerp(io[0], base[0], fade);
    let g = lerp(io[1], base[1], fade);
    let b = lerp(io[2], base[2], fade);
    // Damp coming down from the ceiling, leaving brown tide lines.
    const f = 0.5 - (y / H) * 1.7 + (fbm(u * 1.1, v * 0.5, 4, seed + 3) - 0.5) * 1.3;
    const damp = smoothstep(-0.05, 0.3, f) * 0.22 + smoothstep(-0.08, -0.01, f) * (1 - smoothstep(-0.01, 0.07, f)) * 0.14;
    r = lerp(r, 128, damp);
    g = lerp(g, 96, damp);
    b = lerp(b, 52, damp);
    // Paper grain, yellowing, and the seams between rolls.
    let k = 1 + (noise2(x / 1.3, y / 1.3, 5) - 0.5) * 0.04 - fbm(u * 0.9, v * 0.9, 3, seed + 9) * 0.1;
    if (x % ROLL < 1.2) k *= 0.88;
    k -= smoothstep(0.75, 1, y / H) * 0.08;
    io[0] = r * k;
    io[1] = g * k;
    io[2] = b * k;
  });
  // Strips peeling away at the seams, showing the plaster and the paper's pale back.
  const R = rng(seed + 20);
  const rolls = Math.floor(c.width / ROLL);
  for (let n = 0; n < Math.max(1, Math.round(len / 3)); n++) {
    const sx = (1 + Math.floor(R() * Math.max(1, rolls - 2))) * ROLL;
    const w = (0.32 + R() * 0.2) * PX;
    const drop = (0.8 + R() * 0.6) * PX;
    ctx.fillStyle = '#cdc5b3';
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + w, 0);
    ctx.lineTo(sx + w * 0.35, drop * 0.55);
    ctx.lineTo(sx + 2, drop);
    ctx.closePath();
    ctx.fill();
    // Old paste and cracks on the bare plaster.
    ctx.strokeStyle = 'rgba(120,105,80,0.5)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx + w * 0.3, 2);
    ctx.lineTo(sx + w * 0.22, drop * 0.3);
    ctx.lineTo(sx + w * 0.3, drop * 0.45);
    ctx.stroke();
    // The loose flap, curled over and casting a shadow.
    ctx.fillStyle = 'rgba(40,28,16,0.3)';
    ctx.beginPath();
    ctx.moveTo(sx + w + 2, 0);
    ctx.lineTo(sx + w * 0.35 + 2, drop * 0.55 + 3);
    ctx.lineTo(sx + w * 1.25, drop * 0.5 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eee5d2';
    ctx.strokeStyle = 'rgba(120,100,70,0.6)';
    ctx.beginPath();
    ctx.moveTo(sx + w, 0);
    ctx.lineTo(sx + w * 0.35, drop * 0.55);
    ctx.quadraticCurveTo(sx + w * 0.9, drop * 0.62, sx + w * 1.18, drop * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return c;
}
