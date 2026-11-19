import { clamp, count, glow, hex, lighten, mix, rgba, sprite, TAU, type FxEnv, type RGB, type Rng, type Sprite } from "./util";

/** Los colores de las estrellas de verdad: azuladas, blancas, amarillentas y alguna anaranjada. */
const STAR_COLORS: RGB[] = [hex("#9DB4FF"), hex("#CAD8FF"), hex("#FFFFFF"), hex("#FFF3E4"), hex("#FFD7AA")];
const STAR_WEIGHTS = [0.12, 0.22, 0.36, 0.2, 0.1];

type Star = { x: number; y: number; s: number; a: number; f: number; p: number; ci: number; z: number };

/** Cruz de luz (los rayos de las estrellas más brillantes, como en una foto). */
function spikes(c: RGB, r: number): Sprite {
  return sprite(r * 2, r * 2, (g) => {
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, rgba(c, 0));
      gr.addColorStop(0.5, rgba(lighten(c, 0.4), 0.9));
      gr.addColorStop(1, rgba(c, 0));
      g.strokeStyle = gr;
      g.lineWidth = Math.max(1, r * 0.035);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    };
    line(0, r, r * 2, r);
    line(r, 0, r, r * 2);
  });
}

export type StarField = {
  draw(g: CanvasRenderingContext2D, env: FxEnv, t: number, dt: number, fade?: (x: number, y: number) => number): void;
};

/**
 * Un cielo de estrellas: muchas diminutas y pocas brillantes (con halo y, las que más, con sus rayos), de colores
 * de verdad, que titilan cada una a su ritmo y se mueven muy despacio, más las cercanas que las lejanas.
 * `density`: estrellas por millón de píxeles. `bandW`: concentra parte de ellas en una franja (la Vía Láctea).
 */
export function makeStars(env: FxEnv, r: Rng, density = 260, opts: { bright?: number; band?: (x: number, y: number) => number } = {}): StarField {
  const n = count(env, density, 40, 1100);
  const stars: Star[] = [];
  const pickColor = () => {
    let x = r();
    for (let i = 0; i < STAR_WEIGHTS.length; i++) {
      if ((x -= STAR_WEIGHTS[i]) <= 0) return i;
    }
    return 2;
  };
  const add = (x: number, y: number, dim = false) => {
    const big = Math.pow(r(), 7) * (opts.bright ?? 1);
    stars.push({
      x,
      y,
      s: (dim ? 0.35 : 0.45) + big * 2.6 + r() * 0.5,
      a: dim ? 0.25 + r() * 0.35 : 0.35 + r() * 0.65,
      f: 0.6 + r() * 2.4,
      p: r() * TAU,
      ci: pickColor(),
      z: r(),
    });
  };
  for (let i = 0; i < n; i++) add(r() * env.w, r() * env.h);
  // La franja de la Vía Láctea: muchas más, pequeñas y tenues.
  if (opts.band) {
    let tries = 0;
    for (let i = 0; i < n * 0.9 && tries < n * 12; tries++) {
      const x = r() * env.w;
      const y = r() * env.h;
      if (r() < opts.band(x / env.w, y / env.h)) {
        add(x, y, true);
        i++;
      }
    }
  }
  stars.sort((a, b) => a.ci - b.ci);

  // Sobre un fondo claro las estrellas no brillan: se ven como puntitos del color suave del diseño.
  const colors = env.dark ? STAR_COLORS : STAR_COLORS.map((c) => mix(c, env.c.soft, 0.85));
  const glows = colors.map((c) => glow(c, 24 * env.dpr, 0.08, 2.6));
  const crosses = colors.map((c) => spikes(c, 40 * env.dpr));
  const bright = clamp(env.starO / 0.7, 0.2, 1.4);

  return {
    draw(g, e, t, dt, fade) {
      const W = e.w;
      const H = e.h;
      g.globalCompositeOperation = e.dark ? "lighter" : "source-over";
      let ci = -1;
      for (const s of stars) {
        s.x -= (0.6 + s.z * 2.2) * dt * e.k;
        if (s.x < -4) s.x += W + 8;
        if (s.x > W + 4) s.x -= W + 8;
        if (s.y > H + 4) s.y = s.y % H;
        const tw = 0.7 + 0.3 * Math.sin(t * s.f + s.p) * (0.85 + 0.15 * Math.sin(t * s.f * 2.7 + s.p * 1.7));
        let a = s.a * tw * bright * (e.dark ? 1 : 0.55);
        if (fade) a *= fade(s.x, s.y);
        if (a < 0.02) continue;
        const sz = s.s * Math.max(0.6, e.k);
        if (sz < 1.15) {
          if (s.ci !== ci) {
            ci = s.ci;
            g.fillStyle = rgba(colors[ci], 1);
          }
          g.globalAlpha = Math.min(1, a);
          g.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
        } else {
          const gs = (sz * 3.2) / (24 * e.dpr);
          g.globalAlpha = Math.min(1, a);
          g.drawImage(glows[s.ci], s.x - 24 * e.dpr * gs, s.y - 24 * e.dpr * gs, 48 * e.dpr * gs, 48 * e.dpr * gs);
          if (sz > 2.1) {
            const cs = (sz * 5.5) / (40 * e.dpr);
            g.globalAlpha = Math.min(1, a * 0.55);
            g.drawImage(crosses[s.ci], s.x - 40 * e.dpr * cs, s.y - 40 * e.dpr * cs, 80 * e.dpr * cs, 80 * e.dpr * cs);
          }
          ci = -1;
        }
      }
      g.globalAlpha = 1;
    },
  };
}
