"use client";
import { Download, ExternalLink, Loader2, Maximize2, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Visor de PDF con pdf.js (pdfjs-dist, compilación «legacy» para iPhones algo viejos): todas las
 * páginas una debajo de otra (Safari en iPhone solo enseña la primera de un PDF en un iframe y
 * Chrome en Android, ninguna). Los bytes llegan de /api/stream/<id> (misma web, acceso comprobado
 * en cada tramo) y los recursos de pdf.js de /assets/pdfjs/<versión>/ (scripts/copy-pdfjs-assets.mjs).
 *
 *   · Carga cuando se acerca a la pantalla; pinta solo las páginas visibles (y libera las lejanas)
 *     para no agotar la memoria de lienzos de Safari con un PDF de 60 páginas.
 *   · «Página 3 de 18», − / +, «Pantalla completa» (capa a toda pantalla, el iPhone no tiene
 *     pantalla completa de elementos), «Abrir» (visor del sistema) y «Descargar».
 *   · Sin JavaScript del PDF, sin WebAssembly (useWasm: false → la CSP no cambia).
 */
type PdfDoc = {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
};
type PdfPage = {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
};

const MAX_CANVAS_PIXELS = 4_194_304;
const KEEP_AROUND = 3;

export function PdfViewer({ fileId, name }: { fileId: string; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [full, setFull] = useState(false);
  const [width, setWidth] = useState(0);

  // 1) Carga perezosa: cuando el visor está cerca de la pantalla.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 2) pdf.js y el documento.
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let task: { destroy(): Promise<void>; promise: Promise<PdfDoc> } | null = null;
    (async () => {
      try {
        const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
          version: string;
          GlobalWorkerOptions: { workerSrc: string };
          getDocument(o: Record<string, unknown>): { destroy(): Promise<void>; promise: Promise<PdfDoc> };
        };
        const base = `/assets/pdfjs/${pdfjs.version}/`;
        pdfjs.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
        task = pdfjs.getDocument({
          url: `/api/stream/${fileId}`,
          withCredentials: true,
          rangeChunkSize: 1_048_576,
          disableStream: true,
          disableAutoFetch: true,
          useWasm: false,
          wasmUrl: `${base}wasm/`,
          standardFontDataUrl: `${base}standard_fonts/`,
          cMapUrl: `${base}cmaps/`,
          cMapPacked: true,
          enableXfa: false,
        });
        const d = await task.promise;
        if (cancelled) return;
        const first = await d.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        // Las demás páginas se asumen del tamaño de la primera hasta que se pintan.
        setSizes(Array.from({ length: d.numPages }, () => ({ w: vp.width, h: vp.height })));
        setDoc(d);
      } catch (e) {
        if (cancelled) return;
        const err = e as { name?: string; status?: number };
        if (err?.name === "PasswordException") setError("Este PDF tiene contraseña: descárgalo para abrirlo.");
        else if (err?.status === 401) setError("Tu sesión ha caducado. Vuelve a entrar para ver el PDF.");
        else if (err?.status === 403) setError("Ya no tienes acceso a este contenido.");
        else setError("No se pudo mostrar el PDF.");
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy().catch(() => {});
    };
  }, [near, fileId]);

  // Ancho disponible (al girar el móvil o abrir la pantalla completa).
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 16));
    ro.observe(el);
    setWidth(el.clientWidth - 16);
    return () => ro.disconnect();
  }, [doc, full]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const onVisible = useCallback((n: number) => setCurrent(n), []);
  const total = doc?.numPages ?? 0;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2 text-sm">
      <span className="tabular-nums text-muted" aria-live="polite">
        {total ? `Página ${current} de ${total}` : "Cargando el PDF…"}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-sand disabled:opacity-40" aria-label="Alejar" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-sand disabled:opacity-40" aria-label="Acercar" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
          <Plus className="h-4 w-4" />
        </button>
        {full ? (
          <button type="button" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-sand" aria-label="Cerrar pantalla completa" onClick={() => setFull(false)}>
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 hover:bg-sand" onClick={() => setFull(true)}>
            <Maximize2 className="h-4 w-4" /> <span className="hidden sm:inline">Pantalla completa</span>
            <span className="sr-only sm:hidden">Pantalla completa</span>
          </button>
        )}
        <a href={`/api/download/${fileId}?inline=1`} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 hover:bg-sand">
          <ExternalLink className="h-4 w-4" /> Abrir
        </a>
        <a href={`/api/download/${fileId}`} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 hover:bg-sand">
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Descargar</span>
          <span className="sr-only sm:hidden">Descargar</span>
        </a>
      </div>
    </div>
  );

  return (
    <div ref={box} data-pdf-viewer className="min-w-0">
      <div
        className={
          full
            ? "fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-paper pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
            : "overflow-hidden rounded-2xl border border-line bg-paper"
        }
        role={full ? "dialog" : undefined}
        aria-label={full ? name : undefined}
        aria-modal={full || undefined}
      >
        {toolbar}
        {error ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
            <p className="text-sm text-muted">{error}</p>
            <div className="flex gap-2">
              <a href={`/api/download/${fileId}?inline=1`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
                Abrir
              </a>
              <a href={`/api/download/${fileId}`} className="btn btn-primary btn-sm">
                Descargar
              </a>
            </div>
          </div>
        ) : (
          <div ref={scroller} className={`overflow-auto p-2 [overscroll-behavior:contain] ${full ? "flex-1" : "h-[75svh]"}`}>
            {!doc ? (
              <div className="grid h-full place-items-center text-muted">
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando" />
              </div>
            ) : (
              <div className="mx-auto flex w-max min-w-full flex-col items-center gap-2">
                {sizes.map((s, i) => (
                  <PdfPageView key={i} doc={doc} n={i + 1} base={s} width={width} zoom={zoom} current={current} onVisible={onVisible} root={scroller} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPageView({
  doc,
  n,
  base,
  width,
  zoom,
  current,
  onVisible,
  root,
}: {
  doc: PdfDoc;
  n: number;
  base: { w: number; h: number };
  width: number;
  zoom: number;
  current: number;
  onVisible: (n: number) => void;
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const fit = width > 0 ? width / base.w : 1;
  const cssW = Math.floor(base.w * fit * zoom);
  const cssH = Math.floor(base.h * fit * zoom);
  const far = Math.abs(n - current) > KEEP_AROUND;

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setVisible(e.isIntersecting);
        }
      },
      { root: root.current, rootMargin: "100% 0px" },
    );
    io.observe(el);
    const pageIo = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(n), { root: root.current, threshold: 0.5 });
    pageIo.observe(el);
    return () => {
      io.disconnect();
      pageIo.disconnect();
    };
  }, [n, onVisible, root]);

  useEffect(() => {
    const el = holder.current;
    if (!el || !visible || far || width <= 0) return;
    let task: { promise: Promise<void>; cancel(): void } | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let scale = fit * zoom * dpr;
      const vp1 = page.getViewport({ scale: 1 });
      if (vp1.width * scale * vp1.height * scale > MAX_CANVAS_PIXELS) scale = Math.sqrt(MAX_CANVAS_PIXELS / (vp1.width * vp1.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.setAttribute("aria-label", `Página ${n}`);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      task = page.render({ canvas, canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        return;
      }
      if (cancelled) return;
      el.replaceChildren(canvas);
      el.dataset.rendered = "1";
    })().catch(() => {});
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, n, visible, far, fit, zoom, width]);

  // Lejos de la página actual: se libera el lienzo.
  useEffect(() => {
    const el = holder.current;
    if (el && far && el.dataset.rendered) {
      const c = el.querySelector("canvas");
      if (c) {
        c.width = 0;
        c.height = 0;
      }
      el.replaceChildren();
      delete el.dataset.rendered;
    }
  }, [far]);

  return <div ref={holder} className="shrink-0 bg-white shadow-sm" style={{ width: cssW || "100%", height: cssH || 400 }} data-pdf-page={n} />;
}
