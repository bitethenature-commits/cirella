"use client";
import { Paintbrush } from "lucide-react";
import { useEffect, useState } from "react";
import { hasHintCookie } from "@/lib/auth-utils";
import { asSectionPage } from "@/lib/site-sections";
import { LIVE_DESIGN_PARAM } from "./live-design";

/**
 * «Diseñar», abajo a la derecha de la web: solo lo ve la dueña con su sesión abierta. Lleva al editor
 * (Mi página, app/panel/pagina) de la página en la que está: la portada, una suya, una de las que se crean solas o la legal. La página pública sigue en
 * caché: se pregunta en el navegador (y solo si hay sesión, por la cookie de pista).
 */
export function CanvaButton({ username, personal }: { username: string; personal: boolean }) {
  const [owner, setOwner] = useState(false);
  const [href, setHref] = useState("/panel/pagina");
  useEffect(() => {
    // Ni en la vista en vivo del editor de Diseño.
    if (!hasHintCookie(document.cookie) || new URLSearchParams(window.location.search).has(LIVE_DESIGN_PARAM)) return;
    let alive = true;
    fetch(`/api/canva?u=${encodeURIComponent(username)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { owner: false }))
      .then((d: { owner?: boolean }) => alive && setOwner(!!d.owner))
      .catch(() => {});
    // Una página suya: /<usuaria>/p/<dirección> o, en la web personal, /<dirección>; una de las que se crean solas:
    // /<usuaria>/courses (o /courses), con su nombre interno (cursos); la legal: /<usuaria>/legal (o /legal).
    const seg = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const rest = personal ? seg : seg[0] === username ? seg.slice(1) : [];
    const section = rest.length === 1 ? asSectionPage(rest[0]) : null;
    const slug =
      rest[0] === "p" && rest[1]
        ? rest[1]
        : rest.length === 1 && rest[0] === "legal"
          ? "aviso-legal"
          : section
            ? section
            : personal && rest.length === 1
              ? rest[0]
              : null;
    if (slug) setHref(`/panel/pagina?pagina=${encodeURIComponent(slug)}`);
    return () => {
      alive = false;
    };
  }, [username, personal]);
  if (!owner) return null;
  return (
    <a
      href={href}
      className="fixed bottom-[max(env(safe-area-inset-bottom),1.25rem)] right-5 z-[70] inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-[0_12px_30px_-10px_rgb(0_0_0/.55)] transition hover:-translate-y-0.5"
      style={{ background: "linear-gradient(115deg, #f6e7bf 0%, #e3c27f 45%, #c49a52 100%)", color: "#1d1838" }}
      data-canva-button
    >
      <Paintbrush className="h-4 w-4" /> Diseñar
    </a>
  );
}
