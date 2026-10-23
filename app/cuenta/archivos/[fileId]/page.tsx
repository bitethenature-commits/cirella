import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { MediaView } from "@/components/media/media-view";
import { getSession } from "@/lib/auth";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { checkOrderFileAccess } from "@/lib/order-file-access";
import { findOrderFile } from "@/lib/order-files";
import { CreatorTag } from "../../ui";

export const metadata: Metadata = { title: "Ver archivo", robots: { index: false, follow: false } };

/**
 * Visor de un archivo comprado (PDF, imagen, audio o vídeo): para quien tiene acceso (sesión de
 * cuenta verificada o la sesión limitada de su compra, justo después de pagar) y para la dueña
 * («Vista previa» del panel). La vuelta depende de cómo se llegó.
 */
export default async function FileViewer({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const file = await prisma.productFile.findUnique({ where: { id: fileId }, include: { product: { include: { creator: true } } } });
  if (!file) return <OrderFileViewer fileId={fileId} />;
  if (file.kind === "LINK" || !file.storageKey) notFound();
  const path = `/cuenta/archivos/${file.id}`;
  const { user, isOwner, scoped } = await requireBuyerFor({ productId: file.productId }, path);
  const session = scoped ? await getSession() : null;
  const back = scoped && session?.order
    ? { href: `/cuenta/pedidos/${session.order.id}`, label: "Volver a tu compra" }
    : isOwner
      ? { href: `/panel/productos/${file.productId}`, label: "Volver al panel" }
      : { href: "/cuenta/archivos", label: "Mis archivos" };
  const creator = creatorBrief(file.product.creator);
  const allowed = isOwner || (await hasAccess(user.id, file.productId));

  const header = (
    <>
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {back.label}
      </Link>
      <div className="mt-4 flex flex-col gap-1">
        <CreatorTag name={creator.displayName} avatarUrl={creator.avatarUrl} />
        <p className="eyebrow">{file.product.title}</p>
        <h1 className="display text-[2rem] leading-tight sm:text-[2.4rem] [overflow-wrap:anywhere]">{file.name}</h1>
      </div>
    </>
  );

  if (!allowed)
    return (
      <div>
        {header}
        <div className="card mt-6 p-6 text-sm text-muted">Ya no tienes acceso a este contenido.</div>
      </div>
    );

  if (!isOwner) await markFirstAccess(user.id, file.productId);
  const dark = file.kind === "VIDEO" || file.kind === "AUDIO";
  return (
    <div>
      {header}
      <div className={`mt-6 ${dark ? "overflow-hidden rounded-3xl bg-ink py-6" : ""}`}>
        <MediaView file={file} title={`${file.name} · ${file.product.title}`} poster={file.product.imageUrl} artwork={file.product.imageUrl} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href={`/api/download/${file.id}`} className="btn btn-outline btn-sm">
          <Download className="h-4 w-4" /> Descargar
        </a>
      </div>
    </div>
  );
}

/** Entrega de un pedido (la lectura preparada o la grabación de su sesión): solo su clienta y la dueña. */
async function OrderFileViewer({ fileId }: { fileId: string }) {
  const f = await findOrderFile(fileId);
  if (!f || f.kind === "LINK" || !f.storageKey) notFound();
  const path = `/cuenta/archivos/${f.id}`;
  const s = await getSession();
  // La dueña lo ve desde el panel; la clienta, con su sesión de cuenta o la de este pedido.
  const owner = !!s && !s.order && s.user.creator?.id === f.creatorId;
  if (!owner) await requireBuyerFor({ orderId: f.orderId }, path);
  const access = await checkOrderFileAccess(f);
  const creator = creatorBrief(await prisma.creator.findUniqueOrThrow({ where: { id: f.creatorId } }));
  const back = owner ? { href: `/panel/ventas/${f.orderId}#entrega`, label: "Volver al panel" } : { href: `/cuenta/pedidos/${f.orderId}`, label: "Volver a tu compra" };
  const header = (
    <>
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {back.label}
      </Link>
      <div className="mt-4 flex flex-col gap-1">
        <CreatorTag name={creator.displayName} avatarUrl={creator.avatarUrl} />
        <p className="eyebrow">{f.order.productTitle}</p>
        <h1 className="display text-[2rem] leading-tight sm:text-[2.4rem] [overflow-wrap:anywhere]">{f.name}</h1>
      </div>
    </>
  );
  if (!access.ok)
    return (
      <div>
        {header}
        <div className="card mt-6 p-6 text-sm text-muted">Ya no tienes acceso a este contenido.</div>
      </div>
    );
  const dark = f.kind === "VIDEO" || f.kind === "AUDIO";
  return (
    <div>
      {header}
      <div className={`mt-6 ${dark ? "overflow-hidden rounded-3xl bg-ink py-6" : ""}`}>
        <MediaView file={f} title={`${f.name} · ${f.order.productTitle}`} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm">
          <Download className="h-4 w-4" /> Descargar
        </a>
      </div>
    </div>
  );
}
