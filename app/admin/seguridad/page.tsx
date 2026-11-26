import type { Metadata } from "next";
import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "../../panel/ui";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Seguridad" };

/** Verificación en dos pasos de la cuenta de administración (las admins sin página no tienen panel). */
export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ paso?: string; ok?: string; aviso?: string }> }) {
  const t = await getT();
  const user = await requireAdmin();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("Seguridad")} subtitle={t("Protege tu cuenta de administración con un código de tu móvil.")} />
      <TwoFactorSettings user={user} scope="admin" sp={await searchParams} />
    </div>
  );
}
