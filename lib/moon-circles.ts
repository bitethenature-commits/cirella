/**
 * Los próximos círculos de la luna para el bloque «Próximos círculos de la luna» (lib/page-blocks.ts):
 * de los talleres marcados como círculo, publicados y con fecha futura, el primero de luna nueva y el
 * primero de luna llena (si falta uno de los dos, el siguiente que haya), en orden de fecha. Puro: lo
 * usan la página pública, la portada y las pruebas.
 */

export type MoonCircleLike = { slug: string; title: string; emoji?: string | null; moonCircle?: boolean; eventStartAt?: string | null };

/** «nueva», «llena» o null según el título, la dirección o el emoji del círculo. */
export function moonCirclePhase(p: Pick<MoonCircleLike, "slug" | "title" | "emoji">): "new" | "full" | null {
  const text = `${p.title} ${p.slug}`.toLowerCase();
  if (/llena|full/.test(text) || p.emoji === "🌕") return "full";
  if (/nueva|new/.test(text) || p.emoji === "🌑") return "new";
  return null;
}

export function nextMoonCircles<T extends MoonCircleLike>(products: readonly T[], now: Date = new Date(), count = 2): T[] {
  const upcoming = products
    .filter((p) => p.moonCircle && p.eventStartAt && new Date(p.eventStartAt).getTime() > now.getTime())
    .sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : a.eventStartAt! > b.eventStartAt! ? 1 : 0));
  const picked: T[] = [];
  for (const phase of ["new", "full"] as const) {
    const hit = upcoming.find((p) => moonCirclePhase(p) === phase);
    if (hit) picked.push(hit);
  }
  for (const p of upcoming) {
    if (picked.length >= count) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked.slice(0, count).sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : 1));
}
