import { withoutEmptyBlocks } from "@/lib/page-blocks";
import type { PageConfig } from "@/lib/page-config";

/** Lo que se guarda de la portada: sin las filas que se añadieron y se dejaron vacías (no deben bloquear el guardado). */
export function cleanPageConfig(cfg: PageConfig): PageConfig {
  return {
    ...cfg,
    links: cfg.links.filter((l) => l.label.trim() || l.url.trim()),
    testimonials: cfg.testimonials.filter((t) => t.quote.trim() || t.author.trim()),
    faqs: cfg.faqs.filter((f) => f.q.trim() || f.a.trim()),
    blocks: withoutEmptyBlocks(cfg.blocks ?? []),
    bubbles: cfg.bubbles?.filter((b) => b.label.trim() || b.url.trim() || b.image),
    systems: cfg.systems?.filter((x) => x.title.trim() || x.text.trim() || x.url.trim() || x.image),
    readings: cfg.readings
      ? {
          ...cfg.readings,
          reading: { ...cfg.readings.reading, steps: cfg.readings.reading.steps.map((x) => x.trim()).filter(Boolean) },
          session: { ...cfg.readings.session, steps: cfg.readings.session.steps.map((x) => x.trim()).filter(Boolean) },
        }
      : cfg.readings,
  };
}
