import { slugify } from "@/lib/slug";

/**
 * Aviso cuando la dirección que escribió la creadora ya la usa otra publicación y se ha guardado
 * otra (luna-llena → luna-llena-2). Sin dirección escrita, o si se guardó tal cual, no hay aviso.
 */
export function slugTakenNotice(requested: string | null | undefined, saved: string): string | null {
  const wanted = slugify(requested || "");
  if (!wanted || wanted === saved) return null;
  return `Esa dirección ya la usa otra publicación; se ha guardado como «${saved}».`;
}
