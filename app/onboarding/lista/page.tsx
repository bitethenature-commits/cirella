import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/logo";
import { CopyButton } from "@/components/ui/copy-button";
import { requireCreator } from "@/lib/auth";
import { DELIVERY_COUNT, deliveryFacts, deliveryIssue, deliveryIssueCopy, deliveryIssueHref } from "@/lib/delivery";
import { appHost, appUrl, isDemoMode } from "@/lib/env";
import { getPlatformIssuer } from "@/lib/invoices/issuer";
import { legalIdentityComplete } from "@/lib/legal";
import { canAcceptPayments } from "@/lib/payouts";
import { decideTax } from "@/lib/tax";
import { getTaxMode } from "@/lib/tax/server";
import { tenantDb } from "@/lib/tenant";
import { ShareButtons } from "./share-buttons";

export const metadata: Metadata = { title: "Tu página está lista · Cirella" };

export default async function ReadyPage() {
  const { creator } = await requireCreator();
  const url = `${appUrl()}/${creator.username}`;
  const pretty = `${appHost()}/${creator.username}`;
  const jar = await cookies();
  let plan = "";
  try {
    plan = JSON.parse(jar.get("cirella_signup")?.value ?? "{}").plan ?? "";
  } catch {}
  // Solo se promete que ya pueden comprarte si es verdad: producto publicado y cobros activos.
  const first = await tenantDb(creator.id).product.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
    include: DELIVERY_COUNT,
  });
  const issue = first ? deliveryIssue(deliveryFacts(first)) : null;
  const payoutsReady = canAcceptPayments(creator);
  // Las mismas reglas que el checkout: sus datos legales y, si vende Cirella (IVA de lo digital),
  // los datos fiscales de la plataforma.
  const seller = first
    ? decideTax({ mode: await getTaxMode(), productType: first.type, deliveryMode: first.deliveryMode, buyerCountry: null, creator: { country: creator.legalCountry, vatStatus: creator.vatStatus } }).seller
    : null;
  const platformCanSell = seller !== "PLATFORM" || isDemoMode() || (await getPlatformIssuer()).complete;
  const canSell = first?.status === "PUBLISHED" && payoutsReady && legalIdentityComplete(creator) && platformCanSell;
  const pendingItems: { title: string; text?: string; href: string; cta: string }[] = [];
  if (!first) pendingItems.push({ title: "Añade tu primer producto", href: "/panel/productos/nuevo", cta: "Añadir producto" });
  else if (issue?.blocking) {
    const copy = deliveryIssueCopy(issue, first.title);
    pendingItems.push({
      title: copy.title,
      text: "Lo hemos guardado como borrador: no aparece en tu página hasta que añadas qué entregas.",
      href: deliveryIssueHref(first.id, issue),
      cta: copy.cta,
    });
  }
  if (!payoutsReady) pendingItems.push({ title: "Conecta tu cuenta de cobro para empezar a vender.", href: "/panel/ajustes/cobros", cta: "Conectar cobros" });

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-5 py-16 text-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/demo/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="starfield absolute inset-0 opacity-70" />
      <div className="relative w-full max-w-md text-center animate-fade-up">
        <LogoMark className="mx-auto h-12 w-12 animate-float" />
        <p className="eyebrow mt-8 !text-gold">Publicada</p>
        <h1 className="display mt-3 text-[3.2rem] leading-none sm:text-[4rem]">Tu página está lista</h1>
        <p className="mt-4 text-cream/70">
          {canSell ? "Copia tu enlace y pégalo en tu bio. Tus seguidoras ya pueden comprarte." : "Copia tu enlace y pégalo en tu bio."}
        </p>

        <div className="glass-dark mt-8 rounded-2xl p-2">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-black/30 py-2 pl-4 pr-2">
            <span className="truncate font-medium">{pretty}</span>
            <CopyButton text={url} className="btn btn-light btn-sm shrink-0" label="Copiar enlace" />
          </div>
        </div>

        {!canSell && pendingItems.length > 0 && (
          <div className="glass-dark mt-4 space-y-4 rounded-2xl p-4 text-left">
            <p className="eyebrow !text-gold">Antes de vender</p>
            {pendingItems.map((item) => (
              <div key={item.title} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.title}</p>
                  {item.text && <p className="mt-0.5 text-sm text-cream/70">{item.text}</p>}
                </div>
                <Link href={item.href} className="btn btn-light btn-sm shrink-0">
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        )}

        <ShareButtons url={url} name={creator.displayName} />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/${creator.username}`} className="btn btn-light btn-lg" target="_blank">
            Ver página <ExternalLink className="h-4 w-4" />
          </Link>
          <Link href="/panel" className="btn btn-lg border border-white/20 text-cream hover:bg-white/10">
            Ir a mi panel <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {plan && plan !== "free" && (
          <Link href={`/panel/plan?elegir=${plan}`} className="mt-8 inline-flex items-center gap-2 text-sm text-gold hover:underline">
            <Sparkles className="h-4 w-4" /> Activar el plan que elegiste
          </Link>
        )}
      </div>
    </main>
  );
}
