"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { unseenLabel, type SeenSection } from "@/lib/section-seen-rules";

type Remote = { sync: true; counts: Record<SeenSection, number> } | { sync: false };

const seenKey = (u: string, s: SeenSection) => `cirella:visto:${u}:${s}`;
const syncKey = (u: string) => `cirella:visto-sync:${u}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {}
}

// Una sola pregunta al servidor por página para las tres secciones.
const remote = new Map<string, Promise<Remote | null>>();
function fetchRemote(username: string): Promise<Remote | null> {
  let p = remote.get(username);
  if (!p) {
    const q = new URLSearchParams({ u: username });
    for (const s of ["posts", "portal", "offers"] as const) {
      const v = read(seenKey(username, s));
      if (v) q.set(s, v);
    }
    p = fetch(`/api/novedades?${q}`, { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<Remote>) : null))
      .catch(() => null);
    remote.set(username, p);
  }
  return p;
}

/**
 * El punto rojo con el número de lo nuevo de una sección:
 *   · Con cuenta y suscrita (sync): lo publicado después de la última vez que la abrió, en cualquier
 *     dispositivo (/api/novedades). Mientras no se sabe, no se pinta nada.
 *   · El resto: sale siempre (también en el HTML del servidor) hasta que la abre en este navegador, y
 *     vuelve si después se publica algo más nuevo (`stamps`, las fechas de lo que hay).
 */
function useUnseen(username: string, section: SeenSection | undefined, stamps: number[], preview: boolean, isOpen: () => boolean) {
  const [count, setCount] = useState<number | null>(preview || !section ? null : stamps.length);
  const sync = useRef(false);
  const stampsKey = stamps.join(",");

  useEffect(() => {
    if (preview || !section) return;
    const list = stampsKey ? stampsKey.split(",").map(Number) : [];
    const local = () => {
      const seen = Number(read(seenKey(username, section)) ?? 0);
      return list.filter((t) => t > seen).length;
    };
    const wasSync = read(syncKey(username)) === "1";
    if (isOpen()) setCount(0);
    else setCount(wasSync ? null : local());
    let alive = true;
    fetchRemote(username).then((r) => {
      if (!alive) return;
      sync.current = !!r?.sync;
      if (r) write(syncKey(username), r.sync ? "1" : null);
      if (isOpen()) return;
      if (r?.sync) setCount(r.counts[section] ?? 0);
      else setCount(local()); // sin suscribir, o si falla: lo que recuerda este navegador
    });
    return () => {
      alive = false;
    };
    // isOpen lee el estado del momento: no hace falta volver a empezar cuando cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, username, section, stampsKey]);

  const markSeen = () => {
    if (preview || !section) return;
    setCount(0);
    write(seenKey(username, section), String(Date.now()));
    if (sync.current || read(syncKey(username)) === "1")
      fetch("/api/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ u: username, section }),
        keepalive: true,
      }).catch(() => {});
  };
  return { count, markSeen };
}

export type Fold = {
  /** El ancla de la sección (#actualidades, #portal, #ofertas, #gifts). */
  id: string;
  /** Con aviso de novedades (Gifts no lo lleva). */
  section?: SeenSection;
  /** En el Canva, escritos encima. */
  title: ReactNode;
  countLabel: ReactNode;
  /** Fechas (ms) de lo que hay en la sección: publicadas, del portal u ofertas empezadas. */
  stamps: number[];
  /** El dibujo de la sección, en línea dorada. */
  icon: ReactNode;
  content: ReactNode;
};

/** Un desplegable de la fila: el dibujo con su nombre debajo, como en «Sistemas». */
function FoldTab({ fold, username, preview, open, onToggle, editing }: { fold: Fold; username: string; preview: boolean; open: boolean; onToggle: (markSeen: () => void) => void; editing: boolean }) {
  const openRef = useRef(open);
  openRef.current = open;
  const { count, markSeen } = useUnseen(username, fold.section, fold.stamps, preview, () => openRef.current);
  // En el Canva, un <div>: dentro de un <button> no se puede escribir encima del título.
  const Tag = editing ? "div" : "button";
  return (
    <Tag
      type={editing ? undefined : "button"}
      role={editing ? "button" : undefined}
      onClick={() => onToggle(markSeen)}
      aria-expanded={open}
      aria-controls={fold.id}
      data-fold-tab={fold.id}
      className="group flex flex-col items-center gap-2 text-center"
    >
      <span className="relative grid h-12 w-12 place-items-center">
        <span className={`cp-gold grid place-items-center transition-transform duration-300 group-hover:-translate-y-1 ${open ? "-translate-y-1" : ""}`} aria-hidden>
          {fold.icon}
        </span>
        {count != null && count > 0 && (
          <span data-unseen={count} className="absolute -right-2 -top-1.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full px-1 text-[0.68rem] font-bold leading-none text-white ring-2 ring-[var(--c-bg)]" style={{ background: "#e5484d" }}>
            <span aria-hidden>{count > 9 ? "9+" : count}</span>
            <span className="sr-only">{unseenLabel(count)}</span>
          </span>
        )}
      </span>
      {/* Al escribir encima (Canva), el clic no abre ni cierra. */}
      <span className="cp-display text-[1rem] leading-tight sm:text-[1.15rem]" onClick={editing ? (e) => e.stopPropagation() : undefined}>{fold.title}</span>
      <span className="cp-faint flex items-center gap-0.5 text-[0.7rem] tabular-nums" onClick={editing ? (e) => e.stopPropagation() : undefined}>
        <span className="hidden sm:inline">{fold.countLabel}</span>
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </span>
    </Tag>
  );
}

/**
 * Los desplegables de la portada («Actualidades», «Portal de Noticias», «Ofertas», «Gifts») en una fila,
 * como «Sistemas»: un dibujo dorado con su nombre debajo. Al tocar uno se abre su contenido debajo de la
 * fila (y se cierra el que estuviera abierto). Empiezan cerrados; un enlace con ancla (#ofertas,
 * #portal-form…) abre el que lo contiene.
 */
export function SectionFolds({
  folds,
  username,
  preview,
  editing = false,
  wrap,
}: {
  folds: Fold[];
  username: string;
  preview?: boolean;
  /** Canva: los títulos se escriben encima. */
  editing?: boolean;
  /** Canva: cada desplegable con sus flechas para ordenarlo (su número en la fila). */
  wrap?: (i: number, node: ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const panels = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const el = hash ? document.getElementById(hash) : null;
    if (!el || !panels.current?.contains(el)) return;
    const panel = el.closest<HTMLElement>("[data-fold-panel]");
    if (!panel) return;
    setOpen(panel.id);
    requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
  }, []);

  return (
    <div>
      <div className="grid gap-x-2 gap-y-6" style={{ gridTemplateColumns: `repeat(${folds.length}, minmax(0, 1fr))` }}>
        {folds.map((f, i) => {
          const tab = (
            <FoldTab
              fold={f}
              username={username}
              preview={!!preview}
              open={open === f.id}
              editing={editing}
              onToggle={(markSeen) => {
                const next = open === f.id ? null : f.id;
                setOpen(next);
                if (next) markSeen();
              }}
            />
          );
          return <Fragment key={f.id}>{wrap ? wrap(i, tab) : tab}</Fragment>;
        })}
      </div>
      <div ref={panels}>
        {folds.map((f) => (
          <div key={f.id} id={f.id} data-fold-panel hidden={open !== f.id} className="cp-card mt-6 rounded-2xl border p-4 sm:p-5" style={{ overflow: "visible" }}>
            <h2 id={`${f.id}-titulo`} className="cp-display m-0 mb-3 text-[1.5rem] leading-tight sm:text-[1.75rem]">
              {f.title}
            </h2>
            {f.content}
          </div>
        ))}
      </div>
    </div>
  );
}
