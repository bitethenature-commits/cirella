import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { MediaView } from "@/components/media/media-view";
import { getSession } from "@/lib/auth";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { isMemberPostVisible } from "@/lib/community-rules";
import { courseFileOpenFor } from "@/lib/course-access";
import { creatorBrief } from "@/lib/customer";
import { accessSource } from "@/lib/membership-access";
import { prisma } from "@/lib/db";
import { CreatorTag } from "../../ui";

export const metadata: Metadata = { title: "Ver archivo", robots: { index: false, follow: false } };

/**
 * Visor de un archivo comprado (PDF, imagen, audio o vídeo): para quien tiene acceso (sesión de
 * cuenta verificada o la sesión limitada de su compra, justo después de pagar) y para la dueña
 * («Vista previa» del panel). La vuelta depende de cómo se llegó.
 */
/** «Volver» a donde estaba (la lectura, su compra…): solo rutas del área, nunca a otra web. */
function backParam(v: string | undefined) {
  return v && v.startsWith("/cuenta/") && !v.startsWith("//") && !v.includes("\\") ? v : null;
}

const nice = (name: string) => name.replace(/\.[a-z0-9]{2,4}$/i, "");

export default async function FileViewer({ params, searchParams }: { params: Promise<{ fileId: string }>; searchParams: Promise<{ volver?: string }> }) {
  const { fileId } = await params;
  const volver = backParam((await searchParams).volver);
  const file = await prisma.productFile.findUnique({ where: { id: fileId }, include: { product: { include: { creator: true } }, post: { select: { status: true, publishedAt: true } } } });
  if (!file) notFound();
  if (file.kind === "LINK" || !file.storageKey) notFound();
  const path = `/cuenta/archivos/${file.id}`;
  const { user, isOwner, scoped } = await requireBuyerFor({ productId: file.productId }, path);
  const session = scoped ? await getSession() : null;
  const back = scoped && session?.order
    ? { href: `/cuenta/pedidos/${session.order.id}`, label: "Volver a tu compra" }
    : isOwner
      ? { href: `/panel/productos/${file.productId}`, label: "Volver al panel" }
      : volver
        ? { href: volver, label: "Volver" }
        : { href: "/cuenta/archivos", label: "Favoritos y comentarios" };
  const creator = creatorBrief(file.product.creator);
  // Directo o por una membresía que lo incluye; el adjunto de una publicación, solo si ya se ve.
  const source = isOwner ? null : await accessSource(user.id, file.productId);
  // Material de un curso: solo si está en una lección publicada y ya abierta para ella (lib/course-access.ts).
  const allowed = isOwner || (!!source && (file.post ? isMemberPostVisible(file.post) : await courseFileOpenFor(user.id, file)));

  const header = (
    <>
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold" data-back>
        <ArrowLeft className="h-4 w-4" /> {back.label}
      </Link>
      <ViewerTitle eyebrow={file.product.title} title={nice(file.name)} creator={creator} />
    </>
  );

  if (!allowed)
    return (
      <div>
        {header}
        <div className="card mt-6 p-6 text-sm text-muted">Ya no tienes acceso a este contenido.</div>
      </div>
    );

  if (!isOwner) await markFirstAccess(user.id, source?.productId ?? file.productId);
  const dark = file.kind === "VIDEO" || file.kind === "AUDIO";
  return (
    <div>
      {header}
      <div className={`mt-8 overflow-hidden rounded-[1.75rem] ring-1 ring-gold/30 ${dark ? "py-6" : "p-2 sm:p-3"}`} style={{ background: "radial-gradient(circle at 20% 0%, #2a2552 0%, #17153a 55%, #100e26 100%)" }} data-viewer>
        <MediaView file={file} title={`${file.name} · ${file.product.title}`} poster={file.product.imageUrl} artwork={file.product.imageUrl} />
      </div>
      <div className="mt-6 flex justify-center">
        <a href={`/api/download/${file.id}`} className="btn btn-outline btn-sm">
          <Download className="h-4 w-4" /> Descargar
        </a>
      </div>
    </div>
  );
}

/** El título del visor, centrado como las cabeceras del área: de qué es, el nombre y quién lo ha creado. */
function ViewerTitle({ eyebrow, title, creator }: { eyebrow: string; title: string; creator: { displayName: string; avatarUrl: string | null } }) {
  return (
    <header className="mt-4 text-center">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-gold">✦ {eyebrow} ✦</p>
      <h1 className="display mt-2 text-[2.2rem] leading-tight sm:text-[2.8rem] [overflow-wrap:anywhere]">{title}</h1>
      <div className="mt-3 flex justify-center">
        <CreatorTag name={creator.displayName} avatarUrl={creator.avatarUrl} />
      </div>
    </header>
  );
}
