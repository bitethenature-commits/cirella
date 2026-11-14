import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { PageHeader } from "../../ui";
import { DeckForm } from "../deck-form";

export const metadata: Metadata = { title: "Nueva baraja" };

export default async function NewDeckPage() {
  await requireCreator();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/barajas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Barajas
      </Link>
      <PageHeader title="Nueva baraja" subtitle="Primero el nombre y el reverso; después añades las cartas." />
      <DeckForm deck={{ id: null, name: "", description: "", backImageUrl: null, backFrame: null }} />
    </div>
  );
}
