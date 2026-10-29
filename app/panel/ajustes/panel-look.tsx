"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Lock, Paintbrush, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ColorField } from "@/components/email-editor/color-field";
import {
  accentWarning,
  BOTTOM_BAR_SLOTS,
  HOME_CARDS,
  LOCKED_NAV,
  orderHome,
  orderNav,
  PANEL_PRESETS,
  panelThemeVars,
  TONES,
  type PanelPrefs,
  type PanelTheme,
  type PanelTone,
} from "@/lib/panel-prefs";
import { savePanelPrefs } from "./panel-actions";

type NavEntry = { href: string; label: string };

/**
 * «Personalizar mi panel» (Ajustes): colores del panel (solo el suyo, no su web) con vista previa en
 * vivo sobre el propio panel, orden y visibilidad de las secciones del menú (↑ ↓ y ojo, sin
 * arrastrar: va bien en el iPhone) y orden de las tarjetas de Inicio.
 */
export function PanelLook({ initial, nav: allNav, home: withHome, currentBottom }: { initial: PanelPrefs; nav: NavEntry[]; home: boolean; currentBottom: string[] }) {
  const router = useRouter();
  const [theme, setTheme] = useState<PanelTheme | null>(initial.theme);
  const startNav = orderNav(allNav, initial.nav);
  const [order, setOrder] = useState<string[]>([...startNav.visible, ...startNav.hidden].map((i) => i.href));
  const [hidden, setHidden] = useState<string[]>(startNav.hidden.map((i) => i.href));
  const [navTouched, setNavTouched] = useState(!!initial.nav);
  const [homeOrder, setHomeOrder] = useState<string[]>(orderHome(initial.home));
  const [homeTouched, setHomeTouched] = useState(initial.home.length > 0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  // Estilo del panel tal y como lo pintó el servidor (lo guardado): se vuelve a él al salir sin guardar.
  const original = useRef<{ style: string | null; tone: string | null } | null>(null);

  // Vista previa en vivo: las variables del tema sobre el panel entero (sin guardar todavía).
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-panel-root]");
    if (!root) return;
    original.current ??= { style: root.getAttribute("style"), tone: root.getAttribute("data-panel-tone") };
    // Desde el panel sin colores propios: se quitan las variables guardadas y se ponen las elegidas.
    root.removeAttribute("style");
    for (const [k, v] of Object.entries(panelThemeVars(theme))) root.style.setProperty(k, v);
    if (theme) root.setAttribute("data-panel-tone", theme.tone);
    else root.removeAttribute("data-panel-tone");
  }, [theme]);

  useEffect(
    () => () => {
      const root = document.querySelector<HTMLElement>("[data-panel-root]");
      const o = original.current;
      if (!root || !o) return;
      if (o.style) root.setAttribute("style", o.style);
      else root.removeAttribute("style");
      if (o.tone) root.setAttribute("data-panel-tone", o.tone);
      else root.removeAttribute("data-panel-tone");
    },
    [],
  );

  const items = order.map((h) => allNav.find((n) => n.href === h)!).filter(Boolean);
  const visible = items.filter((i) => !hidden.includes(i.href));
  const bottom = new Set(visible.slice(0, BOTTOM_BAR_SLOTS).map((i) => i.href));

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
  const moveHome = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= homeOrder.length) return;
    const next = [...homeOrder];
    [next[i], next[j]] = [next[j], next[i]];
    setHomeOrder(next);
    setHomeTouched(true);
  };

  const save = (prefs: PanelPrefs) =>
    start(async () => {
      setNotice(null);
      const r = await savePanelPrefs(prefs);
      setNotice(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        // Lo que se ve ya es lo guardado.
        const root = document.querySelector<HTMLElement>("[data-panel-root]");
        if (root) original.current = { style: root.getAttribute("style"), tone: root.getAttribute("data-panel-tone") };
        router.refresh();
      }
    });

  const custom = theme ?? { accent: "#0E1024", tone: "cream" as PanelTone, sidebar: null };
  const warning = theme ? accentWarning(theme) : null;
  const presetKey = theme ? PANEL_PRESETS.find((p) => p.theme.accent === theme.accent && p.theme.tone === theme.tone && p.theme.sidebar === theme.sidebar)?.key : "siempre";
  const vars = panelThemeVars(custom);

  return (
    <section id="personalizar" className="card scroll-mt-20 space-y-6 p-5 sm:p-6" data-testid="panel-look">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Paintbrush className="h-4 w-4" /> Personalizar mi panel</h2>
        <p className="mt-1 text-sm text-muted">Los colores y el orden de tu panel, para que esté a tu gusto. Tu web no cambia: esto solo lo ves tú.</p>
      </div>

      {/* ── Colores ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Colores</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Estilos de color">
          <PresetButton name="De siempre" active={presetKey === "siempre"} colors={["#0E1024", "#FBF8F2", "#F6F1E7"]} onClick={() => setTheme(null)} />
          {PANEL_PRESETS.map((p) => (
            <PresetButton key={p.key} name={p.name} active={presetKey === p.key} colors={[p.theme.accent, TONES[p.theme.tone].vars.paper, p.theme.sidebar ?? TONES[p.theme.tone].vars.cream]} onClick={() => setTheme({ ...p.theme })} />
          ))}
        </div>
        <ColorField
          label="Color de acento (botones y sección activa)"
          value={custom.accent}
          fallback="#0E1024"
          palette={["#0E1024", "#6B58C4", "#8E7CE0", "#B4583F", "#6F8766", "#C8A86E", "#C2655A", "#C9BBF2"]}
          onChange={(accent) => setTheme({ ...custom, accent: accent ?? "#0E1024" })}
        />
        <div role="group" aria-label="Fondo del panel">
          <p className="field-label">Fondo</p>
          <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-sand p-1 text-xs">
            {(["light", "cream", "dark"] as PanelTone[]).map((t) => (
              <button key={t} type="button" aria-pressed={custom.tone === t} onClick={() => setTheme({ ...custom, tone: t })} className={`min-h-9 rounded-xl px-3 py-1.5 font-medium ${custom.tone === t ? "bg-white shadow-soft" : "text-muted"}`}>
                {TONES[t].name}
              </button>
            ))}
          </div>
        </div>
        <ColorField
          label="Barra lateral (en el ordenador)"
          value={custom.sidebar ?? undefined}
          fallback={TONES[custom.tone].vars.cream}
          palette={["#EFE9FA", "#F1E2D6", "#E9E3FB", "#E3EADF", "#0B0E1F", "#1B1D3A", "#FFFFFF"]}
          clearable
          onChange={(sidebar) => setTheme({ ...custom, sidebar: sidebar ?? null })}
        />
        {warning && <p className="rounded-xl bg-[#f8efdc] px-3 py-2 text-xs text-[#8a6420]" role="status">{warning}</p>}
        <p className="text-xs text-muted">El color del texto sobre el acento y sobre la barra se elige solo, para que siempre se lea.</p>

        {/* Vista previa en pequeño (además, el panel entero ya se ve así). */}
        <div className="overflow-hidden rounded-2xl border border-line" aria-hidden data-testid="panel-look-preview">
          <div className="grid grid-cols-[90px_1fr] text-[0.7rem]" style={{ background: vars["--color-paper"] ?? "#FBF8F2", color: vars["--color-ink"] ?? "#0E1024" }}>
            <div className="space-y-1 p-2" style={{ background: vars["--panel-side-bg"] ?? "transparent", color: vars["--panel-side-text"] ?? "inherit" }}>
              <p className="rounded-md px-2 py-1" style={{ background: vars["--panel-accent"] ?? "#0E1024", color: vars["--panel-accent-text"] ?? "#F6F1E7" }}>Inicio</p>
              <p className="px-2 py-1 opacity-75">Productos</p>
              <p className="px-2 py-1 opacity-75">Ajustes</p>
            </div>
            <div className="p-3">
              <div className="rounded-xl p-3" style={{ background: theme?.tone === "dark" ? TONES.dark.surface : "#FFFFFF", border: `1px solid ${vars["--color-line"] ?? "#E7E0D2"}` }}>
                <p className="font-semibold">Hola, Ana</p>
                <p style={{ color: vars["--color-muted"] ?? "#6E6A80" }}>Así va tu página este mes.</p>
                <span className="mt-2 inline-block rounded-full px-3 py-1 font-semibold" style={{ background: vars["--panel-accent"] ?? "#0E1024", color: vars["--panel-accent-text"] ?? "#F6F1E7" }}>Ver página</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Menú ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Orden del menú</h3>
        <p className="text-xs text-muted">
          Sube y baja las secciones y oculta las que no uses. En el móvil, <strong className="text-ink">las 4 primeras van a la barra de abajo</strong> y el resto, a «Más». Inicio y
          Ajustes no se pueden ocultar.
          {!navTouched && ` Ahora mismo tu barra de abajo es la de siempre (${currentBottom.join(", ")}); al guardar este orden, serán las 4 primeras.`}
        </p>
        <ul className="space-y-1.5" data-testid="nav-order">
          {items.map((it, i) => {
            const off = hidden.includes(it.href);
            const locked = LOCKED_NAV.includes(it.href);
            return (
              <li key={it.href} className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${off ? "border-dashed border-line bg-paper opacity-60" : "border-line bg-white"}`} data-nav={it.href}>
                <span className="min-w-0 flex-1 truncate pl-1 text-sm font-medium">{it.label}</span>
                {bottom.has(it.href) && <span className="chip shrink-0 !h-5 !text-[0.62rem]">Barra de abajo</span>}
                <SmallButton label={`Subir ${it.label}`} onClick={() => moveNav(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></SmallButton>
                <SmallButton label={`Bajar ${it.label}`} onClick={() => moveNav(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-4 w-4" /></SmallButton>
                {locked ? (
                  <span className="grid h-10 w-10 place-items-center text-faint" title="Siempre visible"><Lock className="h-3.5 w-3.5" /></span>
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

      {/* ── Inicio ── */}
      {withHome && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Orden de Inicio</h3>
          <p className="text-xs text-muted">Lo que ves primero al entrar en tu panel.</p>
          <ul className="space-y-1.5" data-testid="home-order">
            {homeOrder.map((k, i) => (
              <li key={k} className="flex items-center gap-1 rounded-xl border border-line bg-white px-2 py-1">
                <span className="min-w-0 flex-1 truncate pl-1 text-sm font-medium">{HOME_CARDS.find((c) => c.key === k)?.label}</span>
                <SmallButton label={`Subir ${k}`} onClick={() => moveHome(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></SmallButton>
                <SmallButton label={`Bajar ${k}`} onClick={() => moveHome(i, 1)} disabled={i === homeOrder.length - 1}><ArrowDown className="h-4 w-4" /></SmallButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notice && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${notice.ok ? "bg-[#e7f3ec] text-[#2f6b4a]" : "bg-[#fbe9e6] text-[#9a3a2e]"}`}>
          {notice.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => save({ theme, nav: navTouched ? { order, hidden } : null, home: homeTouched ? homeOrder : [] })}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar mi panel
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("¿Volver a los colores y al orden de siempre?")) return;
            setTheme(null);
            const def = orderNav(allNav, null);
            setOrder(def.visible.map((i) => i.href));
            setHidden([]);
            setNavTouched(false);
            setHomeOrder(orderHome([]));
            setHomeTouched(false);
            save({ theme: null, nav: null, home: [] });
          }}
        >
          <RotateCcw className="h-4 w-4" /> Restaurar
        </button>
      </div>
    </section>
  );
}

function PresetButton({ name, colors, active, onClick }: { name: string; colors: string[]; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-14 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm transition ${active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/30"}`}>
      <span className="flex -space-x-1.5" aria-hidden>
        {colors.map((c, i) => (
          <span key={i} className="h-5 w-5 rounded-full border border-white shadow-soft" style={{ background: c }} />
        ))}
      </span>
      <span className="font-semibold">{name}</span>
    </button>
  );
}

function SmallButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} disabled={disabled} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink disabled:opacity-25">
      {children}
    </button>
  );
}
