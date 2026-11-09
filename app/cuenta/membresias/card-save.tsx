"use client";

import { Bookmark } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { savePost } from "./[productId]/[postId]/actions";

/** Favoritos en la esquina de la foto de cada tarjeta: guarda la publicación en «Mis archivos». */
export function CardSave({ postId, saved }: { postId: string; saved: boolean }) {
  const [state, setState] = useState(saved);
  const [on, setOn] = useOptimistic(state);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
      title={error ?? (on ? "En tus favoritos (Mis archivos)" : "Guardar en favoritos")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOn(!on);
          const r = await savePost(postId);
          if ("error" in r) setError(r.error);
          else {
            setError(null);
            setState(r.saved);
          }
        });
      }}
      className={`absolute left-2 top-2 z-20 grid h-10 w-10 place-items-center rounded-full border backdrop-blur transition hover:scale-105 ${on ? "border-[#F7E5B8] text-[#2A1E0C]" : "border-white/40 bg-[rgb(13_12_34_/_.55)] text-white"}`}
      style={on ? { background: "linear-gradient(135deg, #F7E5B8, #C9A45F)", boxShadow: "0 0 18px rgb(233 204 142 / .6)" } : undefined}
      data-card-save
    >
      <Bookmark className={`h-4 w-4 ${on ? "fill-current" : ""}`} />
    </button>
  );
}
