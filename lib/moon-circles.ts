/**
 * Los próximos círculos de la luna para el bloque «Próximos círculos de la luna» (lib/page-blocks.ts):
 * de los talleres marcados como círculo, publicados y con fecha futura, los 2 más cercanos (luna nueva,
 * luna llena o eclipse), en orden de fecha. Puro: lo
 * usan la página pública, la portada y las pruebas.
 */

export type MoonCircleLike = { slug: string; title: string; emoji?: string | null; moonCircle?: boolean; eventStartAt?: string | null };

/** «nueva», «llena», «eclipse» o null según el título, la dirección o el emoji del círculo. */
export function moonCirclePhase(p: Pick<MoonCircleLike, "slug" | "title" | "emoji">): "new" | "full" | "eclipse" | null {
  const text = `${p.title} ${p.slug}`.toLowerCase();
  if (/eclipse/.test(text) || p.emoji === "🌘") return "eclipse";
  if (/llena|full/.test(text) || p.emoji === "🌕") return "full";
  if (/nueva|new/.test(text) || p.emoji === "🌑") return "new";
  return null;
}

/** Los `count` círculos más cercanos (luna nueva, llena o eclipse), en orden de fecha. */
export function nextMoonCircles<T extends MoonCircleLike>(products: readonly T[], now: Date = new Date(), count = 2): T[] {
  return products
    .filter((p) => p.moonCircle && p.eventStartAt && new Date(p.eventStartAt).getTime() > now.getTime())
    .sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : a.eventStartAt! > b.eventStartAt! ? 1 : 0))
    .slice(0, count);
}
