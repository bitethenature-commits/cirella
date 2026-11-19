import type { Decor } from "@/lib/templates";
import { makeStars } from "./stars";
import {
  addMode,
  blit,
  clamp,
  count,
  drawR,
  darken,
  fbm,
  glow,
  hex,
  lighten,
  loopNoise,
  makeNoise,
  mix,
  noiseTexture,
  rgba,
  rng,
  smooth,
  sprite,
  TAU,
  type EffectFactory,
  type FxEnv,
  type RGB,
  type Sprite,
} from "./util";

/* ───────────── Estrellas ───────────── */

/** La franja de la Vía Láctea (0–1: cuánta hay en cada punto), en diagonal. */
const band = (u: number, v: number) => {
  const d = v - (0.78 - u * 0.62);
  return Math.exp(-(d * d) / 0.018);
};

/** La Vía Láctea: polvo de luz con sus vetas oscuras, muy suave. */
function milkyWay(env: FxEnv): Sprite {
  const W = 220;
  const H = Math.max(60, Math.round((W * env.h) / env.w));
  const warm = hex("#FFE9CF");
  const cool = hex("#C9D6FF");
  return noiseTexture(W, H, 7, (n, u, v) => {
    const b = band(u, v);
    if (b < 0.01) return [0, 0, 0, 0];
    const x = u * 4 * (env.w / env.h);
    const y = v * 4;
    const cloud = 0.5 + 0.5 * fbm(n, x, y, 0, 5);
    const lanes = smooth(0.15, 0.55, fbm(n, x * 1.8 + 9, y * 1.8, 2, 4));
    const a = b * cloud * (1 - 0.75 * lanes);
    const c = mix(cool, warm, clamp(cloud * 1.2 - 0.2));
    return [c[0], c[1], c[2], Math.round(clamp(a) * 120)];
  });
}

const stars: EffectFactory = (env) => {
  let field = makeStars(env, rng(11), 280, { band: env.contained ? undefined : band });
  let way = env.dark ? milkyWay(env) : null;
  return {
    resize(e) {
      field = makeStars(e, rng(11), 280, { band: e.contained ? undefined : band });
      way = e.dark ? milkyWay(e) : null;
    },
    frame(g, e, t, dt) {
      if (way) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.5 * clamp(e.starO / 0.7, 0.3, 1.3) * (0.92 + 0.08 * Math.sin(t * 0.2));
        g.drawImage(way, 0, 0, e.w, e.h);
      }
      field.draw(g, e, t, dt);
    },
  };
};

/* ───────────── Estrellas fugaces y meteoros ───────────── */

type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number; len: number; w: number; c: RGB; fire: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; c: RGB };

/** Una estrella fugaz: cabeza blanca con su halo y una estela que se afina y se apaga. */
function drawMeteor(g: CanvasRenderingContext2D, m: Meteor, head: Sprite, dpr: number, dark: boolean) {
  const p = m.age / m.life;
  const a = p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 1.3);
  const sp = Math.hypot(m.vx, m.vy) || 1;
  const dx = m.vx / sp;
  const dy = m.vy / sp;
  const len = m.len * (0.35 + 0.65 * Math.min(1, p * 4));
  const tx = m.x - dx * len;
  const ty = m.y - dy * len;
  const nx = -dy * m.w * 0.5;
  const ny = dx * m.w * 0.5;
  const gr = g.createLinearGradient(tx, ty, m.x, m.y);
  gr.addColorStop(0, rgba(m.c, 0));
  gr.addColorStop(0.65, rgba(m.c, 0.28 * a));
  gr.addColorStop(1, rgba(dark ? lighten(m.c, 0.7) : m.c, 0.95 * a));
  g.fillStyle = gr;
  g.globalAlpha = 1;
  g.beginPath();
  g.moveTo(tx, ty);
  g.lineTo(m.x + nx, m.y + ny);
  g.lineTo(m.x - nx, m.y - ny);
  g.closePath();
  g.fill();
  const hs = ((m.fire ? 16 : 9) * m.w) / (18 * dpr);
  blit(g, head, m.x, m.y, hs, 0, a);
}

function meteorShower(rate: [number, number], shower: boolean): EffectFactory {
  return (env) => {
    const r = rng(shower ? 23 : 17);
    let field = makeStars(env, r, shower ? 230 : 260);
    const white = env.dark ? hex("#F4F7FF") : env.c.soft;
    const tint = (): RGB => (!env.dark ? env.c.soft : env.own ? r.pick([env.c.b2, env.c.a2, white]) : r.pick([white, white, hex("#D8E6FF"), hex("#CFFFE0"), hex("#FFE2C2")]));
    const heads = new Map<string, Sprite>();
    const headOf = (c: RGB) => {
      const key = c.join(",");
      let s = heads.get(key);
      if (!s) heads.set(key, (s = glow(c, 18 * env.dpr, 0.1, 2.2)));
      return s;
    };
    const list: Meteor[] = [];
    const sparks: Spark[] = [];
    let next = 0.4;
    const spawn = (e: FxEnv) => {
      const fire = shower && r() < 0.07;
      let x: number;
      let y: number;
      let ang: number;
      if (shower) {
        // Todos salen del mismo punto del cielo (el radiante), arriba a la derecha.
        const rx = e.w * 0.86;
        const ry = -e.h * 0.18;
        ang = Math.PI * 0.5 + r.range(0.15, 0.85);
        const d = r.range(0.1, 0.55) * Math.hypot(e.w, e.h);
        x = rx + Math.cos(ang) * d;
        y = ry + Math.sin(ang) * d;
      } else {
        const left = r() < 0.5;
        ang = left ? Math.PI - r.range(0.25, 0.55) : r.range(0.25, 0.55);
        x = r.range(0.1, 0.9) * e.w;
        y = r.range(-0.05, 0.4) * e.h;
      }
      const speed = r.range(shower ? 900 : 700, shower ? 1700 : 1300) * Math.max(0.45, e.k);
      list.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        age: 0,
        life: fire ? r.range(1.1, 1.6) : r.range(0.45, 1.05),
        len: speed * r.range(0.1, 0.16),
        w: (fire ? r.range(3.5, 5) : r.range(1.3, 2.4)) * Math.max(0.5, e.k),
        c: fire ? (e.dark ? hex("#B9FFD8") : env.c.a) : tint(),
        fire,
      });
    };
    return {
      resize(e) {
        field = makeStars(e, rng(shower ? 23 : 17), shower ? 230 : 260);
      },
      frame(g, e, t, dt) {
        field.draw(g, e, t, dt);
        next -= dt;
        if (next <= 0) {
          spawn(e);
          next = r.range(rate[0], rate[1]);
        }
        g.globalCompositeOperation = addMode(e);
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          m.age += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.fire && r() < 0.6)
            sparks.push({ x: m.x, y: m.y, vx: m.vx * 0.05 + r.range(-40, 40), vy: m.vy * 0.05 + r.range(-20, 50), age: 0, life: r.range(0.3, 0.8), c: r.pick([hex("#FFE7B0"), hex("#B9FFD8"), white]) });
          if (m.age >= m.life) {
            list.splice(i, 1);
            continue;
          }
          drawMeteor(g, m, headOf(m.c), e.dpr, e.dark);
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.age += dt;
          if (s.age >= s.life) {
            sparks.splice(i, 1);
            continue;
          }
          s.vy += 220 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          g.globalAlpha = (1 - s.age / s.life) * 0.9;
          g.fillStyle = rgba(s.c, 1);
          g.fillRect(s.x - 0.8, s.y - 0.8, 1.6, 1.6);
        }
      },
    };
  };
}

/* ───────────── La luna ───────────── */

/** La luna de verdad: mares oscuros, cráteres con su borde, oscurecida hacia el borde y con su fase (luz desde un lado). */
function moonSprite(R: number, phase: number, dark: boolean): Sprite {
  const S = Math.ceil(R * 2);
  const n = makeNoise(5);
  const r = rng(9);
  // 1) El color de la superficie (los mares, en baja resolución: son manchas suaves).
  const lo = Math.min(S, 220);
  const albedo = noiseTexture(lo, lo, 5, (nn, u, v) => {
    const m = fbm(nn, u * 2.6, v * 2.6, 0, 4);
    const maria = smooth(0.02, 0.32, m) * 0.42;
    const fine = fbm(nn, u * 14, v * 14, 3, 3) * 0.06;
    const k = 0.86 - maria + fine;
    const base = mix(hex("#F2EEE4"), hex("#C9C2B2"), 1 - k);
    return [base[0], base[1], base[2], 255];
  });
  return sprite(S, S, (g) => {
    g.save();
    g.beginPath();
    g.arc(R, R, R, 0, TAU);
    g.clip();
    g.drawImage(albedo, 0, 0, S, S);
    // 2) Los cráteres: fondo algo más oscuro y un borde claro (achatados hacia el borde de la luna).
    for (let i = 0; i < 90; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.96;
      const cx = R + Math.cos(a) * d * R;
      const cy = R + Math.sin(a) * d * R;
      const cr = R * (0.012 + Math.pow(r(), 3) * 0.09);
      const squash = Math.sqrt(Math.max(0.15, 1 - d * d));
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.scale(squash, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, cr);
      gr.addColorStop(0, "rgba(90,82,70,.22)");
      gr.addColorStop(0.75, "rgba(90,82,70,.12)");
      gr.addColorStop(0.9, "rgba(255,252,240,.28)");
      gr.addColorStop(1, "rgba(255,252,240,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, cr, 0, TAU);
      g.fill();
      g.restore();
    }
    // Dos cráteres jóvenes con sus rayos claros.
    for (const [px, py] of [
      [0.42, 0.78],
      [0.3, 0.36],
    ]) {
      const cx = px * S;
      const cy = py * S;
      g.strokeStyle = "rgba(255,252,240,.07)";
      g.lineWidth = R * 0.012;
      for (let k = 0; k < 14; k++) {
        const ang = r() * TAU;
        const len = R * r.range(0.15, 0.55);
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        g.stroke();
      }
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.05);
      gr.addColorStop(0, "rgba(255,253,245,.75)");
      gr.addColorStop(1, "rgba(255,253,245,0)");
      g.fillStyle = gr;
      g.fillRect(cx - R * 0.05, cy - R * 0.05, R * 0.1, R * 0.1);
    }
    g.restore();
    // 3) La luz: el lado iluminado con su terminador suave y el resto con la luz cenicienta (de noche) o invisible (de día).
    const img = g.getImageData(0, 0, S, S);
    const d = img.data;
    const L = [Math.sin(phase), -0.12, Math.cos(phase)];
    const ln = Math.hypot(L[0], L[1], L[2]);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const nx = (x + 0.5 - R) / R;
        const ny = (y + 0.5 - R) / R;
        const rr = nx * nx + ny * ny;
        if (rr >= 1) {
          d[i + 3] = 0;
          continue;
        }
        const nz = Math.sqrt(1 - rr);
        const lam = (nx * L[0] + ny * L[1] + nz * L[2]) / ln;
        const lit = smooth(-0.05, 0.18, lam);
        const limb = 0.72 + 0.28 * Math.pow(nz, 0.5);
        const edge = clamp((1 - Math.sqrt(rr)) * R * 1.2);
        const shade = dark ? 0.07 + 0.93 * lit * limb : lit * limb;
        d[i] = Math.min(255, d[i] * shade + (dark ? 4 * (1 - lit) : 0));
        d[i + 1] = Math.min(255, d[i + 1] * shade + (dark ? 6 * (1 - lit) : 0));
        d[i + 2] = Math.min(255, d[i + 2] * shade + (dark ? 12 * (1 - lit) : 0));
        d[i + 3] = Math.round(255 * edge * (dark ? 1 : Math.max(lit, 0.04)));
      }
    g.putImageData(img, 0, 0);
  });
}

/** Nubes finas que pasan (se repiten a lo ancho sin costura). */
function cloudStrip(seed: number, dark: boolean): Sprite {
  const c = dark ? hex("#C9D0E0") : hex("#FFFFFF");
  return noiseTexture(360, 70, seed, (n, u, v) => {
    const f = loopNoise(n, u, v * 0.35, 5, 5);
    const vert = Math.sin(Math.PI * v);
    const a = smooth(0.0, 0.55, f) * vert * vert;
    return [c[0], c[1], c[2], Math.round(a * 200)];
  });
}

const moon: EffectFactory = (env) => {
  const r = rng(31);
  let field = makeStars(env, r, 220);
  const make = (e: FxEnv) => {
    const R = e.contained ? e.w * 0.13 : Math.min(Math.min(e.w, e.h) * 0.12, 95);
    const halo = e.own ? e.c.b : e.dark ? hex("#E6ECFF") : hex("#FFFFFF");
    return { R, body: moonSprite(R * e.dpr, 1.05, e.dark), halo: glow(halo, 160, 0, 2.4), clouds: [cloudStrip(3, e.dark), cloudStrip(8, e.dark)] };
  };
  let m = make(env);
  return {
    resize(e) {
      field = makeStars(e, rng(31), 220);
      m = make(e);
    },
    frame(g, e, t, dt) {
      const cx = e.w - e.w * 0.1 - m.R;
      const cy = e.h * 0.09 + m.R + Math.sin(t * 0.5) * 5 * e.k;
      // La luz de la luna apaga las estrellas de alrededor.
      field.draw(g, e, t, dt, (x, y) => smooth(m.R * 1.3, m.R * 5, Math.hypot(x - cx, y - cy)));
      g.globalCompositeOperation = addMode(e);
      drawR(g, m.halo, cx, cy, m.R * 3.4, e.dark ? 0.42 + 0.04 * Math.sin(t * 0.7) : 0.5);
      g.globalCompositeOperation = "source-over";
      blit(g, m.body, cx, cy, 1 / e.dpr, -0.35, 1);
      // Las nubes que pasan por delante, plateadas por la luz de la luna.
      m.clouds.forEach((cl, i) => {
        const h = m.R * (1.6 + i * 0.8);
        const w = Math.max(e.w * 0.9, m.R * 14);
        const off = ((t * (7 + i * 5) * e.k) % w + w) % w;
        const y = cy - h * 0.5 + (i ? m.R * 0.7 : -m.R * 0.2);
        g.globalAlpha = e.dark ? 0.32 - i * 0.08 : 0.22;
        for (let x = -off; x < e.w; x += w) g.drawImage(cl, x, y, w, h);
      });
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Nebulosa ───────────── */

function nebulaLayer(env: FxEnv, seed: number, c1: RGB, c2: RGB, sparse: boolean): Sprite {
  const W = 230;
  const H = Math.max(80, Math.round((W * env.h) / env.w));
  const asp = W / H;
  return noiseTexture(W, H, seed, (n, u, v) => {
    const x = u * 2.3 * asp;
    const y = v * 2.3;
    const q = fbm(n, x, y, 0, 3);
    const q2 = fbm(n, x + 5.2, y + 1.3, 1, 3);
    const w = fbm(n, x + 1.7 * q, y + 1.7 * q2, 2, 5);
    let dens = smooth(sparse ? 0.12 : -0.08, sparse ? 0.75 : 0.62, w);
    const dust = smooth(0.18, 0.58, fbm(n, x * 1.9 + 9, y * 1.9, 3, 4));
    dens *= 1 - 0.7 * dust;
    const col = mix(c1, c2, smooth(-0.4, 0.5, q));
    const hot = lighten(col, dens * dens * 0.55);
    return [hot[0], hot[1], hot[2], Math.round(clamp(dens) * 235)];
  });
}

const nebula: EffectFactory = (env) => {
  const r = rng(41);
  let field = makeStars(env, r, 240, { bright: 1.6 });
  let layers: Sprite[] = [];
  const make = (e: FxEnv) => {
    layers = [nebulaLayer(e, 3, e.c.a, e.c.b, false)];
    // La segunda capa, un fotograma después (para no pararlo todo al empezar).
    requestAnimationFrame(() => layers.push(nebulaLayer(e, 12, e.c.b2, e.c.a, true)));
  };
  make(env);
  return {
    resize(e) {
      field = makeStars(e, rng(41), 240, { bright: 1.6 });
      make(e);
    },
    frame(g, e, t, dt) {
      g.globalCompositeOperation = e.dark ? "lighter" : "source-over";
      layers.forEach((l, i) => {
        const s = 1.25 + 0.04 * Math.sin(t * 0.045 + i * 2);
        const w = e.w * s;
        const h = e.h * s;
        const ox = (e.w - w) / 2 + Math.sin(t * 0.021 + i * 1.7) * e.w * 0.04;
        const oy = (e.h - h) / 2 + Math.cos(t * 0.017 + i) * e.h * 0.035;
        g.globalAlpha = (e.dark ? (i ? 0.38 : 0.62) : i ? 0.22 : 0.34) * (0.9 + 0.1 * Math.sin(t * 0.13 + i * 3));
        g.save();
        g.translate(e.w / 2, e.h / 2);
        g.rotate(Math.sin(t * 0.008 + i) * 0.04);
        g.translate(-e.w / 2, -e.h / 2);
        g.drawImage(l, ox, oy, w, h);
        g.restore();
      });
      g.globalAlpha = 1;
      field.draw(g, e, t, dt);
    },
  };
};

/* ───────────── Constelaciones ───────────── */

const SHAPES: [number, number][][] = [
  [[12, 18], [19, 14], [26, 17], [31, 25], [40, 24], [43, 32], [35, 35]],
  [[62, 12], [68, 20], [74, 13], [80, 21], [87, 14]],
  [[70, 62], [76, 70], [84, 68], [88, 78], [79, 84], [72, 79]],
  [[10, 70], [17, 64], [22, 72], [30, 68]],
];

const constellation: EffectFactory = (env) => {
  const r = rng(51);
  let field = makeStars(env, r, 230);
  const starC = env.dark ? hex("#F4F6FF") : env.c.soft;
  const lineC = env.c.b;
  const big = glow(env.dark ? lighten(env.c.b2, 0.3) : env.c.b, 22 * env.dpr, 0.1, 2.4);
  const tw = SHAPES.map((s) => s.map(() => [r() * TAU, 0.8 + r() * 1.6]));
  return {
    resize(e) {
      field = makeStars(e, rng(51), 230);
    },
    frame(g, e, t, dt) {
      field.draw(g, e, t, dt);
      const P = 16;
      SHAPES.forEach((shape, si) => {
        const pts = shape.map(([x, y]) => [(x / 100) * e.w, (y / 100) * e.h] as const);
        const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
        const total = lens.reduce((a, b) => a + b, 0);
        const ph = (((t + si * 4.1) % P) + P) % P / P;
        const draw = ph < 0.38 ? smooth(0, 0.38, ph) : 1;
        const fade = ph < 0.78 ? 1 : 1 - smooth(0.78, 1, ph);
        // La línea que se va trazando de estrella en estrella.
        let left = draw * total;
        g.globalCompositeOperation = addMode(e);
        for (const [lw, a] of [
          [3.2, 0.1],
          [1.1, 0.55],
        ] as const) {
          g.lineWidth = lw * Math.max(0.6, e.k);
          g.strokeStyle = rgba(lineC, a * fade);
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          left = draw * total;
          for (let i = 1; i < pts.length && left > 0; i++) {
            const seg = lens[i - 1];
            const k = Math.min(1, left / seg);
            g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k);
            left -= seg;
          }
          g.stroke();
        }
        // Sus estrellas: brillan más cuando la línea llega a ellas.
        let acc = 0;
        pts.forEach(([x, y], j) => {
          const reached = j === 0 || acc / total <= draw + 0.001;
          if (j > 0) acc += lens[j - 1];
          const [p, f] = tw[si][j];
          const a = (0.55 + 0.45 * Math.sin(t * f + p)) * (reached ? 0.55 + 0.45 * fade : 0.45);
          const s = (j % 3 === 0 ? 9 : 6) * Math.max(0.6, e.k);
          blit(g, big, x, y, s / (22 * e.dpr), 0, a);
          g.globalAlpha = a;
          g.fillStyle = rgba(starC, 1);
          g.beginPath();
          g.arc(x, y, (j % 3 === 0 ? 1.6 : 1.1) * Math.max(0.6, e.k), 0, TAU);
          g.fill();
        });
      });
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Galaxia ───────────── */

type GStar = { r: number; th: number; s: number; a: number; b: number };

const galaxy: EffectFactory = (env) => {
  const r = rng(61);
  let field = makeStars(env, r, 200);
  const make = (e: FxEnv) => {
    const N = e.contained ? 2200 : count(e, 2600, 2600, 6500);
    const list: GStar[] = [];
    for (let i = 0; i < N; i++) {
      const kind = r();
      let rn: number;
      let th: number;
      if (kind < 0.16) {
        // El bulbo del centro.
        rn = Math.abs(r.gauss()) * 0.09;
        th = r() * TAU;
      } else if (kind < 0.3) {
        // El disco, sin brazos.
        rn = Math.min(1, -Math.log(1 - r() * 0.97) / 3.2);
        th = r() * TAU;
      } else {
        // Los dos brazos en espiral, más abiertos hacia fuera.
        rn = Math.min(1, 0.05 + -Math.log(1 - r() * 0.96) / 3.4);
        const arm = (i % 2) * Math.PI;
        th = arm + Math.log(rn * 12 + 1) * 2.15 + r.gauss() * (0.18 + rn * 0.3);
      }
      const young = kind >= 0.3 && r() < 0.06;
      const hii = kind >= 0.3 && rn > 0.25 && r() < 0.035;
      const b = rn < 0.12 ? 0 : hii ? 3 : young ? 2 : 1;
      list.push({ r: rn, th, s: young || hii ? r.range(1.2, 2.2) : r.range(0.6, 1.4), a: clamp((rn < 0.15 ? 0.9 : 0.55) * r.range(0.4, 1)), b });
    }
    list.sort((p, q) => p.b - q.b);
    const nat = [hex("#FFE6B8"), hex("#B9CBFF"), hex("#8FB0FF"), hex("#FF93B9")];
    const own = [e.c.b2, e.c.a, lighten(e.c.a, 0.35), e.c.b];
    const cols = (e.own ? own : nat).map((c) => (e.dark ? c : darken(c, 0.35)));
    const R = e.contained ? e.w * 0.55 : Math.min(Math.min(e.w, e.h) * 0.56, 700);
    return { list, cols, R, core: glow(cols[0], 160, 0.05, 1.7), halo: glow(mix(cols[1], cols[0], 0.5), 200, 0, 2.2) };
  };
  let gx = make(env);
  return {
    resize(e) {
      field = makeStars(e, rng(61), 200);
      gx = make(e);
    },
    frame(g, e, t, dt) {
      field.draw(g, e, t, dt);
      const cx = e.w * 0.5;
      const cy = e.h * 0.42;
      const tilt = 0.42;
      const inc = -0.42;
      const ci = Math.cos(inc);
      const si = Math.sin(inc);
      const rot = t * 0.012;
      g.globalCompositeOperation = addMode(e);
      g.save();
      g.translate(cx, cy);
      g.rotate(inc);
      g.scale(1, tilt);
      drawR(g, gx.halo, 0, 0, gx.R * 1.05, e.dark ? 0.16 : 0.1);
      drawR(g, gx.core, 0, 0, gx.R * 0.3, e.dark ? 0.85 : 0.5);
      g.restore();
      let b = -1;
      const k = Math.max(0.6, e.k);
      for (const s of gx.list) {
        if (s.b !== b) {
          b = s.b;
          g.fillStyle = rgba(gx.cols[b], 1);
        }
        const th = s.th + rot + 0.06 * Math.sin(t * 0.03 + s.r * 7);
        const x0 = Math.cos(th) * s.r * gx.R;
        const y0 = Math.sin(th) * s.r * gx.R * tilt;
        const x = cx + x0 * ci - y0 * si;
        const y = cy + x0 * si + y0 * ci;
        g.globalAlpha = s.a * (e.dark ? 1 : 0.6);
        const sz = s.s * k;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Auroras ───────────── */

/** Un rayo de la aurora boreal: el borde de abajo muy vivo y la luz que sube y cambia de color hasta apagarse. */
function auroraRay(low: RGB, mid: RGB, top: RGB, edge: RGB): Sprite {
  return sprite(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, rgba(edge, 0));
    gr.addColorStop(0.03, rgba(lighten(edge, 0.35), 0.95));
    gr.addColorStop(0.1, rgba(low, 0.85));
    gr.addColorStop(0.35, rgba(mid, 0.5));
    gr.addColorStop(0.65, rgba(top, 0.22));
    gr.addColorStop(1, rgba(top, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

/** Una cinta de luz suave (la «Aurora» del diseño): más intensa en el medio. */
function veil(c: RGB): Sprite {
  return sprite(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, rgba(c, 0));
    gr.addColorStop(0.35, rgba(c, 0.55));
    gr.addColorStop(0.5, rgba(lighten(c, 0.25), 0.8));
    gr.addColorStop(0.65, rgba(c, 0.5));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

const borealis: EffectFactory = (env) => {
  const r = rng(71);
  const n = makeNoise(71);
  let field = makeStars(env, r, 210);
  const own = env.own;
  const green = own ? env.c.a : hex("#3DFFA0");
  const top = own ? env.c.b : hex("#8F6BFF");
  const rays = [
    auroraRay(green, mix(green, hex("#2BD6C8"), own ? 0 : 0.4), top, own ? lighten(env.c.a, 0.3) : hex("#C8FFE2")),
    auroraRay(green, mix(green, top, 0.3), own ? env.c.b2 : hex("#FF6FB5"), own ? env.c.b2 : hex("#FFB3D9")),
  ];
  const off = document.createElement("canvas");
  const og = off.getContext("2d");
  const curtains = [
    { base: 0.42, amp: 0.1, len: 0.42, seed: 1.3, dir: 1, str: 1, ray: 0 },
    { base: 0.3, amp: 0.08, len: 0.32, seed: 7.9, dir: -1, str: 0.7, ray: 1 },
    { base: 0.52, amp: 0.06, len: 0.26, seed: 4.4, dir: 1, str: 0.45, ray: 0 },
  ];
  return {
    resize(e) {
      field = makeStars(e, rng(71), 210);
    },
    frame(g, e, t, dt) {
      field.draw(g, e, t, dt);
      if (!og) return;
      const S = 3;
      const W = Math.ceil(e.w / S);
      const H = Math.ceil(e.h / S);
      if (off.width !== W || off.height !== H) {
        off.width = W;
        off.height = H;
      }
      og.globalCompositeOperation = "source-over";
      og.clearRect(0, 0, W, H);
      og.globalCompositeOperation = "lighter";
      const step = 1.25;
      for (const c of curtains) {
        for (let x = 0; x < W; x += step) {
          const X = x * S;
          const by = H * (c.base + c.amp * n(X * 0.0011 + c.seed, t * 0.025, c.seed)) + H * 0.025 * Math.sin(X * 0.006 + t * 0.35 + n(X * 0.002, t * 0.05, 9) * 3);
          let I = n(X * 0.0035 + c.seed - t * 0.04 * c.dir, t * 0.09, c.seed * 2) * 0.5 + 0.5;
          I = Math.pow(clamp(I * 1.35 - 0.12), 2.2) * c.str;
          I *= 0.72 + 0.28 * Math.sin(X * 0.05 - t * 2.4 * c.dir + c.seed);
          if (I < 0.02) continue;
          const L = H * c.len * (0.55 + 0.7 * I);
          og.globalAlpha = clamp(I);
          og.drawImage(rays[c.ray], x, by - L, step * 1.6, L);
        }
      }
      g.globalCompositeOperation = e.dark ? "lighter" : "source-over";
      g.globalAlpha = e.dark ? 0.95 : 0.55;
      g.drawImage(off, 0, 0, e.w, e.h);
      g.globalAlpha = 1;
    },
  };
};

const aurora: EffectFactory = (env) => {
  const n = makeNoise(81);
  const cols = [env.c.a, env.c.b, mix(env.c.a, env.c.b2, 0.5)];
  const sprites = cols.map(veil);
  const off = document.createElement("canvas");
  const og = off.getContext("2d");
  return {
    frame(g, e, t) {
      if (!og) return;
      const S = 4;
      const W = Math.ceil(e.w / S);
      const H = Math.ceil(e.h / S);
      if (off.width !== W || off.height !== H) {
        off.width = W;
        off.height = H;
      }
      og.globalCompositeOperation = "source-over";
      og.clearRect(0, 0, W, H);
      og.globalCompositeOperation = e.dark ? "lighter" : "source-over";
      sprites.forEach((s, i) => {
        for (let x = 0; x < W; x += 2) {
          const u = x / W;
          const cy = H * (0.22 + i * 0.13 + 0.14 * n(u * 1.6 + i * 3.1, t * 0.035, i));
          const th = H * (0.26 + 0.14 * n(u * 2.2 + 9 + i, t * 0.03, i * 2));
          const I = clamp(0.35 + 0.65 * (n(u * 2.8 - t * 0.02 * (i % 2 ? -1 : 1), t * 0.05, 4 + i) * 0.5 + 0.5));
          og.globalAlpha = I * (i === 2 ? 0.6 : 0.85);
          og.drawImage(s, x, cy - th / 2, 3, th);
        }
      });
      g.globalCompositeOperation = e.dark ? "lighter" : "source-over";
      g.globalAlpha = e.dark ? 0.55 : 0.4;
      g.drawImage(off, 0, 0, e.w, e.h);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Planetas ───────────── */

/** La luz de una esfera iluminada desde arriba a la izquierda: sombra, borde oscurecido y un filo de atmósfera. */
function sphereShade(R: number, atmo: RGB | null, dark: boolean): Sprite {
  const S = Math.ceil(R * 2);
  return sprite(S, S, (g) => {
    const img = g.createImageData(S, S);
    const d = img.data;
    const L = [-0.62, -0.5, 0.6];
    const ln = Math.hypot(L[0], L[1], L[2]);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const nx = (x + 0.5 - R) / R;
        const ny = (y + 0.5 - R) / R;
        const rr = nx * nx + ny * ny;
        if (rr >= 1) continue;
        const nz = Math.sqrt(1 - rr);
        const lam = (nx * L[0] + ny * L[1] + nz * L[2]) / ln;
        const lit = (dark ? 0.04 : 0.25) + (dark ? 0.96 : 0.75) * smooth(-0.15, 0.75, lam) * (0.75 + 0.25 * Math.pow(nz, 0.4));
        const i = (y * S + x) * 4;
        d[i + 3] = Math.round(255 * (1 - lit) * 0.95);
      }
    g.putImageData(img, 0, 0);
    if (atmo) {
      const gr = g.createRadialGradient(R * 0.8, R * 0.75, R * 0.82, R, R, R);
      gr.addColorStop(0, rgba(atmo, 0));
      gr.addColorStop(1, rgba(atmo, 0.55));
      g.globalCompositeOperation = "source-over";
      g.fillStyle = gr;
      g.beginPath();
      g.arc(R, R, R, 0, TAU);
      g.fill();
    }
  });
}

/** La superficie de un planeta de gas: bandas onduladas y una tormenta (se repite a lo ancho para girar). */
function bands(R: number, cols: RGB[], seed: number, storm: boolean): Sprite {
  const W = Math.ceil(R * 4);
  const H = Math.ceil(R * 2);
  const lo = Math.min(W, 400);
  const tex = noiseTexture(lo, Math.round((lo * H) / W), seed, (n, u, v) => {
    const lat = v * 2 - 1;
    const turb = loopNoise(n, u, lat * 1.4, 6, 3) * 0.55;
    const b = Math.sin((lat + turb * 0.18) * Math.PI * 5.5) * 0.5 + 0.5;
    const fine = loopNoise(n, u, lat * 6, 14, 2, 3) * 0.12;
    const k = clamp(b + fine);
    const idx = k * (cols.length - 1);
    const i0 = Math.floor(idx);
    const c = mix(cols[i0], cols[Math.min(cols.length - 1, i0 + 1)], idx - i0);
    let out = c;
    if (storm) {
      const dx = (u - 0.3) * 4;
      const dy = (v - 0.64) * 9;
      const sd = dx * dx + dy * dy;
      if (sd < 1) out = mix(c, hex("#C2553A"), (1 - sd) * 0.8);
    }
    return [out[0], out[1], out[2], 255];
  });
  return sprite(W, H, (g) => g.drawImage(tex, 0, 0, W, H));
}

/** Los anillos: muchas líneas finas de distinta transparencia, con su hueco oscuro. */
function rings(R: number, c: RGB): Sprite {
  const rx = R * 2.25;
  const ry = R * 0.5;
  return sprite(rx * 2 + 4, ry * 2 + 4, (g) => {
    const r = rng(5);
    g.translate(rx + 2, ry + 2);
    for (let k = 0; k < 90; k++) {
      const f = 1.25 + (k / 90) * 1.0;
      const gap = f > 1.86 && f < 1.92;
      if (gap) continue;
      g.strokeStyle = rgba(mix(c, [255, 255, 255], r() * 0.2), (0.12 + r() * 0.35) * (f < 1.4 ? 0.5 : 1));
      g.lineWidth = Math.max(0.6, R * 0.012);
      g.beginPath();
      g.ellipse(0, 0, (R * f * rx) / (R * 2.25), (R * f * ry) / (R * 2.25), 0, 0, TAU);
      g.stroke();
    }
  });
}

const planets: EffectFactory = (env) => {
  const r = rng(91);
  let field = makeStars(env, r, 220);
  const make = (e: FxEnv) => {
    const vmin = Math.min(e.w, e.h) / 100;
    const sz = (v: number, cap: number) => (e.contained ? e.w * (v / 100) * 1.1 : Math.min(v * vmin, cap)) / 2;
    const own = e.own;
    const giantC = own ? [darken(e.c.a, 0.35), e.c.a, lighten(e.c.a, 0.4), darken(e.c.a, 0.15), lighten(e.c.a, 0.2)] : ["#A9714B", "#E8C9A0", "#C99A6B", "#F2E2C4", "#D8B48A"].map(hex);
    const ringC = own ? [darken(e.c.b, 0.2), e.c.b, lighten(e.c.b, 0.35), e.c.b2] : ["#C8AE7A", "#EBDDB8", "#D9C28F", "#F4EAD0"].map(hex);
    const iceC = own ? [mix(e.c.a, e.c.b, 0.5), lighten(mix(e.c.a, e.c.b, 0.5), 0.3)] : ["#8FA4B8", "#C9D8E6"].map(hex);
    const list = [
      { x: 0.08, y: 0.14, R: sz(16, 130), tex: null as Sprite | null, cols: giantC, storm: true, ring: null as Sprite | null, speed: 6, bob: 11 },
      { x: 0.78, y: 0.58, R: sz(22, 180), tex: null as Sprite | null, cols: ringC, storm: false, ring: null as Sprite | null, speed: 9, bob: 15 },
      { x: 0.62, y: 0.1, R: sz(7, 56), tex: null as Sprite | null, cols: iceC, storm: false, ring: null as Sprite | null, speed: 2, bob: 8 },
    ].map((p, i) => {
      const RD = p.R * e.dpr;
      return {
        ...p,
        tex: bands(RD, p.cols, 3 + i * 5, p.storm),
        ring: i === 1 ? rings(RD, mix(p.cols[1], p.cols[3], 0.4)) : null,
        shade: sphereShade(RD, own ? lighten(e.c.a, 0.3) : i === 2 ? hex("#CFE6FF") : hex("#FFE6C4"), e.dark),
      };
    });
    return list;
  };
  let list = make(env);
  return {
    resize(e) {
      field = makeStars(e, rng(91), 220);
      list = make(e);
    },
    frame(g, e, t, dt) {
      field.draw(g, e, t, dt);
      g.globalCompositeOperation = "source-over";
      for (const p of list) {
        const R = p.R;
        const cx = e.w * p.x + R;
        const cy = e.h * p.y + R + Math.sin((t * TAU) / p.bob) * 7 * e.k;
        const tilt = -0.32;
        // Los anillos de atrás.
        if (p.ring) {
          g.save();
          g.translate(cx, cy);
          g.rotate(tilt);
          g.beginPath();
          g.rect(-R * 3, -R * 3, R * 6, R * 3);
          g.clip();
          g.globalAlpha = 0.9;
          g.drawImage(p.ring, -p.ring.width / e.dpr / 2, -p.ring.height / e.dpr / 2, p.ring.width / e.dpr, p.ring.height / e.dpr);
          g.restore();
        }
        // El planeta: su superficie girando despacio y, encima, su luz.
        g.save();
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.clip();
        g.translate(cx, cy);
        g.rotate(p.ring ? tilt * 0.6 : 0.12);
        const tw = (p.tex?.width ?? 1) / e.dpr;
        const th = R * 2;
        const ox = -(((t * p.speed * e.k) % tw) + tw) % tw;
        if (p.tex) for (let x = ox - R; x < R; x += tw) g.drawImage(p.tex, x, -R, tw, th);
        g.restore();
        g.globalAlpha = 1;
        g.drawImage(p.shade, cx - R, cy - R, R * 2, R * 2);
        // Los anillos de delante.
        if (p.ring) {
          g.save();
          g.translate(cx, cy);
          g.rotate(tilt);
          g.beginPath();
          g.rect(-R * 3, 0, R * 6, R * 3);
          g.clip();
          g.drawImage(p.ring, -p.ring.width / e.dpr / 2, -p.ring.height / e.dpr / 2, p.ring.width / e.dpr, p.ring.height / e.dpr);
          g.restore();
        }
      }
    },
  };
};

export const SKY: Partial<Record<Decor, EffectFactory>> = {
  stars,
  shooting: meteorShower([1.6, 5.5], false),
  meteors: meteorShower([0.18, 0.75], true),
  moon,
  nebula,
  constellation,
  galaxy,
  borealis,
  aurora,
  planets,
};
