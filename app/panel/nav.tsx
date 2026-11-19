"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PanelNavPrefs } from "@/lib/panel-prefs";
import { mobileNavFor, panelNavFor, PANEL_NAV, PLATFORM_NAV_FLAGS, withGroupTitles, type PanelNavFlags, type PanelNavItem } from "./nav-items";

export { PANEL_NAV };

// Por tramos: «/panel/pagina» no se marca en «/panel/paginas».
const isActive = (path: string, href: string) => (href === "/panel" ? path === "/panel" : path === href || path.startsWith(`${href}/`));

/** El número de una sección (las solicitudes por contestar): rojo, para que se vea en cualquier diseño. */
export function NavBadge({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-grid h-5 min-w-5 place-items-center rounded-full bg-[#B4473C] px-1.5 text-[0.68rem] font-bold leading-none text-white ${className}`} aria-label={`${n} por contestar`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Barra lateral: con el orden de siempre, por bloques (Mi web, Lo que ofreces, Personas, Datos y modelos). Los
 * colores salen de las variables del panel (--panel-*, Ajustes › Diseño de mi panel): sin diseño, los de
 * siempre (globals.css, .panel-nav-link).
 */
export function SideNav({ flags = PLATFORM_NAV_FLAGS, nav = null }: { flags?: PanelNavFlags; nav?: PanelNavPrefs | null }) {
  const path = usePathname();
  const items = withGroupTitles(panelNavFor(flags, nav), !!nav);
  return (
    <nav className="space-y-0.5">
      {items.map((i) => (
        <div key={i.href}>
          {i.title && <p className="px-3 pb-1 pt-4 text-[0.66rem] font-semibold uppercase tracking-[0.14em] opacity-55">{i.title}</p>}
          <NavLink item={i} active={isActive(path, i.href)} badge={flags.badges?.[i.href]} />
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, active, badge }: { item: PanelNavItem; active: boolean; badge?: number }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`panel-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition`}
    >
      <item.icon className="h-4 w-4" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {!!badge && <NavBadge n={badge} />}
    </Link>
  );
}

/** La barra de abajo del móvil: 4 secciones y «Más» (que lleva el número de lo que no está a la vista). */
export function BottomNav({ flags = PLATFORM_NAV_FLAGS, nav = null }: { flags?: PanelNavFlags; nav?: PanelNavPrefs | null }) {
  const path = usePathname();
  const items = mobileNavFor(flags, nav);
  const moreActive = !items.slice(0, 4).some((m) => isActive(path, m.href));
  const shown = new Set(items.slice(0, 4).map((i) => i.href));
  const hiddenBadges = Object.entries(flags.badges ?? {}).reduce((a, [href, n]) => (shown.has(href) ? a : a + n), 0);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map((i) => {
          const active = i.href === "/panel/mas" ? moreActive : isActive(path, i.href);
          const badge = i.href === "/panel/mas" ? hiddenBadges : flags.badges?.[i.href];
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 py-2.5 text-[0.68rem] ${active ? "text-ink" : "text-faint"}`}
              // Con un acento propio, una rayita de su color encima de la sección activa.
              style={active ? { boxShadow: "inset 0 2px 0 var(--panel-accent, transparent)" } : undefined}
            >
              <span className="relative">
                <i.icon className={`h-5 w-5 ${active ? "" : "opacity-80"}`} strokeWidth={active ? 2.2 : 1.8} />
                {!!badge && <NavBadge n={badge} className="absolute -right-3 -top-2" />}
              </span>
              <span className="max-w-full truncate px-0.5">{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
