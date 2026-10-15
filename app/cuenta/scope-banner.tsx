import Link from "next/link";
import { buyerLoginPath } from "@/lib/buyer-access";

/** Barra de las sesiones limitadas a un pedido (tras pagar o desde un enlace personal). */
export async function ScopeBanner({ creatorId }: { creatorId: string | null }) {
  const href = await buyerLoginPath("/cuenta", { motivo: "completa", creatorId });
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand px-4 py-2.5 text-sm">
      <span>Estás viendo solo esta compra.</span>
      <Link href={href} className="font-semibold underline-offset-2 hover:underline">
        Ver todas mis compras
      </Link>
    </div>
  );
}
