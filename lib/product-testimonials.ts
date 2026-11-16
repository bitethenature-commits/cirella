/**
 * Opiniones de una lectura o sesión (Product.testimonials). Puro: lo usan el estudio del panel, el
 * guardado y la ficha pública (que, si el producto no tiene, enseña las de la portada).
 */
export type ProductTestimonial = { id: string; quote: string; author: string };

export const PRODUCT_TESTIMONIALS_MAX = 12;

export function readProductTestimonials(v: unknown): ProductTestimonial[] {
  if (!Array.isArray(v)) return [];
  const out: ProductTestimonial[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const quote = typeof r.quote === "string" ? r.quote.trim().slice(0, 500) : "";
    const author = typeof r.author === "string" ? r.author.trim().slice(0, 80) : "";
    if (!quote) continue;
    out.push({ id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : `t${out.length}`, quote, author: author || "Anónima" });
    if (out.length >= PRODUCT_TESTIMONIALS_MAX) break;
  }
  return out;
}

/** Lo que llega del formulario (texto JSON) → la lista limpia. */
export function parseProductTestimonials(raw: FormDataEntryValue | null): ProductTestimonial[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    return readProductTestimonials(JSON.parse(raw));
  } catch {
    return [];
  }
}
