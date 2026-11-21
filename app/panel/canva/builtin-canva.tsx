"use client";
import { Palette } from "lucide-react";
import { useCallback, useState } from "react";
import type { LiveTextMessage } from "@/components/creator-page/live-design";
import type { PageConfig } from "@/lib/page-config";
import { isSiteTextKey, unfillText, withSiteText, type SiteTexts } from "@/lib/site-texts";
import { savePageText, saveSiteTexts } from "./actions";
import { BarButton, CanvaBar, CanvaShell, oneAtATime, type SaveState } from "./canva-ui";
import { DesignLive, DesignSheet, useDesignPanel, useSavedDesign } from "./design-side";
import { PagesMenu } from "./pages-menu";
import { useDevice } from "./web-frame";
import type { PanelPage } from "./web-pages";

/**
 * Mi página, una página que se crea sola (Cursos, Hacerte miembro, Ofertas, Sesiones, Aviso legal…): se ve de
 * verdad, con sus títulos y frases fijas escritos encima (los que llevan raya) y su diseño en «Diseño», al lado. Lo
 * demás (los cursos, las ofertas, los datos legales…) sale solo de lo que publica: se cambia en su sitio del panel.
 */
export function BuiltinCanva({
  page,
  designKey,
  label,
  src,
  viewHref,
  manage,
  menu,
  personal,
  design: initialDesign,
  designPages,
  allowCustom,
  texts: initialTexts,
}: {
  /** Su clave en «Mis páginas» (cursos, privacidad…). */
  page: string;
  /** Su clave en el diseño (las tres partes legales son una sola página: «legal»). */
  designKey: string;
  label: string;
  /** Su dirección en la web (con la parte, en la legal). */
  src: string;
  viewHref: string;
  /** Dónde se cambia lo que enseña. */
  manage: { href: string; label: string } | null;
  menu: { pages: PanelPage[]; initialOpen: boolean };
  personal: boolean;
  design: PageConfig;
  designPages: { title: string; slug: string }[];
  allowCustom: boolean;
  texts: SiteTexts;
}) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [device, setDevice] = useDevice();
  const panel = useDesignPanel(designKey);
  const [design, setDesign] = useSavedDesign(initialDesign, setState);
  const [texts, setTexts] = useState<SiteTexts>(initialTexts);

  /** Lo escrito encima de la página: un texto fijo de la web o uno de la portada. Se publica al momento. */
  const onText = useCallback(
    async ({ target, value, vars }: Omit<LiveTextMessage, "type">) => {
      const [kind, key] = [target.slice(0, 2), target.slice(2)];
      let run: (() => Promise<{ ok: true } | { ok: false; error: string }>) | null = null;
      if (kind === "t:" && isSiteTextKey(key)) {
        const next = withSiteText(texts, key, vars ? unfillText(value, vars) : value);
        setTexts(next);
        run = () => saveSiteTexts(next);
      } else if (kind === "c:") {
        run = () => savePageText(key, value);
      }
      if (!run) return;
      setState({ kind: "saving" });
      const r = await oneAtATime(run).catch(() => ({ ok: false as const, error: "sin conexión" }));
      setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
    },
    [texts],
  );

  return (
    <CanvaShell
      device={device}
      side={panel.open && <DesignSheet panel={panel} cfg={design} setCfg={setDesign} label={label} pages={designPages} allowCustom={allowCustom} canPick />}
      live={<DesignLive panel={panel} cfg={design} src={src} allowCustom={allowCustom} onText={onText} underTabs={device === "pc"} />}
      bar={
        <CanvaBar
          menu={<PagesMenu pages={menu.pages} current={page} personal={personal} initialOpen={menu.initialOpen} />}
          state={state}
          viewHref={viewHref}
          device={device}
          setDevice={setDevice}
          tools={<BarButton icon={Palette} label="Diseño" active={panel.open} onClick={() => panel.setOpen(!panel.open)} />}
          idle="Escribe encima de los textos con raya: se publica al momento"
        />
      }
      notice={
        manage && (
          <p>
            Esta página se hace sola con lo que publicas: aquí cambias sus textos y su diseño.{" "}
            <a href={manage.href} className="panel-tab-title font-semibold underline underline-offset-4">
              {manage.label}
            </a>
          </p>
        )
      }
    />
  );
}
