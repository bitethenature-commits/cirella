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
  makeNoise,
  mix,
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

/** El color de las líneas mágicas: luminoso sobre lo oscuro, hondo sobre lo claro. */
const ink = (env: FxEnv, c: RGB, t = 0.35) => (env.dark ? c : darken(c, t));

/** Un trazo con su resplandor: ancho y tenue, medio, y el hilo fino y brillante del centro. */
function glowStroke(g: CanvasRenderingContext2D, p: Path2D, c: RGB, core: RGB, w: number, a: number, dark: boolean) {
  g.strokeStyle = rgba(c, 1);
  g.globalAlpha = a * (dark ? 0.09 : 0.05);
  g.lineWidth = w * 7;
  g.stroke(p);
  g.globalAlpha = a * (dark ? 0.2 : 0.12);
  g.lineWidth = w * 3;
  g.stroke(p);
  g.strokeStyle = rgba(core, 1);
  g.globalAlpha = a * 0.9;
  g.lineWidth = w;
  g.stroke(p);
}

/** Un degradado que gira alrededor del centro (la luz que recorre los anillos). Sin soporte, un color liso. */
function sweep(g: CanvasRenderingContext2D, a0: number, x: number, y: number, base: RGB, hi: RGB): CanvasGradient | string {
  if (typeof (g as { createConicGradient?: unknown }).createConicGradient !== "function") return rgba(base, 1);
  const gr = g.createConicGradient(a0, x, y);
  gr.addColorStop(0, rgba(hi, 1));
  gr.addColorStop(0.08, rgba(base, 1));
  gr.addColorStop(0.5, rgba(base, 1));
  gr.addColorStop(0.58, rgba(hi, 1));
  gr.addColorStop(0.66, rgba(base, 1));
  gr.addColorStop(0.92, rgba(base, 1));
  gr.addColorStop(1, rgba(hi, 1));
  return gr;
}

/* ───────────── Polvo de oro ───────────── */

/** Una escama de pan de oro: irregular, con su brillo metálico. */
function flake(c: RGB, seed: number, dpr: number): Sprite {
  const r = rng(seed);
  const S = 14 * dpr;
  return sprite(S, S, (g) => {
    const R = S / 2;
    g.translate(R, R);
    g.beginPath();
    const k = 6 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + r.range(-0.3, 0.3);
      const d = R * r.range(0.45, 0.95);
      g[i ? "lineTo" : "moveTo"](Math.cos(a) * d, Math.sin(a) * d * 0.8);
    }
    g.closePath();
    const gr = g.createLinearGradient(-R, -R, R, R);
    gr.addColorStop(0, rgba(lighten(c, 0.55), 1));
    gr.addColorStop(0.45, rgba(c, 1));
    gr.addColorStop(1, rgba(darken(c, 0.35), 1));
    g.fillStyle = gr;
    g.fill();
  });
}

type Flake = { x: number; y: number; z: number; s: number; rot: number; vr: number; tilt: number; vt: number; v: number; id: number };

const golddust: EffectFactory = (env) => {
  const r = rng(301);
  const n = makeNoise(301);
  const gold = env.dark ? env.c.b : darken(env.c.b, 0.25);
  const flakes = [0, 1, 2, 3].map((i) => flake(gold, 40 + i, env.dpr));
  const shine = glow(lighten(gold, 0.6), 32, 0.12, 2);
  const spark = sprite(64, 64, (g, w) => {
    const R = w / 2;
    for (const a of [0, Math.PI / 2]) {
      g.save();
      g.translate(R, R);
      g.rotate(a);
      const gr = g.createLinearGradient(-R, 0, R, 0);
      gr.addColorStop(0, "rgba(255,250,235,0)");
      gr.addColorStop(0.5, "rgba(255,250,235,1)");
      gr.addColorStop(1, "rgba(255,250,235,0)");
      g.fillStyle = gr;
      g.fillRect(-R, -1, w, 2);
      g.restore();
    }
  });
  const bokehDisc = blurred(glow(gold, 64, 0.55, 0.8), 2);
  let list: Flake[] = [];
  const spawn = (e: FxEnv, f: Flake | null, anywhere: boolean, i = 0): Flake => {
    const q = f ?? ({ id: i * 1.37 } as Flake);
    q.z = Math.pow(r(), 1.6);
    q.s = (2 + q.z * 7) * Math.max(0.45, e.k);
    q.x = r() * e.w;
    q.y = anywhere ? r() * e.h : e.h + 20;
    q.rot = r() * TAU;
    q.vr = r.range(-1.2, 1.2);
    q.tilt = r() * TAU;
    q.vt = r.range(0.8, 2.6) * r.sign();
    q.v = Math.floor(r() * flakes.length);
    return q;
  };
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 70, 40, 150) }, (_, i) => spawn(e, null, true, i));
    list.sort((a, b) => a.z - b.z);
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      const k = Math.max(0.45, e.k);
      g.globalCompositeOperation = addMode(e);
      for (const f of list) {
        // Sube despacio, llevado por corrientes suaves (como polvo en el aire caliente).
        const sp = 0.4 + f.z;
        f.x += n(f.x * 0.004, f.y * 0.004, t * 0.07 + f.id) * 14 * sp * k * dt;
        f.y -= (6 + n(f.x * 0.004 + 50, f.y * 0.004, t * 0.07) * 8) * sp * k * dt;
        f.rot += f.vr * dt;
        f.tilt += f.vt * dt;
        if (f.y < -20) spawn(e, f, false);
        if (f.x < -20) f.x += e.w + 40;
        if (f.x > e.w + 20) f.x -= e.w + 40;
        // La escama gira: se ve de canto o de frente, y al ponerse de cara a la luz brilla de golpe.
        const face = Math.cos(f.tilt);
        const glint = Math.pow(Math.max(0, face), 40);
        const a = (0.35 + 0.55 * f.z) * (e.dark ? 1 : 0.9);
        if (f.z > 0.93) {
          // Las que pasan muy cerca, desenfocadas.
          drawR(g, bokehDisc, f.x, f.y, f.s * 2.2, (0.18 + glint * 0.25) * (e.dark ? 1 : 0.7));
          continue;
        }
        g.globalCompositeOperation = "source-over";
        drawRot(g, flakes[f.v], e.dpr, 14, f.x, f.y, f.s, f.rot, 1, 0.15 + 0.85 * Math.abs(face), a * (0.55 + 0.45 * Math.abs(face)));
        g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
        g.globalCompositeOperation = addMode(e);
        if (glint > 0.05) {
          drawR(g, shine, f.x, f.y, f.s * 2.6, glint * (e.dark ? 0.9 : 0.6));
          if (glint > 0.3 && f.z > 0.4) drawR(g, spark, f.x, f.y, f.s * 3.2 * glint, glint * 0.9);
        }
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Velas ───────────── */

type Candle = { x: number; w: number; h: number; id: number; body: Sprite; lit: Sprite; wisp: { x: number; y: number; age: number }[]; nextWisp: number };

/** El cuerpo de una vela: cera con su volumen, el borde de arriba derretido y gotas que han ido cayendo. */
function waxBody(wax: RGB, w: number, h: number, dpr: number, seed: number, dark: boolean): Sprite {
  const r = rng(seed);
  const W = w * dpr;
  const H = h * dpr;
  const rimY = W * 0.14;
  return sprite(W, H, (g) => {
    // El cilindro: más claro en el centro, en sombra en los lados y hacia abajo.
    const side = g.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, rgba(darken(wax, 0.45), 1));
    side.addColorStop(0.3, rgba(wax, 1));
    side.addColorStop(0.55, rgba(lighten(wax, 0.12), 1));
    side.addColorStop(1, rgba(darken(wax, 0.55), 1));
    g.fillStyle = side;
    g.beginPath();
    g.moveTo(0, rimY);
    g.lineTo(0, H);
    g.lineTo(W, H);
    g.lineTo(W, rimY);
    g.ellipse(W / 2, rimY, W / 2, rimY, 0, 0, Math.PI, false);
    g.fill();
    const down = g.createLinearGradient(0, 0, 0, H);
    down.addColorStop(0, "rgba(0,0,0,0)");
    down.addColorStop(1, `rgba(0,0,0,${dark ? 0.6 : 0.25})`);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = down;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    // Gotas de cera que bajan desde el borde.
    const drips = 2 + Math.floor(r() * 3);
    for (let i = 0; i < drips; i++) {
      const x = r.range(0.12, 0.88) * W;
      const dw = r.range(0.07, 0.13) * W;
      const len = r.range(0.06, 0.32) * H;
      const gr = g.createLinearGradient(x - dw, 0, x + dw, 0);
      gr.addColorStop(0, rgba(darken(wax, 0.2), 0.9));
      gr.addColorStop(0.45, rgba(lighten(wax, 0.25), 1));
      gr.addColorStop(1, rgba(darken(wax, 0.3), 0.9));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - dw, rimY);
      g.lineTo(x - dw * 0.8, rimY + len);
      g.arc(x, rimY + len, dw * 0.8, Math.PI, 0, true);
      g.lineTo(x + dw, rimY);
      g.closePath();
      g.fill();
    }
    // El charco de cera derretida arriba, con su borde.
    const pool = g.createRadialGradient(W / 2, rimY, 0, W / 2, rimY, W / 2);
    pool.addColorStop(0, rgba(lighten(wax, 0.35), 1));
    pool.addColorStop(0.8, rgba(wax, 1));
    pool.addColorStop(1, rgba(lighten(wax, 0.5), 1));
    g.fillStyle = pool;
    g.beginPath();
    g.ellipse(W / 2, rimY, W / 2 - 0.5, rimY - 0.5, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(lighten(wax, 0.6), 0.8);
    g.lineWidth = Math.max(1, dpr);
    g.beginPath();
    g.ellipse(W / 2, rimY, W / 2 - 1, rimY - 1, 0, Math.PI * 0.05, Math.PI * 0.95);
    g.stroke();
  });
}

/** La luz de la llama dentro de la cera (la parte de arriba se ve encendida por dentro). */
function waxGlow(c: RGB, w: number, h: number, dpr: number): Sprite {
  const W = w * dpr;
  const H = h * dpr;
  const rimY = W * 0.14;
  return sprite(W, H, (g) => {
    g.beginPath();
    g.moveTo(0, rimY);
    g.lineTo(0, H);
    g.lineTo(W, H);
    g.lineTo(W, rimY);
    g.ellipse(W / 2, rimY, W / 2, rimY, 0, 0, Math.PI, false);
    g.clip();
    const gr = g.createRadialGradient(W / 2, rimY * 0.6, 0, W / 2, rimY, Math.max(W * 1.4, 1));
    gr.addColorStop(0, rgba(c, 0.95));
    gr.addColorStop(0.35, rgba(c, 0.45));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  });
}

/** La forma de una llama: gota que se afila arriba, con la punta movida por el aire. */
function flamePath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sway: number) {
  g.beginPath();
  g.moveTo(x, y + w * 0.55);
  g.bezierCurveTo(x - w * 1.05, y + w * 0.4, x - w * 0.75 + sway * 0.3, y - h * 0.5, x + sway, y - h);
  g.bezierCurveTo(x + w * 0.75 + sway * 0.3, y - h * 0.5, x + w * 1.05, y + w * 0.4, x, y + w * 0.55);
  g.closePath();
}

const candles: EffectFactory = (env) => {
  const n = makeNoise(311);
  const r = rng(311);
  const wax = env.dark ? hex("#E9DCC0") : hex("#F2E8D2");
  const warm = env.own ? lighten(env.c.a, 0.25) : hex("#FFB25C");
  const halo = glow(warm, 128, 0.04, 1.6);
  const wide = glow(env.own ? env.c.a : hex("#FF9440"), 128, 0, 2.2);
  const smokeC = env.dark ? hex("#B9B4AE") : hex("#8E8780");
  let list: Candle[] = [];
  const layout = (e: FxEnv) => {
    const k = Math.max(0.42, e.k);
    const spec = [
      { x: 0.05, w: 40, h: 220 },
      { x: 0.12, w: 30, h: 150 },
      { x: 0.88, w: 32, h: 170 },
      { x: 0.95, w: 42, h: 240 },
    ];
    list = spec.map((s, i) => {
      const w = s.w * k;
      const h = Math.min(s.h * k, e.h * 0.42);
      return {
        x: s.x * e.w,
        w,
        h,
        id: i * 7.3,
        body: waxBody(wax, w, h, e.dpr, 320 + i, e.dark),
        lit: waxGlow(warm, w, h, e.dpr),
        wisp: [],
        nextWisp: r.range(4, 14),
      };
    });
  };
  layout(env);
  return {
    resize: layout,
    frame(g, e, t, dt) {
      const k = Math.max(0.42, e.k);
      for (const c of list) {
        const top = e.h - c.h;
        const rimY = c.w * 0.14;
        // Cómo tiembla la llama: casi quieta, con algún parpadeo y una racha de vez en cuando.
        const f1 = n(t * 2.2, c.id, 0);
        const f2 = n(t * 7.5, c.id, 4);
        const gust = Math.max(0, n(t * 0.35, c.id, 9) - 0.35) * 2;
        const flick = clamp(0.88 + 0.08 * f1 + 0.05 * f2 - gust * 0.12, 0.6, 1.05);
        const sway = (n(t * 1.1, c.id, 2) * 2.5 + gust * n(t * 6, c.id, 3) * 4) * k;
        const fx = c.x;
        const fy = top + rimY * 0.3 - 7 * k;
        const fh = 30 * k * flick * (1 + gust * 0.15);
        const fw = 6.2 * k * (1 - gust * 0.1);

        // La luz que da la vela a su alrededor.
        g.globalCompositeOperation = addMode(e);
        drawR(g, wide, fx, fy - fh * 0.4, 230 * k * (0.96 + 0.04 * flick), (e.dark ? 0.2 : 0.1) * flick);
        drawR(g, halo, fx, fy - fh * 0.4, 70 * k, (e.dark ? 0.32 : 0.16) * flick);

        // La vela.
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.drawImage(c.body, c.x - c.w / 2, top, c.w, c.h);
        g.globalCompositeOperation = addMode(e);
        g.globalAlpha = (e.dark ? 0.75 : 0.4) * flick;
        g.drawImage(c.lit, c.x - c.w / 2, top, c.w, c.h);

        // La mecha: negra, con la punta como una brasa.
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.strokeStyle = "rgba(30,22,18,.95)";
        g.lineWidth = 1.6 * k;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(fx, top + rimY * 0.4);
        g.quadraticCurveTo(fx + 0.5 * k, fy + 2 * k, fx + sway * 0.15, fy - 1 * k);
        g.stroke();

        // La llama, de fuera adentro: el velo naranja, el cuerpo amarillo, el centro casi blanco y el azul de la base.
        g.globalCompositeOperation = addMode(e);
        for (let i = 3; i >= 1; i--) {
          const s = 1 + i * 0.22;
          flamePath(g, fx, fy, fw * s, fh * (1 + i * 0.1), sway * (1 + i * 0.15));
          g.globalAlpha = (e.dark ? 0.16 : 0.22) * flick;
          g.fillStyle = rgba(env.own ? env.c.a : hex("#FF7A1A"), 1);
          g.fill();
        }
        flamePath(g, fx, fy, fw, fh, sway);
        const body = g.createLinearGradient(0, fy + fw * 0.5, 0, fy - fh);
        body.addColorStop(0, "rgba(255,190,90,.75)");
        body.addColorStop(0.25, "rgba(255,226,140,.95)");
        body.addColorStop(0.75, "rgba(255,170,60,.85)");
        body.addColorStop(1, "rgba(255,110,30,0)");
        g.globalAlpha = 1;
        g.fillStyle = body;
        g.fill();
        flamePath(g, fx, fy - fh * 0.06, fw * 0.48, fh * 0.55, sway * 0.6);
        const core = g.createLinearGradient(0, fy, 0, fy - fh * 0.6);
        core.addColorStop(0, "rgba(255,255,245,.2)");
        core.addColorStop(0.3, "rgba(255,255,240,.95)");
        core.addColorStop(1, "rgba(255,240,190,0)");
        g.fillStyle = core;
        g.fill();
        g.globalAlpha = 0.55 * flick;
        g.fillStyle = "rgba(90,130,255,1)";
        g.beginPath();
        g.ellipse(fx, fy + fw * 0.15, fw * 0.55, fw * 0.4, 0, 0, TAU);
        g.fill();

        // De vez en cuando, un hilo de humo que sube de la llama.
        c.nextWisp -= dt;
        if (c.nextWisp < 0 && c.nextWisp > -3.5) {
          if (r() < dt * 22) c.wisp.push({ x: fx + sway, y: fy - fh, age: 0 });
        } else if (c.nextWisp <= -3.5) c.nextWisp = r.range(8, 20);
        g.globalCompositeOperation = "source-over";
        g.strokeStyle = rgba(smokeC, 1);
        g.lineCap = "round";
        for (let i = c.wisp.length - 1; i >= 0; i--) {
          const p = c.wisp[i];
          p.age += dt;
          if (p.age > 3.2) {
            c.wisp.splice(i, 1);
            continue;
          }
          p.y -= 38 * k * dt;
          p.x += n(p.x * 0.02, p.y * 0.02, t * 0.4) * 20 * k * dt;
        }
        for (let i = 1; i < c.wisp.length; i++) {
          const a = c.wisp[i - 1];
          const b = c.wisp[i];
          g.globalAlpha = Math.pow(1 - b.age / 3.2, 1.5) * 0.3;
          g.lineWidth = (0.8 + b.age * 2) * k;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Mandala ───────────── */

/** Un pétalo en punta (de r0 a r1, ancho `w` en radianes) alrededor del centro. */
function petal(p: Path2D, a: number, r0: number, r1: number, w: number) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (rr: number, off: number) => [Math.cos(a + off) * rr, Math.sin(a + off) * rr] as const;
  const [x0, y0] = [ca * r0, sa * r0];
  const [x1, y1] = [ca * r1, sa * r1];
  const mid = (r0 + r1) / 2;
  const [lx, ly] = at(mid, w);
  const [rx, ry] = at(mid, -w);
  p.moveTo(x0, y0);
  p.quadraticCurveTo(lx, ly, x1, y1);
  p.quadraticCurveTo(rx, ry, x0, y0);
}

type Layer = { path: Path2D; speed: number; w: number; c: 0 | 1 };

function mandalaLayers(R: number): Layer[] {
  const L: Layer[] = [];
  const ring = (rr: number) => {
    const p = new Path2D();
    p.arc(0, 0, rr, 0, TAU);
    return p;
  };
  // Las coronas de rayos de fuera.
  const spikes = new Path2D();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    spikes.moveTo(Math.cos(a) * R * 0.99, Math.sin(a) * R * 0.99);
    spikes.lineTo(Math.cos(a) * R * (i % 2 ? 1.05 : 1.1), Math.sin(a) * R * (i % 2 ? 1.05 : 1.1));
  }
  L.push({ path: spikes, speed: 0.012, w: 0.9, c: 1 });
  const outer = ring(R);
  outer.addPath(ring(R * 0.97));
  L.push({ path: outer, speed: 0, w: 1, c: 0 });
  // Doce pétalos grandes, con otro pétalo dentro.
  const big = new Path2D();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    petal(big, a, R * 0.58, R * 0.95, 0.2);
    petal(big, a, R * 0.64, R * 0.86, 0.1);
  }
  L.push({ path: big, speed: -0.018, w: 1.1, c: 0 });
  // Un collar de cuentas.
  const dots = new Path2D();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const x = Math.cos(a) * R * 0.55;
    const y = Math.sin(a) * R * 0.55;
    dots.moveTo(x + R * 0.012, y);
    dots.arc(x, y, R * 0.012, 0, TAU);
  }
  dots.addPath(ring(R * 0.52));
  L.push({ path: dots, speed: 0.025, w: 1, c: 1 });
  // El loto de ocho pétalos dobles.
  const lotus = new Path2D();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    petal(lotus, a, R * 0.2, R * 0.5, 0.36);
    petal(lotus, a, R * 0.24, R * 0.42, 0.2);
  }
  L.push({ path: lotus, speed: -0.03, w: 1.1, c: 0 });
  // La estrella de dos triángulos y su círculo.
  const tri = ring(R * 0.3);
  for (const off of [0, Math.PI]) {
    for (let i = 0; i <= 3; i++) {
      const a = off - Math.PI / 2 + (i / 3) * TAU;
      if (i) tri.lineTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
      else tri.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    }
  }
  L.push({ path: tri, speed: 0.04, w: 1, c: 1 });
  // La flor del centro.
  const core = new Path2D();
  for (let i = 0; i < 6; i++) petal(core, (i / 6) * TAU, R * 0.03, R * 0.16, 0.5);
  core.addPath(ring(R * 0.035));
  L.push({ path: core, speed: -0.06, w: 1, c: 0 });
  return L;
}

const mandala: EffectFactory = (env) => {
  const ca = ink(env, env.c.b);
  const cb = ink(env, env.c.a, 0.3);
  const hiA = lighten(ca, 0.6);
  const hiB = lighten(cb, 0.6);
  const center = glow(env.c.b, 128, 0.05, 2);
  let R = 0;
  let layers: Layer[] = [];
  const layout = (e: FxEnv) => {
    R = Math.min(e.w * 0.46, 430);
    layers = mandalaLayers(R);
  };
  layout(env);
  return {
    resize: layout,
    frame(g, e, t) {
      const cx = e.w / 2;
      const cy = e.h / 2;
      const breathe = 1 + 0.015 * Math.sin(t * 0.5);
      const glowA = 0.75 + 0.25 * Math.sin(t * 0.4);
      g.globalCompositeOperation = addMode(e);
      drawR(g, center, cx, cy, R * 0.45, (e.dark ? 0.14 : 0.06) * glowA);
      layers.forEach((L, i) => {
        g.setTransform(e.dpr * breathe, 0, 0, e.dpr * breathe, cx * e.dpr, cy * e.dpr);
        const rot = t * L.speed;
        g.rotate(rot);
        const base = L.c ? cb : ca;
        const hi = L.c ? hiB : hiA;
        // La luz que da vueltas: cada capa a su ritmo, en sentido contrario al giro.
        const lightA = -t * 0.25 * (i % 2 ? 1 : -1) - rot;
        g.lineCap = "round";
        g.lineJoin = "round";
        glowStroke(g, L.path, base, base, L.w / breathe, 0.3 * glowA, e.dark);
        g.strokeStyle = sweep(g, lightA, 0, 0, base, hi);
        g.globalAlpha = e.dark ? 0.4 : 0.35;
        g.lineWidth = (L.w * 0.9) / breathe;
        g.stroke(L.path);
      });
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Flor de la vida ───────────── */

const flowerlife: EffectFactory = (env) => {
  const r = rng(331);
  const ca = ink(env, env.c.b);
  const cb = ink(env, env.c.a, 0.3);
  const hi = lighten(ca, 0.7);
  const dot = glow(lighten(ca, 0.5), 32, 0.15, 1.8);
  const center = glow(env.c.b, 128, 0.05, 2);
  let rho = 0;
  let centers: [number, number][] = [];
  let circles = new Path2D();
  let rings = new Path2D();
  const layout = (e: FxEnv) => {
    rho = Math.min(e.w * 0.46, 430) / 3.15;
    centers = [[0, 0]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      centers.push([Math.cos(a) * rho, Math.sin(a) * rho]);
      centers.push([Math.cos(a) * rho * 2, Math.sin(a) * rho * 2]);
      const b = a + Math.PI / 6;
      centers.push([Math.cos(b) * rho * Math.sqrt(3), Math.sin(b) * rho * Math.sqrt(3)]);
    }
    circles = new Path2D();
    for (const [x, y] of centers) {
      circles.moveTo(x + rho, y);
      circles.arc(x, y, rho, 0, TAU);
    }
    rings = new Path2D();
    rings.arc(0, 0, rho * 3, 0, TAU);
    rings.moveTo(rho * 3.1, 0);
    rings.arc(0, 0, rho * 3.1, 0, TAU);
  };
  layout(env);
  // Luces que corren por los arcos, cada una por un círculo distinto.
  const comets = Array.from({ length: 7 }, () => ({ c: Math.floor(r() * 19), a: r() * TAU, v: r.range(0.35, 0.7) * r.sign(), life: r.range(5, 11), age: r() * 5 }));
  return {
    resize: layout,
    frame(g, e, t, dt) {
      const cx = e.w / 2;
      const cy = e.h / 2;
      const breathe = 1 + 0.012 * Math.sin(t * 0.42);
      const rot = t * 0.026;
      const glowA = 0.78 + 0.22 * Math.sin(t * 0.35);
      g.globalCompositeOperation = addMode(e);
      drawR(g, center, cx, cy, rho * 1.6, (e.dark ? 0.16 : 0.07) * glowA);
      g.setTransform(e.dpr * breathe, 0, 0, e.dpr * breathe, cx * e.dpr, cy * e.dpr);
      g.rotate(rot);
      g.lineCap = "round";
      glowStroke(g, circles, ca, ca, 1.05 / breathe, 0.34 * glowA, e.dark);
      glowStroke(g, rings, cb, cb, 1.1 / breathe, 0.34 * glowA, e.dark);
      // Una onda de luz que sale del centro cada pocos segundos.
      const pp = (t % 7) / 7;
      const pr = pp * rho * 3.4;
      const band = rho * 0.35;
      const wave = g.createRadialGradient(0, 0, Math.max(0, pr - band), 0, 0, pr + band);
      wave.addColorStop(0, rgba(hi, 0));
      wave.addColorStop(0.5, rgba(hi, 1));
      wave.addColorStop(1, rgba(hi, 0));
      g.strokeStyle = wave;
      g.globalAlpha = (1 - pp) * (e.dark ? 0.55 : 0.4);
      g.lineWidth = 1.6 / breathe;
      g.stroke(circles);
      g.stroke(rings);
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      // Los cometas: una cabeza brillante con su estela, siguiendo el círculo.
      const cs = Math.cos(rot) * breathe;
      const sn = Math.sin(rot) * breathe;
      for (const c of comets) {
        c.age += dt;
        c.a += c.v * dt;
        if (c.age > c.life) {
          c.age = 0;
          c.c = Math.floor(r() * centers.length);
          c.a = r() * TAU;
          c.life = r.range(5, 11);
        }
        const fade = smooth(0, 1, c.age) * smooth(c.life, c.life - 1.5, c.age);
        const [ox, oy] = centers[c.c] ?? [0, 0];
        for (let j = 0; j < 14; j++) {
          const a = c.a - Math.sign(c.v) * j * 0.035;
          const lx = ox + Math.cos(a) * rho;
          const ly = oy + Math.sin(a) * rho;
          const x = cx + lx * cs - ly * sn;
          const y = cy + lx * sn + ly * cs;
          drawR(g, dot, x, y, (j ? 4 - j * 0.2 : 6) * Math.max(0.5, e.k), fade * (1 - j / 14) * (e.dark ? 0.85 : 0.6));
        }
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Cartas que flotan ───────────── */

const CW = 100;
const CH = 166;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number, n: number, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const d = i % 2 ? r : R;
    g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.closePath();
}

type CardInk = { face: RGB; line: RGB; deep: RGB };

/** El marco de una carta: fondo, doble filete dorado y esquinas. */
function cardFrame(g: CanvasRenderingContext2D, k: CardInk) {
  roundRect(g, 1, 1, CW - 2, CH - 2, 7);
  const bg = g.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, rgba(lighten(k.face, 0.08), 1));
  bg.addColorStop(1, rgba(darken(k.face, 0.12), 1));
  g.fillStyle = bg;
  g.fill();
  g.strokeStyle = rgba(k.line, 0.95);
  g.lineWidth = 1.4;
  g.stroke();
  roundRect(g, 6, 6, CW - 12, CH - 12, 4);
  g.lineWidth = 0.8;
  g.stroke();
  roundRect(g, 8.5, 8.5, CW - 17, CH - 17, 3);
  g.lineWidth = 0.5;
  g.stroke();
  g.fillStyle = rgba(k.line, 1);
  for (const [x, y] of [
    [8.5, 8.5],
    [CW - 8.5, 8.5],
    [8.5, CH - 8.5],
    [CW - 8.5, CH - 8.5],
  ])
    star(g, x, y, 3, 1, 4, 0);
  g.fill();
}

/** Una cara de carta con su símbolo (sol, luna, estrella u ojo) dibujado en oro. */
function cardFront(k: CardInk, kind: number, dpr: number): Sprite {
  const S = dpr * 1.25;
  return sprite(CW * S, CH * S, (g) => {
    g.scale(S, S);
    cardFrame(g, k);
    const cx = CW / 2;
    const cy = CH * 0.44;
    g.strokeStyle = rgba(k.line, 1);
    g.fillStyle = rgba(k.line, 1);
    g.lineWidth = 1.1;
    g.lineCap = "round";
    g.lineJoin = "round";
    if (kind === 0) {
      // El Sol.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const r0 = 17;
        const r1 = i % 2 ? 26 : 33;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.stroke();
      }
      g.beginPath();
      g.arc(cx, cy, 14, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, 10, 0, TAU);
      g.globalAlpha = 0.25;
      g.fill();
      g.globalAlpha = 1;
      g.stroke();
    } else if (kind === 1) {
      // La Luna creciente y unas estrellas.
      g.beginPath();
      g.arc(cx, cy, 22, Math.PI * 0.35, Math.PI * 1.65);
      g.arc(cx + 9, cy - 4, 18, Math.PI * 1.45, Math.PI * 0.42, true);
      g.closePath();
      g.globalAlpha = 0.25;
      g.fill();
      g.globalAlpha = 1;
      g.stroke();
      for (const [x, y, s] of [
        [cx + 20, cy - 22, 4],
        [cx + 26, cy + 4, 2.6],
        [cx + 12, cy + 24, 2],
      ]) {
        star(g, x, y, s, s * 0.35, 4);
        g.fill();
      }
    } else if (kind === 2) {
      // La Estrella de ocho puntas, con estrellas pequeñas alrededor.
      star(g, cx, cy, 26, 10, 8);
      g.globalAlpha = 0.2;
      g.fill();
      g.globalAlpha = 1;
      g.stroke();
      star(g, cx, cy, 11, 4.5, 8);
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + ((i - 3) / 3) * 1.2;
        star(g, cx + Math.cos(a) * 38, cy - 4 + Math.sin(a) * 30 + 30, 2.2, 0.8, 4);
        g.fill();
      }
    } else {
      // El Ojo dentro del triángulo, con rayos.
      for (let i = 0; i < 13; i++) {
        const a = -Math.PI / 2 + ((i - 6) / 6) * 1.1;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 30, cy + 4 + Math.sin(a) * 30);
        g.lineTo(cx + Math.cos(a) * 38, cy + 4 + Math.sin(a) * 38);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(cx, cy - 24);
      g.lineTo(cx + 25, cy + 19);
      g.lineTo(cx - 25, cy + 19);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(cx - 15, cy + 6);
      g.quadraticCurveTo(cx, cy - 7, cx + 15, cy + 6);
      g.quadraticCurveTo(cx, cy + 17, cx - 15, cy + 6);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy + 6, 5, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy + 6, 2.2, 0, TAU);
      g.fill();
    }
    // La cartela de abajo, con su rombo.
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(20, CH * 0.8);
    g.lineTo(CW - 20, CH * 0.8);
    g.moveTo(26, CH * 0.8 + 6);
    g.lineTo(CW - 26, CH * 0.8 + 6);
    g.stroke();
    star(g, cx, CH * 0.8 + 3, 4, 2, 2, 0);
    g.fill();
    for (const dx of [-6, 0, 6]) {
      g.beginPath();
      g.arc(cx + dx, 18, 1.2, 0, TAU);
      g.fill();
    }
  });
}

/** El dorso: celosía de rombos, medallón con estrella y luna, y filetes. */
function cardBack(k: CardInk, dpr: number): Sprite {
  const S = dpr * 1.25;
  return sprite(CW * S, CH * S, (g) => {
    g.scale(S, S);
    cardFrame(g, { ...k, face: k.deep });
    g.save();
    roundRect(g, 11, 11, CW - 22, CH - 22, 2);
    g.clip();
    g.strokeStyle = rgba(k.line, 0.35);
    g.lineWidth = 0.6;
    g.beginPath();
    for (let i = -CH; i < CW + CH; i += 9) {
      g.moveTo(i, 0);
      g.lineTo(i + CH, CH);
      g.moveTo(i, CH);
      g.lineTo(i + CH, 0);
    }
    g.stroke();
    g.restore();
    const cx = CW / 2;
    const cy = CH / 2;
    g.fillStyle = rgba(k.deep, 1);
    g.beginPath();
    g.arc(cx, cy, 25, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(k.line, 1);
    g.fillStyle = rgba(k.line, 1);
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 21, 0, TAU);
    g.lineWidth = 0.6;
    g.stroke();
    star(g, cx, cy, 16, 6, 8);
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 5, 0, TAU);
    g.fill();
    for (const y of [26, CH - 26]) {
      star(g, cx, y, 6, 2, 4);
      g.fill();
    }
  });
}

/** La sombra de una carta (para cuando el fondo es claro). */
function cardShadow(dpr: number): Sprite {
  const S = dpr * 0.5;
  return blurred(
    sprite(CW * S, CH * S, (g) => {
      g.scale(S, S);
      roundRect(g, 1, 1, CW - 2, CH - 2, 7);
      g.fillStyle = "rgba(0,0,0,1)";
      g.fill();
    }),
    6 * S,
  );
}

type Card = { x: number; y: number; z: number; s: number; flip: number; vf: number; tilt: number; ph: number; vy: number; kind: number };

const cards: EffectFactory = (env) => {
  const r = rng(341);
  const line = env.dark ? lighten(env.c.b, 0.1) : darken(env.c.b, 0.3);
  const ink2: CardInk = env.dark
    ? { face: mix(darken(env.c.a, 0.72), env.c.bg, 0.35), line, deep: mix(darken(env.c.a, 0.6), env.c.bg, 0.2) }
    : { face: mix(hex("#FBF6EC"), env.c.b2, 0.25), line, deep: mix(darken(env.c.a, 0.45), hex("#2A2140"), 0.4) };
  const fronts = [0, 1, 2, 3].map((i) => cardFront(ink2, i, env.dpr));
  const back = cardBack(ink2, env.dpr);
  const shadow = cardShadow(env.dpr);
  const halo = glow(env.c.b, 64, 0, 2);
  let list: Card[] = [];
  const fill = (e: FxEnv) => {
    const N = count(e, 5, 5, 9);
    list = Array.from({ length: N }, (_, i) => {
      const z = r();
      return {
        x: ((i + 0.5) / N + r.range(-0.04, 0.04)) * e.w,
        y: r() * e.h,
        z,
        s: (54 + z * 46) * Math.max(0.42, e.k),
        flip: r() * TAU,
        vf: r.range(0.25, 0.5) * r.sign(),
        tilt: r.range(-0.3, 0.3),
        ph: r() * TAU,
        vy: (5 + z * 7) * Math.max(0.5, e.k),
        kind: i % 4,
      };
    });
    list.sort((a, b) => a.z - b.z);
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      for (const c of list) {
        c.flip += c.vf * dt;
        c.y -= c.vy * dt;
        const h = (c.s * CH) / CW;
        if (c.y < -h) {
          c.y = e.h + h;
          c.kind = (c.kind + 1) % 4;
        }
        const bob = Math.sin(t * 0.6 + c.ph) * 6;
        const x = c.x + Math.sin(t * 0.21 + c.ph) * 14;
        const y = c.y + bob;
        const rot = c.tilt + Math.sin(t * 0.33 + c.ph) * 0.08;
        // Gira sobre sí misma: de frente se ve la cara; de espaldas, el dorso; de canto, casi nada y más oscura.
        const cosF = Math.cos(c.flip);
        const sx = Math.max(0.02, Math.abs(cosF));
        const side = cosF >= 0 ? fronts[c.kind] : back;
        const a = 0.55 + c.z * 0.4;
        const nominal = CW * 1.25;
        if (!e.dark) drawRot(g, shadow, e.dpr, CW * 0.5, x + 8, y + 12, c.s, rot, sx, 1, a * 0.22);
        else {
          g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
          g.globalCompositeOperation = "lighter";
          drawR(g, halo, x, y, c.s * 1.3, a * 0.12);
          g.globalCompositeOperation = "source-over";
        }
        drawRot(g, side, e.dpr, nominal, x, y, c.s, rot, sx, 1, a);
        // Luz y sombra del giro: un brillo que barre la carta y que se apaga al ponerse de canto.
        const W = side.width;
        const H = side.height;
        const sc = W / CW;
        g.save();
        roundRect(g, -W / 2 + sc, -H / 2 + sc, W - 2 * sc, H - 2 * sc, 7 * sc);
        g.clip();
        g.globalAlpha = a * (1 - sx) * 0.55;
        g.fillStyle = "rgba(0,0,0,1)";
        g.fillRect(-W / 2, -H / 2, W, H);
        const sheenPos = Math.sin(c.flip) * W * 0.9;
        const sh = g.createLinearGradient(sheenPos - W * 0.4, -H / 2, sheenPos + W * 0.4, H / 2);
        sh.addColorStop(0, "rgba(255,255,255,0)");
        sh.addColorStop(0.5, `rgba(255,255,255,${e.dark ? 0.22 : 0.35})`);
        sh.addColorStop(1, "rgba(255,255,255,0)");
        g.globalAlpha = a * sx;
        g.globalCompositeOperation = e.dark ? "lighter" : "source-over";
        g.fillStyle = sh;
        g.fillRect(-W / 2, -H / 2, W, H);
        g.restore();
        g.globalCompositeOperation = "source-over";
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Cristales ───────────── */

type Crystal = { x: number; y: number; z: number; s: number; rot: number; vr: number; lean: number; ph: number; hue: 0 | 1; glint: number };

const LIGHT_DIR = (() => {
  const v = [-0.5, 0.55, 0.67];
  const m = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / m) as [number, number, number];
})();

const crystals: EffectFactory = (env) => {
  const r = rng(351);
  const tints: RGB[] = [env.c.a, env.c.b];
  const halo = tints.map((c) => glow(lighten(c, 0.3), 64, 0.05, 1.8));
  const flareS = sprite(96, 96, (g, w) => {
    const R = w / 2;
    for (const [a, len] of [
      [0, 1],
      [Math.PI / 2, 1],
      [Math.PI / 4, 0.45],
      [-Math.PI / 4, 0.45],
    ] as const) {
      g.save();
      g.translate(R, R);
      g.rotate(a);
      const gr = g.createLinearGradient(-R * len, 0, R * len, 0);
      gr.addColorStop(0, "rgba(255,255,255,0)");
      gr.addColorStop(0.5, "rgba(255,255,255,1)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(-R * len, -1, R * len * 2, 2);
      g.restore();
    }
  });
  let list: Crystal[] = [];
  const fill = (e: FxEnv) => {
    const N = count(e, 6, 5, 11);
    list = Array.from({ length: N }, (_, i) => {
      const z = r();
      return {
        x: ((i + 0.5) / N + r.range(-0.035, 0.035)) * e.w,
        y: r.range(0.12, 0.88) * e.h,
        z,
        s: (26 + z * 34) * Math.max(0.42, e.k),
        rot: r() * TAU,
        vr: r.range(0.12, 0.3) * r.sign(),
        lean: r.range(-0.4, 0.4),
        ph: r() * TAU,
        hue: (i % 2) as 0 | 1,
        glint: 0,
      };
    });
    list.sort((a, b) => a.z - b.z);
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      for (const c of list) {
        c.rot += c.vr * dt;
        const tint = tints[c.hue];
        const dark = darken(tint, e.dark ? 0.55 : 0.35);
        const light = lighten(tint, e.dark ? 0.65 : 0.45);
        const x = c.x + Math.sin(t * 0.17 + c.ph) * 10;
        const y = c.y + Math.sin(t * 0.5 + c.ph) * 8;
        const R = c.s * 0.42;
        const bodyH = c.s * 1.25;
        const tipH = c.s * 0.62;
        const lean = c.lean + Math.sin(t * 0.23 + c.ph) * 0.05;
        const alpha = 0.45 + c.z * 0.45;
        // El resplandor de dentro.
        g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
        g.globalCompositeOperation = addMode(e);
        drawR(g, halo[c.hue], x, y - tipH * 0.3, c.s * 1.5, (e.dark ? 0.22 : 0.1) * (0.8 + 0.2 * Math.sin(t * 0.8 + c.ph)) * alpha);
        g.globalCompositeOperation = "source-over";
        // Se dibuja de pie en su sitio, inclinado; el prisma de seis caras gira sobre su eje.
        g.setTransform(e.dpr, 0, 0, e.dpr, x * e.dpr, y * e.dpr);
        g.rotate(lean);
        const yb = bodyH / 2;
        const yt = -bodyH / 2;
        const apex = yt - tipH;
        const vx = Array.from({ length: 6 }, (_, j) => c.rot + (j * TAU) / 6);
        const faces = vx.map((a, j) => {
          const mid = a + TAU / 12;
          return { j, a0: a, a1: vx[(j + 1) % 6], nz: Math.cos(mid), nx: Math.sin(mid) };
        });
        // Primero las caras de atrás, apenas visibles a través del cuarzo; luego las de delante.
        for (const back of [true, false]) {
          for (const f of faces) {
            if (back !== f.nz < 0) continue;
            const x0 = Math.sin(f.a0) * R;
            const x1 = Math.sin(f.a1) * R;
            const diff = Math.max(0, f.nx * LIGHT_DIR[0] + f.nz * LIGHT_DIR[2]);
            const spec = Math.pow(Math.max(0, f.nx * 0.25 + f.nz * 0.97), 24);
            const lit = back ? 0.15 : 0.22 + diff * 0.78;
            const col = mix(dark, light, lit);
            // La cara del prisma.
            g.beginPath();
            g.moveTo(x0, yb);
            g.lineTo(x1, yb);
            g.lineTo(x1, yt);
            g.lineTo(x0, yt);
            g.closePath();
            const fg = g.createLinearGradient(0, yt, 0, yb);
            fg.addColorStop(0, rgba(lighten(col, 0.15), 1));
            fg.addColorStop(1, rgba(darken(col, 0.25), 1));
            g.fillStyle = fg;
            g.globalAlpha = alpha * (back ? 0.25 : 0.62 + spec * 0.3);
            g.fill();
            if (!back && spec > 0.02) {
              g.globalAlpha = alpha * spec * 0.7;
              g.fillStyle = "rgba(255,255,255,1)";
              g.fill();
            }
            // La cara de la punta: más inclinada hacia arriba, recibe más luz.
            const tl = back ? 0.2 : clamp(0.32 + (f.nx * LIGHT_DIR[0] * 0.8 + 0.55 * LIGHT_DIR[1] + f.nz * 0.8 * LIGHT_DIR[2]) * 0.8);
            g.beginPath();
            g.moveTo(x0, yt);
            g.lineTo(x1, yt);
            g.lineTo(0, apex);
            g.closePath();
            g.fillStyle = rgba(mix(dark, light, tl), 1);
            g.globalAlpha = alpha * (back ? 0.25 : 0.7);
            g.fill();
            // Las aristas, con un filo de luz.
            g.strokeStyle = rgba(light, 1);
            g.lineWidth = back ? 0.5 : 0.9;
            g.globalAlpha = alpha * (back ? 0.2 : 0.55);
            g.beginPath();
            g.moveTo(x0, yb);
            g.lineTo(x0, yt);
            g.lineTo(0, apex);
            g.stroke();
          }
        }
        // La base, rota y apagada (el cristal sale de la roca).
        const base = g.createLinearGradient(0, yb - bodyH * 0.3, 0, yb);
        base.addColorStop(0, rgba(dark, 0));
        base.addColorStop(1, rgba(darken(dark, 0.3), 0.8));
        const xs = vx.map((a) => Math.sin(a) * R);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        g.fillStyle = base;
        g.globalAlpha = alpha;
        g.fillRect(minX, yb - bodyH * 0.3, maxX - minX, bodyH * 0.3 + 0.5);
        // Un destello en la punta de vez en cuando.
        c.glint = Math.max(0, c.glint - dt * 1.8);
        if (c.glint === 0 && Math.random() < dt * 0.09) c.glint = 1;
        if (c.glint > 0) {
          const I = Math.sin(Math.PI * c.glint);
          g.globalCompositeOperation = addMode(e);
          g.globalAlpha = I * (e.dark ? 0.95 : 0.7);
          const s = c.s * 0.9 * I;
          g.drawImage(flareS, -s, apex - s, s * 2, s * 2);
          g.globalCompositeOperation = "source-over";
        }
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Runas ───────────── */

/** Las 24 runas del futhark antiguo, como trazos en una caja de 0,6 × 1. */
const RUNES: [number, number][][][] = [
  [[[0.1, 0], [0.1, 1]], [[0.1, 0.35], [0.5, 0.05]], [[0.1, 0.6], [0.5, 0.3]]], // fehu
  [[[0.1, 1], [0.1, 0], [0.5, 0.3], [0.5, 1]]], // uruz
  [[[0.1, 0], [0.1, 1]], [[0.1, 0.25], [0.5, 0.5], [0.1, 0.75]]], // thurisaz
  [[[0.1, 0], [0.1, 1]], [[0.1, 0], [0.5, 0.25]], [[0.1, 0.3], [0.5, 0.55]]], // ansuz
  [[[0.1, 1], [0.1, 0], [0.5, 0.25], [0.1, 0.5], [0.5, 1]]], // raidho
  [[[0.5, 0.2], [0.1, 0.5], [0.5, 0.8]]], // kenaz
  [[[0.05, 0.1], [0.55, 0.9]], [[0.55, 0.1], [0.05, 0.9]]], // gebo
  [[[0.1, 1], [0.1, 0], [0.5, 0.25], [0.1, 0.5]]], // wunjo
  [[[0.1, 0], [0.1, 1]], [[0.5, 0], [0.5, 1]], [[0.1, 0.35], [0.5, 0.65]]], // hagalaz
  [[[0.3, 0], [0.3, 1]], [[0.05, 0.35], [0.55, 0.6]]], // nauthiz
  [[[0.3, 0], [0.3, 1]]], // isa
  [[[0.25, 0.1], [0.05, 0.35], [0.25, 0.6]], [[0.35, 0.4], [0.55, 0.65], [0.35, 0.9]]], // jera
  [[[0.3, 0], [0.3, 1]], [[0.3, 0], [0.55, 0.2]], [[0.3, 1], [0.05, 0.8]]], // eihwaz
  [[[0.1, 0], [0.1, 1]], [[0.1, 0.05], [0.5, 0.3], [0.55, 0.05]], [[0.1, 0.95], [0.5, 0.7], [0.55, 0.95]]], // perthro
  [[[0.3, 0], [0.3, 1]], [[0.3, 0.45], [0.05, 0.1]], [[0.3, 0.45], [0.55, 0.1]]], // algiz
  [[[0.45, 0], [0.1, 0.35], [0.5, 0.6], [0.15, 1]]], // sowilo
  [[[0.3, 0], [0.3, 1]], [[0.05, 0.3], [0.3, 0], [0.55, 0.3]]], // tiwaz
  [[[0.1, 0], [0.1, 1]], [[0.1, 0], [0.5, 0.25], [0.1, 0.5], [0.5, 0.75], [0.1, 1]]], // berkano
  [[[0.1, 1], [0.1, 0], [0.3, 0.3], [0.5, 0], [0.5, 1]]], // ehwaz
  [[[0.1, 0], [0.1, 1]], [[0.5, 0], [0.5, 1]], [[0.1, 0], [0.5, 0.4]], [[0.5, 0], [0.1, 0.4]]], // mannaz
  [[[0.1, 0], [0.1, 1]], [[0.1, 0], [0.5, 0.3]]], // laguz
  [[[0.3, 0.2], [0.55, 0.5], [0.3, 0.8], [0.05, 0.5], [0.3, 0.2]]], // ingwaz
  [[[0.05, 0], [0.05, 1], [0.55, 0], [0.55, 1], [0.05, 0]]], // dagaz
  [[[0.3, 0], [0.55, 0.35], [0.086, 1]], [[0.3, 0], [0.05, 0.35], [0.514, 1]]], // othala
];

type Rune = {
  x: number;
  y: number;
  h: number;
  i: number;
  c: 0 | 1;
  age: number;
  carve: number;
  hold: number;
  fade: number;
  wait: number;
  segs: { x0: number; y0: number; x1: number; y1: number; l: number }[];
  len: number;
};
type Ember = { x: number; y: number; vx: number; vy: number; age: number; life: number; c: 0 | 1 };

const runes: EffectFactory = (env) => {
  const r = rng(361);
  const n = makeNoise(361);
  const cols: RGB[] = [ink(env, env.c.b), ink(env, env.c.a, 0.3)];
  const cores = cols.map((c) => lighten(c, env.dark ? 0.7 : 0.25));
  const tip = cols.map((c) => glow(lighten(c, 0.5), 32, 0.15, 1.6));
  const emberS = cols.map((c) => glow(lighten(c, 0.4), 16, 0.25, 1.5));
  const haloS = cols.map((c) => glow(c, 64, 0, 2));
  let list: Rune[] = [];
  const embers: Ember[] = [];

  const place = (e: FxEnv, q: Rune) => {
    const k = Math.max(0.45, e.k);
    q.h = r.range(42, 92) * k;
    // Lejos de las otras runas que se ven ahora.
    for (let tries = 0; tries < 12; tries++) {
      q.x = r.range(0.05, 0.92) * e.w;
      q.y = r.range(0.06, 0.86) * e.h;
      if (list.every((o) => o === q || o.wait > 0 || Math.hypot(o.x - q.x, o.y - q.y) > (o.h + q.h) * 1.1)) break;
    }
    q.i = Math.floor(r() * RUNES.length);
    q.c = r() < 0.5 ? 0 : 1;
    q.age = 0;
    q.carve = r.range(1.4, 2.4);
    q.hold = r.range(3, 5.5);
    q.fade = r.range(1.4, 2);
    q.segs = [];
    q.len = 0;
    for (const line of RUNES[q.i])
      for (let j = 1; j < line.length; j++) {
        const [ax, ay] = line[j - 1];
        const [bx, by] = line[j];
        const x0 = q.x + (ax - 0.3) * q.h;
        const y0 = q.y + (ay - 0.5) * q.h;
        const x1 = q.x + (bx - 0.3) * q.h;
        const y1 = q.y + (by - 0.5) * q.h;
        const l = Math.hypot(x1 - x0, y1 - y0);
        q.segs.push({ x0, y0, x1, y1, l });
        q.len += l;
      }
  };
  const fill = (e: FxEnv) => {
    list = [];
    const N = count(e, 4, 4, 8);
    for (let i = 0; i < N; i++) {
      const q = { wait: i * 1.1 + r() * 1.5 } as Rune;
      list.push(q);
      place(e, q);
    }
  };
  fill(env);

  const strokeTo = (g: CanvasRenderingContext2D, q: Rune, upTo: number) => {
    let left = upTo;
    let tx = q.segs[0]?.x0 ?? q.x;
    let ty = q.segs[0]?.y0 ?? q.y;
    g.beginPath();
    for (const s of q.segs) {
      if (left <= 0) break;
      const f = Math.min(1, left / s.l);
      g.moveTo(s.x0, s.y0);
      tx = s.x0 + (s.x1 - s.x0) * f;
      ty = s.y0 + (s.y1 - s.y0) * f;
      g.lineTo(tx, ty);
      left -= s.l;
    }
    return [tx, ty] as const;
  };

  return {
    resize: fill,
    frame(g, e, t, dt) {
      const k = Math.max(0.45, e.k);
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const q of list) {
        if (q.wait > 0) {
          q.wait -= dt;
          if (q.wait <= 0) place(e, q);
          continue;
        }
        q.age += dt;
        const end = q.carve + q.hold + q.fade;
        if (q.age > end) {
          q.wait = r.range(0.8, 3);
          continue;
        }
        const carving = q.age < q.carve;
        const prog = carving ? smooth(0, 1, q.age / q.carve) * q.len : q.len;
        const dying = q.age > q.carve + q.hold;
        const fa = dying ? 1 - (q.age - q.carve - q.hold) / q.fade : 1;
        const pulse = 0.85 + 0.15 * Math.sin(t * 2.1 + q.x);
        const flick = 0.92 + 0.08 * n(t * 6, q.x * 0.01, q.y * 0.01);
        const a = fa * pulse * flick;
        const w = Math.max(1.2, q.h * 0.045);
        // El resplandor que deja la runa en lo que la rodea.
        g.globalCompositeOperation = addMode(e);
        drawR(g, haloS[q.c], q.x, q.y, q.h * 1.1, a * (e.dark ? 0.16 : 0.07) * (prog / q.len));
        const [tx, ty] = strokeTo(g, q, prog);
        g.strokeStyle = rgba(cols[q.c], 1);
        g.globalAlpha = a * (e.dark ? 0.12 : 0.08);
        g.lineWidth = w * 6;
        g.stroke();
        g.globalAlpha = a * (e.dark ? 0.28 : 0.2);
        g.lineWidth = w * 2.6;
        g.stroke();
        g.strokeStyle = rgba(cores[q.c], 1);
        g.globalAlpha = a * 0.95;
        g.lineWidth = w;
        g.stroke();
        // La punta que va grabando, como una chispa.
        if (carving) {
          drawR(g, tip[q.c], tx, ty, w * 5, 0.95);
          if (r() < dt * 30) embers.push({ x: tx, y: ty, vx: r.range(-14, 14) * k, vy: -r.range(8, 30) * k, age: 0, life: r.range(0.5, 1.1), c: q.c });
        }
        // Al deshacerse suelta brasas que suben.
        if (dying && q.segs.length) {
          let want = dt * 26 * (q.len / 100);
          while (want > 0 && embers.length < 260) {
            if (want < 1 && r() > want) break;
            want -= 1;
            const s = q.segs[Math.floor(r() * q.segs.length)];
            const f = r();
            embers.push({ x: s.x0 + (s.x1 - s.x0) * f, y: s.y0 + (s.y1 - s.y0) * f, vx: r.range(-8, 8) * k, vy: -r.range(16, 44) * k, age: 0, life: r.range(0.9, 1.9), c: q.c });
          }
        }
      }
      g.globalCompositeOperation = addMode(e);
      for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i];
        p.age += dt;
        if (p.age > p.life) {
          embers.splice(i, 1);
          continue;
        }
        p.vx += n(p.x * 0.03, p.y * 0.03, t) * 30 * k * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const l = p.age / p.life;
        drawR(g, emberS[p.c], p.x, p.y, (3.2 - l * 2) * k, (1 - l) * (0.6 + 0.4 * Math.sin(p.age * 25 + p.x)));
      }
      g.globalAlpha = 1;
    },
  };
};

export const MAGIC: Partial<Record<Decor, EffectFactory>> = {
  golddust,
  candles,
  mandala,
  flowerlife,
  cards,
  crystals,
  runes,
};
