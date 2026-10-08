import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { getPurchasableProduct } from "@/lib/orders";
import { getPublicProduct } from "@/lib/product-page";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const data = await getPublicProduct(username, slug);
  if (!data) notFound();
  const user = await getCurrentUser();
  const isOwner = user?.id === data.creator.userId;
  const purchasable = await getPurchasableProduct(data.product.id);
  if (!purchasable && !isOwner) notFound();
  const p = data.product;

  return (
    <CreatorShell username={username} config={data.config} allowCustom={data.allowCustom}>
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
          payoutReady={!!data.creator.payoutConnectedAt && !!purchasable}
          prefill={{ name: user?.name ?? "", email: user?.email ?? "" }}
          demo={isDemoMode()}
          creatorName={data.config.displayName}
        />
      </main>
      <TrackOnMount creatorId={data.creator.id} type="CHECKOUT_STARTED" productId={p.id} disabled={isOwner} />
    </CreatorShell>
  );
}
