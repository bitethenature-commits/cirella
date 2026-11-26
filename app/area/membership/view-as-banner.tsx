import Link from "next/link";
import { Eye, X } from "lucide-react";
import { communityTiers } from "@/lib/community-tiers";
import type { ViewAsTier } from "@/lib/view-as";
import { Tr } from "@/lib/i18n/client";

/**
 * Barra de «Ver como miembro»: la dueña está viendo su comunidad como alguien de un nivel. Puede
 * cambiar de nivel o salir (vuelve al estudio Comunidad del panel).
 */
export async function ViewAsBanner({ creatorId, tier }: { creatorId: string; tier: ViewAsTier }) {
  const tiers = await communityTiers(creatorId);
  return (
    <div className="mb-5 rounded-2xl border border-[#cfd3ea] bg-[#eef0fa] px-4 py-3 text-sm text-[#2b3170]" role="status" data-view-as={tier.id}>
      <p className="flex flex-wrap items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1"><Tr s={"Estás viendo la comunidad como miembro de"} />{" "}<strong>{tier.title}</strong><Tr s={". No ves borradores ni programadas."} /></span>
        <Link href="/panel/comunidad/ver-como?salir=1" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-white/60">
          <X className="h-4 w-4" />{" "}<Tr s={"Salir"} /></Link>
      </p>
      {tiers.length > 1 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span><Tr s={"Ver como:"} /></span>
          {tiers.map((t) => (
            <Link
              key={t.id}
              href={`/panel/comunidad/ver-como?nivel=${t.id}`}
              aria-current={t.id === tier.id ? "true" : undefined}
              className={`rounded-full border px-2.5 py-1 font-semibold ${t.id === tier.id ? "border-[#2b3170] bg-[#2b3170] text-white" : "border-[#cfd3ea] bg-white hover:border-[#2b3170]"}`}
            >
              {t.title}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
