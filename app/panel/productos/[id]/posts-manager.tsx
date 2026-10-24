import Link from "next/link";
import { CalendarDays, ChevronRight, Eye, Headphones, PenLine, Plus, Video } from "lucide-react";
import type { MemberPostState } from "@/lib/community-rules";

export type PanelPost = {
  id: string;
  title: string;
  kind: string;
  state: MemberPostState;
  /** «Programada · jue 23 oct, 9:00» / «Publicada · 17 oct» / «Borrador» */
  chip: string;
  likes: number;
  comments: number;
  files: number;
  notified: number | null;
};

const ICON: Record<string, typeof PenLine> = { TEXT: PenLine, AUDIO: Headphones, VIDEO: Video, EVENT: CalendarDays };
const CHIP: Record<MemberPostState, string> = {
  DRAFT: "border-line bg-sand/70 text-muted",
  SCHEDULED: "border-[#ecdcb8] bg-[#fbf5e8] text-[#7a5a1c]",
  PUBLISHED: "border-[#cfe3d6] bg-[#f1f8f3] text-[#2f5f43]",
};

/** «Publicaciones de la comunidad»: la lista (cada fila abre su editor) y «Nueva publicación». */
export function PostsManager({ productId, posts, members, flash }: { productId: string; posts: PanelPost[]; members: number; flash?: string | null }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Publicaciones de la comunidad</h3>
          <p className="text-xs text-muted">
            Las ven tus {members} {members === 1 ? "miembro" : "miembros"} desde su área. Puedes adjuntar audios, vídeos, PDF e imágenes, programarlas y avisar por email.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/cuenta/membresias/${productId}`} className="btn btn-outline btn-sm min-h-10"><Eye className="h-4 w-4" /> Ver como miembro</Link>
          <Link href={`/panel/productos/${productId}/publicaciones/nueva`} className="btn btn-primary btn-sm min-h-10"><Plus className="h-4 w-4" /> Nueva publicación</Link>
        </div>
      </div>
      {flash && <p className="mt-3 text-sm text-[#2f5f43]" role="status">{flash}</p>}
      {posts.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Todavía no has publicado nada. Empieza con una bienvenida.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {posts.map((p) => {
            const Icon = ICON[p.kind] ?? PenLine;
            const meta = [
              p.files ? `${p.files} ${p.files === 1 ? "archivo" : "archivos"}` : null,
              p.state === "PUBLISHED" ? `♥ ${p.likes}` : null,
              p.state === "PUBLISHED" ? `${p.comments} ${p.comments === 1 ? "comentario" : "comentarios"}` : null,
              p.notified != null ? `Aviso enviado a ${p.notified}` : null,
            ].filter(Boolean);
            return (
              <li key={p.id}>
                <Link href={`/panel/productos/${productId}/publicaciones/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-sand/50">
                  <Icon className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${CHIP[p.state]}`}>{p.chip}</span>
                      {meta.length > 0 && <span>{meta.join(" · ")}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
