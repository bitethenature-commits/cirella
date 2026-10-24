import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { PageHeader } from "../../ui";
import { NewPageForm } from "./new-page-form";

export const metadata: Metadata = { title: "Nueva página" };

export default async function NewSitePage() {
  await requireCreator();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/panel/paginas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Páginas
      </Link>
      <PageHeader title="Nueva página" subtitle="Elige cómo empezar: luego cambias los textos y añades imágenes, galerías o vídeos." />
      <NewPageForm />
    </div>
  );
}
