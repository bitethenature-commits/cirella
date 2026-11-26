"use client";

import { askConfirm } from "@/components/ui/ask-confirm";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Lock, Paintbrush, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ColorField } from "@/components/email-editor/color-field";
import { usePanelPreview } from "@/components/panel-design-root";
import { useLeaveGuard } from "@/components/ui/use-leave-guard";
import type { PageConfig } from "@/lib/page-config";
import { LOCKED_NAV, orderNav, panelDesign, type PanelPrefs } from "@/lib/panel-prefs";
import { DesignEditor } from "../pagina/design-editor";
import { savePanelPrefs } from "./panel-actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Una sección del menú y el borde del panel donde va («Arriba», «Izquierda»…). */
type NavEntry = { href: string; label: string; edge: string };

/**
 * «Diseño de mi panel» (Ajustes): el panel con su propio diseño, pieza a pieza, con el mismo editor que la web
 * (y las mismas plantillas), que se ve en vivo sobre el panel entero mientras se diseña; el color de las
 * pestañas del menú y el orden y la visibilidad de las secciones del menú (↑ ↓ y ojo, sin arrastrar: va bien en
 * el iPhone). Cada sección sigue en su borde: el orden cambia su sitio dentro de él.
 */
export function PanelLook({
  initial,
  web,
  nav: allNav,
}: {
  initial: PanelPrefs;
  /** Su web (borrador): de aquí salen sus plantillas, su nombre y su foto para las muestras. */
  web: PageConfig;
  nav: NavEntry[];
}) {
  const t = useT();
  const router = useRouter();
  const setPreview = usePanelPreview();
  // El editor de diseño trabaja sobre una «web»: su diseño general es el del panel.
  const [cfg, setCfg] = useState<PageConfig>(() => ({ ...web, theme: initial.design ?? {}, pageThemes: {} }));
  const [sidebar, setSidebar] = useState<string | null>(initial.sidebar);
  const startNav = orderNav(allNav, initial.nav);
  const [order, setOrder] = useState<string[]>([...startNav.visible, ...startNav.hidden].map((i) => i.href));
  const [hidden, setHidden] = useState<string[]>(startNav.hidden.map((i) => i.href));
  const [navTouched, setNavTouched] = useState(!!initial.nav);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  // En vivo: el panel entero se ve con lo que se está diseñando. Al salir de Ajustes, vuelve a lo guardado.
  useEffect(() => {
    setPreview?.({ design: cfg.theme, sidebar });
  }, [cfg.theme, sidebar, setPreview]);
  useEffect(() => () => setPreview?.(null), [setPreview]);

  // ¿Hay cambios sin guardar? Se avisa antes de salir (lo que no se guarda se pierde).
  const current = (p: PanelPrefs) => JSON.stringify({ ...p, designs: cfg.designs });
  const snap = current({ design: panelDesign(cfg.theme), sidebar, nav: navTouched ? { order, hidden } : null });
  const savedSnap = useRef<string | null>(null);
  savedSnap.current ??= snap;
  useLeaveGuard(snap !== savedSnap.current, "Tienes cambios sin guardar en tu panel. ¿Salir sin guardar?");

  const items = order.map((h) => allNav.find((n) => n.href === h)!).filter(Boolean);

  const moveNav = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setNavTouched(true);
  };
  const toggle = (href: string) => {
    setHidden((h) => (h.includes(href) ? h.filter((x) => x !== href) : [...h, href]));
    setNavTouched(true);
  };

  const save = (prefs: PanelPrefs) =>
    start(async () => {
      setNotice(null);
      // Las plantillas son las mismas que las de la web: si las ha cambiado aquí, se guardan también.
      const r = await savePanelPrefs(prefs, cfg.designs !== web.designs ? cfg.designs : undefined);
      setNotice(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        savedSnap.current = current(prefs);
        router.refresh();
      }
    });

  return (
    <>
      <section id="personalizar" className="card scroll-mt-20 space-y-4 p-5 sm:p-6" data-testid="panel-look">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Paintbrush className="h-4 w-4" />{" "}<Tr s={"Diseño de mi panel"} /></h2>
          <p className="mt-1 text-sm text-muted"><Tr s={"Tu panel a tu gusto, pieza a pieza, como tu web: colores, fondo, fondo con movimiento, letras, tarjetas, botones y marcos. Mientras lo cambias, todo el panel se ve así; si sales sin guardar, vuelve a como estaba. Tu web no cambia: esto solo lo ves tú."} /></p>
        </div>
        <ColorField
          label={t("Pestañas del menú (los bordes del panel)")}
          value={sidebar ?? undefined}
          fallback={(cfg.theme.background as string | undefined) ?? "#0B0E1F"}
          palette={["#0B0E1F", "#1B1D3A", "#EFE9FA", "#F1E2D6", "#E3EADF", "#FFFFFF"]}
          clearable
          onChange={(v) => setSidebar(v ?? null)}
        />
        <p className="text-xs text-muted"><Tr s={"Vacío: el del diseño. El texto de las pestañas se elige solo para que se lea."} /></p>
      </section>

      <DesignEditor cfg={cfg} setCfg={setCfg} target="general" setTarget={() => {}} pages={[]} allowCustom panel />

      <section className="card space-y-6 p-5 sm:p-6">
        {/* ── Menú ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold"><Tr s={"Orden del menú"} /></h3>
          <p className="text-xs text-muted"><Tr s={"Sube y baja las secciones y oculta las que no uses. Cada una sigue en su borde del panel (lo dice su etiqueta): el orden cambia su sitio"} />{" "}
            <strong className="text-ink"><Tr s={"dentro de ese borde"} /></strong><Tr s={". Inicio y Ajustes no se pueden ocultar."} /></p>
          {navTouched && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const def = orderNav(allNav, null);
                setOrder(def.visible.map((i) => i.href));
                setHidden([]);
                setNavTouched(false);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />{" "}<Tr s={"Volver al orden de siempre"} /></button>
          )}
          <ul className="space-y-1.5" data-testid="nav-order">
            {items.map((it, i) => {
              const off = hidden.includes(it.href);
              const locked = LOCKED_NAV.includes(it.href);
              return (
                <li key={it.href} className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${off ? "border-dashed border-line bg-paper opacity-60" : "border-line bg-white"}`} data-nav={it.href}>
                  <span className="min-w-0 flex-1 truncate pl-1 text-sm font-medium"><Tr s={it.label} /></span>
                  <span className="chip shrink-0 !h-5 !text-[0.62rem]"><Tr s={it.edge} /></span>
                  <SmallButton label={`Subir ${it.label}`} onClick={() => moveNav(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></SmallButton>
                  <SmallButton label={`Bajar ${it.label}`} onClick={() => moveNav(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-4 w-4" /></SmallButton>
                  {locked ? (
                    <span className="grid h-10 w-10 place-items-center text-faint" title={t("Siempre visible")}><Lock className="h-3.5 w-3.5" /></span>
                  ) : (
                    <SmallButton label={`${off ? "Mostrar" : "Ocultar"} ${it.label}`} onClick={() => toggle(it.href)} pressed={!off}>
                      {off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </SmallButton>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Guardar, siempre a mano mientras se diseña (encima de las pestañas de abajo). */}
      <div className="card sticky bottom-16 z-20 space-y-2 p-3">
        {notice && (
          <p role="status" className={`rounded-xl px-4 py-2 text-sm ${notice.ok ? "bg-[#e7f3ec] text-[#2f6b4a]" : "bg-[#fbe9e6] text-[#9a3a2e]"}`}>
            <Tr s={notice.text} />
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => save({ design: panelDesign(cfg.theme), sidebar, nav: navTouched ? { order, hidden } : null })}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{" "}<Tr s={"Guardar mi panel"} /></button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={async (e) => {
              if (!(await askConfirm("¿Volver al panel de siempre? Se quita tu diseño del panel y el orden del menú (tus plantillas se quedan).", { from: e.currentTarget, okLabel: "Volver al de siempre" }))) return;
              setCfg((c) => ({ ...c, theme: {} }));
              setSidebar(null);
              const def = orderNav(allNav, null);
              setOrder(def.visible.map((i) => i.href));
              setHidden([]);
              setNavTouched(false);
              save({ design: null, sidebar: null, nav: null });
            }}
          >
            <RotateCcw className="h-4 w-4" />{" "}<Tr s={"Panel de siempre"} /></button>
        </div>
      </div>
    </>
  );
}

function SmallButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} disabled={disabled} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink disabled:opacity-25">
      {children}
    </button>
  );
}
