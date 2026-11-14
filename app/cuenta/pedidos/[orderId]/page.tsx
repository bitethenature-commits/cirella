import type { Metadata } from "next";
import Link from "next/link";
import { isPersonalMode } from "@/lib/site-mode";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Eye, Mail } from "lucide-react";
import { isNoChargeOrder } from "@/lib/access-mode";
import { orderTargetPath } from "@/lib/auth-utils";
import { requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatLegalAddress, sellerLine, type LegalIdentity } from "@/lib/legal";
import type { LegalSnapshotContent } from "@/lib/legal-snapshot";
import { formatMoney, formatPrice } from "@/lib/money";
import { orderRef } from "@/lib/order-ref";
import { formatDate } from "@/lib/tz";
import { IntakeEditCard } from "@/components/booking/intake-edit-card";
import { ReadingFiles } from "@/components/account/reading-files";
import { channelKindLabel } from "@/lib/channel-kind";
import { RichContent } from "@/components/rich-text/rich-content";
import { asksIntake, intakeMissing, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { intakeLocked } from "@/lib/intake-lock";
import { saveIntake } from "../../actions";
import { MethodTag, Thumb } from "../../ui";

/** Archivos que se pueden ver en la web (visor de /cuenta/archivos/[fileId]). */
const VIEWABLE = new Set(["PDF", "IMAGE", "AUDIO", "VIDEO"]);

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
      legalSnapshot: { select: { content: true } },
    },
  });
  if (!order || order.customer?.userId !== user.id || !["PAID", "REFUNDED"].includes(order.status)) notFound();
  const c = creatorBrief(order.creator);
  // Quién vendió: la identidad aceptada al comprar (instantánea del pedido), no la de hoy (la creadora
  // puede haber cambiado de NIF o de domicilio). Los pedidos sin instantánea usan la actual.
  const seller: Partial<LegalIdentity> = (order.legalSnapshot?.content as LegalSnapshotContent | null | undefined)?.identity ?? order.creator;

  const booking = order.bookings[0];
  // Gratis o dado a mano: no hubo pago, así que no hay resumen de la compra.
  const noCharge = isNoChargeOrder(order);
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
  // Lectura «Lo preparo yo»: la prepara la creadora y la entrega aquí (mensaje y archivos).
  const prepared = order.productType === "DIGITAL" && order.product.deliveryMode === "PERSONAL";
  const intakeCfg = readIntakeConfig(order.product.intake);
  const intakeAnswers = readIntakeAnswers(order.intake);
  const showIntake = !refunded && order.status === "PAID" && asksIntake(order.product.type, order.product.deliveryMode, intakeCfg) && order.productType !== "SESSION";

  // Volver a la sección de la que viene: las lecturas, a «Círculos y lecturas»; lo demás, a sus archivos.
  const kind = channelKindLabel({ ...order.product, title: order.productTitle });
  const backTo = !isPersonalMode()
    ? { href: "/cuenta/compras", label: "Mis compras" }
    : kind === "Lectura"
      ? { href: "/cuenta/sesiones#lecturas", label: "Círculos y lecturas" }
      : order.productType === "SESSION"
        ? { href: "/cuenta/sesiones", label: "Círculos y lecturas" }
        : { href: "/cuenta/archivos", label: "Mis archivos" };
  const here = `/cuenta/pedidos/${order.id}`;

  return (
    <div className="mx-auto max-w-3xl">
      {!scoped && (
        <Link href={backTo.href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold" data-back>
          <ArrowLeft className="h-4 w-4" /> {backTo.label}
        </Link>
      )}
      {/* La portada: su imagen a lo ancho, fundida con el cielo, y el título centrado. */}
      <header className="relative mt-4 overflow-hidden rounded-[1.75rem] ring-1 ring-gold/30" data-order-hero>
        {order.product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={order.product.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0d0c22] via-[#0d0c22]/75 to-[#0d0c22]/10" />
        <div className="relative px-6 pb-8 pt-28 text-center sm:pt-36">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-gold">✦ {kind === "Lectura" ? "Tu lectura" : kind || "Tu compra"} ✦</p>
          <h1 className="display mt-2 text-[2.4rem] leading-none text-[#f6f1e7] sm:text-[3.2rem]">{order.productTitle}</h1>
          {order.product.summary && <p className="mx-auto mt-3 max-w-md text-sm text-[rgb(246_241_231/.75)]">{order.product.summary}</p>}
          <div className="mt-4 flex justify-center">
            <MethodTag product={{ title: order.productTitle, courseCategory: order.product.courseCategory }} />
          </div>
          <p className="mt-2 text-xs text-[rgb(246_241_231/.55)]">
            {noCharge ? "Referencia" : `${formatPrice(order.amountCents, order.currency, order.product.billingInterval)} · Pedido`} {orderRef(order.id)}
            {order.paidAt && ` · ${formatDate(order.paidAt)}`}
          </p>
        </div>
      </header>

      {refunded ? (
        <div className="card mt-6 p-6">
          <p className="font-semibold">Esta compra se reembolsó{order.refundedAt ? ` el ${formatDate(order.refundedAt, { day: "numeric", month: "long", year: "numeric" })}` : ""}.</p>
          <p className="mt-1 text-sm text-muted">El contenido ya no está disponible.</p>
        </div>
      ) : prepared ? (
        <section id="lectura" className="mt-8 scroll-mt-24 space-y-5">
          {access ? (
            <div className="card p-6 text-center ring-1 ring-gold/20">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold">Por email</p>
              <p className="display mt-1 text-[1.5rem]">{c.displayName} te la enviará por email</p>
              <p className="mt-1 text-sm text-muted">Tu lectura y su material te llegan directamente a tu correo.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Ya no tienes acceso a este contenido. Si crees que es un error, escribe a {c.displayName}.</p>
          )}
        </section>
      ) : cta ? (
        <Link href={cta.href} className="btn btn-primary btn-lg mt-6 w-full sm:w-auto">
          {cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : access ? (
        order.product.files.length > 0 && (
          <section className="mt-8">
            <ReadingFiles files={order.product.files} title={order.productTitle} artwork={order.product.imageUrl} back={here} linkHref={(f) => `/api/download/${f.id}`} />
          </section>
        )
      ) : (
        <div className="card mt-6 p-6 text-sm text-muted">Ya no tienes acceso a este contenido. Si crees que es un error, escribe a {c.displayName}.</div>
      )}

      {!refunded && order.product.instructions && <p className="mt-5 rounded-xl bg-sand/60 px-4 py-3 text-sm italic">{order.product.instructions}</p>}

      {showIntake && (
        <div className="mt-5">
          <IntakeEditCard
            config={intakeCfg}
            answers={intakeAnswers}
            locked={intakeLocked({ deliveredAt: order.deliveredAt, bookings: [] })}
            lockedText={`Si algo no está bien, escribe a ${c.displayName}.`}
            action={saveIntake}
            hidden={{ orderId: order.id }}
            missing={intakeMissing(intakeCfg, intakeAnswers)}
            ownerName={c.displayName}
          />
        </div>
      )}

      {!noCharge && (
        <section id="resumen" className="mt-10 scroll-mt-20 space-y-4">
          <h2 className="eyebrow !text-ink">Resumen de la compra</h2>
          <div className="card space-y-3 p-5 text-sm sm:p-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted">Producto</dt>
              <dd>{order.productTitle}</dd>
              <dt className="text-muted">Fecha</dt>
              <dd>{order.paidAt ? formatDate(order.paidAt, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
              <dt className="text-muted">Pedido</dt>
              <dd className="font-mono text-xs leading-5">{orderRef(order.id)}</dd>
              <dt className="text-muted">Compradora</dt>
              <dd>{[order.buyerName, order.buyerEmail].filter(Boolean).join(" · ")}</dd>
              <dt className="text-muted">Vende</dt>
              <dd>{seller.legalName ? `${sellerLine(seller)} · ${formatLegalAddress(seller)}` : order.creator.displayName}</dd>
              <dt className="text-muted">Total</dt>
              <dd className="font-semibold">{formatMoney(order.amountCents, order.currency, { decimals: true })}</dd>
            </dl>
          </div>
        </section>
      )}
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
