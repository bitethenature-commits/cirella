"use client";
import Link from "next/link";
import { Heart, MessageCircle, Settings, Sparkles, Star } from "lucide-react";
import type { ReactNode } from "react";
import { EnergyIcon } from "@/components/creator-page/energy-icon";
import { LibroMagicoIcon, LunaIcon, NivelIcon } from "./icons";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/cuenta/cursos", label: "Mis cursos" },
  { href: "/cuenta/sesiones", label: "Mis sesiones" },
  { href: "/cuenta/membresias", label: "Mis membresías" },
  { href: "/cuenta/compras", label: "Mis compras" },
];

/** «Mi energía» (/cuenta/mi-energia): solo en la web personal, detrás de «Mis cursos» (el área ya no tiene «Inicio»: empieza ahí). */
const ENERGY = { href: "/cuenta/mi-energia", label: "Mi energía" };

/** `personal`: web personal (SITE_MODE=personal): está «Mi energía» y no «Mis compras» (su ticket va en «Soporte»). */
/** `tier`: su nivel de membresía (0 = I) para el sólido de «Mis membresías»; sin membresía, unas chispas. */
export function AccountNav({ personal = false, unseen = 0, tier = null }: { personal?: boolean; unseen?: number; tier?: number | null } = {}) {
  const ico = "h-[1.05rem] w-[1.05rem] shrink-0";
  const ICONS: Record<string, ReactNode> = {
    "/cuenta/cursos": <LibroMagicoIcon className={ico} />,
    "/cuenta/mi-energia": <EnergyIcon className={ico} strokeWidth={1.4} />,
    "/cuenta/sesiones": <LunaIcon className={ico} />,
    "/cuenta/membresias": tier != null && tier >= 0 ? <NivelIcon level={tier} className={ico} /> : <Sparkles className={ico} strokeWidth={1.5} />,
  };
  const path = usePathname();
  // «Mis archivos» ya no es una palabra: una estrella (Favoritos) y un chat (Comentarios, con sus avisos).
  const files = path.startsWith("/cuenta/archivos");
  // Web personal: sin «Mis compras» (lo que ha conseguido está en su ticket, en «Soporte»).
  const items = personal
    ? [ITEMS[0], ENERGY, ...ITEMS.slice(1).filter((i) => i.href !== "/cuenta/compras").map((i) => (i.href === "/cuenta/sesiones" ? { ...i, label: "Círculos y lecturas" } : i))]
    : ITEMS;
  return (
    <nav className="-mx-5 flex gap-1 overflow-x-auto px-5 scrollbar-none" aria-label="Área de cliente">
      {items.map((i) => {
        const active = i.href === "/cuenta" ? path === "/cuenta" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className="acc-tab inline-flex items-center gap-1.5" data-active={active ? "true" : undefined}>
            {ICONS[i.href] && <span aria-hidden className="acc-tab-ico">{ICONS[i.href]}</span>}
            {i.label}
          </Link>
        );
      })}
      <span aria-hidden className="acc-tab-sep" />
      <Link href="/cuenta/archivos?abrir=favoritos" className="acc-tab acc-tab-icon" data-active={files ? "true" : undefined} aria-label="Favoritos" title="Favoritos">
        <Star className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} />
      </Link>
      <Link href="/cuenta/archivos?abrir=me-gusta" className="acc-tab acc-tab-icon" data-active={files ? "true" : undefined} aria-label="Me gusta" title="Me gusta">
        <Heart className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} />
      </Link>
      <Link href="/cuenta/archivos?abrir=comentarios" className="acc-tab acc-tab-icon" data-active={files ? "true" : undefined} aria-label={unseen ? `Comentarios: ${unseen} avisos nuevos` : "Comentarios"} title="Comentarios">
        <MessageCircle className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} />
        {unseen > 0 && <span className="acc-badge">{unseen > 99 ? "99+" : unseen}</span>}
      </Link>
      {/* «Soporte»: un icono de ajustes. */}
      <Link href="/cuenta/soporte" className="acc-tab acc-tab-icon" data-active={path.startsWith("/cuenta/soporte") ? "true" : undefined} aria-label="Soporte" title="Soporte">
        <Settings className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} />
      </Link>
    </nav>
  );
}
