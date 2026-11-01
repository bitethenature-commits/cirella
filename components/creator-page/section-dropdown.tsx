"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
 * Sección plegable de la portada («Actualidades», «Portal de Noticias», «Ofertas»): una fila como las de
 * /cursos (título, una línea con el número y la flecha) que se despliega con su contenido. Es un
 * <details> nativo: funciona sin JavaScript (la copia estática de la web) y empieza cerrado.
 *
 * El punto rojo con el número avisa de lo nuevo:
 *   · Con cuenta y suscrita (sync): lo publicado después de la última vez que la abrió, en cualquier
 *     dispositivo (/api/novedades). Mientras no se sabe, no se pinta nada.
 *   · El resto: sale siempre (también en el HTML del servidor) hasta que la abre en este navegador, y
 *     vuelve si después se publica algo más nuevo (`stamps`, las fechas de lo que hay).
 * Va sobre la flecha, en posición absoluta: aparecer o desaparecer no mueve nada.
 */
export function SectionDropdown({
  id,
  section,
  username,
  title,
  countLabel,
  stamps,
  preview,
  children,
}: {
  id: string;
  section: SeenSection;
  username: string;
  title: string;
  countLabel: string;
  /** Fechas (ms) de lo que hay en la sección: publicadas, del portal u ofertas empezadas. */
  stamps: number[];
  preview?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  // null = no se pinta. Sin JavaScript (y en el HTML del servidor): el caso de quien no está suscrita.
  const [count, setCount] = useState<number | null>(preview ? null : stamps.length);
  const sync = useRef(false);
  const stampsKey = stamps.join(",");

  useEffect(() => {
    if (preview) return;
    const list = stampsKey ? stampsKey.split(",").map(Number) : [];
    const local = () => {
      const seen = Number(read(seenKey(username, section)) ?? 0);
      return list.filter((t) => t > seen).length;
    };
    const wasSync = read(syncKey(username)) === "1";
    // Ya abierta (un enlace con ancla): nada que avisar.
    if (ref.current?.open) setCount(0);
    else setCount(wasSync ? null : local());
    let alive = true;
    fetchRemote(username).then((r) => {
      if (!alive) return;
      sync.current = !!r?.sync;
      if (r) write(syncKey(username), r.sync ? "1" : null);
      if (ref.current?.open) return;
      if (r?.sync) setCount(r.counts[section] ?? 0);
      else setCount(local()); // sin suscribir, o si falla: lo que recuerda este navegador
    });
    return () => {
      alive = false;
    };
  }, [preview, username, section, stampsKey]);

  // Un enlace con ancla (#ofertas, #portal-form…) abre la sección que lo contiene.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const el = hash ? document.getElementById(hash) : null;
    const details = ref.current;
    if (!el || !details || !(el === details.parentElement || details.contains(el))) return;
    details.open = true;
    requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
  }, []);

  const onToggle = () => {
    if (preview || !ref.current?.open) return;
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

  return (
    <details ref={ref} onToggle={onToggle} data-section-dropdown={section} className="cp-card group rounded-2xl border" style={{ overflow: "visible" }}>
      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <h2 id={`${id}-titulo`} className="cp-display m-0 text-[1.5rem] leading-tight sm:text-[1.75rem]">
            {title}
          </h2>
          <span className="cp-muted block text-sm tabular-nums">{countLabel}</span>
        </span>
        <span className="relative shrink-0">
          <ChevronDown aria-hidden className="h-5 w-5 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          {count != null && count > 0 && (
            <span data-unseen={count} className="absolute -right-2.5 -top-3 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full px-1 text-[0.68rem] font-bold leading-none text-white ring-2 ring-[var(--c-surface)]" style={{ background: "#e5484d" }}>
              <span aria-hidden>{count > 9 ? "9+" : count}</span>
              <span className="sr-only">{unseenLabel(count)}</span>
            </span>
          )}
        </span>
      </summary>
      <div className="px-4 pb-5 pt-2 sm:px-5 sm:pb-6">{children}</div>
    </details>
  );
}
