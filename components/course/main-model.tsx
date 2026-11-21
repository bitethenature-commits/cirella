"use client";

import type { ReactNode } from "react";
import { RichContent } from "@/components/rich-text/rich-content";
import { InteractiveModel } from "@/components/models/interactive-model";
import { NIGHT_CHART_STYLE } from "@/components/models/night-chart-style";
import { SacredGeometry } from "@/components/models/sacred-geometry";
import type { BirthProfile } from "@/lib/birth-profile";
import type { MainModelData } from "@/lib/lesson-blocks";
import { MODEL_LABEL, hasQuickVersion } from "@/lib/page-blocks";

/**
 * «Modelo» en una lección: uno de los modelos principales entero (carta natal, bodygraph, Gene Keys, Luna, runas,
 * oráculo, kundalini o la geometría sagrada con su frase), como el bloque «Modelo interactivo» de la web. Los que se
 * calculan salen con la carta que la alumna guardó en «Mi energía»; sin ella, con su propio formulario. Va sobre la
 * noche del área de alumna (sus letras claras se leen con cualquier diseño del curso).
 * `edit` (solo en el editor del curso): el título y la entrada, escritos encima.
 */
export function MainModel({ data, profile, edit }: { data: MainModelData; profile: BirthProfile | null; edit?: { title?: ReactNode; intro?: ReactNode } }) {
  if (data.model === "geometry")
    return (
      <figure
        className="cp relative isolate flex flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12"
        style={{ ...NIGHT_CHART_STYLE, minHeight: "20rem" }}
        data-block="main"
        data-model="geometry"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-35">
          <div className="aspect-square w-[min(26rem,120%)]">
            <SacredGeometry figure={data.figure} />
          </div>
        </div>
        {edit?.title ? (
          <blockquote className="cp-display text-[1.7rem] italic leading-snug sm:text-[2.2rem]">{edit.title}</blockquote>
        ) : (
          data.title && <blockquote className="cp-display whitespace-pre-line text-[1.7rem] italic leading-snug sm:text-[2.2rem]">{data.title}</blockquote>
        )}
        {(data.title || data.intro || edit) && <span aria-hidden className="mt-8 block h-px w-20 bg-[var(--c-gold)] opacity-70" />}
        {edit?.intro ? (
          <figcaption className="cp-muted mt-6 max-w-md text-[0.95rem] leading-relaxed">{edit.intro}</figcaption>
        ) : (
          data.intro && <figcaption className="cp-muted mt-6 max-w-md whitespace-pre-line text-[0.95rem] leading-relaxed">{data.intro}</figcaption>
        )}
      </figure>
    );
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper" data-block="main" data-model={data.model}>
      {(data.title || data.intro || edit) && (
        <div className="px-5 pt-5 sm:px-6">
          <p className="eyebrow">{MODEL_LABEL[data.model]}</p>
          {edit?.title ? <h3 className="display mt-1 text-[1.7rem] leading-tight">{edit.title}</h3> : data.title && <h3 className="display mt-1 text-[1.7rem] leading-tight">{data.title}</h3>}
          {edit?.intro ? (
            <div className="mt-2 text-[0.98rem] leading-relaxed text-ink/80">{edit.intro}</div>
          ) : (
            data.intro && <RichContent text={data.intro} format="MD" legacy="paragraphs" tone="account" className="mt-2 space-y-3 text-[0.98rem] leading-relaxed text-ink/80" />
          )}
        </div>
      )}
      <div className="p-2 sm:p-3">
        <div className="cp overflow-hidden rounded-[1.25rem] p-3 sm:p-5" style={{ ...NIGHT_CHART_STYLE, minHeight: 0 }}>
          <InteractiveModel model={data.model} profile={profile} compact={data.quick && hasQuickVersion(data.model)} />
        </div>
      </div>
    </section>
  );
}
