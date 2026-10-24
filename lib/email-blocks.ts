/**
 * Editor visual de emails: la newsletter y los emails automáticos (bienvenida, compra, acceso,
 * recordatorios…) se escriben con bloques (título, texto con formato, imagen, botón, separador y
 * espacio). Son datos, nunca HTML: lib/email/blocks-html.ts los convierte en HTML de email con todo
 * escapado. Este archivo es puro y sirve también en el navegador (el editor del panel).
 *
 * Variables: {nombre} (nombre de quien lo recibe), {mi_nombre} (el de la dueña) y, según el email,
 * {producto} o {fecha}. Si no hay nombre, «Hola, {nombre}» queda en «Hola».
 */
import { z } from "zod";
import { safeLinkHref } from "./rich-text";

export const EMAIL_BLOCKS_MAX = 40;
export const EMAIL_TEXT_MAX = 5000;

export type EmailBlock =
  | { id: string; t: "title"; text: string; align: "left" | "center" }
  | { id: string; t: "text"; body: string }
  | { id: string; t: "image"; url: string; alt: string; href?: string; width: "full" | "narrow" }
  | { id: string; t: "button"; label: string; href: string; align: "left" | "center" }
  | { id: string; t: "divider" }
  | { id: string; t: "spacer"; size: "s" | "m" | "l" };

export type EmailBlockType = EmailBlock["t"];
export type EmailDesign = { v: 1; blocks: EmailBlock[] };

export const BLOCK_LABEL: Record<EmailBlockType, string> = {
  title: "Título",
  text: "Texto",
  image: "Imagen",
  button: "Botón",
  divider: "Separador",
  spacer: "Espacio",
};

const id = z.string().trim().min(1).max(40);
const href = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || !!safeLinkHref(v), "Revisa la dirección del enlace");

const blockSchema = z.discriminatedUnion("t", [
  z.object({ id, t: z.literal("title"), text: z.string().trim().max(140, "El título es demasiado largo"), align: z.enum(["left", "center"]).catch("left") }),
  z.object({ id, t: z.literal("text"), body: z.string().max(EMAIL_TEXT_MAX, `Máximo ${EMAIL_TEXT_MAX} caracteres por texto`) }),
  z.object({
    id,
    t: z.literal("image"),
    url: z.string().trim().max(300).refine((v) => !v || !!emailImagePath(v), "Sube la imagen desde aquí"),
    alt: z.string().trim().max(200).catch(""),
    href: href.optional(),
    width: z.enum(["full", "narrow"]).catch("full"),
  }),
  z.object({ id, t: z.literal("button"), label: z.string().trim().max(40, "El botón admite 40 caracteres"), href, align: z.enum(["left", "center"]).catch("center") }),
  z.object({ id, t: z.literal("divider") }),
  z.object({ id, t: z.literal("spacer"), size: z.enum(["s", "m", "l"]).catch("m") }),
]);

const designSchema = z.object({ v: z.literal(1).catch(1), blocks: z.array(z.unknown()).max(EMAIL_BLOCKS_MAX, `Máximo ${EMAIL_BLOCKS_MAX} bloques`) });

/**
 * Lo guardado en la BD (tolerante): un bloque dañado o de una versión futura se descarta sin tumbar
 * el email. null si no hay diseño.
 */
export function readDesign(raw: unknown): EmailDesign | null {
  if (!raw || typeof raw !== "object") return null;
  const blocks = Array.isArray((raw as { blocks?: unknown }).blocks) ? ((raw as { blocks: unknown[] }).blocks as unknown[]) : [];
  const out: EmailBlock[] = [];
  for (const b of blocks.slice(0, EMAIL_BLOCKS_MAX)) {
    const r = blockSchema.safeParse(b);
    if (r.success) out.push(r.data as EmailBlock);
  }
  return { v: 1, blocks: out };
}

/** Lo que llega del editor al guardar (estricto: dice qué falla). */
export function parseDesignStrict(raw: unknown): { ok: true; value: EmailDesign } | { ok: false; error: string } {
  const d = designSchema.safeParse(raw);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Diseño no válido" };
  const blocks: EmailBlock[] = [];
  for (const b of d.data.blocks) {
    const r = blockSchema.safeParse(b);
    if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Hay un bloque que no se entiende" };
    blocks.push(r.data as EmailBlock);
  }
  return { ok: true, value: { v: 1, blocks } };
}

/** Imagen de un email: solo las subidas aquí (/media/…) o las de la demo. */
export function emailImagePath(url: string): string | null {
  return /^\/media\/[a-z0-9]+\/[a-f0-9]{20}\.(?:webp|jpg|png)$/.test(url) || /^\/demo\/[\w-]+\.(?:webp|jpg|png)$/.test(url) ? url : null;
}

let seq = 0;
/** Id de un bloque nuevo (solo identifica el bloque dentro de su email). */
export function newBlockId(): string {
  seq = (seq + 1) % 1e6;
  return `b${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function newBlock(t: EmailBlockType): EmailBlock {
  const bid = newBlockId();
  switch (t) {
    case "title":
      return { id: bid, t, text: "", align: "left" };
    case "text":
      return { id: bid, t, body: "" };
    case "image":
      return { id: bid, t, url: "", alt: "", width: "full" };
    case "button":
      return { id: bid, t, label: "", href: "", align: "center" };
    case "divider":
      return { id: bid, t };
    case "spacer":
      return { id: bid, t, size: "m" };
  }
}

/** Primer borrador de una newsletter nueva. */
export function defaultCampaignDesign(o: { siteUrl: string }): EmailDesign {
  return {
    v: 1,
    blocks: [
      { id: "titulo", t: "title", text: "Hola, {nombre}", align: "left" },
      { id: "texto", t: "text", body: "Escribe aquí lo que quieras contarle este mes.\n\nUn abrazo,\n{mi_nombre}" },
      { id: "boton", t: "button", label: "Ver mi página", href: o.siteUrl, align: "center" },
    ],
  };
}

/** Texto plano del diseño (para «solo imágenes», el extracto y las pruebas). */
export function designText(d: EmailDesign): string {
  return d.blocks
    .map((b) => (b.t === "title" ? b.text : b.t === "text" ? b.body : b.t === "button" ? b.label : ""))
    .filter(Boolean)
    .join("\n");
}

/** Avisos con arreglo fácil, antes de enviar. */
export function lintDesign(d: EmailDesign, subject?: string): string[] {
  const out: string[] = [];
  if (subject !== undefined && !subject.trim()) out.push("Falta el asunto.");
  if (!d.blocks.length) out.push("El email está vacío: añade un texto.");
  const images = d.blocks.filter((b) => b.t === "image");
  if (images.length && designText(d).replace(/\s|\{[a-z_]+\}/g, "").length < 40)
    out.push("Tu email es casi solo imágenes: añade un texto para que no acabe en spam.");
  if (images.some((b) => b.t === "image" && !b.url)) out.push("Hay un bloque de imagen sin imagen.");
  if (images.some((b) => b.t === "image" && b.url && !b.alt.trim())) out.push("Falta el texto alternativo de una imagen (lo leen quienes no ven imágenes).");
  if (d.blocks.some((b) => b.t === "button" && (!b.label.trim() || !b.href.trim()))) out.push("Hay un botón sin texto o sin enlace.");
  return out;
}

/** Variables que se pueden escribir en los textos de un email. */
export type EmailVars = Partial<Record<"nombre" | "mi_nombre" | "producto" | "fecha", string | null>>;

export const VARIABLE_HELP: Record<keyof EmailVars, string> = {
  nombre: "el nombre de quien lo recibe",
  mi_nombre: "tu nombre",
  producto: "el producto",
  fecha: "la fecha y hora de la sesión",
};

/**
 * Sustituye las variables en un texto YA ESCAPADO para HTML: los valores se escapan aquí. Sin
 * nombre, «Hola, {nombre}» queda en «Hola».
 */
export function applyVars(html: string, vars: EmailVars, escape: (s: string) => string): string {
  return html.replace(/(,?\s*)\{(nombre|mi_nombre|producto|fecha)\}/g, (_, lead: string, k: keyof EmailVars) => {
    const v = vars[k]?.trim();
    if (v) return `${lead}${escape(v)}`;
    return k === "nombre" ? "" : lead;
  });
}
