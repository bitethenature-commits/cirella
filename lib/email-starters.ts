/**
 * «Plantillas» del editor visual de la newsletter: tres diseños de partida (Luna llena, Novedades y
 * Lanzamiento) con los colores de la marca de la dueña, y su paleta (los colores de «Mi página»)
 * para los selectores de color. Puro: lo usan el editor (navegador) y el servidor.
 */
import { normalizeHex, textOn, mixHex } from "./colors";
import { DEFAULT_EMAIL_STYLE, newBlockId, SOCIAL_NETWORKS, type EmailBlock, type EmailDesign, type EmailStyle, type SocialNetwork } from "./email-blocks";
import { readPageConfig } from "./page-config";
import { resolveTheme } from "./templates";

/** Colores neutros que siempre están a mano además de los de la marca. */
export const NEUTRALS = ["#FFFFFF", "#F6F1E7", "#0E1024", "#3B3950", "#8A8698"];

/**
 * Paleta de la marca: los colores de su página (plantilla y personalización de «Mi página») y los
 * neutros. Sin repetir, siempre #RRGGBB.
 */
export function brandPalette(pageDraft: unknown, displayName = "Mi página"): string[] {
  const cfg = readPageConfig(pageDraft, displayName);
  const t = resolveTheme(cfg.template, cfg.theme ?? {});
  const brand = [t.colors.accent, t.colors.gold, t.colors.bg, t.colors.bg2, t.colors.text];
  return [...new Set([...brand, ...NEUTRALS].map((c) => normalizeHex(c)).filter((c): c is string => !!c))].slice(0, 10);
}

export type StarterKey = "luna" | "novedades" | "lanzamiento";

export const STARTERS: { key: StarterKey; name: string; description: string }[] = [
  { key: "luna", name: "Luna llena", description: "Portada nocturna, un ritual destacado y tu lectura" },
  { key: "novedades", name: "Novedades", description: "Lo nuevo del mes en bloques claros" },
  { key: "lanzamiento", name: "Lanzamiento", description: "Portada con botón, vídeo y lo que incluye" },
];

const b = <T extends EmailBlock>(x: Omit<T, "id">): T => ({ ...x, id: newBlockId() }) as T;

/**
 * Diseño de partida con la paleta de la marca (el primero es su acento). Las fotos quedan por subir:
 * la portada sale con su color hasta entonces.
 */
export function starterDesign(key: StarterKey, o: { palette: string[]; siteUrl: string }): EmailDesign {
  const accent = normalizeHex(o.palette[0]) ?? "#6B58C4";
  const soft = mixHex(accent, "#FFFFFF", 0.88);
  const onAccent = textOn(accent, "#0E1024", "#FFFFFF");
  switch (key) {
    case "luna": {
      const night = "#14163A";
      const style: EmailStyle = { ...DEFAULT_EMAIL_STYLE, bg: night, content: "#FFFFFF", heading: "#14163A", text: "#3B3950", link: "#4B3FA0", accent: "#4B3FA0", headingFont: "cormorant", bodyFont: "georgia", radius: "l", width: 600 };
      return {
        v: 1,
        style,
        blocks: [
          b<Extract<EmailBlock, { t: "hero" }>>({ t: "hero", image: "", alt: "", overlay: night, opacity: 45, title: "Luna llena", subtitle: "Lo que trae esta luna y cómo aprovecharla", color: "#F3ECDD", align: "center", height: "l" }),
          b<Extract<EmailBlock, { t: "title" }>>({ t: "title", text: "Hola, {nombre}", align: "left", size: "l" }),
          b<Extract<EmailBlock, { t: "text" }>>({ t: "text", body: "Esta luna llena nos pide parar y mirar lo que ya hemos cosechado.\n\nTe cuento qué energía trae y te dejo un pequeño ritual para estos días." }),
          b<Extract<EmailBlock, { t: "spotlight" }>>({ t: "spotlight", icon: "🌕", title: "Ritual de esta semana", body: "- Escribe tres cosas que quieres soltar.\n- Léelas en voz alta y quema el papel (con cuidado).\n- Bebe un vaso de agua con intención.", bg: "#F1EEFB", accent: "#4B3FA0", border: "left" }),
          b<Extract<EmailBlock, { t: "divider" }>>({ t: "divider", style: "stars", color: "#C8A86E" }),
          b<Extract<EmailBlock, { t: "button" }>>({ t: "button", label: "Reservar mi lectura", href: o.siteUrl, align: "center", style: "pill", bg: "#14163A", color: "#F3ECDD" }),
          b<Extract<EmailBlock, { t: "text" }>>({ t: "text", body: "Un abrazo,\n{mi_nombre}", align: "center" }),
        ],
      };
    }
    case "novedades": {
      const style: EmailStyle = { ...DEFAULT_EMAIL_STYLE, bg: "#F4F1EA", content: "#FFFFFF", heading: "#2B2F27", text: "#3E423A", link: accent, accent, headingFont: "playfair", bodyFont: "helvetica", radius: "m", width: 600 };
      return {
        v: 1,
        style,
        blocks: [
          b<Extract<EmailBlock, { t: "title" }>>({ t: "title", text: "Novedades del mes", align: "center", size: "xl", color: onAccent, bg: accent }),
          b<Extract<EmailBlock, { t: "text" }>>({ t: "text", body: "Hola, {nombre}:\n\nEste mes vienen cosas bonitas. Te lo resumo en tres minutos." }),
          b<Extract<EmailBlock, { t: "columns" }>>({ t: "columns", image: "", alt: "", side: "left", title: "Lo nuevo", body: "Cuéntale aquí tu novedad principal en dos o tres frases.", buttonLabel: "Saber más", buttonHref: o.siteUrl }),
          b<Extract<EmailBlock, { t: "spotlight" }>>({ t: "spotlight", icon: "✨", title: "No te lo pierdas", body: "Una fecha, una plaza libre o un descuento: lo importante, aquí.", bg: soft, accent, border: "box" }),
          b<Extract<EmailBlock, { t: "divider" }>>({ t: "divider" }),
          b<Extract<EmailBlock, { t: "text" }>>({ t: "text", body: "Gracias por estar al otro lado.\n\n{mi_nombre}" }),
          b<Extract<EmailBlock, { t: "social" }>>({ t: "social", links: {}, align: "center" }),
        ],
      };
    }
    case "lanzamiento": {
      const style: EmailStyle = { ...DEFAULT_EMAIL_STYLE, bg: mixHex(accent, "#FFFFFF", 0.82), content: "#FFFFFF", heading: "#0E1024", text: "#3B3950", link: accent, accent, headingFont: "montserrat", bodyFont: "helvetica", radius: "l", width: 600 };
      return {
        v: 1,
        style,
        blocks: [
          b<Extract<EmailBlock, { t: "hero" }>>({ t: "hero", image: "", alt: "", overlay: accent, opacity: 35, title: "Ya está aquí", subtitle: "Mi nuevo programa abre sus puertas hoy", color: onAccent, align: "center", height: "m", buttonLabel: "Quiero entrar", buttonHref: o.siteUrl }),
          b<Extract<EmailBlock, { t: "text" }>>({ t: "text", body: "Hola, {nombre}:\n\nLlevo meses preparándolo y por fin puedo enseñártelo." }),
          b<Extract<EmailBlock, { t: "video" }>>({ t: "video", url: "", src: "", cover: "", title: "Te lo cuento en 2 minutos" }),
          b<Extract<EmailBlock, { t: "spotlight" }>>({ t: "spotlight", icon: "☾", title: "Lo que incluye", body: "- Primera cosa que incluye\n- Segunda cosa\n- Un regalo para las primeras", bg: soft, accent, border: "left" }),
          b<Extract<EmailBlock, { t: "button" }>>({ t: "button", label: "Reservar mi plaza", href: o.siteUrl, align: "center", style: "filled", full: true }),
          b<Extract<EmailBlock, { t: "text" }>>({ t: "text", body: "¿Dudas? Responde a este email y te contesto yo.\n\n{mi_nombre}", size: "s" }),
        ],
      };
    }
  }
}

/** Sus redes de «Mi página», para rellenar el bloque «Redes sociales». */
export function brandSocials(pageDraft: unknown, displayName = "Mi página"): Partial<Record<SocialNetwork, string>> {
  const cfg = readPageConfig(pageDraft, displayName);
  const out: Partial<Record<SocialNetwork, string>> = {};
  for (const [k, v] of Object.entries(cfg.socials ?? {})) {
    if (!v?.trim()) continue;
    const n = (k === "website" ? "web" : k) as SocialNetwork;
    if (SOCIAL_NETWORKS.includes(n)) out[n] = v.trim();
  }
  return out;
}
