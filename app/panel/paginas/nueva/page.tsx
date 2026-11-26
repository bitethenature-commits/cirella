import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { PageHeader } from "../../ui";
import { NewPageForm } from "./new-page-form";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Nueva página" };

export default async function NewSitePage() {
  const t = await getT();
  await requireCreator();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/panel/pagina?ver=paginas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Páginas"} /></Link>
      <PageHeader title={t("Nueva página")} subtitle={t("Elige cómo empezar: luego cambias los textos y añades imágenes, galerías o vídeos.")} />
      <NewPageForm />
    </div>
  );
}
