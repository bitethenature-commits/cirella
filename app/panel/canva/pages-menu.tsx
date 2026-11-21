"use client";

import { ArrowDown, ArrowUp, ChevronDown, FileText, Files, House, Plus, Scale, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { SITE_PAGE_STATE_LABEL, type SitePageState } from "@/lib/site-pages";
import { deleteSitePageAction, moveSitePageAction } from "../paginas/actions";
import { canvaHref } from "./canva-ui";
import { LEGAL_PAGES, pageLabel, WEB_PAGES, type PanelPage } from "./web-pages";

const TONE: Record<SitePageState, string> = {
  DRAFT: "bg-[#f8efdc] text-[#8a6420]",
  PUBLISHED: "bg-[#e7f3ec] text-[#2f6b4a]",
  CHANGES: "bg-sand text-muted",
};

const tool = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-20";

/**
 * «Mis páginas», al principio de la barra del editor: todas las páginas de la web para editarlas aquí (la portada, las
 * que se crean solas, las suyas y las legales). Las suyas se suben, se bajan y se borran; abajo, «Nueva página».
 */
export function PagesMenu({ pages, current, personal, initialOpen = false }: { pages: PanelPage[]; current: string; personal: boolean; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      // Las preguntas («¿Borrar…?») salen en su ventanita: no cierran el menú.
      if (!t || box.current?.contains(t) || t.closest?.("dialog")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const own = new Map(pages.map((p) => [p.slug, p]));
  const mine = pages.filter((p) => !p.fixed);
  const web = WEB_PAGES.filter((w) => personal || !w.personalOnly);

  // La lista se coloca respecto a la barra (la pestaña de arriba), no al botón: así cabe también en el móvil.
  return (
    <div ref={box} className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mis-paginas"
        aria-label={`Mis páginas: ${pageLabel(current, pages)}`}
        className="panel-nav-link inline-flex h-9 max-w-full items-center gap-2 rounded-full px-2.5 text-sm sm:max-w-[20rem] sm:pl-3.5"
      >
        <Files className="h-4 w-4 shrink-0 sm:hidden" />
        <span className="panel-tab-title hidden shrink-0 font-serif text-lg leading-none sm:inline">Mis páginas</span>
        <span className="hidden truncate opacity-80 sm:inline">· {pageLabel(current, pages)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="mis-paginas"
          className="panel-drop absolute right-0 top-full z-10 mt-6 max-h-[calc(100dvh-8.5rem)] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-paper p-2 text-ink shadow-2xl sm:mt-2"
        >
          <ul>
            <Item href={canvaHref()} icon={<House className="h-4 w-4" />} label="Portada" on={current === ""} />
          </ul>

          <Group title="La web">
            {web.map((w) => (
              <Item key={w.key} href={canvaHref(w.key)} icon={<Sparkles className="h-4 w-4" />} label={w.label} on={current === w.key} state={own.get(w.key)?.state} />
            ))}
          </Group>

          <Group title="Tus páginas">
            {mine.map((p, i) => (
              <Item
                key={p.id}
                href={canvaHref(p.slug)}
                icon={<FileText className="h-4 w-4" />}
                label={p.title}
                on={current === p.slug}
                state={p.state}
              >
                {(["up", "down"] as const).map((dir) => (
                  <form key={dir} action={moveSitePageAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="dir" value={dir} />
                    <button
                      disabled={(dir === "up" && i === 0) || (dir === "down" && i === mine.length - 1)}
                      className={tool}
                      aria-label={dir === "up" ? `Subir «${p.title}»` : `Bajar «${p.title}»`}
                    >
                      {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    </button>
                  </form>
                ))}
                <DeleteButton action={deleteSitePageAction} id={p.id} what={p.title} message={`¿Borrar «${p.title}»? Su dirección dejará de funcionar.`} />
              </Item>
            ))}
            {mine.length === 0 && <li className="px-2.5 py-1.5 text-sm text-muted">Aún no tienes páginas tuyas.</li>}
            <li className="pt-1">
              <Link href="/panel/paginas/nueva" className="btn btn-outline btn-sm ml-1.5">
                <Plus className="h-4 w-4" /> Nueva página
              </Link>
            </li>
          </Group>

          <Group title="Legal">
            {LEGAL_PAGES.map((l) => (
              <Item key={l.key} href={canvaHref(l.key)} icon={<Scale className="h-4 w-4" />} label={l.label} on={current === l.key} />
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p className="px-2.5 pb-1 pt-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </>
  );
}

/** Una página de la lista: se pulsa para editarla aquí; a la derecha, lo suyo (subir, bajar, borrar). */
function Item({ href, icon, label, on, state, children }: { href: string; icon: ReactNode; label: string; on: boolean; state?: SitePageState; children?: ReactNode }) {
  return (
    <li className={`flex items-center gap-0.5 rounded-xl pr-1 ${on ? "bg-sand" : "hover:bg-sand/60"}`}>
      <a href={href} aria-current={on ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-ink text-cream" : "bg-white text-muted"}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{label}</span>
          {state && state !== "PUBLISHED" && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${TONE[state]}`}>{SITE_PAGE_STATE_LABEL[state]}</span>
            </span>
          )}
        </span>
      </a>
      {children}
    </li>
  );
}
