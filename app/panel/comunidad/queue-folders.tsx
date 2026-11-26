"use client";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, FilePen, FolderOpen, LayoutGrid, X } from "lucide-react";
import { SpinningSolid } from "@/app/area/spinning-solid";
import { Tr } from "@/lib/i18n/client";

export type FolderItem = { id: string; tierId: string; node: ReactNode };
export type Folder = { key: "programadas" | "borradores"; title: string; hint: string; empty: string; items: FolderItem[] };

/**
 * «Lo que va a salir» y «Borradores» de Publicar y programar: dos carpetas que se abren en una ventana.
 * Arriba, la membresía para buscar rápido; dentro, cada publicación como su tarjeta del área.
 */
export function QueueFolders({ folders, tiers, startOpen }: { folders: Folder[]; tiers: { id: string; title: string }[]; startOpen?: Folder["key"] | null }) {
  const [open, setOpen] = useState<Folder["key"] | null>(startOpen ?? null);
  const [tier, setTier] = useState<string | null>(null);
  const folder = folders.find((f) => f.key === open) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items = folder ? folder.items.filter((i) => !tier || i.tierId === tier) : [];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {folders.map((f) => {
          const Icon = f.key === "programadas" ? CalendarClock : FilePen;
          return (
            <button key={f.key} type="button" onClick={() => setOpen(f.key)} className="com-folder" aria-haspopup="dialog">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/40 text-[color:var(--n-gold-hi,#f0d9a4)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-[1.35rem] leading-tight text-[color:var(--n-ivory,#f1ebdf)]">{f.title}</span>
                <span className="block text-xs text-[color:var(--n-muted,#a7a2c2)]"><Tr s={f.hint} /></span>
              </span>
              <span className="display text-[2rem] leading-none text-gold tabular-nums">{f.items.length}</span>
            </button>
          );
        })}
      </div>

      {folder && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={folder.title}
            onClick={(e) => e.stopPropagation()}
            className="acc-root acc-preview flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-gold/40 shadow-[0_0_80px_-20px_rgb(212_181_122/.5)] sm:rounded-[2rem]"
          >
            <div className="border-b border-gold/20 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-gold" />
                <h2 className="display flex-1 text-[1.7rem] leading-none">
                  {folder.title} <span className="text-gold">({folder.items.length})</span>
                </h2>
                <button type="button" onClick={() => setOpen(null)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-white/5" aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* La membresía, para buscar rápido. */}
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Membresía">
                <button type="button" onClick={() => setTier(null)} aria-pressed={!tier} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${!tier ? "border-[color:var(--n-gold,#e9cc8e)] bg-gold/15 text-[color:var(--n-gold-pale,#f7e5b8)]" : "border-gold/25 text-[color:var(--n-lilac,#cfc8e4)] hover:border-gold/50"}`}>
                  <LayoutGrid className="h-4 w-4" />{" "}<Tr s={"Todas"} /></button>
                {tiers.map((t, i) => (
                  <button key={t.id} type="button" onClick={() => setTier(t.id)} aria-pressed={tier === t.id} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${tier === t.id ? "border-[color:var(--n-gold,#e9cc8e)] bg-gold/15 text-[color:var(--n-gold-pale,#f7e5b8)]" : "border-gold/25 text-[color:var(--n-lilac,#cfc8e4)] hover:border-gold/50"}`}>
                    <SpinningSolid level={i} offset={i * 1.3} speed={0.2} className="h-5 w-5 text-gold" /> {t.title}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {items.length ? items.map((i) => <div key={i.id}>{i.node}</div>) : <p className="rounded-2xl border border-dashed border-gold/25 px-4 py-10 text-center text-sm text-muted"><Tr s={folder.empty} /></p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
