import Link from "next/link";
import { buyerLoginPath } from "@/lib/buyer-access";
import { isPersonalMode } from "@/lib/site-mode";

/** Barra de las sesiones limitadas a un pedido (tras pagar o desde un enlace personal). */
export async function ScopeBanner({ creatorId }: { creatorId: string | null }) {
  const href = await buyerLoginPath("/cuenta", { motivo: "completa", creatorId });
  // Web personal: aquí no se compra (gratis con email o pagado fuera).
  const personal = isPersonalMode();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand px-4 py-2.5 text-sm">
      <span>{personal ? "Estás viendo solo este contenido." : "Estás viendo solo esta compra."}</span>
      <Link href={href} className="font-semibold underline-offset-2 hover:underline">
        {personal ? "Ver todo lo mío" : "Ver todas mis compras"}
      </Link>
    </div>
  );
}
