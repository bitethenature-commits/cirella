import type { Decor } from "@/lib/templates";
import {
  addMode,
  blurred,
  clamp,
  count,
  darken,
  drawR,
  drawRot,
  glow,
  hex,
  lighten,
  loopNoise,
  makeNoise,
  mix,
  nat,
  noiseTexture,
  rgba,
  rng,
  smooth,
  sprite,
  TAU,
  wind,
  type EffectFactory,
  type FxEnv,
  type Noise3,
  type RGB,
  type Rng,
  type Sprite,
} from "./util";

/* ───────────── Lo que cae dando vueltas (pétalos, flores, hojas, plumas) ───────────── */

type Look = { front: Sprite; back: Sprite; near: Sprite; nominal: number };
type Piece = {
  x: number;
  y: number;
  z: number;
  size: number;
  vy: number;
  ph: number;
  sw: number;
  swf: number;
  rot: number;
  vr: number;
  flip: number;
  vf: number;
  look: number;
};

type FallOpts = {
  perMega: number;
  min: number;
  max: number;
  size: [number, number];
  fall: [number, number];
  sway: [number, number];
  swayF: [number, number];
  spin: number;
  flip: [number, number];
  /** Las hojas: se inclinan hacia donde se balancean (el vaivén de una hoja al caer). */
  tiltWithSway?: number;
  windBase: number;
  windGust: number;
  /** Suben en lugar de caer (las semillas del diente de león). */
  rise?: boolean;
  looks: (env: FxEnv, r: Rng) => Look[];
};

/** Una cara del sprite más apagada (el revés de un pétalo o de una hoja). */
function backOf(front: Sprite, tint: RGB, a: number): Sprite {
  return sprite(front.width, front.height, (g) => {
    g.drawImage(front, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = rgba(tint, a);
    g.fillRect(0, 0, front.width, front.height);
  });
}

/**
 * Piezas que caen con profundidad: las lejanas pequeñas, lentas y tenues; las cercanas grandes y desenfocadas. Cada
 * una se balancea, gira y da la vuelta en 3D (se achata y enseña su revés), llevada por un viento con rachas.
 */
function faller(o: FallOpts): EffectFactory {
  return (env) => {
    const r = rng(101);
    const n = makeNoise(101);
    const looks = o.looks(env, r);
    let list: Piece[] = [];
    const spawn = (e: FxEnv, p: Piece | null, anywhere: boolean): Piece => {
      const z = Math.pow(r(), 1.4);
      const q: Piece = p ?? ({} as Piece);
      q.z = z;
      q.size = r.range(o.size[0], o.size[1]) * (0.45 + z * 0.95) * Math.max(0.35, e.k);
      q.vy = r.range(o.fall[0], o.fall[1]) * (0.45 + z * 0.75) * Math.max(0.5, e.k);
      q.ph = r() * TAU;
      q.sw = r.range(o.sway[0], o.sway[1]) * (0.5 + z * 0.7) * Math.max(0.5, e.k);
      q.swf = r.range(o.swayF[0], o.swayF[1]);
      q.rot = r() * TAU;
      q.vr = r.range(-o.spin, o.spin);
      q.flip = o.flip[1] > 0 ? r() * TAU : 0;
      q.vf = r.range(o.flip[0], o.flip[1]) * r.sign();
      q.look = Math.floor(r() * looks.length);
      q.x = r.range(-0.1, 1.1) * e.w;
      q.y = anywhere ? r() * e.h : o.rise ? e.h + q.size * 2 : -q.size * 2;
      return q;
    };
    const fill = (e: FxEnv) => {
      list = Array.from({ length: count(e, o.perMega, o.min, o.max) }, () => spawn(e, null, true));
      list.sort((a, b) => a.z - b.z);
    };
    fill(env);
    return {
      resize: fill,
      frame(g, e, t, dt) {
        const wv = wind(n, t, o.windBase, o.windGust) * Math.max(0.5, e.k);
        g.globalCompositeOperation = "source-over";
        for (const p of list) {
          p.ph += p.swf * dt;
          const sway = Math.cos(p.ph);
          const turb = n(p.x * 0.004, p.y * 0.004, t * 0.15) * 30 * Math.max(0.5, e.k);
          p.x += (wv * (0.45 + p.z * 0.8) + p.sw * sway + turb) * dt;
          const speedUp = o.tiltWithSway ? 0.55 + 0.75 * Math.abs(Math.sin(p.ph)) : 1;
          p.y += (o.rise ? -1 : 1) * p.vy * speedUp * dt;
          p.rot += p.vr * dt;
          p.flip += p.vf * dt;
          const m = p.size * 2.5;
          if (o.rise ? p.y < -m : p.y > e.h + m) spawn(e, p, false);
          if (p.x > e.w + m) p.x -= e.w + m * 2;
          else if (p.x < -m) p.x += e.w + m * 2;
          const L = looks[p.look];
          const c = Math.cos(p.flip);
          const near = p.z > 0.86;
          const s = near ? L.near : c >= 0 ? L.front : L.back;
          const tilt = o.tiltWithSway ? sway * o.tiltWithSway : 0;
          const a = (0.5 + p.z * 0.45) * (near ? 0.75 : 1) * (0.82 + 0.18 * Math.abs(c));
          drawRot(g, s, e.dpr, L.nominal, p.x, p.y, p.size, p.rot + tilt, 1, Math.max(0.1, Math.abs(c)), a);
        }
        g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
        g.globalAlpha = 1;
      },
    };
  };
}

/** Prepara las tres versiones de una pieza: su cara, su revés y la cercana desenfocada. */
function looksOf(env: FxEnv, nominal: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, backTint: RGB, backA: number): Look {
  const S = nominal * env.dpr;
  const front = sprite(S, S, (g, w, h) => draw(g, w, h));
  return { front, back: backOf(front, backTint, backA), near: blurred(front, 2.4 * env.dpr), nominal };
}

/* Pétalo de rosa: ancho arriba con una muesca suave, estrecho en la base, con sus venas y el borde curvado. */
function petalShape(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.96);
  g.bezierCurveTo(w * 0.1, h * 0.82, w * 0.02, h * 0.3, w * 0.28, h * 0.1);
  g.quadraticCurveTo(w * 0.5, h * 0.18, w * 0.72, h * 0.1);
  g.bezierCurveTo(w * 0.98, h * 0.3, w * 0.9, h * 0.82, w * 0.5, h * 0.96);
  g.closePath();
}

function drawPetal(c1: RGB, c2: RGB) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    petalShape(g, w, h);
    const gr = g.createRadialGradient(w * 0.5, h * 0.95, 0, w * 0.5, h * 0.55, h * 0.62);
    gr.addColorStop(0, rgba(darken(c1, 0.25), 1));
    gr.addColorStop(0.35, rgba(c1, 1));
    gr.addColorStop(1, rgba(c2, 1));
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    // El borde que se curva: un poco de sombra en un lado y luz en el otro.
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, "rgba(0,0,0,.16)");
    side.addColorStop(0.3, "rgba(0,0,0,0)");
    side.addColorStop(0.75, "rgba(255,255,255,0)");
    side.addColorStop(1, "rgba(255,255,255,.22)");
    g.fillStyle = side;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = rgba(lighten(c2, 0.4), 0.22);
    g.lineWidth = Math.max(0.6, w * 0.012);
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.95);
      g.quadraticCurveTo(w * (0.5 + i * 0.05), h * 0.55, w * (0.5 + i * 0.1), h * 0.16);
      g.stroke();
    }
    g.restore();
    petalShape(g, w, h);
    g.strokeStyle = rgba(lighten(c2, 0.5), 0.35);
    g.lineWidth = Math.max(0.6, w * 0.015);
    g.stroke();
  };
}

/* Pétalo de cerezo: ovalado con la muesca en V en la punta. */
function sakuraShape(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.97);
  g.bezierCurveTo(w * 0.16, h * 0.78, w * 0.05, h * 0.3, w * 0.27, h * 0.07);
  g.quadraticCurveTo(w * 0.4, h * 0.02, w * 0.5, h * 0.16);
  g.quadraticCurveTo(w * 0.6, h * 0.02, w * 0.73, h * 0.07);
  g.bezierCurveTo(w * 0.95, h * 0.3, w * 0.84, h * 0.78, w * 0.5, h * 0.97);
  g.closePath();
}

function drawSakuraPetal(base: RGB, body: RGB, edge: RGB) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    sakuraShape(g, w, h);
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, rgba(base, 1));
    gr.addColorStop(0.35, rgba(body, 1));
    gr.addColorStop(1, rgba(edge, 1));
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = rgba(base, 0.18);
    g.lineWidth = Math.max(0.5, w * 0.01);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.95);
      g.quadraticCurveTo(w * (0.5 + i * 0.06), h * 0.5, w * (0.5 + i * 0.12), h * 0.12);
      g.stroke();
    }
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, "rgba(120,30,60,.12)");
    side.addColorStop(0.4, "rgba(0,0,0,0)");
    side.addColorStop(1, "rgba(255,255,255,.25)");
    g.fillStyle = side;
    g.fillRect(0, 0, w, h);
    g.restore();
  };
}

/** La flor de cerezo entera: cinco pétalos, el centro y los estambres. */
function drawBlossom(base: RGB, body: RGB, edge: RGB) {
  const petal = drawSakuraPetal(base, body, edge);
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const P = sprite(w * 0.5, h * 0.5, (pg, pw, ph) => petal(pg, pw, ph));
    for (let i = 0; i < 5; i++) {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate((i * TAU) / 5);
      g.drawImage(P, -P.width / 2, -P.height);
      g.restore();
    }
    const r = rng(3);
    g.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const a = r() * TAU;
      const len = w * r.range(0.1, 0.17);
      const x = w / 2 + Math.cos(a) * len;
      const y = h / 2 + Math.sin(a) * len;
      g.strokeStyle = rgba(darken(base, 0.1), 0.7);
      g.lineWidth = Math.max(0.5, w * 0.008);
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.lineTo(x, y);
      g.stroke();
      g.fillStyle = "rgba(246,214,120,.95)";
      g.beginPath();
      g.arc(x, y, Math.max(0.6, w * 0.014), 0, TAU);
      g.fill();
    }
    const c = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.07);
    c.addColorStop(0, rgba(darken(base, 0.35), 1));
    c.addColorStop(1, rgba(base, 0));
    g.fillStyle = c;
    g.fillRect(0, 0, w, h);
  };
}

/* Hojas de otoño: arce (cinco lóbulos dentados), roble (lobulada) y haya (ovalada y dentada). */
function leafPath(g: CanvasRenderingContext2D, w: number, h: number, kind: 0 | 1 | 2) {
  const cx = w / 2;
  const cy = h / 2;
  g.beginPath();
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * TAU - Math.PI / 2;
    const d = th + Math.PI / 2;
    let rr: number;
    if (kind === 0) {
      const lobe = Math.pow((Math.cos(5 * d) + 1) / 2, 2.6);
      rr = 0.27 + 0.2 * lobe + 0.018 * Math.sin(th * 34);
      const dd = Math.atan2(Math.sin(d - Math.PI), Math.cos(d - Math.PI));
      rr *= 1 - 0.55 * Math.exp(-(dd * dd) / 0.05);
    } else if (kind === 1) {
      const ex = 0.25 / Math.sqrt(Math.pow(Math.cos(th) / 0.26, 2) * 0.0625 + Math.pow(Math.sin(th) / 0.47, 2) * 0.0625);
      rr = ex * (0.86 + 0.14 * Math.abs(Math.sin(4.5 * (th + Math.PI / 2))));
    } else {
      const ex = 0.25 / Math.sqrt(Math.pow(Math.cos(th) / 0.22, 2) * 0.0625 + Math.pow(Math.sin(th) / 0.47, 2) * 0.0625);
      rr = ex * (1 + 0.025 * Math.sin(th * 40));
      // La punta, más afilada.
      const top = Math.exp(-Math.pow(d, 2) / 0.08) + Math.exp(-Math.pow(d - TAU, 2) / 0.08);
      rr *= 1 + 0.12 * top;
    }
    const x = cx + Math.cos(th) * rr * w;
    const y = cy + Math.sin(th) * rr * h;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function drawLeaf(kind: 0 | 1 | 2, c1: RGB, c2: RGB, seed: number) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed);
    leafPath(g, w, h, kind);
    const gr = g.createLinearGradient(w * r.range(0, 0.4), 0, w * r.range(0.6, 1), h);
    gr.addColorStop(0, rgba(c1, 1));
    gr.addColorStop(1, rgba(c2, 1));
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    // Manchas del otoño.
    for (let i = 0; i < 6; i++) {
      const sx = w * r.range(0.25, 0.75);
      const sy = h * r.range(0.25, 0.75);
      const sr = w * r.range(0.03, 0.09);
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, rgba(darken(c2, 0.45), 0.35));
      sg.addColorStop(1, rgba(darken(c2, 0.45), 0));
      g.fillStyle = sg;
      g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    // Las venas: el nervio del centro y los de los lados.
    g.strokeStyle = rgba(darken(c1, 0.35), 0.5);
    g.lineCap = "round";
    const cx = w / 2;
    const base = kind === 0 ? h * 0.62 : h * 0.95;
    g.lineWidth = Math.max(0.6, w * 0.018);
    g.beginPath();
    g.moveTo(cx, base);
    g.lineTo(cx, h * 0.06);
    g.stroke();
    g.lineWidth = Math.max(0.4, w * 0.009);
    if (kind === 0) {
      for (const a of [-72, 72, -144, 144]) {
        const rad = ((a - 90) * Math.PI) / 180;
        g.beginPath();
        g.moveTo(cx, h * 0.55);
        g.lineTo(cx + Math.cos(rad) * w * 0.44, h * 0.55 + Math.sin(rad) * h * 0.44);
        g.stroke();
      }
    } else {
      for (let i = 1; i < 7; i++) {
        const y = base - (base - h * 0.08) * (i / 7);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx, y);
          g.quadraticCurveTo(cx + s * w * 0.12, y - h * 0.04, cx + s * w * 0.3, y - h * 0.1);
          g.stroke();
        }
      }
    }
    g.restore();
    // El rabillo.
    g.strokeStyle = rgba(darken(c1, 0.45), 0.9);
    g.lineWidth = Math.max(0.8, w * 0.02);
    g.beginPath();
    g.moveTo(cx, kind === 0 ? h * 0.6 : h * 0.93);
    g.quadraticCurveTo(cx + w * 0.03, h * 0.98, cx - w * 0.02, h * 1);
    g.stroke();
  };
}

/** Pluma: el cañón curvado y cientos de barbas finas, con el plumón suelto abajo y alguna barba abierta. */
function drawFeather(c: RGB, shaft: RGB, seed: number) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed);
    const bend = w * r.range(-0.08, 0.08);
    const P = (t: number) => {
      const y = h * 0.97 - t * h * 0.93;
      const x = w / 2 + bend * Math.sin(Math.PI * t);
      return [x, y] as const;
    };
    g.lineCap = "round";
    const N = 90;
    for (let i = 0; i < N; i++) {
      const t = 0.06 + (i / N) * 0.94;
      const [x, y] = P(t);
      const down = t < 0.28;
      const prof = Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.35 * Math.pow(t, 4));
      for (const s of [-1, 1]) {
        if (!down && r() < 0.05) continue;
        const len = w * 0.46 * prof * (down ? r.range(0.6, 1.2) : r.range(0.92, 1.04));
        const ang = (down ? r.range(0.5, 1.3) : 0.95 + t * 0.3) * s;
        const ex = x + Math.sin(ang) * len;
        const ey = y - Math.cos(ang) * len * 0.55;
        g.strokeStyle = rgba(c, down ? 0.32 : 0.5);
        g.lineWidth = Math.max(0.5, w * (down ? 0.012 : 0.016));
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.sin(ang) * len * 0.5, y + (down ? r.range(-4, 4) : len * 0.05), ex, ey);
        g.stroke();
      }
    }
    // El cañón.
    g.strokeStyle = rgba(shaft, 0.9);
    g.lineWidth = Math.max(0.8, w * 0.03);
    g.beginPath();
    const [x0, y0] = P(0);
    g.moveTo(x0, y0);
    for (let i = 1; i <= 20; i++) {
      const [x, y] = P(i / 20);
      g.lineTo(x, y);
    }
    g.stroke();
  };
}

/** Semilla de diente de león: la semilla, el tallito y el paracaídas de filamentos con sus puntas sedosas. */
function drawSeed(c: RGB, seedC: RGB) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(77);
    const cx = w / 2;
    const top = h * 0.36;
    g.lineCap = "round";
    // El paracaídas.
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + r.range(-1.35, 1.35);
      const len = w * r.range(0.36, 0.46);
      const ex = cx + Math.cos(a) * len;
      const ey = top + Math.sin(a) * len * 0.82;
      g.strokeStyle = rgba(c, 0.55);
      g.lineWidth = Math.max(0.4, w * 0.008);
      g.beginPath();
      g.moveTo(cx, top);
      g.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, top + Math.sin(a) * len * 0.45, ex, ey);
      g.stroke();
      // La punta deshilachada.
      g.strokeStyle = rgba(c, 0.35);
      for (let k = 0; k < 3; k++) {
        const b = a + r.range(-0.6, 0.6);
        g.beginPath();
        g.moveTo(ex, ey);
        g.lineTo(ex + Math.cos(b) * w * 0.05, ey + Math.sin(b) * w * 0.05);
        g.stroke();
      }
    }
    // El tallito y la semilla.
    g.strokeStyle = rgba(c, 0.8);
    g.lineWidth = Math.max(0.5, w * 0.012);
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(cx, h * 0.8);
    g.stroke();
    g.fillStyle = rgba(seedC, 0.95);
    g.beginPath();
    g.ellipse(cx, h * 0.87, w * 0.025, h * 0.075, 0, 0, TAU);
    g.fill();
  };
}

const petals = faller({
  perMega: 9,
  min: 10,
  max: 26,
  size: [14, 22],
  fall: [30, 55],
  sway: [14, 34],
  swayF: [0.7, 1.4],
  spin: 1.2,
  flip: [1.2, 3.2],
  windBase: 18,
  windGust: 40,
  looks: (env) => {
    const pal: [RGB, RGB][] = env.own
      ? [
          [env.c.a, lighten(env.c.a, 0.45)],
          [env.c.b, lighten(env.c.b, 0.4)],
          [mix(env.c.a, env.c.b, 0.5), lighten(env.c.a2, 0.2)],
        ]
      : [
          [hex("#E8668B"), hex("#FBD3DC")],
          [hex("#D9466F"), hex("#F7A9BE")],
          [hex("#F28AA8"), hex("#FFE4EA")],
          [hex("#C93B5E"), hex("#F58FAA")],
        ];
    return pal.map(([c1, c2]) => looksOf(env, 36, drawPetal(c1, c2), hex("#FFFFFF"), 0.22));
  },
});

const sakura = faller({
  perMega: 14,
  min: 14,
  max: 36,
  size: [11, 18],
  fall: [26, 48],
  sway: [16, 36],
  swayF: [0.8, 1.6],
  spin: 1.6,
  flip: [1.5, 3.6],
  windBase: 30,
  windGust: 45,
  looks: (env) => {
    const [base, body, edge] = env.own ? [darken(env.c.a, 0.2), env.c.a, lighten(env.c.a, 0.6)] : [hex("#F07EA8"), hex("#FFC9DC"), hex("#FFF1F5")];
    const petal = looksOf(env, 30, drawSakuraPetal(base, body, edge), hex("#FFFFFF"), 0.25);
    const blossom = looksOf(env, 44, drawBlossom(base, body, edge), hex("#FFFFFF"), 0.2);
    // Casi todo pétalos sueltos; de vez en cuando, una flor entera.
    return [petal, petal, petal, petal, petal, blossom];
  },
});

const leaves = faller({
  perMega: 8,
  min: 9,
  max: 22,
  size: [22, 36],
  fall: [34, 60],
  sway: [30, 60],
  swayF: [0.9, 1.6],
  spin: 0.5,
  flip: [0.6, 1.8],
  tiltWithSway: 0.7,
  windBase: 22,
  windGust: 55,
  looks: (env) => {
    const pal: [RGB, RGB][] = env.own
      ? [
          [env.c.a, darken(env.c.a, 0.35)],
          [env.c.b, darken(env.c.b, 0.3)],
          [lighten(env.c.a, 0.2), env.c.b],
        ]
      : [
          [hex("#F2B33D"), hex("#D9772B")],
          [hex("#D9572B"), hex("#9E2F1C")],
          [hex("#E8A93A"), hex("#B2541F")],
          [hex("#C9562A"), hex("#7E2A18")],
          [hex("#E3C04F"), hex("#C98A2E")],
          [hex("#B8441E"), hex("#6B2414")],
        ];
    return pal.map(([c1, c2], i) => looksOf(env, 48, drawLeaf((i % 3) as 0 | 1 | 2, c1, c2, 9 + i), hex("#E9D8B4"), 0.3));
  },
});

const feathers = faller({
  perMega: 5,
  min: 6,
  max: 13,
  size: [46, 74],
  fall: [16, 30],
  sway: [40, 70],
  swayF: [0.5, 0.9],
  spin: 0.15,
  flip: [0.3, 0.8],
  tiltWithSway: 0.85,
  windBase: 10,
  windGust: 25,
  looks: (env) => {
    const c = nat(env, hex("#F7F4EE"), env.c.soft, 0.35);
    const shaft = env.dark ? hex("#E9E2D6") : darken(c, 0.25);
    const tints = env.own ? [c, mix(c, env.c.a, 0.35)] : [c, mix(c, hex("#D8CFC2"), env.dark ? 0.35 : 0.15)];
    return tints.map((cc, i) => looksOf(env, 90, drawFeather(cc, shaft, 4 + i), hex("#FFFFFF"), 0.1));
  },
});

const dandelion = faller({
  perMega: 9,
  min: 10,
  max: 24,
  size: [24, 36],
  fall: [14, 26],
  sway: [16, 30],
  swayF: [0.4, 0.8],
  spin: 0.25,
  flip: [0, 0],
  rise: true,
  windBase: 26,
  windGust: 30,
  looks: (env) => {
    const c = nat(env, hex("#FBFAF6"), env.c.soft, 0.4);
    return [looksOf(env, 44, drawSeed(c, env.dark ? hex("#8A6A45") : hex("#6B4F33")), hex("#FFFFFF"), 0)];
  },
});

/* ───────────── Mariposas ───────────── */

/** Un ala (la de anterior y la posterior de un lado), con el cuerpo a la derecha del dibujo. */
function wingSprite(env: FxEnv, kind: number): Sprite {
  const N = 40;
  return sprite(N * env.dpr, N * env.dpr, (g, w, h) => {
    const fore = () => {
      g.beginPath();
      g.moveTo(w, h * 0.46);
      g.bezierCurveTo(w * 0.75, h * 0.18, w * 0.25, h * 0.02, w * 0.06, h * 0.12);
      g.bezierCurveTo(w * 0.0, h * 0.3, w * 0.18, h * 0.5, w * 0.42, h * 0.56);
      g.lineTo(w, h * 0.56);
      g.closePath();
    };
    const hind = () => {
      g.beginPath();
      g.moveTo(w, h * 0.54);
      g.bezierCurveTo(w * 0.6, h * 0.5, w * 0.18, h * 0.62, w * 0.22, h * 0.82);
      g.bezierCurveTo(w * 0.28, h * 0.98, w * 0.7, h * 0.96, w, h * 0.66);
      g.closePath();
    };
    const pal = [
      // Monarca, morfo azul, macaón amarilla, blanca de la col.
      { a: hex("#F7962A"), b: hex("#E0661A"), edge: hex("#1C130D"), dots: true, stripes: false },
      { a: hex("#3FD0FF"), b: hex("#1A4FE0"), edge: hex("#0B0F2A"), dots: false, stripes: false },
      { a: hex("#FBE88A"), b: hex("#F2CF4A"), edge: hex("#1A1712"), dots: true, stripes: true },
      { a: hex("#F7F6EF"), b: hex("#E6E3D6"), edge: hex("#3A3A3A"), dots: false, stripes: false },
    ];
    const own = { a: lighten(env.c.a, 0.15), b: env.c.b, edge: darken(env.c.a, 0.75), dots: true, stripes: false };
    const p = env.own ? own : pal[kind % pal.length];
    for (const [shape, k] of [
      [hind, 0],
      [fore, 1],
    ] as const) {
      shape();
      const gr = g.createRadialGradient(w, h * 0.5, w * 0.05, w * 0.9, h * 0.5, w * 0.95);
      gr.addColorStop(0, rgba(darken(p.b, 0.2), 1));
      gr.addColorStop(0.45, rgba(p.a, 1));
      gr.addColorStop(1, rgba(p.b, 1));
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      // Las venas.
      g.strokeStyle = rgba(p.edge, kind === 3 && !env.own ? 0.18 : 0.6);
      g.lineWidth = Math.max(0.5, w * 0.018);
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(w, h * (k ? 0.5 : 0.6));
        const tx = w * (k ? 0.05 + i * 0.07 : 0.2 + i * 0.1);
        const ty = h * (k ? 0.12 + i * 0.07 : 0.85 + (i % 2) * 0.06);
        g.quadraticCurveTo(w * 0.6, (h * (k ? 0.5 : 0.6) + ty) / 2, tx, ty);
        g.stroke();
      }
      if (p.stripes) {
        g.fillStyle = rgba(p.edge, 0.85);
        for (let i = 0; i < 3; i++) {
          g.save();
          g.translate(w * (0.25 + i * 0.2), h * 0.1);
          g.rotate(0.35);
          g.fillRect(0, 0, w * 0.07, h * 0.6);
          g.restore();
        }
      }
      if (kind === 3 && !env.own && k) {
        g.fillStyle = "rgba(40,40,40,.85)";
        g.beginPath();
        g.ellipse(w * 0.12, h * 0.18, w * 0.16, h * 0.1, -0.4, 0, TAU);
        g.fill();
        g.beginPath();
        g.arc(w * 0.42, h * 0.36, w * 0.05, 0, TAU);
        g.fill();
      }
      g.restore();
      // El borde oscuro (ancho en las monarcas y los morfos) con sus puntitos claros.
      shape();
      g.strokeStyle = rgba(p.edge, 0.95);
      g.lineWidth = w * (kind === 3 && !env.own ? 0.02 : 0.07);
      g.stroke();
      if (p.dots) {
        g.fillStyle = "rgba(255,255,255,.85)";
        const pts = k
          ? [
              [0.1, 0.18],
              [0.08, 0.28],
              [0.14, 0.4],
              [0.24, 0.48],
            ]
          : [
              [0.26, 0.8],
              [0.36, 0.9],
              [0.5, 0.92],
            ];
        for (const [x, y] of pts) {
          g.beginPath();
          g.arc(w * x, h * y, w * 0.018, 0, TAU);
          g.fill();
        }
      }
    }
  });
}

type Fly = { x: number; y: number; head: number; v: number; ph: number; f: number; glide: number; kind: number; size: number; id: number };

const butterflies: EffectFactory = (env) => {
  const r = rng(131);
  const n = makeNoise(131);
  const wings = [0, 1, 2, 3].map((k) => wingSprite(env, k));
  const body = env.own ? darken(env.c.a, 0.8) : hex("#1B1510");
  let list: Fly[] = [];
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 4, 5, 11) }, (_, i) => ({
      x: r() * e.w,
      y: r.range(0.1, 0.9) * e.h,
      head: r() * TAU,
      v: r.range(55, 95) * Math.max(0.45, e.k),
      ph: r() * TAU,
      f: r.range(7, 10),
      glide: 0,
      kind: i % 4,
      size: r.range(28, 44) * Math.max(0.4, e.k),
      id: i * 7.3,
    }));
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      g.globalCompositeOperation = "source-over";
      for (const b of list) {
        // Rumbo que va cambiando suave; vuelve hacia dentro si se sale.
        b.head += n(t * 0.35, b.id, 1) * 2.4 * dt;
        const mx = e.w * 0.08;
        const my = e.h * 0.08;
        const want = b.x < -mx ? 0 : b.x > e.w + mx ? Math.PI : b.y < -my ? Math.PI / 2 : b.y > e.h + my ? -Math.PI / 2 : null;
        if (want !== null) b.head += Math.atan2(Math.sin(want - b.head), Math.cos(want - b.head)) * 1.6 * dt;
        // A ratos planea con las alas abiertas.
        const glide = n(t * 0.25, b.id, 5) > 0.45;
        b.ph += (glide ? 0 : b.f * TAU) * dt;
        const open = glide ? 0.92 : 0.18 + 0.82 * (0.5 + 0.5 * Math.cos(b.ph));
        const lift = glide ? 6 : -Math.sin(b.ph) * 26;
        b.x += Math.cos(b.head) * b.v * dt;
        b.y += (Math.sin(b.head) * b.v + lift) * dt * (glide ? 0.8 : 1);
        const rot = b.head + Math.PI / 2;
        const W = wings[b.kind];
        // Sombra suave sobre los fondos claros.
        if (!e.dark) {
          g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
          g.globalAlpha = 0.12;
          g.fillStyle = "#000";
          g.beginPath();
          g.ellipse(b.x + 8, b.y + 14, b.size * 0.5 * open, b.size * 0.22, rot, 0, TAU);
          g.fill();
        }
        drawRot(g, W, e.dpr, 40, b.x - Math.cos(rot) * b.size * 0.25 * open, b.y - Math.sin(rot) * b.size * 0.25 * open, b.size / 2, rot, open, 1, 0.95);
        drawRot(g, W, e.dpr, 40, b.x + Math.cos(rot) * b.size * 0.25 * open, b.y + Math.sin(rot) * b.size * 0.25 * open, b.size / 2, rot, -open, 1, 0.95);
        // El cuerpo y las antenas.
        g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
        g.save();
        g.translate(b.x, b.y);
        g.rotate(rot);
        g.globalAlpha = 0.95;
        g.fillStyle = rgba(body, 1);
        g.beginPath();
        g.ellipse(0, 0, b.size * 0.045, b.size * 0.26, 0, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(body, 0.9);
        g.lineWidth = Math.max(0.5, b.size * 0.018);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(0, -b.size * 0.22);
          g.quadraticCurveTo(s * b.size * 0.06, -b.size * 0.36, s * b.size * 0.13, -b.size * 0.44);
          g.stroke();
          g.beginPath();
          g.arc(s * b.size * 0.13, -b.size * 0.44, b.size * 0.018, 0, TAU);
          g.fill();
        }
        g.restore();
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Luciérnagas ───────────── */

type Bug = { x: number; y: number; z: number; P: number; off: number; dbl: boolean; id: number };

const fireflies: EffectFactory = (env) => {
  const r = rng(141);
  const n = makeNoise(141);
  const core = env.own ? lighten(env.c.a, 0.6) : hex("#FFFBD0");
  const halo = nat(env, hex("#C8FF5A"), env.c.a, 0.5);
  const spriteG = glow(halo, 64, 0.06, 1.6);
  const spriteC = glow(env.dark ? core : halo, 24, 0.25, 1.4);
  const ground = env.dark ? halo : darken(halo, 0.1);
  let list: Bug[] = [];
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 18, 14, 46) }, (_, i) => ({
      x: r() * e.w,
      y: r.range(0.25, 1) * e.h,
      z: Math.pow(r(), 1.5),
      P: r.range(2.6, 6),
      off: r() * 10,
      dbl: r() < 0.3,
      id: i * 3.7,
    }));
  };
  fill(env);
  const flash = (p: number) => (p < 0.07 ? Math.pow(p / 0.07, 2) : p < 0.5 ? Math.exp(-(p - 0.07) * 11) : 0);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      // El resplandor del suelo, muy suave.
      const gr = g.createLinearGradient(0, e.h, 0, e.h * 0.55);
      gr.addColorStop(0, rgba(ground, e.dark ? 0.1 : 0.08));
      gr.addColorStop(1, rgba(ground, 0));
      g.fillStyle = gr;
      g.fillRect(0, e.h * 0.55, e.w, e.h * 0.45);
      g.globalCompositeOperation = addMode(e);
      const k = Math.max(0.45, e.k);
      for (const b of list) {
        b.x += n(b.x * 0.003, b.y * 0.003, t * 0.08 + b.id) * 26 * k * dt;
        b.y += (n(b.x * 0.003 + 40, b.y * 0.003, t * 0.08 + b.id) * 18 - 2) * k * dt;
        if (b.x < -30) b.x = e.w + 20;
        if (b.x > e.w + 30) b.x = -20;
        if (b.y < e.h * 0.15) b.y += 1;
        if (b.y > e.h + 20) b.y = e.h * 0.9;
        const ph = (((t + b.off) % b.P) + b.P) % b.P / b.P;
        let f = flash(ph);
        if (b.dbl) f = Math.max(f, 0.8 * flash(ph - 0.16));
        const near = b.z > 0.8;
        const size = (near ? 24 : 7 + b.z * 9) * k;
        drawR(g, spriteG, b.x, b.y, size * (1 + f * 0.6), (0.04 + f * (near ? 0.35 : 0.85)) * (e.dark ? 1 : 0.7));
        if (!near) drawR(g, spriteC, b.x, b.y, 2.2 * k, 0.15 + f * 0.85);
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Nieve ───────────── */

type Flake = { x: number; y: number; z: number; s: number; vy: number; ph: number; f: number; sw: number; crystal: boolean; rot: number; vr: number };

/** Un copo con forma (estrella de seis brazos con sus ramitas), para los que se ven de cerca. */
function crystal(c: RGB, S: number): Sprite {
  return sprite(S, S, (g, w) => {
    g.translate(w / 2, w / 2);
    g.strokeStyle = rgba(c, 0.95);
    g.lineCap = "round";
    g.lineWidth = Math.max(0.8, w * 0.045);
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i * TAU) / 6);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -w * 0.46);
      for (const k of [0.2, 0.32]) {
        const L = w * (0.42 - k) * 0.6;
        g.moveTo(0, -w * k);
        g.lineTo(-L, -w * k - L);
        g.moveTo(0, -w * k);
        g.lineTo(L, -w * k - L);
      }
      g.stroke();
      g.restore();
    }
  });
}

const snow: EffectFactory = (env) => {
  const r = rng(151);
  const n = makeNoise(151);
  const c = env.own ? env.c.soft : env.dark ? hex("#F6F9FF") : hex("#FFFFFF");
  const soft = sprite(32 * env.dpr, 32 * env.dpr, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, rgba(c, 1));
    gr.addColorStop(0.4, rgba(c, 0.85));
    gr.addColorStop(0.7, rgba(env.dark ? c : hex("#B9C3D0"), env.dark ? 0.25 : 0.5));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
  const bokeh = blurred(soft, 3 * env.dpr);
  const cry = crystal(env.dark ? c : hex("#C9D3E0"), 28 * env.dpr);
  let list: Flake[] = [];
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 110, 60, 260) }, () => {
      const z = Math.pow(r(), 1.8);
      return {
        x: r() * e.w,
        y: r() * e.h,
        z,
        s: (1.6 + z * 5.5 + (z > 0.9 ? 6 : 0)) * Math.max(0.4, e.k),
        vy: (22 + z * 90) * Math.max(0.5, e.k),
        ph: r() * TAU,
        f: r.range(0.6, 1.6),
        sw: r.range(6, 22) * (0.4 + z),
        crystal: z > 0.45 && z < 0.85 && r() < 0.18,
        rot: r() * TAU,
        vr: r.range(-0.8, 0.8),
      };
    });
    list.sort((a, b) => a.z - b.z);
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      const wv = wind(n, t, 10, 38) * Math.max(0.5, e.k);
      g.globalCompositeOperation = "source-over";
      for (const f of list) {
        f.ph += f.f * dt;
        f.x += (wv * (0.3 + f.z) + Math.sin(f.ph) * f.sw) * dt;
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
        if (f.y > e.h + 20) {
          f.y = -20;
          f.x = r() * e.w;
        }
        if (f.x > e.w + 20) f.x -= e.w + 40;
        if (f.x < -20) f.x += e.w + 40;
        const a = 0.35 + f.z * 0.6;
        if (f.crystal) drawRot(g, cry, e.dpr, 28, f.x, f.y, f.s * 2.2, f.rot, 1, 1, a);
        else if (f.z > 0.9) drawRot(g, bokeh, e.dpr, 32, f.x, f.y, f.s * 2.4, 0, 1, 1, 0.45);
        else drawRot(g, soft, e.dpr, 32, f.x, f.y, f.s * 1.6, 0, 1, 1, a);
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Niebla ───────────── */

function fogStrip(seed: number, c: RGB, dens: number): Sprite {
  return noiseTexture(420, 110, seed, (n: Noise3, u, v) => {
    const f = loopNoise(n, u, v * 0.45, 4.5, 5);
    const prof = Math.pow(Math.sin(Math.PI * v), 1.6);
    const a = smooth(-0.35, 0.65, f) * prof * dens;
    return [c[0], c[1], c[2], Math.round(clamp(a) * 255)];
  });
}

const mist: EffectFactory = (env) => {
  const c = env.own ? env.c.soft : env.dark ? hex("#D7DEEA") : hex("#8E98A6");
  const layers = [
    { y: 0.18, h: 0.34, speed: 3, a: 0.22, tex: [fogStrip(1, c, 0.7), fogStrip(2, c, 0.7)] },
    { y: 0.42, h: 0.42, speed: 6, a: 0.34, tex: [fogStrip(3, c, 0.85), fogStrip(4, c, 0.85)] },
    { y: 0.62, h: 0.42, speed: 10, a: 0.42, tex: [fogStrip(5, c, 0.95), fogStrip(6, c, 0.95)] },
    { y: 0.78, h: 0.36, speed: 15, a: 0.5, tex: [fogStrip(7, c, 1), fogStrip(8, c, 1)] },
  ];
  return {
    frame(g, e, t) {
      g.globalCompositeOperation = "source-over";
      for (const L of layers) {
        const w = Math.max(e.w * 1.4, 600);
        const h = e.h * L.h;
        const y = e.h * L.y - h / 2 + Math.sin(t * 0.05 + L.speed) * h * 0.06;
        L.tex.forEach((tex, i) => {
          const sp = L.speed * (i ? 1.7 : 1) * Math.max(0.4, e.k);
          const off = (((t * sp) % w) + w) % w;
          g.globalAlpha = L.a * (e.dark ? 1 : 0.75) * (0.75 + 0.25 * Math.sin(t * 0.07 + i * 2 + L.y * 9));
          for (let x = -off; x < e.w; x += w) g.drawImage(tex, x, y, w, h);
        });
      }
      g.globalAlpha = 1;
    },
  };
};

export const NATURE: Partial<Record<Decor, EffectFactory>> = {
  petals,
  sakura,
  leaves,
  butterflies,
  feathers,
  dandelion,
  fireflies,
  snow,
  mist,
};
