import Link from "next/link";
import { ArrowRight, Eye, Plus, UsersRound } from "lucide-react";
import type { MemberPostState } from "@/lib/community-rules";

/**
 * Ficha de una membresía: sus publicaciones ya no se gestionan aquí sino en el estudio Comunidad
 * (/panel/comunidad, con este nivel elegido). Un resumen y los enlaces.
 */
export function CommunityLink({ productId, members, counts }: { productId: string; members: number; counts: Record<MemberPostState, number> }) {
  const bits = [
    `${counts.PUBLISHED} ${counts.PUBLISHED === 1 ? "publicada" : "publicadas"}`,
    counts.SCHEDULED ? `${counts.SCHEDULED} ${counts.SCHEDULED === 1 ? "programada" : "programadas"}` : null,
    counts.DRAFT ? `${counts.DRAFT} ${counts.DRAFT === 1 ? "borrador" : "borradores"}` : null,
  ].filter(Boolean);
  return (
    <section className="card p-5 sm:p-6" data-community-link>
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sand"><UsersRound className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Publicaciones de la comunidad</h3>
          <p className="mt-0.5 text-sm text-muted">
            {bits.join(" · ")} · {members} {members === 1 ? "miembro" : "miembros"}. Se escriben, programan y moderan en Membresía.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/panel/comunidad?nivel=${productId}`} className="btn btn-primary btn-sm min-h-10">Abrir en Membresía <ArrowRight className="h-4 w-4" /></Link>
        <Link href={`/panel/comunidad?nivel=${productId}&nueva=1#publicar`} className="btn btn-outline btn-sm min-h-10"><Plus className="h-4 w-4" /> Nueva publicación</Link>
        <Link href={`/panel/comunidad/ver-como?nivel=${productId}`} className="btn btn-ghost btn-sm min-h-10"><Eye className="h-4 w-4" /> Ver como miembro</Link>
      </div>
    </section>
  );
}
