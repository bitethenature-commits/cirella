import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { PageHeader } from "../../ui";
import { CodeForm } from "../code-form";

export const metadata: Metadata = { title: "Nuevo código" };

export default async function NewDiscountCodePage() {
  await requireCreator();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/codigos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Códigos
      </Link>
      <PageHeader title="Nuevo código" />
      <CodeForm code={{ id: null, brand: "", code: "", description: "", url: "", imageUrl: null, images: [], expiresOn: "", active: true }} />
    </div>
  );
}
