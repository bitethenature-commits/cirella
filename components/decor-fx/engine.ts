import { clamp, hexRgb, lum, type Effect, type EffectFactory, type FxEnv, type RGB } from "./util";

const FALLBACK: Record<keyof FxEnv["c"], RGB> = {
  a: [201, 187, 242],
  b: [217, 191, 140],
  a2: [233, 226, 252],
  b2: [240, 226, 196],
  soft: [236, 232, 246],
  bg: [11, 14, 31],
  moon: [251, 247, 236],
  moonEdge: [180, 172, 150],
};

/** El elemento de arriba que lleva las variables del diseño (la página .cp, el panel .pd o el área de alumna). */
function varsHost(el: Element): HTMLElement | null {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n instanceof HTMLElement && n.style.getPropertyValue("--fx-a")) return n;
  }
  return null;
}

/**
 * Pone en marcha un fondo con movimiento en un <canvas>: lo ajusta a su caja (y a la nitidez de la pantalla),
 * lee los colores del diseño (--fx-*, lib/templates.ts → decorVars) y los vuelve a leer si cambian, y pinta un
 * fotograma tras otro solo mientras se ve. Con «reducir movimiento» (y sin «Moverse siempre») deja un único
 * fotograma quieto. Devuelve cómo pararlo.
 */
export function runFx(canvas: HTMLCanvasElement, factory: EffectFactory, contained: boolean): () => void {
  const g = canvas.getContext("2d");
  if (!g) return () => {};
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const still = () => !!reduce?.matches && !canvas.closest("[data-fx-always]");

  let env: FxEnv | null = null;
  let fx: Effect | null = null;
  let colorKey = "";
  let raf = 0;
  let last = 0;
  let t = 0;
  let visible = true;
  let dead = false;

  const readColors = () => {
    const cs = getComputedStyle(canvas);
    const v = (k: string) => cs.getPropertyValue(k).trim();
    const raw = [v("--fx-a"), v("--fx-b"), v("--fx-a2"), v("--fx-b2"), v("--fx-soft"), v("--fx-bg") || v("--c-bg"), v("--fx-moon"), v("--fx-moon-edge"), v("--fx-own"), v("--star-o")];
    return { raw, key: raw.join("|") };
  };

  const build = (force: boolean) => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w * h * dpr * dpr > 4.2e6) dpr = Math.max(0.75, Math.sqrt(4.2e6 / (w * h)));
    const { raw, key } = readColors();
    const [a, b, a2, b2, soft, bg, moon, moonEdge, own, starO] = raw;
    const colorsChanged = key !== colorKey;
    const bigResize = !env || Math.abs(env.w - w) > 2 || Math.abs(env.h - h) / Math.max(1, env.h) > 0.18;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const c = {
      a: hexRgb(a, FALLBACK.a),
      b: hexRgb(b, FALLBACK.b),
      a2: hexRgb(a2, FALLBACK.a2),
      b2: hexRgb(b2, FALLBACK.b2),
      soft: hexRgb(soft, FALLBACK.soft),
      bg: hexRgb(bg, FALLBACK.bg),
      moon: hexRgb(moon, FALLBACK.moon),
      moonEdge: hexRgb(moonEdge, FALLBACK.moonEdge),
    };
    const next: FxEnv = {
      w,
      h,
      dpr,
      dark: lum(c.bg) < 0.5,
      own: own === "1",
      contained,
      k: contained ? clamp(w / 1100, 0.3, 1) : 1,
      starO: clamp(Number.parseFloat(starO) || 0.7, 0, 1),
      c,
    };
    if (force || colorsChanged || !fx) {
      colorKey = key;
      env = next;
      fx = factory(next);
    } else {
      // Solo ha cambiado el tamaño: las piezas siguen donde iban (salvo un cambio grande, que las reparte otra vez).
      Object.assign(env as FxEnv, next);
      if (bigResize) fx.resize?.(env as FxEnv);
    }
  };

  const paint = (dt: number) => {
    if (!env || !fx) return;
    g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, env.w, env.h);
    fx.frame(g, env, t, dt);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
  };

  /** Quieto: se deja correr unos segundos sin prisa (para que todo esté repartido) y se queda ese fotograma. */
  const settle = () => {
    for (let i = 0; i < 40; i++) {
      t += 1 / 20;
      paint(1 / 20);
    }
  };

  const loop = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    t += dt;
    try {
      paint(dt);
    } catch (e) {
      console.error("Fondo con movimiento:", e);
      return;
    }
    if (visible && !still()) raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (dead || raf) return;
    if (still()) {
      settle();
      return;
    }
    last = 0;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  build(true);
  // Un comienzo distinto en cada página, ya en marcha (no todo saliendo a la vez de arriba).
  t = 5 + Math.random() * 40;
  if (env && fx) for (let i = 0; i < 30; i++) {
    t += 1 / 15;
    paint(1 / 15);
  }
  start();

  const ro = new ResizeObserver(() => {
    build(false);
    if (!raf) paint(0);
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) start();
    else stop();
  });
  io.observe(canvas);
  // Los colores cambian al diseñar (la vista en vivo) o al elegirlos el área de alumna: se vuelven a leer.
  const recolor = () => {
    if (readColors().key === colorKey) return;
    build(true);
    if (!raf) (still() ? settle : () => paint(0))();
  };
  const host = varsHost(canvas);
  const mo = host ? new MutationObserver(recolor) : null;
  if (host) mo?.observe(host, { attributes: true, attributeFilter: ["style"] });
  const poll = window.setInterval(recolor, 2000);
  const onMotion = () => {
    stop();
    start();
  };
  reduce?.addEventListener?.("change", onMotion);

  return () => {
    dead = true;
    stop();
    ro.disconnect();
    io.disconnect();
    mo?.disconnect();
    window.clearInterval(poll);
    reduce?.removeEventListener?.("change", onMotion);
  };
}
