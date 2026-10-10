import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Mail } from "lucide-react";
import { orderTargetPath } from "@/lib/auth-utils";
import { requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/tz";
import { CreatorTag, Thumb } from "../../ui";

export const metadata: Metadata = { title: "Tu compra", robots: { index: false } };

/**
 * «Tu compra»: una compra concreta. Es el destino de los productos digitales (botón de «gracias»,
 * recibo) y lo único que ve una sesión limitada a un pedido además del curso, la membresía o la
 * reserva de ese pedido.
 */
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { user, scoped } = await requireBuyerFor({ orderId }, `/cuenta/pedidos/${orderId}`);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { userId: true } },
      creator: true,
      product: { include: { files: { orderBy: { sortOrder: "asc" } } } },
      bookings: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || order.customer?.userId !== user.id || !["PAID", "REFUNDED"].includes(order.status)) notFound();
  const c = creatorBrief(order.creator);
  const booking = order.bookings[0];
  const refunded = order.status === "REFUNDED";
  const access = !refunded && (await hasAccess(user.id, order.productId));
  const cta =
    order.productType === "COURSE"
      ? { label: "Ir al curso", href: orderTargetPath(order) }
      : order.productType === "MEMBERSHIP"
        ? { label: "Entrar en la comunidad", href: orderTargetPath(order) }
        : order.productType === "SESSION" && booking
          ? { label: booking.startAt ? "Ver mi reserva" : "Elegir fecha y hora", href: orderTargetPath(order, booking.id) }
          : null;

  return (
    <div className="max-w-2xl">
      {!scoped && (
        <Link href="/cuenta/compras" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis compras
        </Link>
      )}
      <div className="mt-5 flex items-center gap-4">
        <Thumb src={order.product.imageUrl} emoji={order.product.emoji} className="h-16 w-16" />
        <div className="min-w-0">
          <CreatorTag name={c.displayName} avatarUrl={c.avatarUrl} />
          <h1 className="display text-[2.2rem] leading-tight">{order.productTitle}</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {formatPrice(order.amountCents, order.currency, order.product.billingInterval)} · Pedido {order.id.slice(-8).toUpperCase()}
        {order.paidAt && ` · ${formatDate(order.paidAt)}`}
      </p>

      {refunded ? (
        <div className="card mt-6 p-6">
          <p className="font-semibold">Esta compra se reembolsó{order.refundedAt ? ` el ${formatDate(order.refundedAt, { day: "numeric", month: "long", year: "numeric" })}` : ""}.</p>
          <p className="mt-1 text-sm text-muted">El contenido ya no está disponible.</p>
        </div>
      ) : cta ? (
        <Link href={cta.href} className="btn btn-primary btn-lg mt-6 w-full sm:w-auto">
          {cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : access ? (
        order.product.files.length > 0 && (
          <ul className="card mt-6 divide-y divide-line">
            {order.product.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0 truncate font-medium">{f.name}</span>
                {f.kind === "LINK" ? (
                  <a href={`/api/download/${f.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir enlace
                  </a>
                ) : (
                  <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm shrink-0">
                    <Download className="h-3.5 w-3.5" /> Descargar
                  </a>
                )}
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="card mt-6 p-6 text-sm text-muted">Ya no tienes acceso a este contenido. Si crees que es un error, escribe a {c.displayName}.</div>
      )}

      {!refunded && order.product.instructions && <p className="mt-5 rounded-xl bg-sand/60 px-4 py-3 text-sm italic">{order.product.instructions}</p>}

      {c.email && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-5 text-sm">
          <p className="flex-1">¿Dudas? Escribe a {c.displayName}.</p>
          <a href={`mailto:${c.email}`} className="btn btn-ghost btn-sm">
            <Mail className="h-4 w-4" /> {c.email}
          </a>
        </div>
      )}
    </div>
  );
}
