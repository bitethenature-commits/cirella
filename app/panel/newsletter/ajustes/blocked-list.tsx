import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/tz";
import { unblock } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const BLOCK_REASON: Record<string, string> = { BOUNCE: "Rebote: la dirección no existe", COMPLAINT: "Lo marcó como spam", BLOCK: "Bloqueada por ti" };

/** Direcciones bloqueadas, con el botón para desbloquear (pide confirmación). */
export async function BlockedList({ rows }: { rows: { id: string; email: string; unsubscribeVia: string | null; unsubscribedAt: Date | null }[] }) {
  const t = await getT();
  return (
    <ul className="mt-3 divide-y divide-line rounded-2xl bg-sand/40">
      {rows.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
          <Link href={`/panel/newsletter/suscriptoras/${s.id}`} className="min-w-0 truncate font-medium hover:underline">{s.email}</Link>
          <span className="text-xs text-muted"><Tr s={BLOCK_REASON[s.unsubscribeVia ?? ""] ?? t("Bloqueada")} />{s.unsubscribedAt ? ` · ${formatDateTime(s.unsubscribedAt)}` : ""}</span>
          <ConfirmForm
            action={unblock}
            className="ml-auto"
            message={
              s.unsubscribeVia === "COMPLAINT"
                ? `¿Desbloquear ${s.email}? Marcó tu email como spam: quedará dada de baja y solo volverá si se apunta ella.`
                : `¿Desbloquear ${s.email}? Si estaba confirmada, vuelve a recibir tu newsletter. Si solo la habías bloqueado, se borra de la lista.`
            }
          >
            <input type="hidden" name="id" value={s.id} />
            <SubmitButton className="btn btn-outline btn-sm"><Tr s={"Desbloquear"} /></SubmitButton>
          </ConfirmForm>
        </li>
      ))}
    </ul>
  );
}
