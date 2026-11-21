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
  lum,
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

/* ───────────── Lo que cae dando vueltas (pétalos, flores, hojas) ───────────── */

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
      q.y = anywhere ? r() * e.h : -q.size * 2;
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
          p.y += p.vy * speedUp * dt;
          p.rot += p.vr * dt;
          p.flip += p.vf * dt;
          const m = p.size * 2.5;
          if (p.y > e.h + m) spawn(e, p, false);
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

/* ───────────── Plumas ───────────── */

type FeatherKind = { c: RGB; barb: RGB; shaft: RGB; shade: number; bars?: RGB; tip?: RGB };

/**
 * Pluma de contorno: el cañón hueco abajo, el plumón suelto, el raquis que se afina hasta la punta y las dos
 * banderas (una algo más estrecha) hechas de cientos de barbas que salen en diagonal hacia la punta, con alguna
 * abierta. Algunas llevan franjas (como las de un ave rapaz) o la punta más oscura.
 */
function drawFeather(k: FeatherKind, seed: number) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed);
    const L = h * 0.9;
    const y0 = h * 0.955;
    const bend = w * r.range(0.025, 0.06) * r.sign();
    const P = (t: number): [number, number] => [w / 2 + bend * Math.sin(Math.PI * t) - bend * 0.25 * t, y0 - t * L];
    const tan = (t: number): [number, number] => {
      const [ax, ay] = P(Math.max(0, t - 0.01));
      const [bx, by] = P(Math.min(1, t + 0.01));
      const m = Math.hypot(bx - ax, by - ay) || 1;
      return [(bx - ax) / m, (by - ay) / m];
    };
    /** Hacia fuera, por el lado s (-1 izquierda, 1 derecha). */
    const nor = (t: number, s: number): [number, number] => {
      const [tx, ty] = tan(t);
      return [-ty * s, tx * s];
    };
    const T0 = 0.2;
    const maxW = w * 0.2;
    const left = r.range(0.74, 0.88);
    const half = (t: number, s: number) => {
      const u = clamp((t - T0) / (1 - T0));
      const ue = u < 0.4 ? (u / 0.4) * 0.5 : 0.5 + ((u - 0.4) / 0.6) * 0.5;
      return maxW * (s < 0 ? left : 1) * Math.pow(Math.sin(Math.PI * ue), 0.55);
    };
    const edge = (t: number, s: number, f = 1): [number, number] => {
      const [x, y] = P(t);
      const [nx, ny] = nor(t, s);
      const W = half(t, s) * f;
      return [x + nx * W, y + ny * W];
    };
    /** Una barba: del raquis (en t) al borde, en diagonal hacia la punta y algo arqueada. */
    const barb = (t: number, s: number) => {
      const W = half(t, s);
      const te = Math.min(1, t + (W * 0.85) / L);
      const [bx, by] = P(t);
      const [ex, ey] = edge(te, s);
      const [nx, ny] = nor(t, s);
      const mx = (bx + ex) / 2 + nx * W * 0.08;
      const my = (by + ey) / 2 + ny * W * 0.08;
      const at = (u: number): [number, number] => [
        (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * mx + u * u * ex,
        (1 - u) * (1 - u) * by + 2 * (1 - u) * u * my + u * u * ey,
      ];
      return { bx, by, mx, my, ex, ey, W, at };
    };
    g.lineCap = "round";
    g.lineJoin = "round";

    // La bandera: un velo continuo, un poco por dentro del borde (el borde lo hacen las puntas de las barbas).
    const vane = new Path2D();
    const [vx0, vy0] = P(T0);
    vane.moveTo(vx0, vy0);
    for (let i = 0; i <= 60; i++) vane.lineTo(...edge(T0 + (i / 60) * (1 - T0), -1, 0.93));
    for (let i = 60; i >= 0; i--) vane.lineTo(...edge(T0 + (i / 60) * (1 - T0), 1, 0.93));
    vane.closePath();
    g.fillStyle = rgba(k.c, 0.6);
    g.fill(vane);

    // Las barbas, una a una, con su brillo y alguna más oscura (la textura de la pluma).
    const lw = Math.max(0.45, w * 0.0042);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 120; i++) {
        const b = barb(T0 + 0.005 + (i / 120) * (1 - T0 - 0.01), s);
        if (b.W < 0.6) continue;
        g.lineWidth = lw;
        g.strokeStyle = rgba(r() < 0.2 ? darken(k.c, 0.14) : k.barb, r.range(0.3, 0.62));
        g.beginPath();
        g.moveTo(b.bx, b.by);
        g.quadraticCurveTo(b.mx, b.my, b.ex, b.ey);
        g.stroke();
      }
    }

    // Franjas en «V» siguiendo las barbas, la punta oscura y el volumen (un lado a la luz, el otro en sombra).
    g.globalCompositeOperation = "source-atop";
    if (k.bars) {
      g.strokeStyle = rgba(k.bars, 0.45);
      g.lineWidth = L * 0.032;
      for (let t = T0 + 0.1; t < 0.95; t += 0.085)
        for (const s of [-1, 1]) {
          const b = barb(t, s);
          g.beginPath();
          g.moveTo(b.bx, b.by);
          g.quadraticCurveTo(b.mx, b.my, b.ex, b.ey);
          g.stroke();
        }
    }
    if (k.tip) {
      const [tx, ty] = P(1);
      const gr = g.createRadialGradient(tx, ty, 0, tx, ty, L * 0.38);
      gr.addColorStop(0, rgba(k.tip, 0.75));
      gr.addColorStop(1, rgba(k.tip, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    const sh = g.createLinearGradient(w / 2 - maxW, 0, w / 2 + maxW, 0);
    sh.addColorStop(0, "rgba(255,255,255,.16)");
    sh.addColorStop(0.45, "rgba(255,255,255,0)");
    sh.addColorStop(0.55, "rgba(0,0,0,0)");
    sh.addColorStop(1, `rgba(0,0,0,${k.shade})`);
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);

    // Barbas que se han abierto (las rendijas de una pluma de verdad).
    g.globalCompositeOperation = "destination-out";
    g.strokeStyle = "rgba(0,0,0,1)";
    const gaps = 2 + Math.floor(r() * 3);
    for (let i = 0; i < gaps; i++) {
      const b = barb(r.range(T0 + 0.12, 0.88), r.sign());
      const f0 = r.range(0.2, 0.55);
      g.lineWidth = Math.max(1, w * r.range(0.007, 0.013));
      g.beginPath();
      for (let j = 0; j <= 10; j++) {
        const [x, y] = b.at(f0 + ((1.15 - f0) * j) / 10);
        if (j) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";

    // El plumón de abajo: suelto, rizado, sin trabar.
    g.lineWidth = Math.max(0.4, w * 0.0035);
    for (let i = 0; i < 46; i++) {
      const t = r.range(0.07, T0 + 0.06);
      const [x, y] = P(t);
      const [nx, ny] = nor(t, r.sign());
      const [tx, ty] = tan(t);
      const a = r.range(-0.7, 0.9);
      const len = w * r.range(0.07, 0.19) * (1 - Math.abs(t - 0.16) * 2);
      const dx = nx * Math.cos(a) + tx * Math.sin(a);
      const dy = ny * Math.cos(a) + ty * Math.sin(a);
      const ex = x + dx * len;
      const ey = y + dy * len;
      const j = () => r.range(-1, 1) * len * 0.3;
      g.strokeStyle = rgba(k.barb, r.range(0.18, 0.38));
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + dx * len * 0.4 + j(), y + dy * len * 0.4 + j(), ex + j(), ey + j(), ex, ey);
      g.stroke();
    }

    // El cañón (hueco, algo transparente) y el raquis, que se afina hasta la punta, con su brillo.
    const tube = (t0: number, t1: number, w0: number, w1: number) => {
      const N = 24;
      const side = (s: number) =>
        Array.from({ length: N + 1 }, (_, i) => {
          const t = t0 + ((t1 - t0) * i) / N;
          const [x, y] = P(t);
          const [nx, ny] = nor(t, s);
          const hw = (w0 + ((w1 - w0) * i) / N) / 2;
          return [x + nx * hw, y + ny * hw] as const;
        });
      g.beginPath();
      side(1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      side(-1)
        .reverse()
        .forEach(([x, y]) => g.lineTo(x, y));
      g.closePath();
    };
    tube(0, 0.12, w * 0.026, w * 0.022);
    g.fillStyle = rgba(k.shaft, 0.5);
    g.fill();
    g.strokeStyle = rgba(k.shaft, 0.85);
    g.lineWidth = Math.max(0.5, w * 0.004);
    g.stroke();
    tube(0.11, 1, w * 0.021, w * 0.003);
    g.fillStyle = rgba(k.shaft, 0.95);
    g.fill();
    g.strokeStyle = rgba(lighten(k.shaft, 0.6), 0.6);
    g.lineWidth = Math.max(0.4, w * 0.004);
    g.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = 0.02 + (i / 30) * 0.8;
      const [x, y] = P(t);
      const [nx, ny] = nor(t, -1);
      const o = w * 0.005 * (1 - t);
      if (i) g.lineTo(x + nx * o, y + ny * o);
      else g.moveTo(x + nx * o, y + ny * o);
    }
    g.stroke();
  };
}

/** Los colores de las plumas: blancas, marfil y grises sobre lo oscuro; blanca, gris paloma y parda con franjas sobre lo claro. */
function featherKinds(env: FxEnv): FeatherKind[] {
  if (env.own) {
    const c = env.dark || lum(env.c.soft) <= 0.55 ? env.c.soft : darken(env.c.soft, 0.3);
    return [c, mix(c, env.c.a, 0.4)].map((cc) => ({
      c: cc,
      barb: env.dark ? lighten(cc, 0.25) : darken(cc, 0.1),
      shaft: env.dark ? lighten(cc, 0.35) : darken(cc, 0.25),
      shade: 0.14,
    }));
  }
  if (env.dark)
    return [
      { c: hex("#F3F0EA"), barb: hex("#FFFFFF"), shaft: hex("#EDE6DA"), shade: 0.12 },
      { c: hex("#E6DBC8"), barb: hex("#F6EEDF"), shaft: hex("#F1E7D6"), shade: 0.14 },
      { c: hex("#CFCBC4"), barb: hex("#E4E0DA"), shaft: hex("#E9E3D9"), shade: 0.14, bars: hex("#9C958B") },
    ];
  return [
    { c: hex("#FBFAF7"), barb: hex("#E3DED6"), shaft: hex("#B8AF9F"), shade: 0.2 },
    { c: hex("#A8A39B"), barb: hex("#BDB8B0"), shaft: hex("#8E887F"), shade: 0.16, tip: hex("#5F5A54") },
    { c: hex("#C49C6E"), barb: hex("#D6B48A"), shaft: hex("#EBDCC2"), shade: 0.16, bars: hex("#6E4C2F") },
  ];
}

/** Tamaño (px CSS) al que se pinta una pluma una vez. */
const FN = 120;
type FeatherLook = { front: Sprite; back: Sprite; near: Sprite; lit: Sprite; shadow: Sprite | null };

function featherLook(env: FxEnv, k: FeatherKind, seed: number): FeatherLook {
  const S = FN * env.dpr;
  const front = sprite(S, S, drawFeather(k, seed));
  return {
    front,
    // El revés, más apagado.
    back: backOf(front, env.dark ? hex("#BDB6AB") : hex("#7E776D"), 0.18),
    near: blurred(front, 2.6 * env.dpr),
    // La silueta en blanco: el brillo cuando la pluma se pone de cara a la luz.
    lit: backOf(front, [255, 255, 255], 1),
    // Sobre lo claro, una sombra suave (si no, una pluma blanca no se vería).
    shadow: env.dark ? null : blurred(backOf(front, [40, 34, 28], 1), 4 * env.dpr),
  };
}

/** Una pizca de plumón suelto: hilos rizados que salen de un punto. */
function downTuft(c: RGB, seed: number, dpr: number): Sprite {
  const S = 28 * dpr;
  return sprite(S, S, (g) => {
    const r = rng(seed);
    const cx = S / 2;
    const cy = S / 2;
    g.lineCap = "round";
    g.lineWidth = Math.max(0.4, S * 0.012);
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU;
      const len = S * r.range(0.18, 0.46);
      const b = a + r.range(-0.9, 0.9);
      g.strokeStyle = rgba(c, r.range(0.3, 0.6));
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + Math.cos(b) * len * 0.6, cy + Math.sin(b) * len * 0.6, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.stroke();
    }
    g.fillStyle = rgba(c, 0.7);
    g.beginPath();
    g.arc(cx, cy, S * 0.03, 0, TAU);
    g.fill();
  });
}

type Feather = { x: number; y: number; z: number; size: number; base: number; th: number; f: number; A: number; H: number; vy: number; roll: number; vr: number; look: number; id: number };
type Fluff = { x: number; y: number; z: number; s: number; rot: number; vr: number; v: number; id: number };

/**
 * Plumas que caen como de verdad: en vaivén de péndulo (bajan deprisa en el centro del balanceo y casi se paran, o
 * suben un poco, en los extremos), inclinándose con él, girando despacio sobre su eje y con alguna racha de viento.
 * Además, pizcas de plumón que casi flotan.
 */
const feathers: EffectFactory = (env) => {
  const r = rng(131);
  const n = makeNoise(131);
  const kinds = featherKinds(env);
  const looks = kinds.map((k, i) => featherLook(env, k, 4 + i * 3));
  const tuftC = env.dark ? lighten(kinds[0].c, 0.2) : darken(kinds[0].barb, 0.15);
  const tufts = [0, 1, 2].map((i) => downTuft(tuftC, 60 + i, env.dpr));
  let list: Feather[] = [];
  let fluff: Fluff[] = [];
  const spawn = (e: FxEnv, p: Feather | null, anywhere: boolean): Feather => {
    const kk = Math.max(0.4, e.k);
    // Al volver a salir conserva su profundidad (así el orden de dibujo sigue bien).
    const q = p ?? ({ z: Math.pow(r(), 1.3), id: r() * 100 } as Feather);
    const z = q.z;
    q.size = r.range(56, 92) * (0.42 + z * 0.9) * kk;
    q.f = r.range(0.45, 0.8);
    q.A = r.range(26, 58) * (0.5 + z * 0.7) * kk;
    q.H = r.range(5, 12) * (0.5 + z * 0.7) * kk;
    q.vy = r.range(13, 24) * (0.45 + z * 0.7) * kk;
    // Casi tumbada, con el cañón (que pesa más) algo más bajo que la punta.
    q.base = r.sign() * r.range(0.65, 1.35);
    q.th = r() * TAU;
    q.roll = r() * TAU;
    q.vr = r.range(0.06, 0.24) * r.sign();
    q.look = Math.floor(r() * looks.length);
    q.x = r.range(-0.05, 1.05) * e.w;
    q.y = anywhere ? r() * e.h : -q.size;
    return q;
  };
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 5, 6, 13) }, () => spawn(e, null, true)).sort((a, b) => a.z - b.z);
    fluff = Array.from({ length: count(e, 7, 6, 16) }, (_, i) => ({
      x: r() * e.w,
      y: r() * e.h,
      z: r(),
      s: r.range(8, 18) * Math.max(0.4, e.k),
      rot: r() * TAU,
      vr: r.range(-0.4, 0.4),
      v: i % tufts.length,
      id: r() * 100,
    }));
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      const kk = Math.max(0.4, e.k);
      const wv = wind(n, t, 10, 26) * kk;
      const gust = clamp((wv / kk - 10) / 26 + 0.4);
      g.globalCompositeOperation = "source-over";
      for (const d of fluff) {
        d.x += (wv * 0.6 + n(d.x * 0.004, d.y * 0.004, t * 0.1 + d.id) * 22 * kk) * dt;
        d.y += (4 + n(d.id, t * 0.08, 3) * 9) * kk * dt;
        d.rot += d.vr * dt;
        if (d.y > e.h + 20) d.y = -20;
        else if (d.y < -20) d.y = e.h + 20;
        if (d.x > e.w + 20) d.x = -20;
        else if (d.x < -20) d.x = e.w + 20;
        drawRot(g, tufts[d.v], e.dpr, 28, d.x, d.y, d.s * (0.6 + d.z * 0.7), d.rot, 1, 1, 0.3 + d.z * 0.4);
      }
      for (const p of list) {
        p.th += p.f * dt * (1 + 0.35 * gust);
        const s = Math.sin(p.th);
        const turb = n(p.x * 0.003, p.y * 0.003, t * 0.12 + p.id) * 16 * kk;
        p.x += (wv * (0.4 + 0.8 * p.z) + p.A * p.f * Math.cos(p.th) + turb) * dt;
        p.y += (p.vy - 2 * p.H * p.f * Math.sin(2 * p.th)) * dt;
        p.roll += p.vr * dt;
        const m = p.size;
        if (p.y > e.h + m) spawn(e, p, false);
        if (p.x > e.w + m) p.x -= e.w + 2 * m;
        else if (p.x < -m) p.x += e.w + 2 * m;
        const L = looks[p.look];
        // Se inclina con el balanceo (sigue el arco que dibuja) y gira sobre su eje: se estrecha de canto, nunca se acorta.
        const rot = p.base - 0.42 * s + 0.08 * n(t * 0.3, p.id, 1);
        const roll = p.roll + 0.55 * s;
        const cr = Math.cos(roll);
        const sx = Math.max(0.13, Math.abs(cr));
        const near = p.z > 0.88;
        const a = (0.5 + p.z * 0.45) * (near ? 0.7 : 1) * (0.8 + 0.2 * sx);
        if (L.shadow && !near) drawRot(g, L.shadow, e.dpr, FN, p.x + 4 + p.z * 6, p.y + 7 + p.z * 9, p.size, rot, sx, 1, a * 0.16);
        drawRot(g, near ? L.near : cr >= 0 ? L.front : L.back, e.dpr, FN, p.x, p.y, p.size, rot, sx, 1, a);
        const lit = Math.pow(clamp(0.5 + 0.5 * Math.cos(roll - 0.7)), 3);
        if (lit > 0.05 && !near) {
          g.globalCompositeOperation = addMode(e);
          drawRot(g, L.lit, e.dpr, FN, p.x, p.y, p.size, rot, sx, 1, a * lit * (e.dark ? 0.2 : 0.16));
          g.globalCompositeOperation = "source-over";
        }
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Diente de león ───────────── */

/** Tamaño (px CSS) al que se pinta una semilla, y desde cuántos ángulos (de perfil a vista desde abajo). */
const SEED_N = 56;
const VIEW_STEP = (16 * Math.PI) / 180;
const VIEWS = 6;

/**
 * Una semilla vista inclinada `psi` (0 de perfil, ~80° casi desde abajo): el vilano (64 hilos que se abren en
 * paraguas, cada uno con sus pelillos sedosos en la mitad de fuera), el pico largo y fino y la semilla parda con
 * sus espinitas. El centro del dibujo es el nudo donde se juntan los hilos (de ahí cuelga la semilla).
 */
function seedView(c: RGB, seedC: RGB, psi: number, dpr: number, seed: number): Sprite {
  const S = SEED_N * dpr;
  return sprite(S, S, (g) => {
    const r = rng(seed);
    const cx = S / 2;
    const cy = S / 2;
    const P = S * 0.4;
    const B = S * 0.3;
    const A = S * 0.1;
    const cp = Math.cos(psi);
    const sp = Math.sin(psi);
    const bow = -S * 0.025 * cp;
    g.lineCap = "round";
    const fil = Array.from({ length: 64 }, (_, i) => {
      const phi = (i / 64) * TAU + r.range(-0.05, 0.05);
      const beta = r.range(1.16, 1.36);
      const len = P * r.range(0.88, 1.03);
      const dx = Math.sin(beta) * Math.cos(phi);
      const dy = Math.cos(beta);
      const dz = Math.sin(beta) * Math.sin(phi);
      return { ex: cx + dx * len, ey: cy - (dy * cp - dz * sp) * len, z: dy * sp + dz * cp };
    }).sort((a, b) => a.z - b.z);
    const lw = Math.max(0.45, S * 0.0055);
    for (const f of fil) {
      const a = 0.34 + 0.3 * (f.z * 0.5 + 0.5);
      g.strokeStyle = rgba(c, a);
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo((cx + f.ex) / 2, (cy + f.ey) / 2 + bow, f.ex, f.ey);
      g.stroke();
      const ang = Math.atan2(f.ey - cy, f.ex - cx);
      g.strokeStyle = rgba(c, a * 0.45);
      g.lineWidth = lw * 0.7;
      g.beginPath();
      for (let j = 0; j < 5; j++) {
        const u = 0.5 + j * 0.115;
        const px = cx + (f.ex - cx) * u;
        const py = cy + (f.ey - cy) * u + 2 * u * (1 - u) * bow;
        const hl = S * 0.028 * (0.5 + u * 0.6);
        for (const sd of [-0.6, 0.6]) {
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(ang + sd) * hl, py + Math.sin(ang + sd) * hl);
        }
      }
      g.stroke();
    }
    g.fillStyle = rgba(c, 0.9);
    g.beginPath();
    g.arc(cx, cy, S * 0.011, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(mix(c, seedC, 0.25), 0.8);
    g.lineWidth = Math.max(0.5, S * 0.0065);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx, cy + B * cp);
    g.stroke();
    const ay = cy + (B + A * 0.5) * cp;
    const ry = Math.max(S * 0.02, A * 0.5 * cp);
    const gr = g.createLinearGradient(cx - S * 0.02, 0, cx + S * 0.02, 0);
    gr.addColorStop(0, rgba(lighten(seedC, 0.3), 1));
    gr.addColorStop(1, rgba(darken(seedC, 0.3), 1));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, ay, S * 0.021, ry, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(darken(seedC, 0.2), 0.8);
    g.lineWidth = Math.max(0.4, S * 0.004);
    g.beginPath();
    for (const sd of [-1, 1]) {
      g.moveTo(cx + sd * S * 0.018, ay - ry * 0.55);
      g.lineTo(cx + sd * S * 0.03, ay - ry * 0.75 - S * 0.006);
    }
    g.stroke();
  });
}

type Seed = { x: number; y: number; z: number; size: number; lift: number; ph: number; id: number };

/**
 * Dientes de león: solo las semillas, que viajan con la brisa, suben y bajan con las corrientes y se inclinan
 * colgando de su paraguas, vistas desde distintos ángulos (las más cercanas, algo desenfocadas).
 */
const dandelion: EffectFactory = (env) => {
  const r = rng(141);
  const n = makeNoise(141);
  const c = nat(env, hex("#FBFAF6"), env.c.soft, 0.4);
  const seedC = env.dark ? hex("#9A7650") : hex("#6B4F33");
  const views = Array.from({ length: VIEWS }, (_, i) => seedView(c, seedC, i * VIEW_STEP, env.dpr, 7));
  const nearViews = views.map((v) => blurred(v, 2.2 * env.dpr));
  const halo = glow(lighten(c, 0.2), 64, 0.05, 1.8);
  let seeds: Seed[] = [];
  let dir = 1;

  const ambient = (e: FxEnv, s: Seed | null, anywhere: boolean): Seed => {
    const kk = Math.max(0.4, e.k);
    const q = s ?? ({ z: Math.pow(r(), 1.3), id: r() * 100 } as Seed);
    q.size = r.range(22, 38) * (0.42 + q.z * 0.95) * kk;
    q.lift = r.range(3, 10);
    q.ph = r() * TAU;
    if (anywhere) {
      q.x = r() * e.w;
      q.y = r() * e.h;
    } else {
      // Entra por donde viene el viento.
      q.x = dir > 0 ? -q.size : e.w + q.size;
      q.y = r.range(0.05, 0.95) * e.h;
    }
    return q;
  };
  const layout = (e: FxEnv) => {
    seeds = Array.from({ length: count(e, 9, 10, 24) }, () => ambient(e, null, true)).sort((a, b) => a.z - b.z);
  };
  layout(env);

  const drawSeed = (g: CanvasRenderingContext2D, e: FxEnv, s: Seed, t: number) => {
    // Hacia dónde mira (de perfil o más desde abajo): se mezclan los dos dibujos más cercanos.
    const psi = clamp(0.75 + 0.6 * n(t * 0.11, s.id, 5), 0, (VIEWS - 1) * VIEW_STEP);
    const vi = psi / VIEW_STEP;
    const i0 = Math.min(VIEWS - 2, Math.floor(vi));
    const w1 = vi - i0;
    const rot = 0.25 * n(t * 0.25, s.id, 9) + 0.08 * Math.sin(t * 0.9 + s.ph);
    const near = s.z > 0.9;
    const a = (0.45 + s.z * 0.5) * (near ? 0.75 : 1);
    const set = near ? nearViews : views;
    if (e.dark) {
      g.globalCompositeOperation = "lighter";
      drawR(g, halo, s.x, s.y, s.size * 0.5, a * 0.12);
      g.globalCompositeOperation = "source-over";
    }
    drawRot(g, set[i0], e.dpr, SEED_N, s.x, s.y, s.size, rot, 1, 1, a * (1 - w1));
    drawRot(g, set[i0 + 1], e.dpr, SEED_N, s.x, s.y, s.size, rot, 1, 1, a * w1);
    g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
  };

  return {
    resize: layout,
    frame(g, e, t, dt) {
      const kk = Math.max(0.4, e.k);
      const wv = wind(n, t, 30, 30) * kk;
      dir = wv >= 0 ? 1 : -1;
      for (const s of seeds) {
        const depth = 0.45 + s.z * 0.75;
        s.x += (wv * depth + n(s.x * 0.003, s.y * 0.003, t * 0.1 + s.id) * 26 * kk) * dt;
        s.y += (-s.lift + n(s.x * 0.003 + 40, s.y * 0.003, t * 0.1 + s.id) * 24) * kk * depth * dt;
        const m = s.size;
        if (s.x > e.w + m || s.x < -m || s.y < -m || s.y > e.h + m) ambient(e, s, false);
      }
      g.globalCompositeOperation = "source-over";
      for (const s of seeds) drawSeed(g, e, s, t);
      g.globalAlpha = 1;
    },
  };
};

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
