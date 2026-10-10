import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarCheck, Check, Loader2, Mail } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ProductImage } from "@/components/creator-page/product-art";
import { Reveal } from "@/components/reveal";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { getSession, hasCheckoutCookie } from "@/lib/auth";
import { maskEmail, orderTargetPath } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { getPublicCreator } from "@/lib/public";
import { capitalize, formatSessionDate } from "@/lib/tz";

export const metadata: Metadata = { title: "Compra completada", robots: { index: false } };

export default async function ThankYouPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ pedido?: string }> }) {
  const { username } = await params;
  const sp = await searchParams;
  const data = await getPublicCreator(username);
  if (!data || !sp.pedido) notFound();
  const order = await prisma.order.findFirst({
    where: { id: sp.pedido, creatorId: data.creator.id },
    include: { product: true, bookings: { orderBy: { createdAt: "asc" } }, customer: { select: { userId: true } } },
  });
  if (!order || !["PAID", "PENDING", "PROCESSING", "FAILED"].includes(order.status)) notFound();
  const pending = order.status === "PROCESSING" || (order.status === "PENDING" && !!order.checkoutRef);
  if (pending || order.status === "FAILED" || order.status === "PENDING")
    return (
      <CreatorShell username={username} config={data.config} allowCustom={data.allowCustom} back={false} sellerName={data.creator.legalName}>
        <main className="mx-auto max-w-md px-5 pb-20 pt-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: "var(--c-line)" }}>
            {pending ? <Loader2 className="h-8 w-8 animate-spin" /> : <AlertCircle className="h-8 w-8" />}
          </div>
          <h1 className="cp-display mt-6 text-[2.4rem] leading-tight">{pending ? "Pago pendiente de confirmar" : "El pago no se ha completado"}</h1>
          <p className="cp-muted mt-3 text-[1.02rem]">
            {pending
              ? "Tu banco está confirmando el pago. En cuanto llegue la confirmación te enviaremos el acceso por email; no hace falta que esperes aquí."
              : (order.paymentError ?? "Tu banco no ha confirmado el pago. No se te ha cobrado nada.")}
          </p>
          <div className="cp-card mt-8 flex items-center gap-4 p-3 text-left">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden" style={{ borderRadius: "calc(var(--r-card) * 0.6)" }}>
              <ProductImage src={order.product.imageUrl} emoji={order.product.emoji} title={order.productTitle} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="cp-display truncate text-[1.25rem]">{order.productTitle}</p>
              <p className="cp-muted text-sm">{formatPrice(order.amountCents, order.currency, order.product.billingInterval)} · Pedido {order.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          {pending ? (
            <AutoRefresh seconds={4} maxSeconds={120} />
          ) : (
            <Link href={`/${username}/${order.product.slug}/checkout?pedido=${order.id}`} className="cp-btn mt-8 h-14 w-full text-base">
              Intentarlo de nuevo <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link href={`/${username}`} className="cp-muted mt-6 inline-block text-sm underline-offset-4 hover:underline">
            Volver a la página de {data.config.displayName}
          </Link>
        </main>
      </CreatorShell>
    );
  // Ve el botón quien tiene la sesión de este pedido (tras pagar o desde el enlace del email) o la
  // sesión verificada de la compradora. El navegador que pagó y aún no tiene sesión la abre en
  // /auth/pedido (claimOrderSession nunca sustituye una sesión de cuenta abierta); cualquier otro
  // recibe el enlace personal en el recibo.
  const s = await getSession();
  const scoped = s?.orderId === order.id;
  const canSee = scoped || (!!s && !s.orderId && s.verified && s.user.id === order.customer?.userId);
  const claimable = !canSee && (!s || !!s.orderId) && (await hasCheckoutCookie(order.id));
  const booking = order.bookings[0];
  const reminder = booking?.startAt
    ? await prisma.emailMessage.findFirst({ where: { status: "QUEUED", dedupeKey: { startsWith: `reminder:${booking.id}:` } } })
    : null;

  const label =
    order.productType === "COURSE"
      ? "Empezar el curso"
      : order.productType === "MEMBERSHIP"
        ? "Entrar en la comunidad"
        : order.productType === "SESSION" && booking
          ? booking.startAt ? "Ver mi reserva" : "Elegir fecha y hora"
          : "Acceder a mi contenido";
  const next = { href: canSee ? orderTargetPath(order, booking?.id) : `/auth/pedido/${order.id}`, label };

  return (
    <CreatorShell username={username} config={data.config} allowCustom={data.allowCustom} back={false} sellerName={data.creator.legalName}>
      <main className="mx-auto max-w-md px-5 pb-20 pt-12 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full animate-fade-up" style={{ background: "var(--c-accent)", color: "var(--c-accent-text)" }}>
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <h1 className="cp-display mt-6 text-[2.8rem] animate-fade-up">Compra completada</h1>
        <p className="cp-muted mt-3 text-[1.02rem] animate-fade-up">
          {order.buyerName ? `Gracias, ${order.buyerName.split(" ")[0]}. ` : "Gracias. "}Tu contenido está disponible en tu cuenta.
        </p>

        <div className="cp-card mt-8 flex items-center gap-4 p-3 text-left" data-reveal>
          <div className="relative h-16 w-16 shrink-0 overflow-hidden" style={{ borderRadius: "calc(var(--r-card) * 0.6)" }}>
            <ProductImage src={order.product.imageUrl} emoji={order.product.emoji} title={order.productTitle} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="cp-display truncate text-[1.25rem]">{order.productTitle}</p>
            <p className="cp-muted text-sm">{formatPrice(order.amountCents, order.currency, order.product.billingInterval)} · Pedido {order.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        {booking?.startAt && (
          <div className="cp-card mt-3 flex items-center gap-3 p-4 text-left text-sm" data-reveal>
            <CalendarCheck className="cp-gold h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">{capitalize(formatSessionDate(booking.startAt, data.creator.timezone))}</span>
              <span className="cp-muted">
                Te hemos enviado la confirmación por email{reminder ? " y te recordaremos la sesión antes de que empiece" : ""}.
              </span>
            </span>
          </div>
        )}

        {canSee || claimable ? (
          <>
            {canSee ? (
              <Link href={next.href} className="cp-btn mt-8 h-14 w-full text-base" data-reveal>
                {next.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              // Navegación completa: /auth/pedido es un route handler que abre la sesión (cookie).
              <a href={next.href} className="cp-btn mt-8 h-14 w-full text-base" data-reveal>
                {next.label} <ArrowRight className="h-4 w-4" />
              </a>
            )}
            {(scoped || claimable) && (
              <p className="cp-muted mt-3 text-xs">Este acceso dura 24 horas en este dispositivo. El enlace del email te servirá después.</p>
            )}
          </>
        ) : (
          <div className="cp-card mt-8 p-5 text-left" data-reveal>
            <p className="flex items-center gap-2 font-semibold">
              <Mail className="cp-gold h-4 w-4" /> Revisa tu email
            </p>
            <p className="cp-muted mt-2 text-sm">
              Hemos enviado a <strong>{maskEmail(order.buyerEmail)}</strong> el recibo con un enlace directo a tu compra. No necesitas contraseña.
            </p>
            {isDemoMode() && (
              <Link href="/dev/correo" className="cp-btn mt-4 w-full">
                Abrir buzón de demostración
              </Link>
            )}
          </div>
        )}

        <Link href={`/${username}`} className="cp-muted mt-6 inline-block text-sm underline-offset-4 hover:underline">
          Volver a la página de {data.config.displayName}
        </Link>
      </main>
      <Reveal />
    </CreatorShell>
  );
}
