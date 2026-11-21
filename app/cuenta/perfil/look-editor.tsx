"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LookPart as Part, Pill, Swatches } from "@/components/ui/look-controls";
import { ACC_ACCENT_COLORS, ACC_PAGE_COLORS, accountLookKey, EMPTY_ACCOUNT_LOOK, hasAccountLook, type AccountLook } from "@/lib/account-look";
import { GEOMETRY_FIGURES, GEOMETRY_LABEL } from "@/lib/page-blocks";
import { FIGURE_POS, type FigurePos } from "@/lib/sacred-figures";
import { DECOR_GROUPS, DECORS, type Decor, type DecorGroup } from "@/lib/templates";
import { useAccountLookPreview } from "../look-root";
import { saveAccountLook } from "./actions";

const GROUPS = Object.entries(DECOR_GROUPS) as [DecorGroup, string][];

/**
 * «Colores de mi área» (Ajustes): la barra de arriba, la página (con degradado si quiere), los detalles, el fondo
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
      <Part title="Barra de arriba" hint="Donde está el menú.">
        <Swatches value={draft.bar} onChange={(v) => set("bar", v)} colors={ACC_PAGE_COLORS} auto="Como la página" />
      </Part>

      <Part title="Página" hint="Con un color claro, las letras se ponen oscuras solas.">
        <Swatches value={draft.page} onChange={(v) => set("page", v ?? null)} colors={ACC_PAGE_COLORS} />
        <div className="mt-3">
          <Pill on={!!draft.page2} onClick={() => set("page2", draft.page2 ? null : "#3B1F5E")}>
            {draft.page2 ? "Con degradado" : "Añadir degradado"}
          </Pill>
        </div>
        {draft.page2 && (
          <div className="mt-3">
            <p className="mb-2 text-[0.75rem] text-muted">Segundo color del degradado</p>
            <Swatches value={draft.page2} onChange={(v) => set("page2", v)} colors={ACC_PAGE_COLORS} />
          </div>
        )}
      </Part>

      <Part title="Detalles" hint="Líneas, botones, iconos y el menú.">
        <Swatches value={draft.accent} onChange={(v) => set("accent", v)} colors={ACC_ACCENT_COLORS} />
      </Part>

      <Part title="Fondo con movimiento">
        <select
          className="input"
          value={draft.decor ?? ""}
          onChange={(e) => set("decor", (e.target.value || null) as Decor | null)}
          aria-label="Fondo con movimiento"
        >
          <option value="">Las estrellas de siempre</option>
          {GROUPS.map(([g, name]) => (
            <optgroup key={g} label={name}>
              {DECORS.filter((d) => d.group === g).map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Part>

      <Part title="Geometría" hint="Una figura fina detrás de todo.">
        <div className="flex flex-wrap gap-2">
          <Pill on={!draft.geo} onClick={() => set("geo", null)}>
            Ninguna
          </Pill>
          {GEOMETRY_FIGURES.map((f) => (
            <Pill key={f} on={draft.geo === f} onClick={() => set("geo", f)}>
              {GEOMETRY_LABEL[f]}
            </Pill>
          ))}
        </div>
        {draft.geo && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-1.5 text-[0.8rem] text-muted">Dónde va la figura</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(FIGURE_POS) as [FigurePos, string][]).map(([k, label]) => (
                  <Pill key={k} on={draft.geoPos === k} onClick={() => set("geoPos", k)}>
                    {label}
                  </Pill>
                ))}
              </div>
            </div>
            <Pill on={draft.geoSpin} onClick={() => set("geoSpin", !draft.geoSpin)}>
              Que gire despacio
            </Pill>
            <label className="flex items-center gap-3 text-[0.8rem] text-muted">
              Cuánto se ve
              <input
                type="range"
                min={6}
                max={50}
                value={draft.geoOpacity}
                onChange={(e) => set("geoOpacity", Number(e.target.value))}
                className="flex-1 accent-[var(--color-gold)]"
              />
            </label>
          </div>
        )}
      </Part>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {hasAccountLook(draft) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
              setMsg(null);
              setDraft({ ...EMPTY_ACCOUNT_LOOK });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Los de siempre
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
        </button>
      </div>
      {dirty && !pending && <p className="-mt-2 text-right text-[0.75rem] text-muted">Ya lo ves en toda tu área. Guarda para quedártelo.</p>}
      {msg?.ok && !dirty && <p className="-mt-2 text-right text-[0.8rem] text-gold">{msg.ok}</p>}
      {msg?.error && <p className="-mt-2 text-right text-[0.8rem] text-[#f2a097]">{msg.error}</p>}
    </div>
  );
}
