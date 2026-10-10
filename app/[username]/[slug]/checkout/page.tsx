import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { getCurrentUser } from "@/lib/auth";
import { dac7SalesPaused } from "@/lib/dac7-data";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { creatorLegalHref, legalIdentityComplete, sellerLine } from "@/lib/legal";
import { getPurchasableProduct } from "@/lib/orders";
import { paymentProvider } from "@/lib/payments";
import { canAcceptPayments } from "@/lib/payouts";
import { getPublicProduct } from "@/lib/product-page";
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
  const sp = await searchParams;
  const data = await getPublicProduct(username, slug);
  if (!data) notFound();
  const user = await getCurrentUser();
  const isOwner = user?.id === data.creator.userId;
  const purchasable = await getPurchasableProduct(data.product.id);
  if (!purchasable && !isOwner) notFound();
  const p = data.product;
  const provider = paymentProvider();
  // Sin la identidad legal de quien vende no se puede vender (LSSI art. 10).
  const payoutReady =
    !!purchasable &&
    canAcceptPayments(data.creator, provider.key) &&
    legalIdentityComplete(data.creator) &&
    !(await dac7SalesPaused(data.creator, p.type));
  // Vuelta desde la pasarela (cancelado) o desde el email de «pago no completado»: se reintenta el mismo pedido.
  const previous = sp.pedido
    ? await prisma.order.findFirst({
        where: { id: sp.pedido, productId: p.id, status: { in: ["PENDING", "FAILED", "ABANDONED"] } },
        select: { id: true, buyerName: true, buyerEmail: true, paymentError: true },
      })
    : null;

  return (
    <CreatorShell username={username} config={data.config} allowCustom={data.allowCustom} sellerName={data.creator.legalName}>
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
          }}
          payoutReady={payoutReady}
          collectsCardOnSite={provider.collectsCardOnSite}
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
            line: data.creator.legalName ? sellerLine(data.creator) : data.config.displayName,
            legalHref: creatorLegalHref(username),
          }}
          platformName={data.platformName}
        />
      </main>
      <TrackOnMount creatorId={data.creator.id} type="CHECKOUT_STARTED" productId={p.id} disabled={isOwner} />
    </CreatorShell>
  );
}
