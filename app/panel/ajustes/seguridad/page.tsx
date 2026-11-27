import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { requireCreator } from "@/lib/auth";
import { PageHeader } from "../../ui";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ paso?: string; ok?: string; aviso?: string }> }) {
  const t = await getT();
  const { user } = await requireCreator();
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/ajustes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Ajustes"} /></Link>
      <PageHeader title={t("Seguridad")} subtitle={t("Protege tu panel con un código de tu móvil.")} />
      <TwoFactorSettings user={user} scope="panel" sp={await searchParams} />
    </div>
  );
}
