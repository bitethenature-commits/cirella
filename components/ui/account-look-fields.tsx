"use client";

import { LookPart as Part, Pill, Swatches } from "@/components/ui/look-controls";
import { ACC_ACCENT_COLORS, ACC_PAGE_COLORS, type AccountLook } from "@/lib/account-look";
import { DECOR_GROUPS, DECORS, type Decor, type DecorGroup } from "@/lib/templates";
import { Tr, useT } from "@/lib/i18n/client";

const GROUPS = Object.entries(DECOR_GROUPS) as [DecorGroup, string][];

/**
 * Los colores del área de alumna (lib/account-look.ts): las pestañas del menú, la página (con degradado si se
 * quiere), los detalles y el fondo con movimiento. Los usan «Colores de mi área» (cada
 * alumna) y Mi página › Área de alumna, Cursos y Membresías (la creadora, para todas).
 */
export function AccountLookFields({ value, onChange }: { value: AccountLook; onChange: <K extends keyof AccountLook>(k: K, v: AccountLook[K]) => void }) {
  const t = useT();
  const set = onChange;
  const draft = value;
  return (
    <div className="space-y-5">
      <Part title={t("Pestañas del menú")} hint={t("Las que salen de los bordes de la pantalla.")}>
        <Swatches value={draft.bar} onChange={(v) => set("bar", v)} colors={ACC_PAGE_COLORS} auto="Como la página" />
      </Part>

      <Part title={t("Página")} hint={t("Con un color claro, las letras se ponen oscuras solas.")}>
        <Swatches value={draft.page} onChange={(v) => set("page", v ?? null)} colors={ACC_PAGE_COLORS} />
        <div className="mt-3">
          <Pill on={!!draft.page2} onClick={() => set("page2", draft.page2 ? null : "#3B1F5E")}>
            {draft.page2 ? t("Con degradado") : t("Añadir degradado")}
          </Pill>
        </div>
        {draft.page2 && (
          <div className="mt-3">
            <p className="mb-2 text-[0.75rem] text-muted"><Tr s={"Segundo color del degradado"} /></p>
            <Swatches value={draft.page2} onChange={(v) => set("page2", v)} colors={ACC_PAGE_COLORS} />
          </div>
        )}
      </Part>

      <Part title={t("Detalles")} hint={t("Líneas, botones, iconos y el menú.")}>
        <Swatches value={draft.accent} onChange={(v) => set("accent", v)} colors={ACC_ACCENT_COLORS} />
      </Part>

      <Part title={t("Fondo con movimiento")}>
        <select className="input" value={draft.decor ?? ""} onChange={(e) => set("decor", (e.target.value || null) as Decor | null)} aria-label={t("Fondo con movimiento")}>
          <option value=""><Tr s={"Las estrellas de siempre"} /></option>
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

    </div>
  );
}
