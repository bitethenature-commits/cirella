import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck, Check, Mail } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ProductImage } from "@/components/creator-page/product-art";
import { Reveal } from "@/components/reveal";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { getPublicCreator } from "@/lib/public";
import { capitalize, formatSessionDate } from "@/lib/tz";

export const metadata: Metadata = { title: "Compra completada", robots: { index: false } };

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export default async function ThankYouPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ pedido?: string; acceso?: string }> }) {
  const { username } = await params;
  const sp = await searchParams;
  const data = await getPublicCreator(username);
  if (!data || !sp.pedido) notFound();
  const order = await prisma.order.findFirst({
    where: { id: sp.pedido, creatorId: data.creator.id, status: "PAID" },
    include: { product: true, bookings: true },
  });
  if (!order) notFound();
  const user = await getCurrentUser();
  const signedIn = user?.email === order.buyerEmail;
  const booking = order.bookings[0];

  const next =
    order.productType === "COURSE"
      ? { href: `/cuenta/cursos/${order.productId}`, label: "Empezar el curso" }
      : order.productType === "MEMBERSHIP"
        ? { href: `/cuenta/membresias/${order.productId}`, label: "Entrar en la comunidad" }
        : order.productType === "SESSION" && booking
          ? { href: `/cuenta/sesiones/${booking.id}`, label: booking.startAt ? "Ver mi reserva" : "Elegir fecha y hora" }
          : { href: "/cuenta", label: "Acceder a mi contenido" };

  return (
    <CreatorShell username={username} config={data.config} allowCustom={data.allowCustom} back={false}>
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
              <span className="cp-muted">Te hemos enviado la confirmación y un recordatorio llegará antes de la sesión.</span>
            </span>
          </div>
        )}

        {signedIn ? (
          <Link href={next.href} className="cp-btn mt-8 h-14 w-full text-base" data-reveal>
            {next.label} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="cp-card mt-8 p-5 text-left" data-reveal>
            <p className="flex items-center gap-2 font-semibold">
              <Mail className="cp-gold h-4 w-4" /> Revisa tu email
            </p>
            <p className="cp-muted mt-2 text-sm">
              Hemos enviado a <strong>{maskEmail(order.buyerEmail)}</strong> un enlace para entrar a tu cuenta, sin contraseña.
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
