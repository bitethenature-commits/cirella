"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AccountLookFields } from "@/components/ui/account-look-fields";
import { accountLookKey, EMPTY_ACCOUNT_LOOK, hasAccountLook, type AccountLook } from "@/lib/account-look";
import { useAccountLookPreview } from "../look-root";
import { saveAccountLook } from "./actions";
import { Tr } from "@/lib/i18n/client";

/**
 * «Colores de mi área» (Ajustes): las pestañas del menú, la página (con degradado si quiere), los detalles, el fondo
 * con movimiento y una figura de geometría. Lo que se toca se ve al momento en toda el área (look-root.tsx);
 * «Guardar» se lo queda. Sin guardar, al salir de Ajustes vuelve lo guardado.
 */
export function AccountLookEditor({ saved }: { saved: AccountLook }) {
  const router = useRouter();
  const preview = useAccountLookPreview();
  const [draft, setDraft] = useState<AccountLook>(saved);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = accountLookKey(draft) !== accountLookKey(saved);
  const set = <K extends keyof AccountLook>(k: K, v: AccountLook[K]) => {
    setMsg(null);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // Al momento, en toda el área; lo guardado en cuanto no hay nada distinto (y al salir de Ajustes).
  useEffect(() => {
    preview?.(dirty ? draft : null);
  }, [preview, dirty, draft]);
  useEffect(() => () => preview?.(null), [preview]);

  const save = () =>
    start(async () => {
      const r = await saveAccountLook(draft);
      setMsg(r ?? null);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <AccountLookFields value={draft} onChange={set} />

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {hasAccountLook(draft) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
              setMsg(null);
              setDraft({ ...EMPTY_ACCOUNT_LOOK });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />{" "}<Tr s={"Los de la web"} /></button>
        )}
        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{" "}<Tr s={"Guardar"} /></button>
      </div>
      {dirty && !pending && <p className="-mt-2 text-right text-[0.75rem] text-muted"><Tr s={"Ya lo ves en toda tu área. Guarda para quedártelo."} /></p>}
      {msg?.ok && !dirty && <p className="-mt-2 text-right text-[0.8rem] text-gold"><Tr s={msg.ok} /></p>}
      {msg?.error && <p className="-mt-2 text-right text-[0.8rem] text-[#f2a097]"><Tr s={msg.error} /></p>}
    </div>
  );
}
