import type { Decor } from "@/lib/templates";
import {
  addMode,
  blurred,
  clamp,
  count,
  darken,
  drawR,
  drawRot,
  fbm,
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
  type RGB,
  type Sprite,
} from "./util";

/* ───────────── Olas ───────────── */

const waves: EffectFactory = (env) => {
  const r = rng(201);
  const n = makeNoise(201);
  const day = !env.dark;
  const deep = env.own ? darken(env.c.a, 0.55) : day ? hex("#1B4F73") : hex("#0E2C47");
  const near = env.own ? env.c.a : day ? hex("#2C6E95") : hex("#1D4E72");
  const far = env.own ? lighten(env.c.b, 0.15) : day ? hex("#8FC3DD") : hex("#3F6E8F");
  const crest = env.own ? lighten(env.c.b, 0.5) : day ? hex("#EAF6FB") : hex("#A9D2EC");
  const layers = [0, 1, 2, 3].map((i) => ({
    i,
    amp: 6 + i * 3.2,
    len: 210 + i * 70,
    speed: 16 + i * 7,
    phase: r() * TAU,
    col: mix(far, near, i / 3),
    haze: 0.55 - i * 0.15,
  }));
  const glints = Array.from({ length: 40 }, () => ({ u: r(), p: r() * TAU, f: r.range(1.5, 4) }));
  return {
    frame(g, e, t) {
      const k = Math.max(0.45, e.k);
      const Ho = Math.min(e.h * 0.3, 280 * k);
      g.globalCompositeOperation = "source-over";
      for (const L of layers) {
        const yb = e.h - Ho * (1 - L.i * 0.21);
        const A = L.amp * k;
        const k1 = TAU / (L.len * k);
        const k2 = k1 * 2.13;
        const pts: [number, number, number][] = [];
        for (let u = -40; u <= e.w + 40; u += 5) {
          const th1 = k1 * u - L.speed * k1 * k * t + L.phase;
          const th2 = k2 * u + 0.7 * L.speed * k2 * k * t + L.phase * 2;
          const X = u + 0.65 * A * Math.cos(th1) + 0.2 * A * Math.cos(th2);
          const Y = -A * Math.sin(th1) - 0.42 * A * Math.sin(th2) + A * 0.45 * n(u * 0.003, L.i * 3, t * 0.12);
          pts.push([X, yb + Y, Math.sin(th1)]);
        }
        const col = mix(L.col, e.c.bg, L.haze * 0.35);
        const gr = g.createLinearGradient(0, yb - A * 1.6, 0, e.h);
        gr.addColorStop(0, rgba(lighten(col, 0.18), 0.92));
        gr.addColorStop(0.35, rgba(col, 0.95));
        gr.addColorStop(1, rgba(deep, 1));
        g.globalAlpha = 0.55 + L.i * 0.13;
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(pts[0][0], e.h + 2);
        for (const [x, y] of pts) g.lineTo(x, y);
        g.lineTo(pts[pts.length - 1][0], e.h + 2);
        g.closePath();
        g.fill();
        // El filo de luz de la cresta y la espuma donde la ola es más alta.
        g.strokeStyle = rgba(crest, 0.35 + L.i * 0.1);
        g.lineWidth = 1 + L.i * 0.35;
        g.beginPath();
        pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.fillStyle = rgba(crest, 1);
        for (let j = 0; j < pts.length; j += 2) {
          const [x, y, s] = pts[j];
          if (s < 0.72) continue;
          const f = (s - 0.72) / 0.28;
          g.globalAlpha = f * (0.25 + L.i * 0.12);
          g.beginPath();
          g.ellipse(x, y + 1.5, (2 + f * 6) * k, (0.8 + f) * k, 0, 0, TAU);
          g.fill();
        }
      }
      // Destellos de luz sobre el agua de delante.
      g.globalCompositeOperation = addMode(e);
      g.fillStyle = rgba(crest, 1);
      const yb = e.h - Ho * 0.37;
      for (const s of glints) {
        const a = Math.pow(Math.max(0, Math.sin(t * s.f + s.p)), 6);
        if (a < 0.05) continue;
        g.globalAlpha = a * 0.75;
        const x = s.u * e.w;
        g.fillRect(x - 3 * k, yb + Ho * 0.18 + (s.u * 997) % (Ho * 0.4), 6 * k, 1.2);
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Lluvia ───────────── */

type Drop = { x: number; y: number; z: number; vy: number; len: number; gy: number };
type Splash = { x: number; y: number; age: number; z: number; d: [number, number, number, number][] };

const rain: EffectFactory = (env) => {
  const r = rng(211);
  const n = makeNoise(211);
  const c = nat(env, hex("#B8CCE0"), env.c.soft, 0.5);
  const streak = sprite(3 * env.dpr, 64 * env.dpr, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, rgba(c, 0));
    gr.addColorStop(0.7, rgba(c, 0.55));
    gr.addColorStop(1, rgba(lighten(c, 0.4), 0.95));
    g.fillStyle = gr;
    g.fillRect(w * 0.25, 0, w * 0.5, h);
  });
  let drops: Drop[] = [];
  const splashes: Splash[] = [];
  const spawn = (e: FxEnv, d: Drop | null, anywhere: boolean): Drop => {
    const z = Math.pow(r(), 1.3);
    const q = d ?? ({} as Drop);
    q.z = z;
    q.vy = (650 + z * 900) * Math.max(0.5, e.k);
    q.len = (12 + z * 58) * Math.max(0.45, e.k);
    q.x = r.range(-0.2, 1.1) * e.w;
    q.y = anywhere ? r() * e.h : -q.len - r() * 60;
    q.gy = z > 0.55 ? e.h * r.range(0.86, 1.02) : e.h + 80;
    return q;
  };
  const fill = (e: FxEnv) => {
    drops = Array.from({ length: count(e, 150, 90, 340) }, () => spawn(e, null, true));
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      const k = Math.max(0.5, e.k);
      const wv = wind(n, t, 70, 90) * k;
      g.globalCompositeOperation = "source-over";
      for (const d of drops) {
        d.y += d.vy * dt;
        d.x += wv * (0.6 + d.z * 0.5) * dt;
        if (d.y > d.gy) {
          if (d.gy < e.h + 10 && splashes.length < 80)
            splashes.push({
              x: d.x,
              y: d.gy,
              age: 0,
              z: d.z,
              d: Array.from({ length: 3 }, () => [0, 0, r.range(-60, 60) * k, -r.range(70, 160) * k] as [number, number, number, number]),
            });
          spawn(e, d, false);
        }
        if (d.x > e.w + 40) d.x -= e.w + 80;
        const ang = Math.atan2(-wv * (0.6 + d.z * 0.5), d.vy);
        const wpx = 0.7 + d.z * 1.3;
        drawRot(g, streak, e.dpr, 64, d.x, d.y - d.len / 2, d.len, ang, (wpx / 3) * (64 / d.len) * 3, 1, (0.16 + d.z * 0.32) * (e.dark ? 1 : 1.2));
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      // Las salpicaduras: un anillo que se abre y unas gotitas que saltan.
      g.strokeStyle = rgba(c, 1);
      g.fillStyle = rgba(c, 1);
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.age += dt;
        const p = s.age / 0.45;
        if (p >= 1) {
          splashes.splice(i, 1);
          continue;
        }
        const rad = (2 + p * 9) * (0.5 + s.z) * k;
        g.globalAlpha = (1 - p) * 0.45;
        g.lineWidth = 0.8;
        g.beginPath();
        g.ellipse(s.x, s.y, rad, rad * 0.28, 0, 0, TAU);
        g.stroke();
        for (const dd of s.d) {
          dd[3] += 600 * k * dt;
          dd[0] += dd[2] * dt;
          dd[1] += dd[3] * dt;
          if (dd[1] > 0) continue;
          g.globalAlpha = (1 - p) * 0.6;
          g.fillRect(s.x + dd[0] - 0.7, s.y + dd[1] - 0.7, 1.4, 1.4);
        }
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Reflejos de agua ───────────── */

/** El dibujo de la luz en el fondo de una piscina (cáusticas), que se repite sin costura. */
function causticTex(size: number, shift: number, c: RGB): Sprite {
  return sprite(size, size, (g) => {
    const img = g.createImageData(size, size);
    const d = img.data;
    const inten = 0.005;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const px = (x / size) * TAU - 250;
        const py = (y / size) * TAU - 250;
        let ix = px;
        let iy = py;
        let cc = 1;
        for (let k = 0; k < 5; k++) {
          const tt = shift * (1 - 3.5 / (k + 1));
          const nx = px + Math.cos(tt - ix) + Math.sin(tt + iy);
          const ny = py + Math.sin(tt - iy) + Math.cos(tt + ix);
          ix = nx;
          iy = ny;
          cc += 1 / Math.hypot(px / (Math.sin(ix + tt) / inten), py / (Math.cos(iy + tt) / inten));
        }
        cc /= 5;
        cc = 1.17 - Math.pow(cc, 1.4);
        const v = clamp(Math.pow(Math.abs(cc), 8));
        const i = (y * size + x) * 4;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = Math.round(v * 255);
      }
    g.putImageData(img, 0, 0);
  });
}

/** Un haz de luz que baja: blando a los lados y apagándose hacia abajo. */
function beam(c: RGB): Sprite {
  return sprite(64, 256, (g, w, h) => {
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, rgba(c, 0));
    gx.addColorStop(0.5, rgba(c, 1));
    gx.addColorStop(1, rgba(c, 0));
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-in";
    const gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, "rgba(0,0,0,1)");
    gy.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gy;
    g.fillRect(0, 0, w, h);
  });
}

const caustics: EffectFactory = (env) => {
  const r = rng(221);
  const n = makeNoise(221);
  const c = env.own ? lighten(env.c.a, 0.45) : env.dark ? hex("#BFF6FF") : hex("#2E9DB0");
  const texs: Sprite[] = [causticTex(200, 4.2, c)];
  requestAnimationFrame(() => texs.push(causticTex(200, 23.7, env.own ? lighten(env.c.b, 0.4) : c)));
  const ray = beam(env.own ? lighten(env.c.b, 0.3) : env.dark ? hex("#9BEFF7") : hex("#3AA9BB"));
  const off = document.createElement("canvas");
  const og = off.getContext("2d");
  const rays = Array.from({ length: 7 }, (_, i) => ({ x: (i + 0.5) / 7 + r.range(-0.05, 0.05), w: r.range(0.06, 0.14), p: r() * TAU, f: r.range(0.12, 0.3) }));
  const motes = Array.from({ length: 50 }, () => ({ x: r(), y: r(), s: r.range(0.6, 1.8), p: r() * TAU }));
  return {
    frame(g, e, t, dt) {
      const k = Math.max(0.4, e.k);
      // La luz de la superficie, arriba.
      const top = g.createLinearGradient(0, 0, 0, e.h * 0.5);
      top.addColorStop(0, rgba(c, e.dark ? 0.14 : 0.1));
      top.addColorStop(1, rgba(c, 0));
      g.fillStyle = top;
      g.fillRect(0, 0, e.w, e.h * 0.5);
      // Las cáusticas: dos capas que se cruzan, fuertes arriba y apagándose hacia abajo.
      if (og) {
        const S = 2;
        const W = Math.ceil(e.w / S);
        const H = Math.ceil(e.h / S);
        if (off.width !== W || off.height !== H) {
          off.width = W;
          off.height = H;
        }
        og.globalCompositeOperation = "source-over";
        og.clearRect(0, 0, W, H);
        og.globalCompositeOperation = "lighter";
        texs.forEach((tx, i) => {
          const tile = ((i ? 330 : 270) * k * (1 + 0.04 * Math.sin(t * 0.2 + i))) / S;
          const ox = ((((i ? -1 : 1) * t * 9 * k) / S) % tile + tile) % tile;
          const oy = (((t * (i ? 11 : 6) * k) / S) % tile + tile) % tile;
          og.globalAlpha = 0.7;
          for (let y = -tile + oy; y < H; y += tile) for (let x = -tile + ox; x < W; x += tile) og.drawImage(tx, x, y, tile + 0.5, tile + 0.5);
        });
        og.globalCompositeOperation = "destination-in";
        og.globalAlpha = 1;
        const m = og.createLinearGradient(0, 0, 0, H);
        m.addColorStop(0, "rgba(0,0,0,.95)");
        m.addColorStop(0.55, "rgba(0,0,0,.35)");
        m.addColorStop(1, "rgba(0,0,0,.05)");
        og.fillStyle = m;
        og.fillRect(0, 0, W, H);
        g.globalCompositeOperation = addMode(e);
        g.globalAlpha = e.dark ? 0.6 : 0.4;
        g.drawImage(off, 0, 0, e.w, e.h);
      }
      // Los haces de luz que bajan y se mecen.
      g.globalCompositeOperation = addMode(e);
      for (const b of rays) {
        const a = (0.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * b.f + b.p))) * (e.dark ? 1 : 0.6);
        g.save();
        g.translate(b.x * e.w, -e.h * 0.05);
        g.rotate(0.12 + 0.05 * Math.sin(t * 0.15 + b.p));
        g.globalAlpha = a;
        g.drawImage(ray, (-b.w * e.w) / 2, 0, b.w * e.w, e.h * 1.1);
        g.restore();
      }
      // Partículas que flotan en el agua.
      g.fillStyle = rgba(c, 1);
      for (const m of motes) {
        m.x += n(m.x * 3, m.y * 3, t * 0.1) * 0.004 * dt * 10;
        m.y += (n(m.x * 3 + 9, m.y * 3, t * 0.1) * 0.003 - 0.0008) * dt * 10;
        if (m.y < -0.02) m.y = 1.02;
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;
        g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + m.p);
        g.fillRect(m.x * e.w, m.y * e.h, m.s * k, m.s * k);
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Burbujas de jabón ───────────── */

function bubbleFilm(colors: RGB[], start: number, dark: boolean): Sprite {
  const S = 160;
  return sprite(S, S, (g) => {
    const R = S / 2;
    const anyG = g as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
    let fill: CanvasGradient;
    if (typeof anyG.createConicGradient === "function") {
      fill = anyG.createConicGradient(start, R, R);
      colors.forEach((c, i) => fill.addColorStop(i / colors.length, rgba(c, 1)));
      fill.addColorStop(1, rgba(colors[0], 1));
    } else {
      fill = g.createLinearGradient(0, 0, S, S);
      colors.forEach((c, i) => fill.addColorStop(i / (colors.length - 1), rgba(c, 1)));
    }
    g.fillStyle = fill;
    g.beginPath();
    g.arc(R, R, R - 1, 0, TAU);
    g.fill();
    // La película: casi transparente en el centro y con color en el borde.
    g.globalCompositeOperation = "destination-in";
    const m = g.createRadialGradient(R, R, 0, R, R, R);
    m.addColorStop(0, "rgba(0,0,0,.06)");
    m.addColorStop(0.62, "rgba(0,0,0,.12)");
    m.addColorStop(0.86, "rgba(0,0,0,.55)");
    m.addColorStop(0.97, "rgba(0,0,0,.9)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = m;
    g.fillRect(0, 0, S, S);
    if (!dark) {
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = "rgba(0,0,0,.12)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(R, R, R - 1.5, 0, TAU);
      g.stroke();
    }
  });
}

/** Los brillos de una burbuja (la ventana reflejada arriba y un filo abajo): no giran con ella. */
function bubbleShine(): Sprite {
  const S = 160;
  return sprite(S, S, (g) => {
    const R = S / 2;
    g.save();
    g.translate(R * 0.62, R * 0.55);
    g.rotate(-0.6);
    const w = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
    w.addColorStop(0, "rgba(255,255,255,.9)");
    w.addColorStop(0.5, "rgba(255,255,255,.35)");
    w.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = w;
    g.scale(1, 0.55);
    g.beginPath();
    g.arc(0, 0, R * 0.32, 0, TAU);
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,255,255,.45)";
    g.lineWidth = 2;
    g.lineCap = "round";
    g.beginPath();
    g.arc(R, R, R * 0.86, 0.35, 1.25);
    g.stroke();
  });
}

type Bubble = { x: number; y: number; r: number; vy: number; ph: number; f: number; rot: number; vr: number; life: number; age: number; pop: number; v: number };

const bubbles: EffectFactory = (env) => {
  const r = rng(231);
  const n = makeNoise(231);
  const iri = env.own
    ? [env.c.a, lighten(env.c.a, 0.5), env.c.b, lighten(env.c.b, 0.5), env.c.a2]
    : ["#FF6FD0", "#FFD36B", "#7DFFC9", "#6FB6FF", "#C47CFF"].map(hex);
  const films = [0, 1.7, 3.6].map((s) => bubbleFilm(iri, s, env.dark));
  const shine = bubbleShine();
  let list: Bubble[] = [];
  const spawn = (e: FxEnv, b: Bubble | null, anywhere: boolean): Bubble => {
    const q = b ?? ({} as Bubble);
    q.r = r.range(12, 44) * Math.max(0.35, e.k);
    q.x = r() * e.w;
    q.y = anywhere ? r() * e.h : e.h + q.r * 2;
    q.vy = r.range(16, 38) * Math.max(0.5, e.k);
    q.ph = r() * TAU;
    q.f = r.range(1.2, 2.4);
    q.rot = r() * TAU;
    q.vr = r.range(-0.35, 0.35);
    q.life = r.range(9, 22);
    q.age = anywhere ? r() * q.life * 0.8 : 0;
    q.pop = -1;
    q.v = Math.floor(r() * films.length);
    return q;
  };
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 7, 7, 18) }, () => spawn(e, null, true));
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      const wv = wind(n, t, 6, 18) * Math.max(0.5, e.k);
      g.globalCompositeOperation = "source-over";
      for (const b of list) {
        if (b.pop >= 0) {
          // Se rompe: un anillo de gotitas que se abre y desaparece.
          b.pop += dt;
          const p = b.pop / 0.28;
          if (p >= 1) {
            spawn(e, b, false);
            continue;
          }
          g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
          g.fillStyle = rgba(e.dark ? hex("#FFFFFF") : hex("#7A8798"), 1);
          g.globalAlpha = (1 - p) * 0.8;
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU + b.rot;
            const d = b.r * (1 + p * 0.7);
            g.fillRect(b.x + Math.cos(a) * d - 0.9, b.y + Math.sin(a) * d - 0.9, 1.8, 1.8);
          }
          continue;
        }
        b.age += dt;
        b.ph += b.f * dt;
        b.rot += b.vr * dt;
        b.y -= b.vy * dt;
        b.x += (wv + Math.sin(b.ph * 0.5) * 10) * dt;
        if (b.age > b.life || b.y < -b.r * 2) {
          if (b.y < -b.r * 2) spawn(e, b, false);
          else b.pop = 0;
          continue;
        }
        if (b.x > e.w + b.r * 2) b.x -= e.w + b.r * 4;
        if (b.x < -b.r * 2) b.x += e.w + b.r * 4;
        const wob = 0.035 * Math.sin(b.ph * 2.3);
        const fadeIn = Math.min(1, b.age / 0.6);
        drawRot(g, films[b.v], e.dpr, 160 / e.dpr, b.x, b.y, b.r * 2, b.rot, 1 + wob, 1 - wob, (e.dark ? 0.85 : 0.95) * fadeIn);
        drawRot(g, shine, e.dpr, 160 / e.dpr, b.x, b.y, b.r * 2, 0, 1 + wob, 1 - wob, (e.dark ? 0.9 : 0.75) * fadeIn);
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Luces desenfocadas ───────────── */

function bokehDisc(c: RGB, hexagon: boolean): Sprite {
  const S = 128;
  return blurred(
    sprite(S, S, (g) => {
      const R = S / 2 - 4;
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, R);
      gr.addColorStop(0, rgba(c, 0.5));
      gr.addColorStop(0.7, rgba(c, 0.58));
      gr.addColorStop(0.9, rgba(lighten(c, 0.25), 0.95));
      gr.addColorStop(1, rgba(c, 0.6));
      g.fillStyle = gr;
      g.beginPath();
      if (hexagon) for (let i = 0; i < 6; i++) g[i ? "lineTo" : "moveTo"](S / 2 + Math.cos((i * TAU) / 6 + 0.3) * R, S / 2 + Math.sin((i * TAU) / 6 + 0.3) * R);
      else g.arc(S / 2, S / 2, R, 0, TAU);
      g.closePath();
      g.fill();
    }),
    1.5,
  );
}

const bokeh: EffectFactory = (env) => {
  const r = rng(241);
  const n = makeNoise(241);
  const cols = [env.c.a, env.c.b, env.c.a2, env.c.b2, env.dark ? hex("#FFE9C2") : env.c.b].map((c) => (env.dark ? c : darken(c, 0.15)));
  const discs = cols.flatMap((c) => [bokehDisc(c, false), bokehDisc(c, true)]);
  let list: { x: number; y: number; s: number; d: number; p: number; f: number; id: number }[] = [];
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 12, 12, 30) }, (_, i) => ({
      x: r() * e.w,
      y: r() * e.h,
      s: r.range(18, 82) * Math.max(0.35, e.k),
      d: Math.floor(r() * discs.length * 0.999) & ~1 | (r() < 0.25 ? 1 : 0),
      p: r() * TAU,
      f: r.range(0.15, 0.4),
      id: i * 5.1,
    }));
    list.sort((a, b) => b.s - a.s);
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      g.globalCompositeOperation = addMode(e);
      for (const b of list) {
        const sp = (90 - b.s) * 0.12 + 3;
        b.x += n(b.id, t * 0.05, 1) * sp * dt;
        b.y += (n(b.id, t * 0.05, 7) * sp - 2) * dt;
        if (b.y < -b.s) b.y = e.h + b.s;
        if (b.x < -b.s) b.x = e.w + b.s;
        if (b.x > e.w + b.s) b.x = -b.s;
        const a = (0.16 + 0.14 * Math.sin(t * b.f + b.p)) * (e.dark ? 1 : 0.85);
        drawR(g, discs[b.d % discs.length], b.x, b.y, b.s, a);
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Destellos ───────────── */

/** Un destello de cuatro puntas largas y otras cuatro cortas en diagonal, con el centro encendido. */
function flare(c: RGB): Sprite {
  const S = 160;
  return sprite(S, S, (g) => {
    const R = S / 2;
    g.translate(R, R);
    const ray = (len: number, wid: number, a: number) => {
      g.save();
      g.rotate(a);
      const gr = g.createLinearGradient(-len, 0, len, 0);
      gr.addColorStop(0, rgba(c, 0));
      gr.addColorStop(0.5, rgba(lighten(c, 0.6), 1));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-len, 0);
      g.quadraticCurveTo(0, -wid, len, 0);
      g.quadraticCurveTo(0, wid, -len, 0);
      g.fill();
      g.restore();
    };
    ray(R, 3.2, 0);
    ray(R, 3.2, Math.PI / 2);
    ray(R * 0.42, 2, Math.PI / 4);
    ray(R * 0.42, 2, -Math.PI / 4);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.22);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(0.3, rgba(lighten(c, 0.5), 0.8));
    core.addColorStop(1, rgba(c, 0));
    g.fillStyle = core;
    g.fillRect(-R, -R, S, S);
  });
}

const sparkles: EffectFactory = (env) => {
  const r = rng(251);
  const cols = (env.dark ? [env.c.b2, env.c.a2, env.c.b] : [env.c.b, env.c.a, darken(env.c.b, 0.2)]).map((c) => c);
  const flares = cols.map(flare);
  const glows = cols.map((c) => glow(c, 48, 0.1, 2));
  let list: { x: number; y: number; s: number; wait: number; dur: number; age: number; c: number; rot: number }[] = [];
  const reset = (e: FxEnv, s: (typeof list)[number] | null) => {
    const q = s ?? ({} as (typeof list)[number]);
    q.x = r() * e.w;
    q.y = r() * e.h;
    q.s = r.range(10, 30) * Math.max(0.4, e.k);
    q.wait = r.range(0.2, 4.5);
    q.dur = r.range(0.7, 1.4);
    q.age = 0;
    q.c = Math.floor(r() * cols.length);
    q.rot = r.range(-0.3, 0.3);
    return q;
  };
  const fill = (e: FxEnv) => {
    list = Array.from({ length: count(e, 14, 14, 40) }, () => reset(e, null));
  };
  fill(env);
  return {
    resize: fill,
    frame(g, e, t, dt) {
      g.globalCompositeOperation = addMode(e);
      for (const s of list) {
        if (s.wait > 0) {
          s.wait -= dt;
          continue;
        }
        s.age += dt;
        const p = s.age / s.dur;
        if (p >= 1) {
          reset(e, s);
          continue;
        }
        const I = Math.pow(Math.sin(Math.PI * p), 1.6);
        drawR(g, glows[s.c], s.x, s.y, s.s * 0.9, I * 0.55);
        drawRot(g, flares[s.c], e.dpr, 160 / e.dpr, s.x, s.y, s.s * 2.4 * (0.6 + 0.4 * I), s.rot + p * 0.4, 1, 1, I);
      }
      g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Rayos de sol ───────────── */

const sunrays: EffectFactory = (env) => {
  const r = rng(261);
  const n = makeNoise(261);
  const c = nat(env, hex("#FFE3A3"), env.c.b, 0.35);
  const rays = Array.from({ length: 14 }, (_, i) => ({ a: 0.12 + (i / 13) * 1.25 + r.range(-0.04, 0.04), w: r.range(0.018, 0.06), id: i * 3.3 }));
  const sun = glow(lighten(c, 0.3), 160, 0.05, 1.8);
  const mote = glow(lighten(c, 0.4), 24, 0.2, 1.6);
  const motes = Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: r.range(0.8, 2.4), p: r() * TAU }));
  const off = document.createElement("canvas");
  const og = off.getContext("2d");
  const inten = (i: number, t: number) => clamp(0.35 + 0.65 * (n(rays[i].id, t * 0.08, 2) * 0.5 + 0.5));
  return {
    frame(g, e, t, dt) {
      const sx = -e.w * 0.06;
      const sy = -e.h * 0.12;
      const D = Math.hypot(e.w, e.h) * 1.15;
      if (og) {
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
        rays.forEach((ray, i) => {
          const a = ray.a + 0.02 * Math.sin(t * 0.06 + ray.id);
          const I = inten(i, t);
          const x0 = sx / S;
          const y0 = sy / S;
          const gr = og.createLinearGradient(x0, y0, x0 + (Math.cos(a) * D) / S, y0 + (Math.sin(a) * D) / S);
          gr.addColorStop(0, rgba(c, 0.5 * I));
          gr.addColorStop(0.45, rgba(c, 0.16 * I));
          gr.addColorStop(1, rgba(c, 0));
          og.fillStyle = gr;
          og.beginPath();
          og.moveTo(x0, y0);
          og.lineTo(x0 + (Math.cos(a - ray.w) * D) / S, y0 + (Math.sin(a - ray.w) * D) / S);
          og.lineTo(x0 + (Math.cos(a + ray.w) * D) / S, y0 + (Math.sin(a + ray.w) * D) / S);
          og.closePath();
          og.fill();
        });
        g.globalCompositeOperation = addMode(e);
        g.globalAlpha = e.dark ? 0.75 : 0.55;
        g.drawImage(off, 0, 0, e.w, e.h);
      }
      g.globalCompositeOperation = addMode(e);
      drawR(g, sun, sx, sy, Math.min(e.w, e.h) * 0.55, e.dark ? 0.55 : 0.45);
      // El polvo que flota y brilla al cruzar un rayo.
      for (const m of motes) {
        m.x += (n(m.x * 4, m.y * 4, t * 0.06) * 0.006 + 0.0008) * dt * 6;
        m.y += (n(m.x * 4 + 30, m.y * 4, t * 0.06) * 0.004 + 0.0005) * dt * 6;
        if (m.x > 1.02) m.x = -0.02;
        if (m.y > 1.02) m.y = -0.02;
        const px = m.x * e.w;
        const py = m.y * e.h;
        const ang = Math.atan2(py - sy, px - sx);
        let lit = 0.12;
        rays.forEach((ray, i) => {
          const d = Math.abs(ang - ray.a);
          if (d < ray.w) lit = Math.max(lit, inten(i, t) * (1 - d / ray.w));
        });
        drawR(g, mote, px, py, m.s * 2.4 * Math.max(0.5, e.k), lit * (0.6 + 0.4 * Math.sin(t * 1.7 + m.p)));
      }
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Humo de incienso ───────────── */

/** Una bocanada de humo que lleva el aire: dónde está, su edad, su tamaño, cuánto gira, lo densa que es y su dibujo. */
type Wisp = { x: number; y: number; age: number; life: number; big: number; rot: number; spin: number; a: number; look: number; sp: number; lift: number };
/** Por donde sale el humo, abajo y fuera de la vista: se mueve despacio y sopla más o menos, hacia un lado o al otro. */
type Vent = { x: number; ph: number; acc: number };

/** Tamaño (px de dibujo) de cada bocanada pintada. */
const WISP_N = 96;

/** Una bocanada: una nube suave de borde deshilachado y más densa por dentro a trozos (sin bordes ni bolitas). */
function wispSprite(c: RGB, S: number, seed: number): Sprite {
  const n = makeNoise(seed);
  return sprite(S, S, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = ((x + 0.5) / W) * 2 - 1;
        const v = ((y + 0.5) / H) * 2 - 1;
        const wx = u + 0.32 * fbm(n, u * 1.6, v * 1.6, 0, 3);
        const wy = v + 0.32 * fbm(n, u * 1.6 + 4.1, v * 1.6, 1, 3);
        const body = Math.pow(clamp(1 - Math.hypot(wx, wy) / 0.8), 1.7);
        const tex = clamp(0.62 + 0.6 * fbm(n, u * 3.4 + 7, v * 3.4, 2, 4));
        const a = body * tex * (1 - smooth(0.86, 1, Math.hypot(u, v)));
        const sh = 0.9 + 0.12 * tex;
        const i = (y * W + x) * 4;
        d[i] = c[0] * sh;
        d[i + 1] = c[1] * sh;
        d[i + 2] = c[2] * sh;
        d[i + 3] = Math.round(clamp(a) * 255);
      }
    g.putImageData(img, 0, 0);
  });
}

/**
 * Humo de incienso: un fondo de humo que sube desde abajo. Por varias salidas (bajo la pantalla) sale humo caliente
 * que sopla hacia arriba, cada una con su fuerza y su inclinación, que cambian despacio; y a lo largo de todo el suelo
 * hay humo suelto que el aire va metiendo en las columnas. El aire es un fluido de verdad en una rejilla gruesa (no se
 * puede amontonar ni vaciar): el humo caliente sube y arrastra el de alrededor, y cuando dos columnas se encuentran no
 * se atraviesan: chocan, se apartan y se enroscan en remolinos. El humo son cientos de bocanadas suaves que el aire
 * lleva, que crecen al subir y se apagan arriba; se pintan en una capa aparte, a menos resolución.
 */
const smoke: EffectFactory = (env) => {
  const n = makeNoise(271);
  const r = rng(271);
  const c = nat(env, hex("#E6E8EE"), env.c.soft, 0.45);
  const looks = [0, 1, 2, 3].map((i) => wispSprite(c, WISP_N, 300 + i * 17));
  /** Lo que sopla cada salida, lo que empuja el humo caliente, el aire inquieto, los remolinos y el freno (en celdas/s). */
  const JET = 3.6;
  const BUOY = 2.4;
  const TURB = 1.3;
  const VORT = 1.4;
  const DRAG = 0.32;
  const ITERS = 18;

  let nx = 0;
  let ny = 0;
  let cs = 1;
  let ox = 0;
  let u = new Float32Array(0);
  let v = u;
  let u0 = u;
  let v0 = u;
  let d = u;
  let d0 = u;
  let p = u;
  let dv = u;
  let w = u;
  let tx = u;
  let ty = u;
  let vents: Vent[] = [];
  let wisps: Wisp[] = [];
  let amb = 0;
  let steps = 0;
  let span = 12;
  let layer: HTMLCanvasElement | null = null;

  /** Valor de una rejilla en (x, y), en celdas (con los bordes pegados). */
  const sample = (f: Float32Array, x: number, y: number) => {
    const X = clamp(x - 0.5, 0, nx - 1.001);
    const Y = clamp(y - 0.5, 0, ny - 1.001);
    const i = X | 0;
    const j = Y | 0;
    const fx = X - i;
    const fy = Y - j;
    const k = i + j * nx;
    return (f[k] * (1 - fx) + f[k + 1] * fx) * (1 - fy) + (f[k + nx] * (1 - fx) + f[k + nx + 1] * fx) * fy;
  };

  /** El aire se lleva algo (o a sí mismo): cada celda toma lo que había de donde viene. */
  const advect = (dst: Float32Array, src: Float32Array, U: Float32Array, V: Float32Array, dt: number) => {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = i + j * nx;
        dst[k] = sample(src, i + 0.5 - U[k] * dt, j + 0.5 - V[k] * dt);
      }
  };

  /** Que no se amontone ni se vacíe: lo que sobra en un sitio empuja a los de al lado (abierto solo por arriba). */
  const project = () => {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = i + j * nx;
        const uL = i > 0 ? u[k - 1] : 0;
        const uR = i < nx - 1 ? u[k + 1] : 0;
        const vT = j > 0 ? v[k - nx] : v[k];
        const vB = j < ny - 1 ? v[k + nx] : 0;
        dv[k] = -0.5 * (uR - uL + vB - vT);
      }
    for (let it = 0; it < ITERS; it++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const k = i + j * nx;
          let s = dv[k];
          let cnt = 1;
          if (j > 0) s += p[k - nx];
          if (i > 0) {
            s += p[k - 1];
            cnt++;
          }
          if (i < nx - 1) {
            s += p[k + 1];
            cnt++;
          }
          if (j < ny - 1) {
            s += p[k + nx];
            cnt++;
          }
          p[k] += 1.6 * (s / cnt - p[k]);
        }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = i + j * nx;
        const pL = i > 0 ? p[k - 1] : p[k];
        const pR = i < nx - 1 ? p[k + 1] : p[k];
        const pT = j > 0 ? p[k - nx] : 0;
        const pB = j < ny - 1 ? p[k + nx] : p[k];
        u[k] -= 0.5 * (pR - pL);
        v[k] -= 0.5 * (pB - pT);
      }
  };

  /** Los remolinos no se pierden: se refuerza el giro que ya hay. */
  const confine = (dt: number) => {
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const k = i + j * nx;
        w[k] = 0.5 * (v[k + 1] - v[k - 1]) - 0.5 * (u[k + nx] - u[k - nx]);
      }
    for (let j = 2; j < ny - 2; j++)
      for (let i = 2; i < nx - 2; i++) {
        const k = i + j * nx;
        const gx = 0.5 * (Math.abs(w[k + 1]) - Math.abs(w[k - 1]));
        const gy = 0.5 * (Math.abs(w[k + nx]) - Math.abs(w[k - nx]));
        const m = Math.hypot(gx, gy) + 1e-5;
        u[k] += VORT * (gy / m) * w[k] * dt;
        v[k] -= VORT * (gx / m) * w[k] * dt;
      }
  };

  const puff = (x: number, y: number, a: number, lift: number): Wisp => ({
    x,
    y,
    age: 0,
    life: span * r.range(0.8, 1.1),
    big: r.range(0.8, 1.25),
    rot: r() * TAU,
    spin: r.range(-0.35, 0.35),
    a,
    look: Math.floor(r() * looks.length) % looks.length,
    sp: r() * 50,
    lift,
  });

  const step = (e: FxEnv, t: number, dt: number) => {
    // 1. Lo que empuja el aire: las salidas, el humo caliente que sube, un aire que nunca está quieto, los remolinos.
    for (const vt of vents) {
      const x = vt.x * e.w + Math.sin(t * 0.05 + vt.ph) * e.w * 0.05;
      const y = e.h + 1.2 * cs;
      const str = clamp(0.55 + 0.6 * n(t * 0.17, vt.ph, 1), 0.15, 1);
      const ang = 0.5 * n(t * 0.09, vt.ph, 4);
      const tu = Math.sin(ang) * JET * str;
      const tv = -Math.cos(ang) * JET * str;
      const gi = (x - ox) / cs;
      const gj = y / cs;
      const R = 1.8;
      const f0 = Math.min(1, 6 * dt);
      for (let j = Math.max(0, Math.floor(gj - R)); j <= Math.min(ny - 1, Math.ceil(gj + R)); j++)
        for (let i = Math.max(0, Math.floor(gi - R)); i <= Math.min(nx - 1, Math.ceil(gi + R)); i++) {
          const q = 1 - Math.hypot(i + 0.5 - gi, j + 0.5 - gj) / R;
          if (q <= 0) continue;
          const k = i + j * nx;
          u[k] += (tu - u[k]) * f0 * q;
          v[k] += (tv - v[k]) * f0 * q;
          d[k] = Math.min(3, d[k] + 1.6 * str * q * dt);
        }
      vt.acc += dt * 9 * (0.4 + 0.6 * str);
      for (; vt.acc >= 1; vt.acc--) wisps.push(puff(x + r.range(-0.7, 0.7) * cs, y + r.range(-0.5, 0.5) * cs, 0.2 * (0.6 + 0.4 * str), 0));
    }
    // El humo suelto de todo el suelo (sube despacio por sí mismo hasta que el aire lo coge).
    amb += (dt * e.w) / 110;
    for (; amb >= 1; amb--) wisps.push(puff(r() * e.w, e.h + r.range(0.3, 1.5) * cs, 0.12, 0.7 * cs));

    // El aire inquieto cambia despacio: se calcula cada pocos pasos.
    if (steps++ % 4 === 0)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const k = i + j * nx;
          tx[k] = n(i * 0.16, j * 0.16, t * 0.22) * TURB;
          ty[k] = n(i * 0.16 + 31, j * 0.16, t * 0.22) * TURB * 0.6;
        }
    const drag = 1 - DRAG * dt;
    const decay = 1 - 0.09 * dt;
    for (let k = 0; k < nx * ny; k++) {
      let a = (u[k] + tx[k] * dt) * drag;
      let b = (v[k] + (ty[k] - BUOY * d[k]) * dt) * drag;
      // Por si acaso (también si algo sale mal): nunca se desboca.
      if (!(Math.abs(a) < 14)) a = 0;
      if (!(Math.abs(b) < 14)) b = 0;
      u[k] = a;
      v[k] = b;
      d[k] *= decay;
    }
    confine(dt);

    // 2. El aire se lleva a sí mismo y se reparte (así las columnas chocan y se apartan), y luego al humo caliente.
    u0.set(u);
    v0.set(v);
    advect(u, u0, u0, v0, dt);
    advect(v, v0, u0, v0, dt);
    project();
    d0.set(d);
    advect(d, d0, u, v, dt);

    // 3. Las bocanadas van con el aire (más un temblor fino que la rejilla no ve) y se apagan al acabar su vida.
    let m = 0;
    for (const q of wisps) {
      q.age += dt;
      if (q.age >= q.life || q.y < -cs * 4) continue;
      const gx = (q.x - ox) / cs;
      const gy = q.y / cs;
      const fine = cs * 0.55 * (0.4 + q.age / q.life);
      q.x += (sample(u, gx, gy) * cs + n(q.x * 0.011, q.y * 0.011, t * 0.3 + q.sp) * fine) * dt;
      q.y += (sample(v, gx, gy) * cs - q.lift + n(q.x * 0.011 + 50, q.y * 0.011, t * 0.3 + q.sp) * fine * 0.6) * dt;
      q.rot += q.spin * dt;
      wisps[m++] = q;
    }
    wisps.length = m;
  };

  const build = (e: FxEnv) => {
    cs = Math.max(e.w, e.h) / 54;
    nx = Math.ceil(e.w / cs) + 4;
    ny = Math.ceil(e.h / cs) + 3;
    ox = -2 * cs;
    const N = nx * ny;
    [u, v, u0, v0, d, d0, p, dv, w, tx, ty] = Array.from({ length: 11 }, () => new Float32Array(N));
    // Lo que tarda el humo en cruzar la pantalla (en una alta tarda más).
    span = clamp((ny - 3) / 3, 8, 18);
    const nv = Math.round(clamp(e.w / 260, 3, 7));
    vents = Array.from({ length: nv }, (_, i) => ({ x: (i + 0.5 + r.range(-0.25, 0.25)) / nv, ph: r() * 100, acc: r() }));
    wisps = [];
    amb = 0;
    steps = 0;
    // Al abrir la página, el humo ya ha subido (no empieza a salir de abajo).
    for (let i = 0; i < Math.round(span * 12); i++) step(e, i / 12, 1 / 12);
  };
  build(env);

  return {
    resize: build,
    frame(g, e, t, dt) {
      step(e, t, dt);
      const ls = clamp(0.5 * e.dpr, 0.5, 0.75);
      const W = Math.max(1, Math.round(e.w * ls));
      const H = Math.max(1, Math.round(e.h * ls));
      if (!layer || layer.width !== W || layer.height !== H) {
        layer = document.createElement("canvas");
        layer.width = W;
        layer.height = H;
      }
      const L = layer.getContext("2d");
      if (!L) return;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.globalAlpha = 1;
      L.clearRect(0, 0, W, H);
      L.imageSmoothingEnabled = true;
      for (const q of wisps) {
        const life = q.age / q.life;
        // Entra suave, se apaga al final de su vida y, algo, al subir.
        const a = q.a * smooth(0, 1.2, q.age) * (1 - smooth(0.45, 1, life)) * (0.3 + 0.7 * smooth(0, 0.75, q.y / e.h));
        if (a < 0.004) continue;
        const sz = (cs * q.big * (0.9 + 3.4 * Math.pow(life, 0.65)) * ls) / WISP_N;
        const co = Math.cos(q.rot) * sz;
        const si = Math.sin(q.rot) * sz;
        L.setTransform(co, si, -si, co, q.x * ls, q.y * ls);
        L.globalAlpha = Math.min(1, a);
        L.drawImage(looks[q.look], -WISP_N / 2, -WISP_N / 2);
      }
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.globalAlpha = (e.dark ? 0.8 : 0.85) * (0.92 + 0.08 * Math.sin(t * 0.3));
      g.drawImage(layer, 0, 0, e.w, e.h);
      g.globalAlpha = 1;
    },
  };
};

/* ───────────── Calima ───────────── */

function dustStrip(seed: number, c: RGB): Sprite {
  return noiseTexture(380, 120, seed, (nn, u, v) => {
    const f = loopNoise(nn, u, v * 0.5, 4, 5);
    const prof = Math.sin(Math.PI * v);
    const a = smooth(-0.4, 0.7, f) * prof;
    return [c[0], c[1], c[2], Math.round(clamp(a) * 200)];
  });
}

const haze: EffectFactory = (env) => {
  const r = rng(281);
  const n = makeNoise(281);
  const warm = nat(env, hex("#E9B97A"), env.c.a, 0.25);
  const deepC = nat(env, hex("#D98E4F"), env.c.b, 0.2);
  const strips = [dustStrip(1, warm), dustStrip(2, deepC)];
  const sun = glow(env.dark ? hex("#FFF1D6") : hex("#FFF6E4"), 128, 0.25, 1.4);
  const spec = glow(lighten(warm, 0.5), 16, 0.3, 1.4);
  const motes = Array.from({ length: 90 }, () => ({ x: r(), y: r(), s: r.range(0.5, 1.8), p: r() * TAU, f: r.range(0.5, 2) }));
  return {
    frame(g, e, t, dt) {
      const breathe = 0.85 + 0.15 * Math.sin(t * 0.08);
      const gr = g.createLinearGradient(0, 0, 0, e.h);
      gr.addColorStop(0, rgba(warm, 0));
      gr.addColorStop(0.45, rgba(warm, 0.13 * breathe));
      gr.addColorStop(1, rgba(deepC, 0.26 * breathe));
      g.fillStyle = gr;
      g.fillRect(0, 0, e.w, e.h);
      // El sol, un disco pálido detrás del polvo.
      g.globalCompositeOperation = addMode(e);
      drawR(g, sun, e.w * 0.78, e.h * 0.22, Math.min(e.w, e.h) * 0.16, (e.dark ? 0.32 : 0.55) * breathe);
      // Nubes de polvo que pasan despacio.
      g.globalCompositeOperation = "source-over";
      strips.forEach((s, i) => {
        const w = Math.max(e.w * 1.6, 700);
        const h = e.h * (0.55 + i * 0.2);
        const off = (((t * (5 + i * 4) * Math.max(0.4, e.k)) % w) + w) % w;
        g.globalAlpha = (e.dark ? 0.22 : 0.3) * (0.8 + 0.2 * Math.sin(t * 0.05 + i * 2));
        for (let x = -off; x < e.w; x += w) g.drawImage(s, x, e.h * (0.3 + i * 0.25) - h / 2, w, h);
      });
      // Motas de polvo que brillan al girar.
      g.globalCompositeOperation = addMode(e);
      for (const m of motes) {
        m.x += (n(m.x * 3, m.y * 3, t * 0.05) * 0.004 + 0.0012) * dt * 6;
        m.y += n(m.x * 3 + 20, m.y * 3, t * 0.05) * 0.003 * dt * 6;
        if (m.x > 1.02) m.x = -0.02;
        if (m.y < -0.02) m.y = 1.02;
        if (m.y > 1.02) m.y = -0.02;
        const glint = Math.pow(Math.max(0, Math.sin(t * m.f + m.p)), 8);
        drawR(g, spec, m.x * e.w, m.y * e.h, m.s * (2 + glint * 3) * Math.max(0.5, e.k), 0.25 + glint * 0.7);
      }
      g.globalAlpha = 1;
    },
  };
};

export const LIGHT: Partial<Record<Decor, EffectFactory>> = {
  waves,
  rain,
  caustics,
  bubbles,
  bokeh,
  sparkles,
  sunrays,
  smoke,
  haze,
};
