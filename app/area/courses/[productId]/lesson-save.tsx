"use client";

import { Star } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { saveLesson } from "./comment-actions";
import { useT, Tr } from "@/lib/i18n/client";

/** ★ de una lección: la guarda en sus Favoritos (la estrella del menú). */
export function LessonSaveButton({ lessonId, saved }: { lessonId: string; saved: boolean }) {
  const t = useT();
  const [state, setState] = useState(saved);
  const [on, setOn] = useOptimistic(state);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        aria-pressed={on}
        className="pill-fav inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold"
        data-on={on ? "true" : undefined}
        onClick={() =>
          start(async () => {
            setOn(!on);
            const r = await saveLesson(lessonId);
            if ("error" in r) setError(r.error);
            else {
              setError(null);
              setState(r.saved);
            }
          })
        }
      >
        <Star className={`h-4 w-4 ${on ? "fill-current" : ""}`} /> {on ? t("En favoritos") : t("Guardar en favoritos")}
      </button>
      {error && (
        <p className="mt-1 text-xs text-rose" role="alert">
          <Tr s={error} />
        </p>
      )}
    </div>
  );
}
