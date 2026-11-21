"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type Device = "pc" | "movil";

const SKELETON = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';

/** ¿Es una hoja de estilos (o un <style>) que hay que llevar dentro del marco? */
function isStyle(n: Node): n is HTMLElement {
  if (n.nodeType !== 1) return false;
  const el = n as HTMLElement;
  return el.tagName === "STYLE" || (el.tagName === "LINK" && (el as HTMLLinkElement).rel === "stylesheet");
}

/**
 * La web dentro de un marco (un iframe) del ancho del ordenador o del móvil: así la web se ve de verdad como en
 * cada uno (sus «sm:», «lg:»… miran el ancho del marco, no el de la pantalla). Se pinta con React desde aquí mismo
 * (createPortal): los textos que se escriben encima, las fotos y los bloques siguen funcionando igual. Lleva dentro
 * los mismos estilos que la página (y los que vayan llegando).
 */
export function WebFrame({ device, children }: { device: Device; children: ReactNode }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let stop = () => {};
    const setup = () => {
      const doc = iframe.contentDocument;
      // Hasta que carga su documento (about:srcdoc), el del principio no vale: se cambia al cargar.
      if (!doc || doc.URL !== "about:srcdoc" || !doc.body || doc.body.dataset.ready) return;
      stop();
      doc.body.dataset.ready = "1";
      // Lo que entra con animación al deslizar (components/reveal.tsx mira la página del panel, no la del marco): aquí, a la vista.
      doc.documentElement.setAttribute("data-canva-frame", "");
      // Los estilos de la página, copiados y al día (en desarrollo cambian; al navegar llegan otros).
      const copies = new Map<Node, Node>();
      const add = (n: Node) => {
        if (!isStyle(n) || copies.has(n)) return;
        const c = doc.importNode(n, true);
        copies.set(n, c);
        doc.head.appendChild(c);
      };
      document.head.childNodes.forEach(add);
      const heads = new MutationObserver((recs) => {
        for (const r of recs) {
          r.addedNodes.forEach(add);
          r.removedNodes.forEach((n) => {
            const c = copies.get(n);
            if (c) c.parentNode?.removeChild(c);
            copies.delete(n);
          });
          // Un <style> que cambia por dentro.
          const host = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
          const style = host?.closest("style");
          if (style && copies.has(style)) (copies.get(style) as HTMLElement).textContent = style.textContent;
        }
      });
      heads.observe(document.head, { childList: true, subtree: true, characterData: true });
      // Las letras van en las clases de <html> (next/font).
      const syncRoot = () => {
        doc.documentElement.className = document.documentElement.className;
        doc.documentElement.lang = document.documentElement.lang;
        doc.body.className = document.body.className;
      };
      syncRoot();
      const roots = new MutationObserver(syncRoot);
      roots.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "lang"] });
      roots.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      doc.documentElement.style.background = "#000";
      doc.body.style.margin = "0";
      doc.body.style.background = "#000";
      const root = doc.createElement("div");
      doc.body.appendChild(root);
      setMount(root);
      // Deshacerlo todo (al salir, o si React lo monta dos veces en desarrollo).
      stop = () => {
        heads.disconnect();
        roots.disconnect();
        copies.forEach((c) => c.parentNode?.removeChild(c));
        copies.clear();
        root.remove();
        delete doc.body.dataset.ready;
        stop = () => {};
      };
    };
    setup();
    iframe.addEventListener("load", setup);
    return () => {
      iframe.removeEventListener("load", setup);
      stop();
      setMount(null);
    };
  }, []);

  // Como ordenador, la web llena la pantalla bajo las pestañas del panel: su cabecera baja hasta debajo de ellas.
  useEffect(() => {
    mount?.ownerDocument.documentElement.toggleAttribute("data-under-tabs", device === "pc");
  }, [mount, device]);

  return (
    <DeviceBox device={device}>
      <iframe ref={frame} srcDoc={SKELETON} title="Tu web" className="block h-full w-full border-0 bg-black" />
      {mount && createPortal(children, mount)}
    </DeviceBox>
  );
}

/** El marco: toda la pantalla (ordenador) o un móvil en medio, entre las pestañas de arriba y las de abajo. */
export function DeviceBox({ device, children }: { device: Device; children: ReactNode }) {
  const phone = device === "movil";
  return (
    <div className={`flex h-full w-full justify-center ${phone ? "sm:items-center sm:px-5 sm:pb-14 sm:pt-[4.5rem]" : ""}`}>
      <div
        className={
          phone
            ? "h-full w-full overflow-hidden bg-black sm:max-h-[880px] sm:w-[400px] sm:max-w-full sm:rounded-[2.6rem] sm:border-[10px] sm:border-[#1b1834] sm:shadow-[0_40px_90px_-40px_rgb(0_0_0/.95)] sm:ring-1 sm:ring-white/10"
            : "h-full w-full"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Ordenador o móvil (en la pantalla de un móvil no hace falta: ya se ve como en el móvil). */
export function DeviceToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  const opt = (d: Device, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      role="radio"
      aria-checked={device === d}
      aria-label={label}
      title={label}
      onClick={() => onChange(d)}
      className="panel-nav-link grid h-9 w-9 place-items-center rounded-full"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Cómo se ve" className="hidden shrink-0 items-center gap-0.5 md:inline-flex">
      {opt("pc", "Ordenador", Monitor)}
      {opt("movil", "Móvil", Smartphone)}
    </div>
  );
}

/** Ordenador o móvil, recordado en este navegador (en pantallas pequeñas, siempre como se ve en ella). */
export function useDevice(): [Device, (d: Device) => void] {
  const [device, setDevice] = useState<Device>("pc");
  useEffect(() => {
    try {
      if (window.localStorage.getItem("canva-device") === "movil" && window.matchMedia("(min-width: 48rem)").matches) setDevice("movil");
    } catch {}
  }, []);
  const change = (d: Device) => {
    setDevice(d);
    try {
      window.localStorage.setItem("canva-device", d);
    } catch {}
  };
  return [device, change];
}
