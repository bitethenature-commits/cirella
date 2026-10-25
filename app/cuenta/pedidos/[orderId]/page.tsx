import type { Metadata } from "next";
import Link from "next/link";
import { isPersonalMode } from "@/lib/site-mode";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Eye, FileText, Mail } from "lucide-react";
import { PrintButton } from "@/components/invoice/print-button";
import { Flash } from "@/components/ui/flash";
import { isNoChargeOrder } from "@/lib/access-mode";
import { orderTargetPath } from "@/lib/auth-utils";
import { requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { INVOICE_TYPE_LABEL } from "@/lib/invoices/format";
import { canInvoiceSale } from "@/lib/invoices/issue";
import { getPlatformIssuer } from "@/lib/invoices/issuer";
import { formatLegalAddress, sellerLine, sellerStatement, type LegalIdentity } from "@/lib/legal";
import type { LegalSnapshotContent } from "@/lib/legal-snapshot";
import { bpsToPercent, formatMoney, formatPrice } from "@/lib/money";
import { orderRef } from "@/lib/order-ref";
import { formatDate } from "@/lib/tz";
import { IntakeEditCard } from "@/components/booking/intake-edit-card";
import { MediaView } from "@/components/media/media-view";
import { RichContent } from "@/components/rich-text/rich-content";
import { asksIntake, intakeMissing, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { intakeLocked } from "@/lib/intake-lock";
import { saveIntake } from "../../actions";
import { CreatorTag, Thumb } from "../../ui";

/** Archivos que se pueden ver en la web (visor de /cuenta/archivos/[fileId]). */
const VIEWABLE = new Set(["PDF", "IMAGE", "AUDIO", "VIDEO"]);
import { FullInvoiceForm } from "./full-invoice-form";

export const metadata: Metadata = { title: "Tu compra", robots: { index: false } };

/**
 * «Tu compra»: una compra concreta. Es el destino de los productos digitales (botón de «gracias»,
 * recibo) y lo único que ve una sesión limitada a un pedido además del curso, la membresía o la
 * reserva de ese pedido.
 */
export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ factura?: string }> }) {
  const { orderId } = await params;
  const sp = await searchParams;
  const { user, scoped } = await requireBuyerFor({ orderId }, `/cuenta/pedidos/${orderId}`);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { userId: true } },
      creator: true,
      product: { include: { files: { orderBy: { sortOrder: "asc" } } } },
      bookings: { orderBy: { createdAt: "asc" } },
      legalSnapshot: { select: { content: true } },
      files: { where: { sentAt: { not: null } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || order.customer?.userId !== user.id || !["PAID", "REFUNDED"].includes(order.status)) notFound();
  const c = creatorBrief(order.creator);
  // Quién vendió: la identidad aceptada al comprar (instantánea del pedido), no la de hoy (la creadora
  // puede haber cambiado de NIF o de domicilio). Los pedidos sin instantánea usan la actual.
  const seller: Partial<LegalIdentity> = (order.legalSnapshot?.content as LegalSnapshotContent | null | undefined)?.identity ?? order.creator;
  // Recibo y factura: facturas de la venta (la simplificada, su sustituta y las rectificativas).
  const [invoices, taxedCharge, platform] = await Promise.all([
    prisma.invoice.findMany({
      where: { orderId: order.id, kind: "SALE" },
      orderBy: { issuedAt: "asc" },
      select: { id: true, type: true, fullNumber: true, taxNote: true, relatedFrom: { where: { type: "F3" }, select: { id: true } } },
    }),
    prisma.transaction.findFirst({ where: { orderId: order.id, type: "CHARGE", taxSeller: { not: null } }, select: { id: true } }),
    order.taxSeller === "PLATFORM" ? getPlatformIssuer() : null,
  ]);
  const fullInvoice = invoices.find((i) => i.type === "F1" || i.type === "F3");
  // Los pedidos anteriores a la facturación (sin instantánea fiscal en el cobro) solo tienen justificante.
  const invoiceable = !!taxedCharge && canInvoiceSale(order.taxSeller, order.creator);
  // «Vende: …» como en la ficha del producto y el checkout (lib/legal.ts → sellerStatement).
  const soldBy = sellerStatement(order.taxSeller, { ...seller, displayName: order.creator.displayName }, platform);
  const booking = order.bookings[0];
  // Gratis o dado a mano: no hubo pago, así que ni recibo, ni factura, ni justificante.
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

  return (
    <div className="max-w-2xl">
      {!scoped && (
        <Link href="/cuenta/compras" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {isPersonalMode() ? "Mis canales" : "Mis compras"}
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
        {noCharge ? "Gratis" : formatPrice(order.amountCents, order.currency, order.product.billingInterval)} · {noCharge ? "Referencia" : "Pedido"} {orderRef(order.id)}
        {order.paidAt && ` · ${formatDate(order.paidAt)}`}
      </p>

      {refunded ? (
        <div className="card mt-6 p-6">
          <p className="font-semibold">Esta compra se reembolsó{order.refundedAt ? ` el ${formatDate(order.refundedAt, { day: "numeric", month: "long", year: "numeric" })}` : ""}.</p>
          <p className="mt-1 text-sm text-muted">El contenido ya no está disponible.</p>
        </div>
      ) : prepared ? (
        <section id="lectura" className="card mt-6 scroll-mt-24 space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Tu lectura</h2>
          {order.deliveredAt && access ? (
            <>
              {order.deliveryMessage && <RichContent text={order.deliveryMessage} format={order.deliveryMessageFormat} legacy="paragraphs" tone="account" />}
              {order.files.map((f) =>
                f.kind === "LINK" && f.url ? (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm h-11">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir enlace · {f.name}
                  </a>
                ) : (
                  <div key={f.id} className="space-y-2">
                    {(f.kind === "AUDIO" || f.kind === "VIDEO") ? (
                      <div className="overflow-hidden rounded-2xl bg-ink py-4">
                        <MediaView file={f} title={`${f.name} · ${order.productTitle}`} artwork={order.product.imageUrl} poster={order.product.imageUrl} />
                      </div>
                    ) : (
                      <p className="text-sm font-medium">{f.name}</p>
                    )}
                    <span className="flex flex-wrap gap-2">
                      {VIEWABLE.has(f.kind) && f.kind !== "AUDIO" && f.kind !== "VIDEO" && (
                        <Link href={`/cuenta/archivos/${f.id}`} className="btn btn-primary btn-sm">
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </Link>
                      )}
                      <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm">
                        <Download className="h-3.5 w-3.5" /> Descargar
                      </a>
                    </span>
                  </div>
                ),
              )}
            </>
          ) : access ? (
            <p className="text-sm text-muted">{c.displayName} la está preparando. Te avisaremos por email cuando esté lista.</p>
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
          <ul className="card mt-6 divide-y divide-line">
            {order.product.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0 truncate font-medium">{f.name}</span>
                {f.kind === "LINK" ? (
                  <a href={`/api/download/${f.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir enlace
                  </a>
                ) : (
                  <span className="flex shrink-0 gap-2">
                    {VIEWABLE.has(f.kind) && (
                      <Link href={`/cuenta/archivos/${f.id}`} className="btn btn-primary btn-sm">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </Link>
                    )}
                    <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm">
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
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
      <section id="factura" className="mt-10 scroll-mt-20 space-y-4">
        <h2 className="eyebrow !text-ink print:hidden">Recibo y factura</h2>
        {sp.factura === "emitida" && fullInvoice && <Flash ok={`Hemos emitido tu factura ${fullInvoice.fullNumber}.`} />}
        {invoices.length > 0 ? (
          <>
            <div className="card space-y-1.5 p-5 text-sm">
              <p className="flex justify-between gap-4"><span className="text-muted">Total</span><strong className="tabular-nums">{formatMoney(order.amountCents, order.currency, { decimals: true })}</strong></p>
              {order.taxCents > 0 && (
                <p className="flex justify-between gap-4 text-muted">
                  <span>IVA incluido ({bpsToPercent(order.taxRateBps)})</span>
                  <span className="tabular-nums">{formatMoney(order.taxCents, order.currency, { decimals: true })}</span>
                </p>
              )}
              {invoices[0].taxNote && <p className="text-xs italic text-muted">{invoices[0].taxNote.replace(/ ?Factura expedida por .*$/, "")}</p>}
              <p className="pt-1 text-xs text-muted">Vende: {soldBy.line}</p>
            </div>
            <ul className="card divide-y divide-line">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <span>
                      {INVOICE_TYPE_LABEL[inv.type]} <span className="font-mono text-xs">{inv.fullNumber}</span>
                      {inv.relatedFrom.length > 0 && <span className="text-muted"> (sustituida)</span>}
                    </span>
                  </span>
                  <Link href={`/facturas/${inv.id}`} className="btn btn-outline btn-sm shrink-0">Ver</Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="card space-y-3 p-5 text-sm sm:p-6">
            <h3 className="display text-2xl">Justificante de compra</h3>
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
              <dd>{soldBy.platformSells ? soldBy.line : seller.legalName ? `${sellerLine(seller)} · ${formatLegalAddress(seller)}` : order.creator.displayName}</dd>
              <dt className="text-muted">Total</dt>
              <dd className="font-semibold">{formatMoney(order.amountCents, order.currency, { decimals: true })}</dd>
            </dl>
            <p className="text-xs italic text-muted">Este documento no es una factura.</p>
            <PrintButton label="Imprimir justificante" />
          </div>
        )}
        {!fullInvoice && order.status === "PAID" && order.refundedCents === 0 && (
          invoiceable ? (
            <div className="print:hidden"><FullInvoiceForm orderId={order.id} defaultCountry={order.buyerCountry ?? "ES"} lockedCountry={order.buyerCountry} /></div>
          ) : (
            <p className="text-sm text-muted print:hidden">
              {taxedCharge ? `${seller.legalName ?? order.creator.displayName} no emite facturas con IVA por esta venta.` : "Esta compra no admite factura con NIF."} Puedes usar el justificante de compra.
            </p>
          )
        )}
      </section>
      )}

      {c.email && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-5 text-sm print:hidden">
          <p className="flex-1">¿Dudas? Escribe a {c.displayName}.</p>
          <a href={`mailto:${c.email}`} className="btn btn-ghost btn-sm">
            <Mail className="h-4 w-4" /> {c.email}
          </a>
        </div>
      )}
    </div>
  );
}
