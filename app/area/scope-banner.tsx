import Link from "next/link";
import { buyerLoginPath } from "@/lib/buyer-access";
import { signupsOnly } from "@/lib/commerce";
import { getT } from "@/lib/i18n/server";

/** Barra de las sesiones limitadas a un pedido (tras pagar o desde un enlace personal). */
export async function ScopeBanner({ creatorId }: { creatorId: string | null }) {
  const t = await getT();
  const href = await buyerLoginPath("/area", { motivo: "completa", creatorId });
  // Web personal: aquí no se compra (gratis con email o pagado fuera).
  const personal = signupsOnly();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand px-4 py-2.5 text-sm">
      <span>{personal ? t("Estás viendo solo este contenido.") : t("Estás viendo solo esta compra.")}</span>
      <Link href={href} className="font-semibold underline-offset-2 hover:underline">
        {personal ? t("Ver todo lo mío") : t("Ver todas mis compras")}
      </Link>
    </div>
  );
}
