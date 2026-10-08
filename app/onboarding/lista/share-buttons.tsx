"use client";
import { useState } from "react";
import { SocialIcon } from "@/components/social-icons";

export function ShareButtons({ url, name }: { url: string; name: string }) {
  const [igHelp, setIgHelp] = useState(false);
  const text = `Ya tengo mi espacio: lecturas, sesiones y más ✨ ${url}`;
  const shareInstagram = async () => {
    // Instagram no permite compartir enlaces por URL: usamos la hoja nativa
    // del móvil o copiamos el enlace y explicamos cómo ponerlo en la bio.
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setIgHelp(true);
  };
  const btn = "flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-2 py-3.5 text-xs transition hover:bg-white/10";
  return (
    <div className="mt-6">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={shareInstagram} className={btn}>
          <SocialIcon name="instagram" className="h-5 w-5" /> Instagram
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={btn}>
          <SocialIcon name="whatsapp" className="h-5 w-5" /> WhatsApp
        </a>
        <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Ya tengo mi espacio ✨")}`} target="_blank" rel="noopener noreferrer" className={btn}>
          <SocialIcon name="telegram" className="h-5 w-5" /> Telegram
        </a>
      </div>
      {igHelp && (
        <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-left text-xs leading-relaxed text-cream/80">
          ✓ Enlace copiado. En Instagram ve a <strong>Editar perfil → Enlaces → Añadir enlace externo</strong> y pégalo. También puedes añadirlo como sticker de enlace en una historia.
        </p>
      )}
    </div>
  );
}
