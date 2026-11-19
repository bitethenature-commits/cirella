"use client";
import { Paintbrush } from "lucide-react";
import { useEffect, useState } from "react";
import { hasHintCookie } from "@/lib/auth-utils";
import { LIVE_DESIGN_PARAM } from "./live-design";

/**
 * «Canva», abajo a la derecha de la web: solo lo ve la dueña con su sesión abierta. Lleva al modo Canva
 * (app/panel/canva) de la página en la que está: la portada o una página extra. La página pública sigue en
 * caché: se pregunta en el navegador (y solo si hay sesión, por la cookie de pista).
 */
export function CanvaButton({ username, personal }: { username: string; personal: boolean }) {
  const [owner, setOwner] = useState(false);
  const [href, setHref] = useState("/panel/canva");
  useEffect(() => {
    // Ni en la vista en vivo del editor de Diseño.
    if (!hasHintCookie(document.cookie) || new URLSearchParams(window.location.search).has(LIVE_DESIGN_PARAM)) return;
    let alive = true;
    fetch(`/api/canva?u=${encodeURIComponent(username)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { owner: false }))
      .then((d: { owner?: boolean }) => alive && setOwner(!!d.owner))
      .catch(() => {});
    // Una página extra: /<usuaria>/p/<dirección> o, en la web personal, /<dirección>.
    const seg = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const slug = seg[1] === "p" && seg[2] ? seg[2] : personal && seg.length === 1 && seg[0] !== username ? seg[0] : null;
    if (slug) setHref(`/panel/canva?pagina=${encodeURIComponent(slug)}`);
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
      <Paintbrush className="h-4 w-4" /> Canva
    </a>
  );
}
