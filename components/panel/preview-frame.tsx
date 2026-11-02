"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BLANK = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';

/**
 * Pinta `children` dentro de un <iframe> del mismo origen (con un portal de React, sin ninguna
 * petición): la página se ve con el ancho del marco, así que sus `md:`/`sm:` y su barra fija de
 * compra se comportan como en un teléfono de verdad, y nada se mezcla con el panel. Copia los estilos
 * y las fuentes del panel al montar. El contenido es `inert`: se puede desplazar, pero no pulsar ni
 * enfocar (ni un enlace navega ni un formulario se envía).
 */
export function PreviewFrame({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body || doc.URL !== "about:srcdoc") return;
      if (doc.documentElement.dataset.ready) return setRoot(doc.body);
      doc.documentElement.dataset.ready = "1";
      doc.documentElement.className = document.documentElement.className;
      for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) doc.head.appendChild(node.cloneNode(true));
      const own = doc.createElement("style");
      own.textContent = "html{scrollbar-width:none}html::-webkit-scrollbar{display:none}body{background:transparent}";
      doc.head.appendChild(own);
      setRoot(doc.body);
    };
    setup();
    iframe.addEventListener("load", setup);
    return () => iframe.removeEventListener("load", setup);
  }, []);

  return (
    <>
      <iframe ref={ref} title={title} srcDoc={BLANK} tabIndex={-1} className={className} />
      {root &&
        createPortal(
          <div inert data-preview-root>
            {children}
          </div>,
          root,
        )}
    </>
  );
}
