"use client";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { CategoryIcons } from "@/components/creator-page/category-icons";
import { COURSE_CATEGORIES, COURSE_CATEGORY_LABEL, COURSE_CATEGORY_SEP, courseCategoriesOf, type CourseCategory } from "@/lib/course-categories";
import { setStudioCourseCategory } from "../actions";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * «Temática del curso» en el estudio: los iconos de cada temática para marcar una o varias (un curso
 * puede ser Astrología + Mi energía). Se guarda al tocar; así el curso sale en su grupo en «Cursos» del
 * panel y de la web.
 */
export function CourseThemeCard({ productId, initial }: { productId: string; initial: string | null }) {
  const t = useT();
  const [picked, setPicked] = useState<CourseCategory[]>(() => courseCategoriesOf(initial));
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [saving, start] = useTransition();

  const toggle = (c: CourseCategory) => {
    const prev = picked;
    const next = prev.includes(c) ? prev.filter((x) => x !== c) : COURSE_CATEGORIES.filter((x) => x === c || prev.includes(x));
    setPicked(next);
    start(async () => {
      const r = await setStudioCourseCategory(productId, next.join(COURSE_CATEGORY_SEP));
      if (r.error) setPicked(prev);
      setMsg(r);
    });
  };

  return (
    <section className="card p-4" aria-labelledby="tematica-titulo" data-course-theme>
      <div className="flex items-center justify-between gap-2">
        <h3 id="tematica-titulo" className="text-[0.66rem] font-medium uppercase tracking-[0.3em] text-gold" title={t("Toca una o varias: el curso sale en su temática en «Cursos» del panel y de tu web.")}><Tr s={"Temática"} /></h3>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {COURSE_CATEGORIES.map((c) => {
          const on = picked.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              aria-pressed={on}
              disabled={saving}
              className={`studio-pick flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition ${on ? "is-on" : "border-line text-muted hover:text-ink"}`}
            >
              <span className={on ? "text-gold" : ""}>
                <CategoryIcons categories={[c]} size={1.5} />
              </span>
              <span className="text-[0.66rem] font-semibold leading-tight"><Tr s={COURSE_CATEGORY_LABEL[c]} /></span>
            </button>
          );
        })}
      </div>
      {msg?.error && <p className="mt-2 text-xs text-[#9a3a2e]"><Tr s={msg.error} /></p>}
      {msg?.ok && !saving && <p className="mt-2 text-xs text-[#2f6b4a]"><Tr s={msg.ok} /></p>}
    </section>
  );
}
