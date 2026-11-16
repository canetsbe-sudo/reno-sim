// Trouble with the house, painted straight into a wall or floor texture so it sits in
// the surface like the real thing. Positions and sizes are in texture pixels.
import { clamp01, fbm, noise2, rng, smoothstep } from './noise';

type Canvas = HTMLCanvasElement;

// Edit a rectangle of a canvas one pixel at a time. `fn` gets canvas coordinates and
// changes r, g, b in `io`.
function region(c: Canvas, x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, io: number[]) => void) {
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(c.width, Math.ceil(x1));
  y1 = Math.min(c.height, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const px = img.data;
  const io = [0, 0, 0];
  const w = x1 - x0;
  for (let y = 0; y < y1 - y0; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      io[0] = px[i];
      io[1] = px[i + 1];
      io[2] = px[i + 2];
      fn(x + x0, y + y0, io);
      px[i] = io[0];
      px[i + 1] = io[1];
      px[i + 2] = io[2];
    }
  }
  ctx.putImageData(img, x0, y0);
}

const tint = (io: number[], r: number, g: number, b: number, a: number) => {
  a = clamp01(a);
  io[0] += (r - io[0]) * a;
  io[1] += (g - io[1]) * a;
  io[2] += (b - io[2]) * a;
};
const dim = (io: number[], k: number) => {
  io[0] *= k;
  io[1] *= k;
  io[2] *= k;
};

// ---- Walls ----

// A leak inside the wall: tea-brown blooms with ring after ring of tide lines, and runs
// down the wall below. `full` adds the dark, soft heart of it.
export function waterStain(c: Canvas, cx: number, cy: number, r: number, full: boolean, seed = 3) {
  region(c, cx - r * 1.7, cy - r * 1.4, cx + r * 1.7, cy + r * 3.4, (x, y, io) => {
    const dx = (x - cx) / r;
    const dy = (y - cy) / (y > cy ? r * 1.5 : r);
    const f = 1 - Math.hypot(dx, dy) + (fbm(x / 34, y / 34, 4, seed) - 0.5) * 0.9;
    // Runs: narrow streaks that carry on down from the stain.
    const below = (y - cy) / (r * 3.2);
    if (below > 0 && below < 1 && Math.abs(dx) < 1) {
      const run = smoothstep(0.66, 0.86, noise2(x / 3.2, seed, seed + 4)) * (1 - below) * smoothstep(1, 0.5, Math.abs(dx));
      tint(io, 126, 92, 46, run * (0.3 + noise2(x / 3.2, y / 60, seed + 5) * 0.3));
    }
    if (f < -0.1) return;
    tint(io, 150, 112, 58, smoothstep(-0.1, 0.2, f) * 0.3);
    // Each time it dried it left a line a little further in.
    for (const t of [-0.04, 0.2, 0.42]) {
      const line = smoothstep(t - 0.05, t, f) * (1 - smoothstep(t, t + 0.07, f));
      tint(io, 112, 78, 36, line * 0.5);
    }
    if (full) {
      const soft = smoothstep(0.35, 0.7, f + (fbm(x / 12, y / 12, 3, seed + 8) - 0.5) * 0.5);
      tint(io, 82, 60, 38, soft * 0.6);
      // Paper face bubbling and splitting over the wet core.
      if (soft > 0.3 && Math.abs(fbm(x / 9, y / 9, 2, seed + 9) - 0.5) < 0.02) dim(io, 0.6);
    }
  });
}

// Layers of old paint letting go: flakes missing down to the plaster, lifted edges that
// catch the light, and fine crazing around them.
export function peelingPaint(c: Canvas, cx: number, cy: number, r: number, full: boolean, seed = 6) {
  const T = full ? 0.6 : 0.72;
  const chip = (x: number, y: number) => {
    const f = 1 - Math.hypot((x - cx) / (r * 1.3), (y - cy) / r);
    return fbm(x / 13, y / 13, 3, seed) * 0.75 + f * 0.36 + (noise2(x / 3, y / 3, seed + 1) - 0.5) * 0.04;
  };
  region(c, cx - r * 1.6, cy - r * 1.3, cx + r * 1.6, cy + r * 1.3, (x, y, io) => {
    const v = chip(x, y);
    if (v > T) {
      // Bare plaster, with the shadow of the paint's thickness along the upper edge.
      const n = noise2(x / 1.5, y / 1.5, seed + 2);
      const k = chip(x - 2, y - 2.5) <= T ? 0.62 : 1;
      io[0] = (208 + n * 14) * k;
      io[1] = (200 + n * 12) * k;
      io[2] = (184 + n * 10) * k;
      // An older coat of colour showing in places.
      if (fbm(x / 20, y / 20, 2, seed + 3) > 0.58) tint(io, 150, 172, 160, 0.5 * k);
    } else if (chip(x + 2, y + 2.5) > T) {
      // The curled lip of a flake.
      tint(io, 255, 255, 250, 0.45);
    } else if (v > T - 0.14 && Math.abs(fbm(x / 7, y / 7, 2, seed + 4) - 0.5) < 0.014) dim(io, 0.72);
  });
}

// Sea-air rust: orange blooms under a sill or bracket, weeping long streaks down the
// wall.
export function saltRust(c: Canvas, cx: number, cy: number, r: number, full: boolean, seed = 9) {
  const len = r * (full ? 2.6 : 1.5);
  region(c, cx - r * 1.5, cy - r * 0.6, cx + r * 1.5, cy + len, (x, y, io) => {
    const dx = (x - cx) / (r * 1.3);
    const dy = (y - cy) / (r * 0.5);
    const f = 1 - Math.hypot(dx, dy) + (fbm(x / 9, y / 9, 3, seed) - 0.5) * 1.3;
    // Streaks: each column runs its own length.
    const t = (y - cy) / len;
    if (t > 0 && Math.abs(dx) < 1) {
      const col = noise2(x / 2.6, seed, seed + 1);
      const reach = 0.3 + noise2(x / 2.6, seed + 7, seed + 2) * 0.7;
      const a = smoothstep(0.5, 0.8, col) * smoothstep(reach, reach * 0.3, t) * smoothstep(1, 0.6, Math.abs(dx));
      tint(io, 168, 86, 34, a * (full ? 0.7 : 0.45));
    }
    if (f > 0.1) {
      const pit = smoothstep(0.5, 0.9, f);
      tint(io, 160 - pit * 80, 78 - pit * 40, 30 - pit * 12, smoothstep(0.1, 0.3, f) * 0.9);
    } else if (f > -0.15) tint(io, 176, 110, 56, 0.25);
  });
}

// A hole opened in the wall, showing a stud and wiring nobody should still be using.
export function oldWiring(c: Canvas, cx: number, cy: number, w: number, h: number, seed = 12) {
  const ctx = c.getContext('2d')!;
  const R = rng(seed);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  // Ragged edge of the cut.
  const edge: [number, number][] = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = t * 4;
    const j = () => (R() - 0.5) * 5;
    if (p < 1) edge.push([x0 + p * w, y0 + j()]);
    else if (p < 2) edge.push([x0 + w + j(), y0 + (p - 1) * h]);
    else if (p < 3) edge.push([x0 + w - (p - 2) * w, y0 + h + j()]);
    else edge.push([x0 + j(), y0 + h - (p - 3) * h]);
  }
  const path = () => {
    ctx.beginPath();
    edge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.save();
  path();
  ctx.fillStyle = '#1c1612';
  ctx.fill();
  ctx.clip();
  // Stud and lath inside the cavity.
  const g = ctx.createLinearGradient(x0 + w * 0.62, 0, x0 + w * 0.82, 0);
  g.addColorStop(0, '#8a6a44');
  g.addColorStop(1, '#5c4429');
  ctx.fillStyle = g;
  ctx.fillRect(x0 + w * 0.62, y0 - 6, w * 0.2, h + 12);
  ctx.fillStyle = 'rgba(120,92,58,0.55)';
  for (let y = y0 + 4; y < y0 + h; y += 9) ctx.fillRect(x0 - 4, y, w * 0.62, 4);
  // Cloth-covered wires sagging between porcelain knobs.
  for (const [dy, col] of [[0.3, '#2a2420'], [0.45, '#5b4630']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 + h * dy);
    ctx.bezierCurveTo(x0 + w * 0.3, y0 + h * (dy + 0.3), x0 + w * 0.5, y0 + h * (dy - 0.05), x0 + w * 0.68, y0 + h * (dy + 0.12));
    ctx.lineTo(x0 + w + 4, y0 + h * (dy + 0.5));
    ctx.stroke();
    // Frayed insulation.
    ctx.strokeStyle = 'rgba(200,180,140,0.7)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) {
      const fx = x0 + w * (0.15 + R() * 0.4);
      const fy = y0 + h * (dy + 0.14 + R() * 0.06);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (R() - 0.5) * 5, fy + 3 + R() * 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#e6e2d6';
    ctx.beginPath();
    ctx.ellipse(x0 + w * 0.72, y0 + h * (dy + 0.13), 4.2, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f8a7d';
    ctx.beginPath();
    ctx.arc(x0 + w * 0.72, y0 + h * (dy + 0.13), 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Torn paper lip and a scorch mark above.
  path();
  ctx.strokeStyle = 'rgba(240,236,224,0.85)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const s = ctx.createRadialGradient(cx - w * 0.1, y0, 2, cx - w * 0.1, y0 - 6, w * 0.5);
  s.addColorStop(0, 'rgba(30,20,14,0.45)');
  s.addColorStop(1, 'rgba(30,20,14,0)');
  ctx.fillStyle = s;
  ctx.fillRect(x0 - w * 0.3, y0 - w * 0.6, w * 1.4, w * 0.62);
}

// ---- Floors ----

// How far inside a rounded, ragged patch a pixel is: 0 at the edge, about 1 in the middle.
const patch = (x: number, y: number, x0: number, y0: number, w: number, h: number, seed: number) => {
  const dx = (x - (x0 + w / 2)) / (w / 2);
  const dy = (y - (y0 + h / 2)) / (h / 2);
  return 1 - Math.pow(Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6), 1 / 2.6) + (fbm(x / 22, y / 22, 4, seed) - 0.5) * 0.7;
};

// Dry rot: wood gone dark and brittle, cracked into cubes, fallen through in the worst
// of it, with pale threads of fungus spreading across.
export function dryRot(c: Canvas, x0: number, y0: number, w: number, h: number, seed = 15) {
  region(c, x0 - w * 0.2, y0 - h * 0.25, x0 + w * 1.2, y0 + h * 1.25, (x, y, io) => {
    const f = patch(x, y, x0, y0, w, h, seed);
    if (f < -0.12) return;
    // A damp halo, then the rotten wood itself.
    tint(io, 96, 70, 44, smoothstep(-0.12, 0.1, f) * 0.5);
    const rot = smoothstep(0.05, 0.3, f);
    tint(io, 68, 46, 28, rot * (0.7 + noise2(x / 2, y / 2, seed + 1) * 0.25));
    if (rot > 0.2) {
      // Cubical cracking, across and along the grain.
      const wx = x + (fbm(x / 30, y / 30, 2, seed + 2) - 0.5) * 22;
      const wy = y + (fbm(x / 30, y / 30, 2, seed + 3) - 0.5) * 22;
      const gx = ((wx % 15) + 15) % 15;
      const gy = ((wy % 11) + 11) % 11;
      if (gx < 1.7 || gy < 1.5) dim(io, 0.35);
      else if (gx < 3.2 || gy < 2.8) dim(io, 1.18);
    }
    // Fallen through to the dark under the floor.
    const hole = f + (fbm(x / 10, y / 10, 3, seed + 4) - 0.5) * 0.5;
    if (hole > 0.72) {
      io[0] = 20;
      io[1] = 14;
      io[2] = 10;
    } else if (hole > 0.66) dim(io, 0.55);
    // Fungal strands.
    if (f > 0 && hole <= 0.72 && Math.abs(fbm(x / 16, y / 16, 3, seed + 5) - 0.5) < 0.011) tint(io, 226, 220, 204, 0.75);
  });
}

// Termites: galleries eaten along the grain, the surface papery over them, and little
// piles of pellets.
export function termites(c: Canvas, x0: number, y0: number, w: number, h: number, seed = 18) {
  region(c, x0 - w * 0.15, y0 - h * 0.2, x0 + w * 1.15, y0 + h * 1.2, (x, y, io) => {
    const f = patch(x, y, x0, y0, w, h, seed);
    if (f < -0.05) return;
    const a = smoothstep(-0.05, 0.25, f);
    // Dusty, dried-out wood.
    tint(io, 196, 170, 126, a * 0.3);
    // Galleries: long, wandering, mostly following the grain.
    const wy = y + Math.sin(x / 13 + seed) * 3 + (fbm(x / 40, y / 40, 2, seed + 1) - 0.5) * 26;
    const g = Math.abs(noise2(x / 46, wy / 4.2, seed + 2) - 0.5);
    const cross = Math.abs(noise2(x / 5, y / 30, seed + 3) - 0.5);
    const t = Math.min(g, cross * 2.2 + 0.03);
    if (t < 0.07 * a) {
      // The tunnel floor, darker at the edges where it undercuts.
      tint(io, 58, 38, 22, 0.9);
      if (t > 0.05 * a) dim(io, 0.7);
      // Mud packed along the tunnel.
      if (noise2(x / 2.2, y / 2.2, seed + 4) > 0.7) tint(io, 124, 96, 62, 0.7);
    } else if (t < 0.095 * a) tint(io, 232, 212, 170, 0.5);
    // Frass: tiny pellets scattered near the damage.
    if (a > 0.3 && noise2(x / 1.3, y / 1.3, seed + 5) > 0.93 && fbm(x / 14, y / 14, 2, seed + 6) > 0.5) tint(io, 150, 116, 70, 0.9);
  });
}

// A supply line rusted through under the floor: a slot cut to show it, the pipe scabbed
// with rust, and years of rusty water soaked into the wood around it.
export function rustyLine(c: Canvas, x0: number, y0: number, w: number, h: number, seed = 21) {
  const my = y0 + h / 2;
  region(c, x0 - w * 0.2, y0 - h * 0.3, x0 + w * 1.2, y0 + h * 1.3, (x, y, io) => {
    const f = patch(x, y, x0, y0, w, h, seed);
    if (f < -0.12) return;
    tint(io, 150, 92, 46, smoothstep(-0.12, 0.2, f) * 0.42);
    for (const t of [-0.06, 0.22]) tint(io, 110, 62, 30, smoothstep(t - 0.05, t, f) * (1 - smoothstep(t, t + 0.07, f)) * 0.5);
    // Still wet close to the leak.
    tint(io, 60, 40, 26, smoothstep(0.45, 0.85, f) * 0.45);
  });
  const ctx = c.getContext('2d')!;
  const R = rng(seed);
  const sx = x0 + w * 0.08;
  const sw = w * 0.84;
  const sh = h * 0.2;
  // The slot, with splintered edges.
  ctx.fillStyle = '#17110d';
  ctx.beginPath();
  ctx.moveTo(sx, my - sh / 2);
  for (let x = sx; x <= sx + sw; x += 6) ctx.lineTo(x, my - sh / 2 + (R() - 0.5) * 3);
  for (let x = sx + sw; x >= sx; x -= 6) ctx.lineTo(x, my + sh / 2 + (R() - 0.5) * 3);
  ctx.closePath();
  ctx.fill();
  // The pipe.
  const pr = sh * 0.28;
  const g = ctx.createLinearGradient(0, my - pr, 0, my + pr);
  g.addColorStop(0, '#c4875a');
  g.addColorStop(0.35, '#9a5a30');
  g.addColorStop(1, '#3f2414');
  ctx.fillStyle = g;
  ctx.fillRect(sx + 2, my - pr, sw - 4, pr * 2);
  // A coupling, scabs of rust, and the pinhole where it weeps.
  ctx.fillStyle = '#6f5a48';
  ctx.fillRect(sx + sw * 0.28, my - pr * 1.35, 9, pr * 2.7);
  for (let i = 0; i < 26; i++) {
    const rx = sx + 4 + R() * (sw - 8);
    ctx.fillStyle = R() < 0.5 ? 'rgba(196,96,36,0.9)' : 'rgba(92,44,20,0.9)';
    ctx.beginPath();
    ctx.ellipse(rx, my + (R() - 0.5) * pr * 1.8, 1.5 + R() * 3, 1 + R() * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const lx = sx + sw * 0.62;
  ctx.fillStyle = 'rgba(214,150,96,0.9)';
  ctx.beginPath();
  ctx.ellipse(lx, my + pr * 1.4, 5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,0.7)';
  ctx.beginPath();
  ctx.ellipse(lx - 1.5, my + pr * 1.2, 1.6, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}
