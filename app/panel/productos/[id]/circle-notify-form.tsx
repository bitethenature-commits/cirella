"use client";
import { Loader2, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { notifyCircleRecording, type NotifyResult } from "./circle-actions";

export type NotifyPerson = { userId: string; label: string; email: string; via: string; noticedAt: string | null };

/** La lista con casillas de «Avisar a las alumnas»: marca a quién y se envía el email. */
export function CircleNotifyForm({ productId, people, ready }: { productId: string; people: NotifyPerson[]; ready: boolean }) {
  const [state, action, pending] = useActionState<NotifyResult | null, FormData>(notifyCircleRecording, null);
  // Por defecto, marcadas las que aún no tienen aviso.
  const [picked, setPicked] = useState(() => new Set(people.filter((p) => !p.noticedAt).map((p) => p.userId)));
  const all = picked.size === people.length;
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex items-center justify-between gap-3 border-b border-line pb-2 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
          <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(people.map((p) => p.userId)))} className="h-4 w-4 accent-[var(--color-gold,#c9a45c)]" />
          Todas
        </label>
        <span className="text-muted">{picked.size} de {people.length} marcadas</span>
      </div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">
        {people.map((p) => (
          <li key={p.userId}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
              <input type="checkbox" name="userId" value={p.userId} checked={picked.has(p.userId)} onChange={() => toggle(p.userId)} className="h-4 w-4 shrink-0 accent-[var(--color-gold,#c9a45c)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.label}</span>
                <span className="block truncate text-xs text-muted">{p.via}</span>
              </span>
              {p.noticedAt && <span className="chip shrink-0">Avisada {p.noticedAt}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={pending || !ready || picked.size === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {picked.size === 1 ? "Avisar a 1 alumna" : `Avisar a ${picked.size} alumnas`}
        </button>
        {!ready && <span className="text-sm text-muted">Sube primero el vídeo o el PDF.</span>}
        {state && <span className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose"}`}>{state.ok ? state.message : state.error}</span>}
      </div>
    </form>
  );
}
