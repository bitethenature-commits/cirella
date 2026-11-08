import type { Metadata } from "next";
import { requireCreator } from "@/lib/auth";
import { listBirthProfiles } from "@/lib/birth-profiles";
import { tenantDb } from "@/lib/tenant";
import { ASTRO_LAYERS, ASTRO_LAYER_LABEL, LAYER_KEYS, LAYER_OPTIONS, LAYER_SYSTEM, MODEL_MODES, type AstroLayer, type ModelMode } from "@/lib/lesson-blocks";
import { MODEL_KINDS, MODEL_LABEL } from "@/lib/page-blocks";
import { getPublishedOracleDecks } from "@/lib/oracle-decks";
import type { ContentBlock } from "@/lib/page-blocks";
import { getPublicCreator } from "@/lib/public";
import { readSitePageContent } from "@/lib/site-pages";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { PageHeader } from "../ui";
import { ModelsCatalog, type LayerRow } from "./catalog";
import type { FullUse } from "./full-models";

export const metadata: Metadata = { title: "Modelos" };

/**
 * «Modelos»: todos los modelos de la web en un sitio, por tipo. Los modelos completos (los del bloque
 * «Modelo interactivo» de las páginas) y los modelos por partes de las lecciones, por sistema, con sus
 * versiones (configuraciones y modos), en qué lecciones los usa, cuántos textos suyos tienen y una vista
 * previa con su propia carta. Al final, lo que aún no existe. Para ver de un vistazo qué falta y qué mejorar.
 */
export default async function ModelsPage() {
  const { user, creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const [parts, profiles] = await Promise.all([
    db.lessonPart.findMany({
      where: { kind: "MODEL" },
      select: { data: true, lesson: { select: { id: true, title: true, productId: true, product: { select: { title: true } } } } },
    }),
    listBirthProfiles(creator.id, user.id).catch(() => []),
  ]);

  // Por capa: en qué lecciones está, cuántas piezas tienen texto suyo (en la lección que más tiene) y con qué modos empieza.
  const usage = new Map<string, { lessons: Map<string, { title: string; course: string; href: string }>; notes: number; modes: Set<ModelMode> }>();
  for (const p of parts) {
    const d = (p.data ?? {}) as { layer?: string; notes?: Record<string, string>; mode?: ModelMode };
    if (!d.layer) continue;
    const u = usage.get(d.layer) ?? { lessons: new Map(), notes: 0, modes: new Set<ModelMode>() };
    u.lessons.set(p.lesson.id, { title: p.lesson.title, course: p.lesson.product.title, href: `/panel/productos/${p.lesson.productId}/lecciones/${p.lesson.id}` });
    u.notes = Math.max(u.notes, Object.values(d.notes ?? {}).filter((t) => t?.trim()).length);
    u.modes.add(d.mode ?? "explore");
    usage.set(d.layer, u);
  }

  const rows: LayerRow[] = ASTRO_LAYERS.map((layer: AstroLayer) => {
    const u = usage.get(layer);
    return {
      layer,
      label: ASTRO_LAYER_LABEL[layer],
      system: LAYER_SYSTEM[layer],
      pieces: LAYER_KEYS[layer].length,
      options: (LAYER_OPTIONS[layer] ?? []).map((o) => o.label),
      lessons: u ? [...u.lessons.values()] : [],
      notes: u?.notes ?? 0,
      modes: u ? MODEL_MODES.filter((m) => u.modes.has(m)) : [],
    };
  });

  // Los modelos completos: con los colores de su web, dónde los usa (portada y páginas) y sus barajas publicadas.
  const [site, pages, decks, lessonRows] = await Promise.all([
    getPublicCreator(creator.username, true),
    db.sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, draft: true, status: true } }),
    getPublishedOracleDecks(creator.id),
    db.lesson.findMany({ orderBy: [{ productId: "asc" }, { sortOrder: "asc" }], select: { id: true, title: true, product: { select: { title: true } } } }),
  ]);
  const lessons = lessonRows.map((l) => ({ id: l.id, title: l.title, course: l.product.title }));
  const theme = site ? resolveTheme(site.config.template, site.config.theme, site.allowCustom) : null;
  const uses: FullUse[] = [];
  const addUses = (blocks: ContentBlock[], where: string, href: string, draft: boolean) => {
    for (const b of blocks) if (b.kind === "model") uses.push({ kind: b.model, where, href, draft, quick: !!b.quick, deck: b.model === "oracle" ? (decks.find((d) => d.id === b.deck)?.name ?? null) : null, figure: b.model === "geometry" ? b.figure : null });
  };
  if (site) addUses(site.config.blocks ?? [], "Portada", "/panel/pagina", false);
  for (const p of pages) addUses(readSitePageContent(p.draft, p.title).blocks, p.title, `/panel/paginas/${p.id}`, p.status !== "PUBLISHED");

  const own = profiles.find((p) => p.isOwn) ?? null;
  const others = profiles.filter((p) => !p.isOwn).map((p) => ({ name: p.name, date: p.date, time: p.time, place: p.place }));

  return (
    <div>
      <PageHeader
        title="Modelos"
        subtitle="Todos tus modelos en un sitio, por tipo: los completos de tus páginas y los modelos por partes de tus lecciones, con sus versiones. Ábrelos para verlos funcionando y mira qué falta o qué puedes mejorar."
      />
      <ModelsCatalog
        rows={rows}
        full={MODEL_KINDS.map((k) => ({ kind: k, label: MODEL_LABEL[k] }))}
        fullInfo={{ theme: theme ? { style: themeStyle(theme), card: theme.card, template: site?.config.template ?? null } : null, uses, decks, lessons }}
        profile={own ? { name: own.name, date: own.date, time: own.time, place: own.place } : null}
        others={others}
      />
    </div>
  );
}
