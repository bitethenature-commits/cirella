import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireCreator } from "@/lib/auth";
import { CODE_STATE_LABEL, codeState, dateKeyFromExpiry, readCodePhotos, readCodeRecommendations } from "@/lib/discount-codes";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../../ui";
import { deleteDiscountCode } from "../actions";
import { CodeForm } from "../code-form";

export const metadata: Metadata = { title: "Código de descuento" };

export default async function EditDiscountCodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const code = await tenantDb(creator.id).discountCode.findFirst({ where: { id } });
  if (!code) notFound();
  const state = codeState(code);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/pagina?ver=codigos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Códigos
      </Link>
      <PageHeader title={code.brand} subtitle={<Badge tone={state === "ACTIVE" ? "success" : state === "EXPIRED" ? "warning" : "neutral"}>{CODE_STATE_LABEL[state]}</Badge>} />
      <CodeForm
        code={{
          id: code.id,
          brand: code.brand,
          code: code.code,
          description: code.description ?? "",
          url: code.url,
          imageUrl: code.imageUrl,
          images: readCodePhotos(code.images),
          recommendations: readCodeRecommendations(code.recommendations),
          expiresOn: dateKeyFromExpiry(code.expiresAt, creator.timezone),
          active: code.active,
        }}
      />
      <ConfirmForm action={deleteDiscountCode} message="¿Borrar este código? Desaparece de tu página y no se puede deshacer." className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={code.id} />
        <button className="btn btn-ghost btn-sm text-rose">
          <Trash2 className="h-4 w-4" /> Borrar código
        </button>
      </ConfirmForm>
    </div>
  );
}
