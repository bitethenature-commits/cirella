"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_NAV = [
  ["/admin", "Resumen"],
  ["/admin/creadoras", "Creadoras"],
  ["/admin/clientes", "Clientes"],
  ["/admin/ventas", "Ventas"],
  ["/admin/transacciones", "Transacciones"],
  ["/admin/envios", "Envíos fallidos"],
  ["/admin/suscripciones", "Suscripciones"],
  ["/admin/productos", "Productos"],
  ["/admin/planes", "Planes"],
  ["/admin/categorias", "Categorías"],
  ["/admin/disenos", "Diseños"],
  ["/admin/bloqueados", "Bloqueados"],
  ["/admin/reportes", "Reportes"],
  ["/admin/ajustes", "Ajustes"],
  ["/admin/seguridad", "Seguridad"],
] as const;

/** Modo personal: solo lo que necesita una persona (envíos que fallaron y ajustes de la web). */
export const PERSONAL_ADMIN_NAV = [
  ["/admin", "Resumen"],
  ["/admin/envios", "Envíos fallidos"],
  ["/admin/ajustes", "Ajustes"],
  ["/admin/seguridad", "Seguridad"],
  ["/panel", "Mi panel"],
] as const;

export function AdminNav({ personal = false }: { personal?: boolean }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:px-0">
      {(personal ? PERSONAL_ADMIN_NAV : ADMIN_NAV).map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-cream text-ink" : "text-cream/70 hover:bg-white/10 hover:text-cream"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
