import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../../../../ui";
import { CardForm } from "../../../card-form";

export const metadata: Metadata = { title: "Nueva carta" };

export default async function NewCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const deck = await tenantDb(creator.id).oracleDeck.findFirst({ where: { id }, select: { id: true, name: true } });
  if (!deck) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/panel/barajas/${deck.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {deck.name}
      </Link>
      <PageHeader title="Nueva carta" />
      <CardForm card={{ id: null, deckId: deck.id, name: "", keyword: "", message: "", question: "", imageUrl: null, imageFrame: null, backImageUrl: null, backFrame: null, motif: "", reversible: false, reversedMessage: "" }} />
    </div>
  );
}
