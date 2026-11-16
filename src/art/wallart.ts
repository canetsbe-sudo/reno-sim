// Things you hang on a wall. Each piece is painted flat, in a frame of its own centred on
// the middle of its wall slot (x right, y down, in texture pixels), and the caller maps
// that frame onto the wall.
import { rng } from './noise';

type Ctx = CanvasRenderingContext2D;

function shadow(ctx: Ctx, path: () => void) {
  ctx.save();
  ctx.translate(2.5, 3.5);
  ctx.fillStyle = 'rgba(30,20,10,0.28)';
  path();
  ctx.fill();
  ctx.restore();
}

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number) => {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
};
const circle = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

// A framed picture: frame with a lit top-left edge, a mat, and `paint` for the picture.
function framed(ctx: Ctx, x: number, y: number, w: number, h: number, frame: string, mat: string | undefined, paint: (w: number, h: number) => void) {
  shadow(ctx, () => rect(ctx, x, y, w, h));
  ctx.fillStyle = frame;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y, w, 1.5);
  ctx.fillRect(x, y, 1.5, h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + h - 1.5, w, 1.5);
  ctx.fillRect(x + w - 1.5, y, 1.5, h);
  let m = 4;
  if (mat) {
    ctx.fillStyle = mat;
    ctx.fillRect(x + m, y + m, w - m * 2, h - m * 2);
    m += 6;
  }
  ctx.save();
  rect(ctx, x + m, y + m, w - m * 2, h - m * 2);
  ctx.clip();
  ctx.translate(x + m, y + m);
  paint(w - m * 2, h - m * 2);
  ctx.restore();
  // Glass glare.
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 4);
  ctx.lineTo(x + w * 0.45, y + 4);
  ctx.lineTo(x + 4, y + h * 0.6);
  ctx.fill();
}

function landscape(ctx: Ctx) {
  framed(ctx, -36, -27, 72, 54, '#7a5a3a', undefined, (w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8fb8d6');
    sky.addColorStop(0.6, '#f3d9b0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff3cf';
    circle(ctx, w * 0.7, h * 0.36, 5);
    ctx.fill();
    const hill = (y0: number, amp: number, col: string, ph: number) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, y0 + Math.sin(x / 11 + ph) * amp + Math.sin(x / 4.3 + ph) * amp * 0.25);
      ctx.lineTo(w, h);
      ctx.fill();
    };
    hill(h * 0.5, 5, '#8ea6b4', 0.5);
    hill(h * 0.62, 4, '#6f8f6a', 2.2);
    ctx.fillStyle = '#b9d2dc';
    ctx.fillRect(0, h * 0.72, w, 5);
    hill(h * 0.84, 3, '#4f7048', 4);
    // A stand of pines on the near bank.
    ctx.fillStyle = '#2f4a34';
    for (const [tx, s] of [[10, 9], [16, 12], [23, 8]]) {
      ctx.beginPath();
      ctx.moveTo(tx, h * 0.86 - s);
      ctx.lineTo(tx + s * 0.35, h * 0.88);
      ctx.lineTo(tx - s * 0.35, h * 0.88);
      ctx.fill();
    }
  });
}

function abstract(ctx: Ctx) {
  framed(ctx, -26, -36, 52, 72, '#1f1f22', '#f4efe4', (w, h) => {
    ctx.fillStyle = '#f1e7d6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c96f4a';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.72, w * 0.36, Math.PI, 0);
    ctx.lineTo(w * 0.86, h);
    ctx.lineTo(w * 0.14, h);
    ctx.fill();
    ctx.fillStyle = '#2f4063';
    circle(ctx, w * 0.36, h * 0.28, w * 0.2);
    ctx.fill();
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.34, w * 0.2, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = '#1f1f22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.52);
    ctx.lineTo(w * 0.9, h * 0.46);
    ctx.stroke();
  });
}

function botanical(ctx: Ctx) {
  const sprig = (kind: number) => (w: number, h: number) => {
    ctx.fillStyle = '#f6f1e4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#55693f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 2);
    ctx.quadraticCurveTo(w / 2 + (kind ? 3 : -3), h / 2, w / 2, 3);
    ctx.stroke();
    ctx.fillStyle = kind ? '#6f8a4f' : '#4f7048';
    for (let i = 0; i < 6; i++) {
      const y = h - 6 - i * ((h - 10) / 6);
      const side = i % 2 ? 1 : -1;
      const len = kind ? 6 - i * 0.6 : 5;
      ctx.beginPath();
      ctx.ellipse(w / 2 + side * len * 0.7, y, len, kind ? 1.4 : 2.4, side * (kind ? 0.5 : 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
  };
  framed(ctx, -38, -30, 34, 60, '#c9a777', '#fbf8f0', sprig(0));
  framed(ctx, 4, -30, 34, 60, '#c9a777', '#fbf8f0', sprig(1));
}

function mirror(ctx: Ctx, rays: boolean) {
  const r = rays ? 14 : 30;
  if (rays) {
    // Sunburst: long and short brass rays around a small mirror.
    ctx.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const len = i % 2 ? 26 : 38;
      for (const [off, col, lw] of [[1.5, 'rgba(30,20,10,0.25)', 2.4], [0, i % 2 ? '#b98a33' : '#d9b25a', 2]] as const) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r + off, Math.sin(a) * r + off * 1.5);
        ctx.lineTo(Math.cos(a) * len + off, Math.sin(a) * len + off * 1.5);
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }
  }
  shadow(ctx, () => circle(ctx, 0, 0, r + 3));
  const ring = ctx.createLinearGradient(-r, -r, r, r);
  ring.addColorStop(0, '#f0d58a');
  ring.addColorStop(0.5, '#b98a33');
  ring.addColorStop(1, '#7d5a1f');
  ctx.fillStyle = ring;
  circle(ctx, 0, 0, r + 3);
  ctx.fill();
  const glass = ctx.createLinearGradient(-r, -r, r, r);
  glass.addColorStop(0, '#eef4f6');
  glass.addColorStop(0.5, '#b7c8cf');
  glass.addColorStop(1, '#8fa3ad');
  ctx.fillStyle = glass;
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.save();
  circle(ctx, 0, 0, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.rotate(-0.7);
  ctx.fillRect(-r * 2, -r * 0.45, r * 4, r * 0.22);
  ctx.fillRect(-r * 2, -r * 0.12, r * 4, r * 0.08);
  ctx.restore();
}

function clock(ctx: Ctx) {
  const r = 24;
  shadow(ctx, () => circle(ctx, 0, 0, r + 3));
  ctx.fillStyle = '#2b2d31';
  circle(ctx, 0, 0, r + 3);
  ctx.fill();
  const face = ctx.createRadialGradient(-6, -8, 2, 0, 0, r);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(1, '#e9e3d4');
  ctx.fillStyle = face;
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.strokeStyle = '#2b2d31';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 ? 0.9 : 1.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
    ctx.lineTo(Math.cos(a) * (r - (i % 3 ? 5 : 7)), Math.sin(a) * (r - (i % 3 ? 5 : 7)));
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  const hand = (a: number, len: number, lw: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(a) * len, -Math.cos(a) * len);
    ctx.stroke();
  };
  hand(-1.05, 12, 2.4, '#2b2d31');
  hand(1.05, 18, 1.6, '#2b2d31');
  hand(3.3, 19, 0.8, '#c0463a');
  ctx.fillStyle = '#c0463a';
  circle(ctx, 0, 0, 1.8);
  ctx.fill();
}

function shelf(ctx: Ctx) {
  const y = 14;
  // Brackets, then the board.
  ctx.fillStyle = '#2b2d31';
  for (const x of [-30, 27]) {
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + 3, y + 4);
    ctx.lineTo(x + 3, y + 16);
    ctx.fill();
  }
  shadow(ctx, () => rect(ctx, -40, y, 80, 5));
  const wood = ctx.createLinearGradient(0, y, 0, y + 5);
  wood.addColorStop(0, '#c99460');
  wood.addColorStop(1, '#8f643c');
  ctx.fillStyle = wood;
  ctx.fillRect(-40, y, 80, 5);
  // Books leaning together.
  const books: [number, number, number, string][] = [[-34, 7, 24, '#2f4063'], [-27, 6, 28, '#c96f4a'], [-21, 5, 22, '#e9e1d6'], [-16, 7, 26, '#55693f']];
  for (const [x, w, h, col] of books) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + w - 1, y - h, 1, h);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x + 1.5, y - h + 4, w - 3, 1.5);
  }
  // A trailing plant in a clay pot.
  ctx.fillStyle = '#b86b47';
  ctx.beginPath();
  ctx.moveTo(8, y - 14);
  ctx.lineTo(24, y - 14);
  ctx.lineTo(21, y);
  ctx.lineTo(11, y);
  ctx.fill();
  ctx.fillStyle = '#9c5638';
  ctx.fillRect(7, y - 16, 18, 3);
  const R = rng(4);
  for (let i = 0; i < 9; i++) {
    const sx = 9 + R() * 14;
    const drop = 4 + R() * 26;
    const sway = (R() - 0.5) * 12;
    ctx.strokeStyle = '#4f7048';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sx, y - 17);
    ctx.quadraticCurveTo(sx + sway, y - 24, sx + sway * 1.4, y - 16 + drop);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? '#6f9a5c' : '#55803f';
    for (let t = 0.3; t <= 1; t += 0.23) {
      ctx.beginPath();
      ctx.ellipse(sx + sway * 1.3 * t, y - 20 + (drop + 4) * t, 2.6, 1.6, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A little jar.
  ctx.fillStyle = '#e8eef0';
  ctx.fillRect(29, y - 11, 8, 11);
  ctx.fillStyle = '#b98a33';
  ctx.fillRect(28.5, y - 13, 9, 3);
}

function plates(ctx: Ctx) {
  const plate = (x: number, y: number, r: number, col: string, kind: number) => {
    shadow(ctx, () => circle(ctx, x, y, r));
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e4e2da');
    ctx.fillStyle = g;
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    circle(ctx, x, y, r - 1.5);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    circle(ctx, x, y, r * 0.58);
    ctx.stroke();
    ctx.fillStyle = col;
    if (kind === 0) {
      // Petals around the well.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.2, r * 0.09, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Dots around the rim.
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        circle(ctx, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, 1);
        ctx.fill();
      }
      circle(ctx, x, y, r * 0.2);
      ctx.fill();
    }
  };
  plate(-22, 10, 15, '#3f6f9c', 0);
  plate(4, -18, 18, '#2f4f7a', 1);
  plate(26, 16, 12, '#5d8fae', 0);
}

function macrame(ctx: Ctx) {
  // Dowel on a cord, then knotted rows narrowing to a point, then fringe.
  ctx.strokeStyle = '#8f7a5a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-24, -30);
  ctx.lineTo(0, -44);
  ctx.lineTo(24, -30);
  ctx.stroke();
  shadow(ctx, () => rect(ctx, -30, -32, 60, 4));
  ctx.fillStyle = '#9a7248';
  ctx.fillRect(-30, -32, 60, 4);
  ctx.lineCap = 'round';
  const cord = '#efe6d2';
  const dark = '#cdbf9f';
  for (let i = 0; i <= 12; i++) {
    const x = -24 + i * 4;
    const len = 46 - Math.abs(i - 6) * 6;
    for (const [off, col] of [[0.8, dark], [0, cord]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + off, -28);
      ctx.lineTo(x + off, -28 + len + 14);
      ctx.stroke();
    }
  }
  // Diamond lattice of knots.
  ctx.strokeStyle = cord;
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    for (let i = row; i < 6 - row; i++) {
      const x = -20 + i * 8 + (row % 2 ? 0 : 0);
      const y = -22 + row * 10;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x - 4, y + 10);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x + 4, y + 10);
      ctx.stroke();
      ctx.fillStyle = dark;
      circle(ctx, x, y + 5, 1.6);
      ctx.fill();
    }
  }
}

function potRack(ctx: Ctx) {
  // Wrought iron rail on two wall plates.
  const y = -30;
  ctx.fillStyle = '#26282c';
  for (const x of [-38, 34]) ctx.fillRect(x, y - 4, 4, 10);
  shadow(ctx, () => rect(ctx, -40, y, 80, 3));
  ctx.fillStyle = '#26282c';
  ctx.fillRect(-40, y, 80, 3);
  const hook = (x: number) => {
    ctx.strokeStyle = '#26282c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  };
  const pan = (x: number, r: number, handle: number, a: string, b: string) => {
    hook(x);
    ctx.fillStyle = '#3a3c40';
    ctx.fillRect(x - 1.6, y + 7, 3.2, handle);
    const cy = y + 7 + handle + r - 2;
    shadow(ctx, () => circle(ctx, x, cy, r));
    const g = ctx.createRadialGradient(x - r * 0.4, cy - r * 0.4, 1, x, cy, r);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    circle(ctx, x, cy, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,15,0.5)';
    ctx.lineWidth = 0.8;
    circle(ctx, x, cy, r * 0.72);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
  };
  pan(-26, 13, 14, '#f0b488', '#a85a30');
  pan(0, 10, 18, '#f0b488', '#9a4f2a');
  pan(22, 8, 12, '#d9dde0', '#7d868c');
  // A ladle between them.
  hook(-12);
  ctx.strokeStyle = '#a9adb0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-12, y + 7);
  ctx.lineTo(-12, y + 44);
  ctx.stroke();
  ctx.fillStyle = '#a9adb0';
  ctx.beginPath();
  ctx.arc(-12, y + 46, 4.5, 0, Math.PI);
  ctx.fill();
}

// Draws the piece with this id, centred on the origin.
export function drawArt(ctx: Ctx, id: string) {
  ctx.save();
  switch (id) {
    case 'art-landscape':
      landscape(ctx);
      break;
    case 'art-abstract':
      abstract(ctx);
      break;
    case 'art-botanical':
      botanical(ctx);
      break;
    case 'art-mirror':
      mirror(ctx, false);
      break;
    case 'art-sunburst':
      mirror(ctx, true);
      break;
    case 'art-clock':
      clock(ctx);
      break;
    case 'art-shelf':
      shelf(ctx);
      break;
    case 'art-plates':
      plates(ctx);
      break;
    case 'art-macrame':
      macrame(ctx);
      break;
    case 'art-potrack':
      potRack(ctx);
      break;
  }
  ctx.restore();
}
