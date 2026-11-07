"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/cuenta/cursos", label: "Mis cursos" },
  { href: "/cuenta/sesiones", label: "Mis sesiones" },
  { href: "/cuenta/membresias", label: "Mis membresías" },
  { href: "/cuenta/compras", label: "Mis compras" },
  { href: "/cuenta/archivos", label: "Mis archivos" },
  { href: "/cuenta/perfil", label: "Mi perfil" },
  { href: "/cuenta/soporte", label: "Soporte" },
];

/** «Mi energía» (/cuenta/mi-energia): solo en la web personal, detrás de «Mis cursos» (el área ya no tiene «Inicio»: empieza ahí). */
const ENERGY = { href: "/cuenta/mi-energia", label: "Mi energía" };

/** `personal`: web personal (SITE_MODE=personal): está «Mi energía» y no «Mis compras» (su ticket va en «Soporte»). */
export function AccountNav({ personal = false }: { personal?: boolean } = {}) {
  const path = usePathname();
  // Web personal: sin «Mis compras» (lo que ha conseguido está en su ticket, en «Soporte»).
  const items = personal ? [ITEMS[0], ENERGY, ...ITEMS.slice(1).filter((i) => i.href !== "/cuenta/compras")] : ITEMS;
  return (
    <nav className="-mx-5 flex gap-1 overflow-x-auto px-5 scrollbar-none" aria-label="Área de cliente">
      {items.map((i) => {
        const active = i.href === "/cuenta" ? path === "/cuenta" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`relative shrink-0 rounded-full px-3.5 py-2 text-sm transition ${active ? "bg-ink text-cream" : "text-muted hover:bg-sand hover:text-ink"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
