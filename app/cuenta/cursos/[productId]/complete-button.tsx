"use client";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleLessonComplete } from "../../actions";

export function CompleteButton({ lessonId, completed, nextHref }: { lessonId: string; completed: boolean; nextHref: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await toggleLessonComplete(lessonId, !completed);
          if (!completed && nextHref) router.push(nextHref);
          else router.refresh();
        })
      }
      className={`btn ${completed ? "btn-outline" : "btn-primary"}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {completed ? "Completada" : nextHref ? "Completar y seguir" : "Marcar como completada"}
    </button>
  );
}
