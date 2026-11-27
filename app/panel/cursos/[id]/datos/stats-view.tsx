import { Stat } from "../../../ui";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export type StatsLesson = { id: string; title: string; module: string; published: boolean; viewers: number; views: number; completions: number };
export type StatsTotals = { students: number; started: number; finished: number; avgPercent: number; views: number };

/**
 * «Datos» del curso: cifras arriba y, por lección, cuántas alumnas la han abierto y cuántas la han
 * completado, en barras sencillas (la escala es el número de alumnas con acceso, o el máximo si es
 * mayor: alguien que ya no tiene acceso también cuenta). Puro.
 */
export async function StatsView({ lessons, totals }: { lessons: StatsLesson[]; totals: StatsTotals }) {
  const t = await getT();
  const scale = Math.max(1, totals.students, ...lessons.map((l) => Math.max(l.viewers, l.completions)));
  let lastModule = "";
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-stats-totals>
        <Stat label={t("Alumnas con acceso")} value={totals.students} />
        <Stat label={t("Han empezado")} value={totals.started} hint={totals.students ? `${Math.round((totals.started / totals.students) * 100)}% de ellas` : undefined} />
        <Stat label={t("Lo han terminado")} value={totals.finished} />
        <Stat label={t("Progreso medio")} value={`${totals.avgPercent}%`} hint={`${totals.views} ${totals.views === 1 ? "visita" : "visitas"} a lecciones`} />
      </div>

      <section className="card mt-6 p-5" aria-labelledby="por-leccion">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="por-leccion" className="font-semibold"><Tr s={"Por lección"} /></h2>
          <p className="flex items-center gap-4 text-xs text-muted" aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#c9bbf2]" />{" "}<Tr s={"La han abierto"} /></span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-lavender-deep" />{" "}<Tr s={"La han completado"} /></span>
          </p>
        </div>
        {lessons.length ? (
          <ol className="mt-4 space-y-4" data-stats-lessons>
            {lessons.map((l, i) => {
              const head = l.module !== lastModule ? l.module : null;
              lastModule = l.module;
              return (
                <li key={l.id}>
                  {head && <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted first:mt-0"><Tr s={head} /></p>}
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 text-xs text-faint tabular-nums">{i + 1}.</span>
                      {l.title}
                      {!l.published && <span className="ml-2 rounded-full bg-[#f8efdc] px-2 py-0.5 text-[0.68rem] font-semibold text-[#8a6420]"><Tr s={"Borrador"} /></span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums" aria-label={`${l.viewers} la han abierto (${l.views} visitas), ${l.completions} la han completado`}>
                      {l.viewers} · <span className="font-semibold text-ink">{l.completions}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1" aria-hidden>
                    <span className="block h-2 overflow-hidden rounded-full bg-sand">
                      <span className="block h-full rounded-full bg-[#c9bbf2]" style={{ width: `${(l.viewers / scale) * 100}%` }} />
                    </span>
                    <span className="block h-2 overflow-hidden rounded-full bg-sand">
                      <span className="block h-full rounded-full bg-lavender-deep" style={{ width: `${(l.completions / scale) * 100}%` }} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted"><Tr s={"Este curso aún no tiene lecciones."} /></p>
        )}
      </section>
      <p className="mt-4 text-xs text-muted"><Tr s={"«La han abierto» cuenta a cada alumna una vez (aunque vuelva); las visitas, cada vez que entra. Tus propias visitas («Ver como alumna») no cuentan. Las visitas se anotan desde que existe el estudio de cursos."} /></p>
    </div>
  );
}
