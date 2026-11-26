import type { Metadata } from "next";
import Link from "next/link";
import { peopleLabel } from "@/lib/site-mode";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../../ui";
import { GiveAccessForm, type GiveProduct } from "./give-access-form";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Dar acceso" };

/** «Dar acceso»: a quien haya hablado contigo directamente, sin solicitud previa. Cualquier producto. */
export default async function GiveAccessPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const t = await getT();
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const [products, customers] = await Promise.all([
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, type: true, deliveryMode: true, status: true, billingInterval: true },
    }),
    db.customer.findMany({ orderBy: { lastPurchaseAt: { sort: "desc", nulls: "last" } }, take: 300, select: { name: true, email: true } }),
  ]);
  const list: GiveProduct[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    published: p.status === "PUBLISHED",
    billingInterval: p.billingInterval,
    kind:
      p.type === "COURSE"
        ? "course"
        : p.type === "MEMBERSHIP"
          ? "membership"
          : p.type === "SESSION"
            ? "session"
            : p.deliveryMode === "PERSONAL"
              ? "reading"
              : "digital",
  }));
  return (
    <div className="max-w-3xl pb-28">
      <Link href="/panel/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {peopleLabel()}
      </Link>
      <PageHeader title={t("Dar acceso")} subtitle={t("A cualquiera que haya hablado contigo, sin formulario. Elige qué le das y escribe su email: le llega el enlace para entrar.")} />
      {list.length === 0 ? (
        <p className="card p-5 text-sm text-muted"><Tr s={"Primero crea algún producto en"} />{" "}<Link href="/panel/sesiones" className="underline"><Tr s={"Sesiones y lecturas"} /></Link>.
        </p>
      ) : (
        <GiveAccessForm products={list} customers={customers.map((c) => ({ name: c.name ?? "", email: c.email }))} timeZone={creator.timezone} initialEmail={sp.email} />
      )}
    </div>
  );
}
