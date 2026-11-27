"use client";
import { Check, ExternalLink, ImagePlus, Link2, Loader2, Pencil, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { askText } from "@/components/ui/ask-confirm";
import { uploadImage } from "@/components/ui/image-upload";
import { DeviceBox, DeviceToggle, WebFrame, type Device } from "./web-frame";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Las piezas de «Mi página» (la web con todo editable encima): la barra de arriba, la web a pantalla completa (o en
 * su móvil), los formularios superpuestos (también el Diseño), lo que se abre encima (los códigos), los textos
 * que se escriben encima, las fotos con «Cambiar foto» y el botón de los enlaces. Todo lo que es del editor lleva
 * data-canva-ui: sus clics no se cancelan (los de la web sí, para no salir de la página mientras se edita).
 */

export type SaveState = { kind: "idle" | "pending" | "saving" | "ok" } | { kind: "error"; error: string };

/** La dirección de «Mi página» con una página (la portada sin nada) y, si hace falta, lo que se abre al llegar. */
export const canvaHref = (page?: string | null, ver?: "paginas" | "codigos") => {
  const q = new URLSearchParams();
  if (page) q.set("pagina", page);
  if (ver) q.set("ver", ver);
  const s = q.toString();
  return s ? `/panel/pagina?${s}` : "/panel/pagina";
};

/**
 * Lo que se guarda en la portada desde el editor (textos fijos, diseño…) va de uno en uno: dos a la vez se
 * pisarían (cada uno lee la portada y la vuelve a escribir entera).
 */
let queue: Promise<unknown> = Promise.resolve();
export function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/**
 * La barra del editor: una pestaña que cuelga del borde de arriba, a la derecha (como la de su nombre, a la
 * izquierda). «Mis páginas», ordenador o móvil, las herramientas (Diseño), si ya está publicado y «Ver la web».
 */
export function CanvaBar({
  menu,
  state,
  viewHref,
  device,
  setDevice,
  tools,
  idle = "Escribe encima de tu web: se publica al momento",
}: {
  menu: ReactNode;
  state: SaveState;
  viewHref: string;
  device: Device;
  setDevice: (d: Device) => void;
  tools?: ReactNode;
  /** Lo que dice la barra mientras no se está publicando nada. */
  idle?: string;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 p-2 sm:gap-1.5">
      {menu}
      <DeviceToggle device={device} onChange={setDevice} />
      {tools}
      <span className="inline-flex shrink-0 items-center gap-1.5 px-1 text-xs empty:hidden" role="status">
        {state.kind === "saving" || state.kind === "pending" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> <span className="hidden sm:inline"><Tr s={"Publicando…"} /></span>
          </>
        ) : state.kind === "ok" ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" /> <span className="hidden sm:inline"><Tr s={"Publicado"} /></span>
          </>
        ) : state.kind === "error" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#d0675b]" title={`No se ha publicado: ${state.error}`}>
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> <span className="hidden max-w-[16rem] truncate sm:inline"><Tr s={"No se ha publicado:"} />{" "}<Tr s={state.error} /></span>
          </span>
        ) : (
          <span className="hidden max-w-[20rem] opacity-70 2xl:inline"><Tr s={idle} /></span>
        )}
      </span>
      <a href={viewHref} target="_blank" rel="noopener" className="panel-nav-link inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm" title={t("Ver la web")} aria-label={t("Ver la web")}>
        <ExternalLink className="h-4 w-4" /> <span className="hidden xl:inline"><Tr s={"Ver la web"} /></span>
      </a>
    </div>
  );
}

/** Un botón de la barra (Diseño). Con `href`, lleva a otra página del editor. */
export function BarButton({ icon: Icon, label, onClick, href, active }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string; active?: boolean }) {
  const cls = "panel-nav-link inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm";
  const inner = (
    <>
      <Icon className="h-4 w-4" /> <span className="hidden lg:inline"><Tr s={label} /></span>
    </>
  );
  return href ? (
    <a href={href} className={cls} title={label} aria-label={label}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls} title={label} aria-label={label} aria-pressed={active}>
      {inner}
    </button>
  );
}

/**
 * El editor entero, dentro del panel: la web ocupa toda la pantalla y las pestañas del panel siguen en sus bordes,
 * encima de ella (como en las demás páginas). La barra del editor es una pestaña más, arriba a la derecha; el aviso
 * (si lo hay), otra abajo. Los formularios se abren encima de la web, sin quitarle sitio. Con `live`, en lugar de la
 * web pintada aquí, la página de verdad (la vista en vivo: Diseño y las páginas que se crean solas).
 *
 * Nada de esto va dentro de una caja con posición: así cada pieza se coloca entre las pestañas del panel (z-40 las
 * de los lados, z-46 la de su nombre).
 */
export function CanvaShell({
  bar,
  notice,
  device,
  side,
  overlay,
  live,
  frameClassName = "",
  children,
}: {
  bar: ReactNode;
  notice?: ReactNode;
  device: Device;
  side?: ReactNode;
  overlay?: ReactNode;
  live?: ReactNode;
  /** El sitio de la web dentro de la pantalla (p. ej., dejar hueco a un panel fijo a la izquierda). El aviso de abajo se centra en ese mismo sitio. */
  frameClassName?: string;
  children?: ReactNode;
}) {
  const barTab = useRef<HTMLDivElement>(null);

  // La etiqueta con su nombre (arriba a la izquierda) se acorta para no pisar la barra: le deja su ancho.
  useEffect(() => {
    const el = barTab.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--canva-bar", `${el.offsetWidth}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--canva-bar");
    };
  }, []);

  return (
    <div data-canva>
      <div className="fixed inset-0 z-30 bg-[radial-gradient(ellipse_at_center,#141414_0%,#000_72%)] text-[#f3ecdd]">
        <div className={`h-full transition-[padding] duration-300 ${frameClassName}`}>
          {live ? (
            <DeviceBox device={device}>{live}</DeviceBox>
          ) : (
            <WebFrame key={device} device={device}>
              {children}
            </WebFrame>
          )}
        </div>
      </div>
      <div ref={barTab} data-canva-ui className="panel-side panel-tab panel-tab-top fixed right-3 top-0 z-[44] max-w-[calc(100vw-1.5rem)] rounded-b-[1.6rem] sm:right-6">
        {bar}
      </div>
      {notice && (
        <div data-canva-ui className={`pointer-events-none fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-[41] flex justify-center px-3 xl:bottom-0 ${frameClassName}`}>
          <div className="canva-notice panel-side panel-tab pointer-events-auto max-w-[28rem] rounded-2xl px-4 py-2 text-center text-xs leading-relaxed xl:rounded-b-none xl:rounded-t-2xl xl:pb-[calc(0.7rem+env(safe-area-inset-bottom))]">
            {notice}
          </div>
        </div>
      )}
      {side}
      {overlay}
    </div>
  );
}

/** Un texto que se escribe encima de la web. Se guarda al salir de él (Intro en los de una línea; Esc deshace). */
export function EditText({ value, onCommit, multiline = false, placeholder }: { value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <span
      key={value}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder ?? "Escribe aquí"}
      className={`canva-text ${multiline ? "whitespace-pre-line" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.textContent = value;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const raw = (e.currentTarget.innerText ?? "").replace(/ /g, " ");
        const next = multiline ? raw.replace(/\n{3,}/g, "\n\n").trim() : raw.replace(/\s+/g, " ").trim();
        if (next === value) return;
        const el = e.currentTarget;
        onCommit(next);
        // Si no se acepta (un título vacío, un texto que vuelve al de serie…), el valor no cambia: se vuelve a ver el
        // que vale (con otro valor, este se pinta de nuevo y ya no está en la página).
        requestAnimationFrame(() => {
          if (el.isConnected && el.textContent !== value) el.textContent = value;
        });
      }}
    >
      <Tr s={value} />
    </span>
  );
}

/** Una foto de la web con «Cambiar foto» (y «Quitar» si se puede dejar sin ella). */
export function EditImage({ children, onChange, onFile, round = false, label, removable = false, hasImage, className = "" }: { children: ReactNode; onChange: (url: string | null) => void; /** Subir la foto a su manera (p. ej. con sus medidas). */ onFile?: (file: File) => Promise<void>; round?: boolean; label?: string; removable?: boolean; hasImage: boolean; /** Su sitio y su ancho en la web. */ className?: string }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={`group/img relative ${round ? "inline-block" : "block"} ${className}`}>
      {children}
      <span data-canva-ui className={`absolute inset-0 z-20 flex flex-wrap items-center justify-center gap-1.5 ${round ? "rounded-full" : ""} ${hasImage ? "bg-black/0 opacity-0 transition group-hover/img:bg-black/35 group-hover/img:opacity-100 focus-within:opacity-100" : ""}`}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0e0e10]/90 px-3 py-1.5 text-xs font-semibold text-[#f3e2b3] shadow-lg"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          <Tr s={round ? "" : label ?? (hasImage ? t("Cambiar foto") : t("Añadir foto"))} />
        </button>
        {removable && hasImage && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg" aria-label={t("Quitar la foto")}>
            <X className="h-3.5 w-3.5" /> <Tr s={round ? "" : t("Quitar")} />
          </button>
        )}
        {error && <span className="w-full text-center text-xs font-semibold text-[#f2a99f]"><Tr s={error} /></span>}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            if (onFile) await onFile(file);
            else onChange(await uploadImage(file));
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo subir");
          } finally {
            setBusy(false);
          }
        }}
      />
    </span>
  );
}

/** El botón para cambiar un enlace (con sus páginas y productos como sugerencias). */
export function EditLink({ url, onChange, suggestions }: { url: string; onChange: (v: string) => void; suggestions: { value: string; label: string }[] }) {
  const t = useT();
  return (
    <button
      type="button"
      data-canva-ui
      onClick={async (e) => {
        const next = await askText("¿Adónde lleva?", url, { from: e.currentTarget, placeholder: "/aboutme o https://…", suggestions });
        if (next !== null && next !== url) onChange(next);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e9cc8e]/60 bg-[#0e0e10]/85 px-2.5 py-1 text-[0.7rem] font-semibold text-[#f3e2b3] shadow"
      title={t(url || t("Sin enlace"))}
    >
      <Link2 className="h-3 w-3" />{" "}<Tr s={"Enlace"} /></button>
  );
}

/**
 * Una parte de la web que se cambia en su ventanita (redes, botones, testimonios, un código, el pie…): al
 * pulsarla se abre. Sus textos se siguen escribiendo encima y sus botones («Copiar», «Ver más»…) siguen
 * funcionando.
 */
export function PartFrame({ label, onOpen, className, children }: { label: string; onOpen: () => void; className?: string; children: ReactNode }) {
  return (
    <div
      className={`canva-part ${className ?? ""}`}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest(".canva-text, [data-canva-ui], button, summary, input, textarea, select")) return;
        // La de dentro gana (un código dentro de la lista de códigos).
        e.stopPropagation();
        onOpen();
      }}
    >
      <button
        type="button"
        data-canva-ui
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="canva-part-chip absolute right-0 top-0 z-30 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-[#e9cc8e]/50 bg-[#0e0e10]/90 px-2.5 py-1 text-[0.7rem] font-semibold text-[#f3e2b3] shadow"
      >
        <Pencil className="h-3 w-3" /> <Tr s={label} />
      </button>
      {children}
    </div>
  );
}

/** Cerrar con Escape (sin estar escribiendo en un campo). */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement | null)?.closest?.("input, textarea, select")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/**
 * Los formularios de una parte, superpuestos a la web (no le quitan sitio): en el ordenador, una ventana flotante a
 * la derecha, entre la barra de arriba y las pestañas de abajo; en el móvil, abajo, dejando la web a la vista arriba.
 */
export function CanvaSheet({
  title,
  onClose,
  wide = false,
  footer = true,
  tall = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  /** true: «Se publica solo al momento» y «Listo»; false: sin pie; o un pie propio. */
  footer?: ReactNode;
  /** En el móvil, casi toda la pantalla (formularios largos, como los ajustes de un curso). */
  tall?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  useEscape(onClose);
  return (
    <aside
      data-canva-ui
      role="dialog"
      aria-label={title}
      className={`fixed inset-x-0 bottom-0 z-[42] flex ${tall ? "max-h-[calc(100dvh-4.5rem)]" : "max-h-[68vh]"} flex-col rounded-t-2xl border border-b-0 border-line bg-paper/80 text-ink backdrop-blur-xl shadow-[0_30px_80px_-20px_rgb(0_0_0/.75)] animate-fade-up sm:inset-x-auto sm:bottom-[3.6rem] sm:right-6 sm:top-[4.25rem] sm:max-h-none sm:max-w-[calc(100vw-5rem)] sm:rounded-2xl sm:border-b ${wide ? "sm:w-[34rem]" : "sm:w-[28rem] xl:w-[30rem]"}`}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-semibold">{title}</p>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label={t("Cerrar")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{children}</div>
      {footer === true ? (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-xs text-muted"><Tr s={"Se publica solo al momento."} /></p>
          <button type="button" onClick={onClose} className="btn btn-primary btn-sm"><Tr s={"Listo"} /></button>
        </div>
      ) : footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">{footer}</div>
      ) : null}
    </aside>
  );
}

/**
 * Lo que se abre encima de la web cuando se pide (los códigos): las pestañas del panel siguen a la vista, encima.
 * `size`: «full», casi toda la pantalla; «md», una ventana mediana.
 */
export function CanvaOverlay({ title, onClose, size = "md", children }: { title: ReactNode; onClose: () => void; size?: "full" | "md"; children: ReactNode }) {
  const t = useT();
  useEscape(onClose);
  return (
    <div
      data-canva-ui
      className="fixed inset-0 z-[39] flex justify-center bg-black/60 px-3 pb-[calc(3.6rem+env(safe-area-inset-bottom))] pt-[5rem] sm:px-14 lg:px-16"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-paper text-ink shadow-2xl ${size === "md" ? "max-w-3xl self-center" : "max-w-[90rem]"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0 font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-sand" aria-label={t("Cerrar")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

/** Los clics de la web no llevan a ningún sitio mientras se edita (sí los del editor). */
export function stopWebLinks(e: React.MouseEvent) {
  // También al pulsar un botón del editor que está dentro de un enlace de la web (la foto de una burbuja…).
  // La web va dentro de su marco (otro documento): se mira la etiqueta, no «instanceof».
  const t = e.target as HTMLElement;
  if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "file") return; // el selector de fotos («Cambiar foto»)
  const a = t.closest("a");
  if (a && !a.closest("[data-canva-ui]")) e.preventDefault();
}
