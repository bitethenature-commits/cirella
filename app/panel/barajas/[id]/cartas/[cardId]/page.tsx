import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../../../../ui";
import { deleteCard } from "../../../actions";
import { CardForm } from "../../../card-form";
import { Tr } from "@/lib/i18n/client";

export const metadata: Metadata = { title: "Editar carta" };

export default async function EditCardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const { creator } = await requireCreator();
  const card = await tenantDb(creator.id).oracleCard.findFirst({ where: { id: cardId, deckId: id }, include: { deck: { select: { id: true, name: true } } } });
  if (!card) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/panel/barajas/${card.deck.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {card.deck.name}
      </Link>
      <PageHeader title={card.name} />
      <CardForm
        card={{
          id: card.id,
          deckId: card.deck.id,
          name: card.name,
          keyword: card.keyword,
          message: card.message,
          question: card.question,
          imageUrl: card.imageUrl,
          imageFrame: card.imageFrame,
          backImageUrl: card.backImageUrl,
          backFrame: card.backFrame,
          motif: card.motif ?? "",
          reversible: card.reversible,
          reversedMessage: card.reversedMessage ?? "",
        }}
      />
      <ConfirmForm action={deleteCard} message={`¿Borrar la carta «${card.name}»? No se puede deshacer.`} className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={card.id} />
        <button className="btn btn-ghost btn-sm text-rose">
          <Trash2 className="h-4 w-4" />{" "}<Tr s={"Borrar la carta"} /></button>
      </ConfirmForm>
    </div>
  );
}
