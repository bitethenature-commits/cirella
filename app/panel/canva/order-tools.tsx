"use client";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, Palette, Plus, X, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

/**
 * Lo que sale encima de la web en Mi página para ordenarla y cambiarla (sin tapar la web):
 *   · en cada sección y cada bloque, a la izquierda y a la altura de su título, subir y bajar; a la derecha, el ojo
 *     (lo oculto sigue en su sitio, más tenue), la X para quitarla, sus estilos (Tarjeta, Sin burbuja, Panel dorado,
 *     Título dorado) y su «Diseño»;
 *   · entre dos secciones, a la izquierda, el + para añadir una nueva (Texto, Tarjetas, Cita…) o volver a poner una
 *     que se quitó;
 *   · en cada cosa de una lista (sistemas, accesos, desplegables, códigos, testimonios, preguntas, redes), sus flechas
 *     al pasar por encima.
 * Todo lleva data-canva-ui: sus clics no abren la ventanita de la parte ni siguen los enlaces de la web.
 */

const dot =
  "grid h-7 w-7 place-items-center rounded-full border border-[#e9cc8e]/45 bg-[#0e0e10]/90 text-[#f3e2b3] shadow transition hover:bg-[#26262b] disabled:pointer-events-none disabled:opacity-30";

function Dot({ label, onClick, disabled, children, className = "" }: { label: string; onClick?: (() => void) | null; disabled?: boolean; children: ReactNode; className?: string }) {
  return (
    <button type="button" className={`${dot} ${className}`} aria-label={label} title={label} disabled={disabled || !onClick} onClick={() => onClick?.()}>
      {children}
    </button>
  );
}

const arrowBtn =
  "grid h-7 w-7 place-items-center text-[#f3e2b3] transition hover:bg-[#26262b] disabled:pointer-events-none disabled:text-[#f3e2b3]/25";

/**
 * Las dos flechas juntas en una sola cápsula (↑ ↓ en columna o ← → en fila), con una rayita entre medias. La que no
 * se puede usar (la primera no sube, la última no baja) se queda en su sitio, apagada: la cápsula no cambia.
 */
function ArrowPair({ axis, prevLabel, nextLabel, onPrev, onNext }: { axis: "x" | "y"; prevLabel: string; nextLabel: string; onPrev: (() => void) | null; onNext: (() => void) | null }) {
  const row = axis === "x";
  const [Prev, Next] = row ? [ArrowLeft, ArrowRight] : [ArrowUp, ArrowDown];
  return (
    <span className={`flex items-center overflow-hidden rounded-full border border-[#e9cc8e]/45 bg-[#0e0e10]/90 shadow ${row ? "flex-row" : "flex-col"}`}>
      <button type="button" className={arrowBtn} aria-label={prevLabel} title={prevLabel} disabled={!onPrev} onClick={() => onPrev?.()}>
        <Prev className="h-3.5 w-3.5" />
      </button>
      <span aria-hidden className={row ? "h-4 w-px bg-[#e9cc8e]/30" : "h-px w-4 bg-[#e9cc8e]/30"} />
      <button type="button" className={arrowBtn} aria-label={nextLabel} title={nextLabel} disabled={!onNext} onClick={() => onNext?.()}>
        <Next className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Un botón con texto de la columna de la derecha (los estilos y «Diseño»). `on`: elegido. */
export function ToolPill({ label, on = false, icon: Icon, onClick, title }: { label: string; on?: boolean; icon?: LucideIcon; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title ?? label}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[0.7rem] font-semibold shadow transition ${
        on ? "border-[#e9cc8e] bg-[#e9cc8e] text-[#0e0e10]" : "border-[#e9cc8e]/45 bg-[#0e0e10]/90 text-[#f3e2b3] hover:bg-[#26262b]"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

/**
 * Dónde empieza lo de dentro de la sección (sin el hueco que la separa de la anterior): ahí van sus flechas, junto
 * a su título. La web va en su marco (otro documento): se mide con el suyo.
 */
function useContentTop(ref: RefObject<HTMLElement | null>): number {
  const [top, setTop] = useState(4);
  useLayoutEffect(() => {
    const wrap = ref.current?.parentElement;
    const win = wrap?.ownerDocument.defaultView;
    if (!wrap || !win) return;
    const measure = () => {
      let el = wrap.querySelector<HTMLElement>(":scope > :not(.canva-tools):not(.canva-add)");
      // Lo que envuelve sin ser nada (una parte con ventanita, el diseño propio): lo de dentro.
      while (el && (el.classList.contains("canva-part") || el.classList.contains("cp-scope") || el.classList.contains("canva-body")))
        el = el.querySelector<HTMLElement>(":scope > :not([data-canva-ui]):not(link)");
      if (!el) return;
      setTop(Math.max(4, Math.round(el.getBoundingClientRect().top - wrap.getBoundingClientRect().top) + 4));
    };
    measure();
    const ro = new win.ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [ref]);
  return top;
}

/** Lo que se puede añadir con el +: una sección nueva («new», con su dibujo) o una que se quitó («back»). */
export type AddChoice = { key: string; label: string; hint?: string; icon?: LucideIcon; group: "new" | "back" };

/**
 * Lo de una sección o un bloque: subir y bajar a la izquierda (sin flechas, lo que va siempre arriba); a la derecha
 * el ojo (abierto si se ve en la web, tachado si está oculta; al tocarlo, al revés), la X para quitarla, `extra` (sus
 * estilos, solo en pantallas anchas) y «Diseño»; y, en el hueco de encima, el + para añadir otra justo ahí.
 * `note`: por qué sale tenue («Oculta», «Vacía»).
 */
export function SectionTools({
  label,
  arrows = true,
  up = null,
  down = null,
  hidden = false,
  onToggle,
  onRemove,
  removeLabel,
  note,
  extra,
  onDesign,
  add,
  onAdd,
}: {
  label: string;
  arrows?: boolean;
  up?: (() => void) | null;
  down?: (() => void) | null;
  hidden?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  note?: string;
  extra?: ReactNode;
  onDesign?: () => void;
  add?: AddChoice[];
  onAdd?: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const top = useContentTop(ref);
  const right = !!(onToggle || onRemove || note || extra || onDesign);
  return (
    <>
      <div ref={ref} data-canva-ui className="canva-tools absolute left-0 z-30 flex -translate-x-1/2 flex-col gap-1 md:left-auto md:right-full md:mr-4 md:translate-x-0" style={{ top }}>
        {arrows && <ArrowPair axis="y" prevLabel={`Subir «${label}»`} nextLabel={`Bajar «${label}»`} onPrev={up} onNext={down} />}
      </div>
      {right && (
        <div data-canva-ui className="canva-tools absolute right-0 z-30 flex translate-x-1/2 flex-col items-start gap-1 md:left-full md:right-auto md:ml-4 md:translate-x-0" style={{ top }}>
          <div className="flex flex-col gap-1 md:flex-row">
            {onToggle && (
              <Dot label={hidden ? `Mostrar «${label}» en la web` : `Ocultar «${label}»`} onClick={onToggle}>
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Dot>
            )}
            {onRemove && (
              <Dot label={removeLabel ?? `Quitar «${label}» (vuelve con el +)`} onClick={onRemove} className="hover:!bg-rose-900/80">
                <X className="h-3.5 w-3.5" />
              </Dot>
            )}
            {/* En el móvil, «Diseño» es otro círculo (sus estilos van dentro). */}
            {onDesign && (
              <Dot label={`Diseño de «${label}»`} onClick={onDesign} className="md:hidden">
                <Palette className="h-3.5 w-3.5" />
              </Dot>
            )}
          </div>
          {note && <span className="hidden whitespace-nowrap rounded-full bg-[#0e0e10]/90 px-2 py-0.5 text-[0.65rem] font-semibold text-[#f3e2b3] shadow md:block">{note}</span>}
          {/* «Diseño» arriba y, bajo una raya, sus estilos (Título dorado, Panel dorado, Tarjeta, Sin burbuja). */}
          {(extra || onDesign) && (
            <div className="hidden flex-col items-start gap-1 md:flex">
              {onDesign && <ToolPill icon={Palette} label="Diseño" title={`Diseño de «${label}»: letras, colores, tarjetas…`} onClick={onDesign} />}
              {onDesign && extra && <span aria-hidden className="my-1 h-px self-stretch bg-[#e9cc8e]/40" />}
              {extra}
            </div>
          )}
        </div>
      )}
      {/* El + en el hueco entre las dos secciones y siempre por encima de las flechas, con aire: nunca las tapa (si no
          hay hueco, sube hasta el final de la sección de antes). */}
      {add && onAdd && <AddSection options={add} onAdd={onAdd} style={{ top: Math.min(Math.round(top / 2) - 16, top - 32 - 12) }} />}
    </>
  );
}

/**
 * El + con su círculo, a la izquierda entre dos secciones: al tocarlo se elige qué añadir ahí, una sección nueva
 * (Texto, Foto y texto, Tarjetas…) o una de las que se quitaron.
 */
export function AddSection({ options, onAdd, style }: { options: AddChoice[]; onAdd: (key: string) => void; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Los clics y las teclas llegan al documento de la web (su marco), no al del panel.
    const doc = box.current?.ownerDocument;
    if (!doc) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    doc.addEventListener("pointerdown", onDown);
    doc.addEventListener("keydown", onKey);
    return () => {
      doc.removeEventListener("pointerdown", onDown);
      doc.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const fresh = options.filter((o) => o.group === "new");
  const back = options.filter((o) => o.group === "back");
  const pick = (key: string) => {
    setOpen(false);
    onAdd(key);
  };
  return (
    <div
      ref={box}
      data-canva-ui
      data-open={open ? "" : undefined}
      className="canva-add absolute left-0 z-40 -translate-x-1/2 md:left-auto md:right-full md:mr-3.5 md:translate-x-0"
      style={style}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Añadir una sección aquí"
        title="Añadir una sección aquí"
        className="grid h-8 w-8 place-items-center rounded-full border border-[#e9cc8e]/70 bg-[#0e0e10]/90 text-[#e9cc8e] shadow-lg transition hover:scale-105 hover:bg-[#26262b]"
      >
        <Plus className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 max-h-[26rem] w-[min(34rem,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-[#e9cc8e]/35 bg-[#0b0b0d] p-3 text-left text-[#f1ebdf] shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#d9b46a]">¿Qué añades?</p>
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          {fresh.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {fresh.map((o) => {
                const Icon = o.icon;
                return (
                  <button key={o.key} type="button" role="menuitem" onClick={() => pick(o.key)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-white/10">
                    {Icon && <Icon className="h-4 w-4 shrink-0 text-[#d9b46a]" />} {o.label}
                  </button>
                );
              })}
            </div>
          )}
          {back.length > 0 && (
            <>
              <p className="mb-1 mt-3 border-t border-white/10 px-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#d9b46a]/80">Volver a poner</p>
              {back.map((o) => (
                <button key={o.key} type="button" role="menuitem" onClick={() => pick(o.key)} className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  {o.hint && <span className="mt-0.5 block text-xs leading-snug text-white/60">{o.hint}</span>}
                </button>
              ))}
            </>
          )}
          {!options.length && <p className="px-1 py-2 text-sm text-white/70">No hay nada más que añadir aquí.</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Una cosa de una lista con sus flechas al pasar: ← → si van en fila (encima de ella, arriba en medio; si es pequeña,
 * `above`, justo encima), ↑ ↓ si van en lista (a su izquierda). Con `onToggle`, también el ojo para ocultarla o
 * mostrarla, y con `onRemove`, la X para quitarla (los desplegables, que son secciones). `dim`: sale tenue (oculta o
 * sin nada ahora).
 */
export function OrderItem({
  axis,
  first,
  last,
  onMove,
  above = false,
  hidden = false,
  dim = false,
  onToggle,
  onRemove,
  label = "",
  children,
}: {
  axis: "x" | "y";
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  above?: boolean;
  hidden?: boolean;
  dim?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  label?: string;
  children: ReactNode;
}) {
  const row = axis === "x";
  const name = label ? ` «${label}»` : "";
  return (
    // El color de la raya, por si va en una lista con rayas entre medias (las preguntas).
    <div className="canva-order relative" data-dim={dim ? "" : undefined} style={{ borderColor: "var(--c-line)" }}>
      {children}
      <span
        data-canva-ui
        className={`canva-order-tools absolute z-30 flex gap-1 ${
          above ? "bottom-full left-1/2 -translate-x-1/2 pb-1.5" : row ? "left-1/2 top-1 -translate-x-1/2" : "right-0 top-2 md:right-full md:mr-3 md:flex-col"
        }`}
      >
        <ArrowPair
          axis={axis}
          prevLabel={row ? `Mover${name} a la izquierda` : `Subir${name}`}
          nextLabel={row ? `Mover${name} a la derecha` : `Bajar${name}`}
          onPrev={first ? null : () => onMove(-1)}
          onNext={last ? null : () => onMove(1)}
        />
        {onToggle && (
          <Dot label={hidden ? `Mostrar${name} en la web` : `Ocultar${name}`} onClick={onToggle}>
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Dot>
        )}
        {onRemove && (
          <Dot label={`Quitar${name} (vuelve con el +)`} onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Dot>
        )}
      </span>
    </div>
  );
}
