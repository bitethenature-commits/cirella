/**
 * Herramientas de los fondos con movimiento dibujados (components/decor-fx): colores, azar con semilla, ruido
 * (simplex 3D y fractal), imágenes pintadas una vez y reutilizadas (sprites) y curvas de animación.
 */

export type RGB = [number, number, number];

/** Lo que cada fondo sabe de dónde se pinta. */
export type FxEnv = {
  /** Tamaño en píxeles CSS. */
  w: number;
  h: number;
  dpr: number;
  /** Fondo oscuro (la luz suma) o claro (se pinta con sombra y colores más hondos). */
  dark: boolean;
  /** El diseño eligió «Color del efecto»: manda ese en lugar de los colores naturales. */
  own: boolean;
  /** Dentro de una caja pequeña (miniaturas y vistas previas), no a pantalla completa. */
  contained: boolean;
  /** Escala de las piezas: 1 a pantalla completa, menos en las miniaturas. */
  k: number;
  /** Brillo de las estrellas (0–1). */
  starO: number;
  c: { a: RGB; b: RGB; a2: RGB; b2: RGB; soft: RGB; bg: RGB; moon: RGB; moonEdge: RGB };
};

/** Un fondo: lo que hace al cambiar de tamaño, cómo pinta cada fotograma (t y dt en segundos) y qué suelta al quitarlo. */
export type Effect = {
  resize?(env: FxEnv): void;
  frame(g: CanvasRenderingContext2D, env: FxEnv, t: number, dt: number): void;
  dispose?(): void;
};
export type EffectFactory = (env: FxEnv) => Effect;

/* ───────────── Colores ───────────── */

export function hexRgb(v: string | null | undefined, fb: RGB): RGB {
  const s = (v ?? "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const r = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (r) return [Number(r[1]), Number(r[2]), Number(r[3])];
  return fb;
}
export const hex = (h: string): RGB => hexRgb(h, [255, 255, 255]);
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const lighten = (c: RGB, t: number) => mix(c, [255, 255, 255], t);
export const darken = (c: RGB, t: number) => mix(c, [0, 0, 0], t);
export const lum = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

/**
 * El color natural de algo (la nieve, la llama…) o, si el diseño eligió «Color del efecto», el suyo. Sobre un fondo
 * claro se oscurece lo justo para que se vea.
 */
export function nat(env: FxEnv, natural: RGB, own: RGB, lightShift = 0.45): RGB {
  const c = env.own ? own : natural;
  if (env.dark) return c;
  return lum(c) > 0.55 ? darken(c, lightShift) : c;
}

/** Cómo se suma la luz: sobre lo oscuro, sumando; sobre lo claro, encima. */
export const addMode = (env: FxEnv): GlobalCompositeOperation => (env.dark ? "lighter" : "source-over");

/* ───────────── Azar y curvas ───────────── */

/** Azar con semilla (mulberry32): siempre igual para la misma semilla. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(r, {
    range: (lo: number, hi: number) => lo + r() * (hi - lo),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length],
    sign: () => (r() < 0.5 ? -1 : 1),
    /** Normal (media 0, desviación 1). */
    gauss: () => {
      let u = 0;
      let v = 0;
      while (u === 0) u = r();
      while (v === 0) v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  });
}
export type Rng = ReturnType<typeof rng>;

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;

/** Cuántas piezas caben: por superficie (piezas por millón de píxeles), entre un mínimo y un máximo. */
export const count = (env: FxEnv, perMega: number, lo: number, hi: number) => Math.round(clamp((env.w * env.h * perMega) / 1e6, lo, hi));

/* ───────────── Ruido ───────────── */

const GRAD3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];

/** Ruido simplex 3D (Gustavson): suave, entre -1 y 1. */
export function makeNoise(seed = 1) {
  const r = rng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  const pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    pm12[i] = perm[i] % 12;
  }
  const F3 = 1 / 3;
  const G3 = 1 / 6;
  return function noise3(x: number, y: number, z: number): number {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    let n = 0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const g = pm12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n += t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n += t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n += t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n += t3 * t3 * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3);
    }
    return 32 * n;
  };
}
export type Noise3 = ReturnType<typeof makeNoise>;

/** Ruido fractal (varias octavas), entre -1 y 1 aprox. */
export function fbm(n: Noise3, x: number, y: number, z: number, oct = 4, gain = 0.5, lac = 2) {
  let s = 0;
  let a = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * n(x * f, y * f, z + o * 17.3);
    norm += a;
    a *= gain;
    f *= lac;
  }
  return s / norm;
}

/** El viento: una racha suave que va y viene (px/s), igual para todas las piezas. */
export function wind(n: Noise3, t: number, base: number, gust: number) {
  return base + gust * (n(t * 0.07, 3.1, 7.7) * 0.7 + n(t * 0.23, 9.4, 1.3) * 0.3);
}

/* ───────────── Imágenes pintadas una vez ───────────── */

export type Sprite = HTMLCanvasElement;

/** Un lienzo aparte de w×h px (en píxeles de dibujo) donde se pinta una vez algo que luego se copia. */
export function sprite(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): Sprite {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext("2d");
  if (g) draw(g, c.width, c.height);
  return c;
}

/** ¿Se puede desenfocar al pintar? (Safari antiguo no). */
let filterOk: boolean | null = null;
export function canFilter() {
  if (filterOk === null) {
    const g = document.createElement("canvas").getContext("2d");
    filterOk = !!g && "filter" in g;
  }
  return filterOk;
}

/** La misma imagen, desenfocada (para lo que está muy cerca o muy lejos). */
export function blurred(src: Sprite, px: number): Sprite {
  if (px <= 0.3 || !canFilter()) return src;
  const pad = Math.ceil(px * 2.5);
  return sprite(src.width + pad * 2, src.height + pad * 2, (g) => {
    g.filter = `blur(${px}px)`;
    g.drawImage(src, pad, pad);
  });
}

/** Un punto de luz: centro intenso y halo que se apaga (radio r en px de dibujo). */
export function glow(c: RGB, r: number, core = 0.12, falloff = 2.2): Sprite {
  return sprite(r * 2, r * 2, (g) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    for (let i = 0; i <= 10; i++) {
      const x = i / 10;
      const inCore = core > 0 && x <= core;
      const a = inCore ? 1 : Math.pow(Math.max(0, 1 - (x - core) / (1 - core)), falloff);
      gr.addColorStop(x, rgba(inCore ? lighten(c, 0.6 * (1 - x / core)) : c, a));
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, r * 2, r * 2);
  });
}

/** Una textura de ruido fractal coloreada (pequeña: se estira al pintarla, y así sale suave como una nube). */
export function noiseTexture(
  w: number,
  h: number,
  seed: number,
  pixel: (n: Noise3, u: number, v: number) => [number, number, number, number],
): Sprite {
  const n = makeNoise(seed);
  return sprite(w, h, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const [r, gg, b, a] = pixel(n, x / W, y / H);
        const i = (y * W + x) * 4;
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b;
        d[i + 3] = a;
      }
    g.putImageData(img, 0, 0);
  });
}

/**
 * Como noiseTexture, pero poco a poco (unas filas en cada fotograma, sin parar la página), para las texturas grandes
 * y finas; `done` la recibe al acabar. Devuelve cómo pararla (si el fondo se rehace antes).
 */
export function noiseTextureLater(
  w: number,
  h: number,
  seed: number,
  pixel: (n: Noise3, u: number, v: number) => [number, number, number, number],
  done: (s: Sprite) => void,
  rowsPerFrame = 20,
): () => void {
  const n = makeNoise(seed);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext("2d");
  if (!g) return () => {};
  const W = c.width;
  const H = c.height;
  const img = g.createImageData(W, H);
  const d = img.data;
  let y = 0;
  let raf = 0;
  let dead = false;
  const step = () => {
    if (dead) return;
    const end = Math.min(H, y + rowsPerFrame);
    for (; y < end; y++)
      for (let x = 0; x < W; x++) {
        const [r, gg, b, a] = pixel(n, x / W, y / H);
        const i = (y * W + x) * 4;
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b;
        // Un pelín de grano en la transparencia: sin escalones al estirarla.
        d[i + 3] = a > 2 ? Math.min(255, a + (((x * 7 + y * 13) % 5) - 2)) : a;
      }
    if (y < H) raf = requestAnimationFrame(step);
    else {
      g.putImageData(img, 0, 0);
      done(c);
    }
  };
  raf = requestAnimationFrame(step);
  return () => {
    dead = true;
    cancelAnimationFrame(raf);
  };
}

/** Una textura al doble de tamaño y desenfocada lo justo: al estirarla luego mucho no se ven los cuadritos. */
export function soften(src: Sprite, px = 1.3): Sprite {
  return sprite(src.width * 2, src.height * 2, (g, W, H) => {
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    if (canFilter()) g.filter = `blur(${px}px)`;
    g.drawImage(src, 0, 0, W, H);
  });
}

/** Ruido que se repite a lo ancho sin costura (u en 0–1 da la vuelta): para niebla y nubes que pasan. */
export function loopNoise(n: Noise3, u: number, v: number, freq: number, oct = 4, z = 0) {
  const a = u * TAU;
  const rad = freq / TAU;
  return fbm(n, Math.cos(a) * rad, Math.sin(a) * rad, v * freq + z, oct);
}

/**
 * Pinta deprisa un sprite hecho a `nominal` px CSS (con la nitidez de la pantalla) centrado en (x, y), a `size` px,
 * girado `rot` y achatado (sx, sy: el giro en 3D de un pétalo o una carta). Deja la transformación cambiada: al
 * terminar, `g.setTransform(dpr, 0, 0, dpr, 0, 0)`.
 */
export function drawRot(g: CanvasRenderingContext2D, s: Sprite, dpr: number, nominal: number, x: number, y: number, size: number, rot: number, sx = 1, sy = 1, alpha = 1) {
  if (alpha <= 0.003) return;
  const f = size / nominal;
  const c = Math.cos(rot);
  const si = Math.sin(rot);
  g.globalAlpha = Math.min(1, alpha);
  g.setTransform(c * f * sx, si * f * sx, -si * f * sy, c * f * sy, x * dpr, y * dpr);
  g.drawImage(s, -s.width / 2, -s.height / 2);
}

/** Pinta un sprite redondo (un halo) centrado en (x, y) con radio r en px CSS, sea cual sea su resolución. */
export function drawR(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, r: number, alpha = 1) {
  if (alpha <= 0.002 || r <= 0) return;
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(s, x - r, y - r, r * 2, r * 2);
}

/** Pinta un sprite centrado en (x, y), girado, con escala y opacidad. */
export function blit(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale: number, rot = 0, alpha = 1, sx = 1, sy = 1) {
  if (alpha <= 0.002) return;
  g.globalAlpha = alpha;
  if (rot === 0 && sx === 1 && sy === 1) {
    const w = s.width * scale;
    const h = s.height * scale;
    g.drawImage(s, x - w / 2, y - h / 2, w, h);
    return;
  }
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.scale(scale * sx, scale * sy);
  g.drawImage(s, -s.width / 2, -s.height / 2);
  g.restore();
}
