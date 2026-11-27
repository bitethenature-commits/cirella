import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Pencil, Percent } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { saleState } from "@/lib/offers";
import { isPersonalMode } from "@/lib/site-mode";
import { homeFoldPath } from "@/lib/site-sections";
import { tenantDb } from "@/lib/tenant";
import { dateKeyInTz, formatDate } from "@/lib/tz";
import { Badge, PageHeader } from "../ui";
import { endOffer } from "./actions";
import { OfferForm, type OfferProduct } from "./offer-form";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Ofertas" };

const KIND: Record<string, string> = { COURSE: "Curso", SESSION: "Sesión", MEMBERSHIP: "Membresía", DIGITAL: "Lectura" };

/**
 * «Ofertas» (junto a Actualidades): poner en oferta cualquier cosa que se paga en la web —un curso, una sesión, un
 * círculo, una lectura o una membresía— con su precio rebajado, su etiqueta y sus días; arriba, las que hay.
 * En la portada salen en el desplegable «Ofertas» y cada una lleva a lo suyo (lib/offers.ts).
 */
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ p?: string; quitada?: string }> }) {
  const t = await getT();
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const tz = creator.timezone;
  const rows = await tenantDb(creator.id).product.findMany({
    where: { status: "PUBLISHED", accessMode: "PAID", priceCents: { gt: 0 } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, type: true, groupSession: true, imageUrl: true, emoji: true, priceCents: true, currency: true, billingInterval: true, salePriceCents: true, saleStartsAt: true, saleEndsAt: true, saleLabel: true },
  });
  const kindOf = (p: (typeof rows)[number]) => (p.type === "SESSION" && p.groupSession ? "Círculo" : (KIND[p.type] ?? "Producto"));
  const products: OfferProduct[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    kind: kindOf(p),
    priceCents: p.priceCents,
    membership: p.type === "MEMBERSHIP",
    sale:
      p.salePriceCents != null
        ? {
            price: String(p.salePriceCents / 100).replace(".", ","),
            label: p.saleLabel ?? "",
            start: p.saleStartsAt ? dateKeyInTz(p.saleStartsAt, tz) : "",
            // Se guarda el final del día siguiente: aquí, el último día que vale.
            end: p.saleEndsAt ? dateKeyInTz(new Date(p.saleEndsAt.getTime() - 1), tz) : "",
          }
        : null,
  }));
  const onSale = rows.filter((p) => p.salePriceCents != null);
  const now = new Date();
  const initial = sp.p && products.some((p) => p.id === sp.p) ? sp.p : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t("Ofertas")}
        actions={
          <Link href={homeFoldPath(creator.username, "ofertas", isPersonalMode())} target="_blank" className="btn btn-outline btn-sm">
            <ExternalLink className="h-4 w-4" />{" "}<Tr s={"Ver en la web"} /></Link>
        }
      />
      {sp.quitada && <Flash ok="Oferta quitada: vuelve a su precio normal." />}

      {/* Las que hay */}
      <section className="mb-8" aria-labelledby="ahora-t">
        <h2 id="ahora-t" className="mb-3 font-semibold"><Tr s={"Tus ofertas"} /></h2>
        {onSale.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted"><Tr s={"Aún no tienes ninguna oferta. Crea la primera aquí debajo."} /></p>
        ) : (
          <ul className="card divide-y divide-line">
            {onSale.map((p) => {
              const s = saleState(p, now);
              const ended = !!p.saleEndsAt && p.saleEndsAt <= now;
              const state = s.active ? { label: "Activa", tone: "success" as const } : s.upcoming ? { label: "Programada", tone: "warning" as const } : { label: ended ? "Terminada" : "No vale", tone: "neutral" as const };
              const days = [p.saleStartsAt ? `desde el ${formatDate(p.saleStartsAt, { day: "numeric", month: "short" }, tz)}` : null, p.saleEndsAt ? `hasta el ${formatDate(new Date(p.saleEndsAt.getTime() - 1), { day: "numeric", month: "short" }, tz)}` : "sin fecha de fin"].filter(Boolean).join(" ");
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/40 text-gold">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    ) : p.emoji ? (
                      <span className="text-xl"><Tr s={p.emoji} /></span>
                    ) : (
                      <Percent className="h-5 w-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                      <Badge tone={state.tone}><Tr s={state.label} /></Badge>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {kindOf(p)}
                      {p.saleLabel ? ` · ${p.saleLabel}` : ""} · <Tr s={days} />
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end leading-tight">
                    <s className="text-xs text-muted">{formatMoney(p.priceCents, p.currency)}</s>
                    <strong className="font-serif text-lg text-gold">{formatMoney(p.salePriceCents!, p.currency)}</strong>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Link href={`/panel/ofertas?p=${p.id}#nueva`} className="btn btn-ghost btn-sm" aria-label={`Cambiar la oferta de ${p.title}`}>
                      <Pencil className="h-4 w-4" />{" "}<Tr s={"Cambiar"} /></Link>
                    <DeleteButton action={endOffer} id={p.id} what={p.title} label={t("Quitar")} message={`¿Quitar la oferta de «${p.title}»? Vuelve a su precio normal; el producto sigue igual.`} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Crear o cambiar */}
      <section id="nueva" className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby="nueva-t">
        <div className="mb-4 flex items-center gap-3">
          <span className="panel-emblem h-10 w-10 shrink-0">
            <Percent className="h-5 w-5" />
          </span>
          <div>
            <h2 id="nueva-t" className="font-semibold">
              {initial ? t("Cambiar la oferta") : t("Nueva oferta")}
            </h2>
            <p className="text-xs text-muted"><Tr s={"Cualquier cosa que se paga en tu web: un curso, una sesión, un círculo, una lectura o una membresía."} /></p>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-muted"><Tr s={"Aún no tienes nada publicado que se pague en tu web. Publica un curso, una sesión, una lectura o una membresía de pago y vuelve aquí."} /></p>
        ) : (
          <OfferForm key={initial ?? "nueva"} products={products} initial={initial} />
        )}
      </section>
    </div>
  );
}
