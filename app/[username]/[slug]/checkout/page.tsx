import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { getCurrentUser, holdsCheckout } from "@/lib/auth";
import { dac7SalesPaused } from "@/lib/dac7-data";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { creatorLegalHref, legalIdentityComplete, sellerStatement } from "@/lib/legal";
import { getPurchasableProduct } from "@/lib/orders";
import { asAccessMode } from "@/lib/access-mode";
import { checkoutMethods, paidCheckoutOpen } from "@/lib/payments";
import { canAcceptPayments } from "@/lib/payouts";
import { canInvoiceSale } from "@/lib/invoices/issue";
import { getPlatformIssuer } from "@/lib/invoices/issuer";
import { getPublicProduct } from "@/lib/product-page";
import { asVatStatus, decideTax } from "@/lib/tax";
import { isKnownCountry } from "@/lib/tax/rates";
import { getTaxMode, headerCountry } from "@/lib/tax/server";
import { isGroupSession, seatsTaken } from "@/lib/booking";
import { asksIntake, intakeFormValues, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ pedido?: string; cancelado?: string }>;
}) {
  const { username, slug } = await params;
  const productHref = `/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
  // Web personal o sin pasarela: no hay checkout de pago, de vuelta a la ficha del producto.
  if (!paidCheckoutOpen()) redirect(productHref);
  const sp = await searchParams;
  const data = await getPublicProduct(username, slug);
  if (!data) notFound();
  // Lo gratuito con email y lo que se paga fuera se consiguen desde la ficha, nunca aquí.
  if (asAccessMode(data.product.accessMode) !== "PAID") redirect(productHref);
  const user = await getCurrentUser();
  const isOwner = user?.id === data.creator.userId;
  const purchasable = await getPurchasableProduct(data.product.id);
  if (!purchasable && !isOwner) notFound();
  const p = data.product;
  // Métodos de pago: uno por pasarela activa con la que esta creadora puede cobrar (tarjeta, PayPal).
  const methods = checkoutMethods().filter((m) => canAcceptPayments(data.creator, m.key));
  // IVA: quién vende según la política y el tipo de producto. El país lo elige la compradora.
  const c = data.creator;
  const taxInfo = { mode: await getTaxMode(), creatorCountry: c.legalCountry, creatorVatStatus: asVatStatus(c.vatStatus), creatorVatNote: c.vatExemptionNote };
  const seller = decideTax({
    mode: taxInfo.mode,
    productType: p.type,
    deliveryMode: p.deliveryMode,
    buyerCountry: null,
    creator: { country: c.legalCountry, vatStatus: c.vatStatus },
  }).seller;
  // Si vende Cirella tiene que poder facturar: la misma regla que createPendingOrder (lib/orders.ts),
  // para no dejar rellenar el formulario y fallar al enviarlo.
  const platform = seller === "PLATFORM" ? await getPlatformIssuer() : null;
  const platformCanSell = !platform || isDemoMode() || platform.complete;
  // «Vende: …» igual que en la ficha del producto, el pie y «Tu compra» (lib/legal.ts).
  const statement = sellerStatement(seller, { ...c, displayName: data.config.displayName }, platform);
  // Sin la identidad legal de quien vende no se puede vender (LSSI art. 10).
  const payoutReady =
    !!purchasable &&
    methods.length > 0 &&
    legalIdentityComplete(data.creator) &&
    platformCanSell &&
    !(await dac7SalesPaused(data.creator, p.type));
  // Vuelta desde la pasarela (cancelado) o desde el email de «pago no completado»: se reintenta el
  // mismo pedido. Sus datos (email, NIF, dirección) solo se rellenan en el navegador que lo hizo o
  // para la compradora con su cuenta abierta: la URL con el id se comparte y no debe enseñarlos.
  const found = sp.pedido
    ? await prisma.order.findFirst({
        where: { id: sp.pedido, productId: p.id, status: { in: ["PENDING", "FAILED", "ABANDONED"] } },
        select: {
          id: true,
          buyerName: true,
          buyerEmail: true,
          paymentError: true,
          paymentProvider: true,
          buyerCountry: true,
          billingName: true,
          billingTaxId: true,
          billingAddress: true,
          claimTokenHash: true,
        },
      })
    : null;
  const previous =
    found && ((user?.sessionVerified && user.email === found.buyerEmail) || (!!found.claimTokenHash && (await holdsCheckout(found.id, found.claimTokenHash))))
      ? found
      : null;
  // Taller: fecha fija y plazas que quedan (contando los pagos en curso de otras personas).
  const workshop =
    isGroupSession(p) && p.eventStartAt
      ? {
          startAt: p.eventStartAt.toISOString(),
          ownerTz: data.creator.timezone,
          seatsLeft: p.capacity == null ? null : Math.max(0, p.capacity - (await seatsTaken(prisma, p.id, { ignoreOrderId: previous?.id }))),
        }
      : null;
  // Datos para la lectura: con la sesión verificada de la compradora, sus datos de nacimiento de la
  // última vez (nunca con una sesión limitada a otro pedido ni para alguien sin sesión).
  const intakeCfg = readIntakeConfig(p.intake);
  const intake = asksIntake(p.type, p.deliveryMode, intakeCfg) ? intakeCfg : null;
  const lastIntake =
    intake && intake.birth !== "off" && user?.sessionVerified
      ? await prisma.order.findFirst({
          where: { creatorId: data.creator.id, buyerEmail: user.email, status: "PAID", NOT: { intake: { equals: Prisma.DbNull } } },
          orderBy: { createdAt: "desc" },
          select: { intake: true },
        })
      : null;
  const lastBirth = readIntakeAnswers(lastIntake?.intake)?.birth;
  const intakePrefill = lastBirth ? intakeFormValues({ v: 1, birth: lastBirth, answers: [] }) : undefined;
  const guessed = headerCountry(await headers());
  const defaultCountry = previous?.buyerCountry ?? (guessed ? (isKnownCountry(guessed) ? guessed : "XX") : "ES");

  return (
    <CreatorShell username={username} config={data.config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} sellerName={statement.name}>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        <CheckoutForm
          product={{
            id: p.id,
            type: p.type,
            title: p.title,
            emoji: p.emoji,
            imageUrl: p.imageUrl,
            priceCents: p.priceCents,
            currency: p.currency,
            billingInterval: p.billingInterval,
            durationMin: p.durationMin,
            ctaLabel: p.ctaLabel,
            deliveryMode: p.deliveryMode,
            workshop,
            intake,
            intakePrefill,
          }}
          payoutReady={payoutReady}
          methods={methods}
          defaultMethod={methods.find((m) => m.key === previous?.paymentProvider)?.key ?? methods[0]?.key ?? null}
          initialOrderId={previous?.id}
          notice={
            sp.cancelado === "1" && previous
              ? ["No se ha completado el pago.", previous.paymentError, "Puedes intentarlo de nuevo cuando quieras."].filter(Boolean).join(" ")
              : undefined
          }
          prefill={{ name: previous?.buyerName ?? user?.name ?? "", email: previous?.buyerEmail ?? user?.email ?? "" }}
          demo={isDemoMode()}
          creatorName={data.config.displayName}
          seller={{
            name: data.creator.legalName ?? data.config.displayName,
            line: statement.line,
            legalHref: creatorLegalHref(username),
          }}
          platformName={data.personal ? null : data.platformName}
          taxInfo={taxInfo}
          canInvoice={canInvoiceSale(seller, c)}
          defaultCountry={defaultCountry}
          billingPrefill={
            previous?.billingTaxId
              ? { wantsInvoice: true, name: previous.billingName ?? "", taxId: previous.billingTaxId, address: previous.billingAddress ?? "" }
              : undefined
          }
        />
      </main>
      <TrackOnMount creatorId={data.creator.id} type="CHECKOUT_STARTED" productId={p.id} disabled={isOwner} />
    </CreatorShell>
  );
}
