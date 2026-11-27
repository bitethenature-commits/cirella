import type { Decor } from "@/lib/templates";

/**
 * De qué grupo es cada fondo dibujado (cada grupo se descarga solo cuando hace falta). Sin «use client»:
 * lo usan el servidor (components/template-decor.tsx) y el lienzo (decor-canvas.tsx).
 */
export const DECOR_GROUP: Partial<Record<Decor, "sky" | "nature" | "light" | "magic">> = {
  stars: "sky", aurora: "sky", shooting: "sky", meteors: "sky", moon: "sky", nebula: "sky", constellation: "sky", galaxy: "sky", borealis: "sky", planets: "sky",
  petals: "nature", sakura: "nature", leaves: "nature", butterflies: "nature", feathers: "nature", dandelion: "nature", fireflies: "nature", snow: "nature", mist: "nature",
  waves: "light", rain: "light", caustics: "light", bubbles: "light", bokeh: "light", sparkles: "light", sunrays: "light", smoke: "light", haze: "light",
  golddust: "magic", candles: "magic", mandala: "magic", flowerlife: "magic", cards: "magic", crystals: "magic", runes: "magic",
};

/** ¿Este fondo se dibuja en vivo? (Nada, Líneas y Grano de papel son quietos, con CSS.) */
export const isDrawnDecor = (d: Decor) => !!DECOR_GROUP[d];
