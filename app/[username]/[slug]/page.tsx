import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ProductPageView } from "@/components/creator-page/product-page-view";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { asAccessMode } from "@/lib/access-mode";
import { getCurrentUser } from "@/lib/auth";
import { appUrl, isDemoMode } from "@/lib/env";
import { legalIdentityComplete, sellerStatement } from "@/lib/legal";
import { getPublicProduct } from "@/lib/product-page";
import { isPersonalMode } from "@/lib/site-mode";
import { isGroupSession, seatsTaken } from "@/lib/booking";
import { prisma } from "@/lib/db";

type Params = { username: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getPublicProduct(username, slug);
  if (!data) return { title: "Producto no encontrado" };
  const title = `${data.product.title} · ${data.config.displayName}`;
  const description = data.product.summary ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: data.product.imageUrl ? [{ url: `${appUrl()}${data.product.imageUrl}` }] : undefined },
    alternates: { canonical: `${appUrl()}/${username}/${slug}` },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ embed?: string }> }) {
  const { username, slug } = await params;
  const sp = await searchParams;
  const data = await getPublicProduct(username, slug);
  if (!data) notFound();
  const user = await getCurrentUser();
  const isOwner = user?.id === data.creator.userId;
  if (!data.creator.published && !isOwner) notFound();

  const { product: p, config, creator } = data;
  // Cómo se consigue (lib/access-mode.ts): pago aquí, gratis con email o pago en otra web.
  const accessMode = asAccessMode(p.accessMode);
  // En la web personal sin cobros nada se cobra aquí: un producto de pago en la web no se ofrece.
  if (data.signupsOnly && accessMode === "PAID" && !isOwner) notFound();
  const paid = accessMode === "PAID" && !data.signupsOnly;
  const clickEvent = isOwner ? null : { creatorId: creator.id, type: "PRODUCT_CLICK" as const, productId: p.id };
  // Quién vende (lo mismo que dirán el checkout y el recibo).
  const seller = sellerStatement({ ...creator, displayName: config.displayName });
  const sellerNamed = !!creator.legalName;
  // Taller en directo: plazas al momento (la página es dinámica).
  const seatsLeft = isGroupSession(p) && p.eventStartAt && p.capacity != null ? Math.max(0, p.capacity - (await seatsTaken(prisma, p.id))) : null;

  return (
    <CreatorShell username={username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages} sellerName={paid && sellerNamed ? seller.name : null}>
      <ProductPageView
        username={username}
        product={{
          ...p,
          includes: p.includes
            .map((i) => i.includedProduct)
            .filter((ip) => ip.status !== "ARCHIVED" && ip.creatorId === p.creatorId)
            .map((ip) => ({ id: ip.id, title: ip.title, slug: ip.slug, status: ip.status, lessons: ip._count.lessons })),
        }}
        timeZone={creator.timezone}
        signupsOnly={data.signupsOnly}
        seller={{ line: seller.line, named: sellerNamed }}
        seatsLeft={seatsLeft}
        testimonial={config.testimonials[0] ?? null}
        claim={{
          legalComplete: legalIdentityComplete(creator),
          isOwner,
          responsible: creator.legalName || config.displayName,
          processorName: isPersonalMode() ? null : data.platformName,
          creatorDisplayName: config.displayName,
          demo: isDemoMode(),
        }}
        clickEvent={clickEvent}
      />
      <TrackOnMount creatorId={creator.id} type="PRODUCT_VIEW" productId={p.id} disabled={isOwner || sp.embed === "1"} />
    </CreatorShell>
  );
}
