import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { asAccessMode } from "@/lib/access-mode";
import { getCurrentUser } from "@/lib/auth";
import { isGroupSession, seatsTaken } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { asksIntake, intakeFormValues, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { creatorLegalHref, sellerStatement } from "@/lib/legal";
import { effectivePriceCents, orderSaleMeta } from "@/lib/offers";
import { getPublicProduct } from "@/lib/product-page";
import { productPath } from "@/lib/public-paths";
import { renamedProductSlug } from "@/lib/renamed-slugs";
import { getRequestableProduct } from "@/lib/requests";
import { RequestForm } from "./request-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Solicitud"), robots: { index: false } };
}

/** Formulario de solicitud (en vez de pagar): /{usuario}/{producto}/request. */
export default async function RequestPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const data = await getPublicProduct(username, slug);
  if (!data) {
    // Un nombre de antes (lib/renamed-slugs.ts): lleva al formulario del nombre nuevo.
    const renamed = renamedProductSlug(slug);
    const moved = renamed ? await getPublicProduct(username, renamed) : null;
    if (moved) redirect(productPath(username, moved.product, "request"));
    notFound();
  }
  // La ficha, en su dirección (en la web personal, en su sección: /sessions/<sesión>…).
  const productHref = productPath(username, data.product);
  // Lo gratuito con email y lo que se paga fuera se consiguen desde la ficha.
  if (asAccessMode(data.product.accessMode) !== "PAID") redirect(productHref);
  const user = await getCurrentUser();
  const isOwner = user?.id === data.creator.userId;
  const requestable = await getRequestableProduct(data.product.id);
  if (!requestable && !isOwner) notFound();
  const p = data.product;
  const statement = sellerStatement({ ...data.creator, displayName: data.config.displayName });
  const workshop =
    isGroupSession(p) && p.eventStartAt
      ? {
          startAt: p.eventStartAt.toISOString(),
          ownerTz: data.creator.timezone,
          seatsLeft: p.capacity == null ? null : Math.max(0, p.capacity - (await seatsTaken(prisma, p.id, { holds: true }))),
        }
      : null;
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

  return (
    <CreatorShell page="productos" username={username} config={data.config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} sellerName={statement.name} showNewsletter={false}>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        <RequestForm
          product={{
            id: p.id,
            type: p.type,
            title: p.title,
            courseCategory: p.courseCategory,
            emoji: p.emoji,
            imageUrl: p.imageUrl,
            priceCents: effectivePriceCents(p),
            sale: orderSaleMeta(p),
            currency: p.currency,
            billingInterval: p.billingInterval,
            durationMin: p.durationMin,
            workshop,
            intake,
            intakePrefill,
          }}
          creatorName={data.config.displayName}
          avatarUrl={data.config.avatarUrl}
          seller={{ name: data.creator.legalName ?? data.config.displayName, legalHref: creatorLegalHref(username) }}
          productHref={productHref}
        />
      </main>
      <TrackOnMount creatorId={data.creator.id} type="CHECKOUT_STARTED" productId={p.id} disabled={isOwner} />
    </CreatorShell>
  );
}
