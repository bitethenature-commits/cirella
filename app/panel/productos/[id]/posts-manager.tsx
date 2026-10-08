"use client";
import { CalendarDays, Headphones, PenLine, Trash2, Video } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { Flash } from "@/components/ui/flash";
import { addPost, deletePost, type ActionState } from "../actions";

type Post = { id: string; title: string; body: string; kind: string; publishedAt: string };
const ICON: Record<string, typeof PenLine> = { TEXT: PenLine, AUDIO: Headphones, VIDEO: Video, EVENT: CalendarDays };

export function PostsManager({ productId, posts, members }: { productId: string; posts: Post[]; members: number }) {
  const [state, action, isPending] = useActionState<ActionState, FormData>(addPost, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="font-semibold">Contenido privado</h3>
      <p className="text-xs text-muted">Solo lo ven tus {members} {members === 1 ? "miembro activo" : "miembros activos"} desde su área de cliente.</p>
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="mt-4 space-y-3 rounded-2xl border border-line bg-paper p-4"
      >
        <Flash ok={state?.ok} error={state?.error} />
        <input type="hidden" name="productId" value={productId} />
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <input name="title" placeholder="Título (p. ej. Ritual de luna nueva)" className="input h-10 text-sm" required />
          <select name="kind" className="input h-10 text-sm">
            <option value="TEXT">Publicación</option>
            <option value="AUDIO">Audio</option>
            <option value="VIDEO">Vídeo</option>
            <option value="EVENT">Directo / evento</option>
          </select>
        </div>
        <textarea name="body" rows={4} placeholder="Escribe para tu comunidad…" className="input text-sm" required />
        <input name="mediaUrl" type="url" placeholder="Enlace opcional (directo, audio, vídeo…)" className="input h-10 text-sm" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>{isPending ? "Publicando…" : "Publicar en la comunidad"}</button>
      </form>
      <ul className="mt-4 divide-y divide-line">
        {posts.map((p) => {
          const Icon = ICON[p.kind] ?? PenLine;
          return (
            <li key={p.id} className="flex items-start gap-3 py-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="line-clamp-2 text-xs text-muted">{p.body}</p>
                <p className="mt-0.5 text-[0.7rem] text-faint">{p.publishedAt}</p>
              </div>
              <form action={deletePost} onSubmit={(e) => { if (!confirm("¿Eliminar la publicación?")) e.preventDefault(); }}>
                <input type="hidden" name="id" value={p.id} />
                <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
