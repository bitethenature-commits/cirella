import { clamp, fbm, lighten, makeNoise, mix, smooth, type Noise3, type RGB } from "./util";

/**
 * Cómo es cada punto de una capa de la nebulosa (u, v: 0–1; `asp`: ancho entre alto): nubes de gas retorcidas con
 * mucho detalle, hilos brillantes más finos dentro y franjas de polvo oscuro de borde marcado que las cortan.
 * Sin nada del navegador: se usa también en la tarea aparte (nebula.worker.ts).
 */
export function nebulaPixel(c1: RGB, c2: RGB, sparse: boolean, asp: number, fine = true) {
  const oct = fine ? 8 : 5;
  return (n: Noise3, u: number, v: number): [number, number, number, number] => {
    const x = u * 2.3 * asp;
    const y = v * 2.3;
    const q = fbm(n, x, y, 0, 4);
    const q2 = fbm(n, x + 5.2, y + 1.3, 1, 4);
    const w = fbm(n, x + 1.8 * q, y + 1.8 * q2, 2, oct);
    let dens = smooth(sparse ? 0.1 : -0.1, sparse ? 0.7 : 0.58, w);
    // Los hilos: crestas finas del mismo gas retorcido, solo donde hay gas.
    const ridge = 1 - Math.abs(fbm(n, x * 1.6 + 2 * q, y * 1.6 + 2 * q2, 4, fine ? 6 : 4));
    const fil = Math.pow(ridge, 9) * smooth(-0.25, 0.35, w) * (sparse ? 0.6 : 1);
    // El polvo: franjas oscuras con el borde nítido.
    const dust = smooth(0.14, 0.32, fbm(n, x * 2.1 + 9 + 0.6 * q, y * 2.1, 3, fine ? 7 : 4));
    dens *= 1 - 0.85 * dust;
    const a = clamp(dens * 0.92 + fil * 0.8 * (1 - 0.7 * dust));
    const col = mix(c1, c2, smooth(-0.45, 0.55, q + 0.3 * q2));
    const hot = lighten(col, clamp(dens * dens * 0.5 + fil * 0.6));
    return [hot[0], hot[1], hot[2], Math.round(a * 240)];
  };
}

/** Lo que pide quien quiere una capa pintada. */
export type NebulaJob = { W: number; H: number; seed: number; c1: RGB; c2: RGB; sparse: boolean };

/** Pinta una capa entera (W×H) y devuelve sus píxeles (RGBA), con un pelín de grano para que no haya escalones. */
export function paintNebula(j: NebulaJob): Uint8ClampedArray<ArrayBuffer> {
  const { W, H } = j;
  const n = makeNoise(j.seed);
  const pixel = nebulaPixel(j.c1, j.c2, j.sparse, W / H);
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = pixel(n, x / W, y / H);
      const i = (y * W + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a > 2 ? a + (((x * 7 + y * 13) % 5) - 2) : a;
    }
  return d;
}
