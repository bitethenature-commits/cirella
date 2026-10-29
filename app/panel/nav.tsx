"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PanelNavPrefs } from "@/lib/panel-prefs";
import { mobileNavFor, panelNavFor, PANEL_NAV, PLATFORM_NAV_FLAGS, type PanelNavFlags } from "./nav-items";

export { PANEL_NAV };

// Por tramos: «/panel/pagina» no se marca en «/panel/paginas».
const isActive = (path: string, href: string) => (href === "/panel" ? path === "/panel" : path === href || path.startsWith(`${href}/`));

/**
 * Barra lateral. Los colores salen de las variables del panel (--panel-*, «Personalizar mi panel»):
 * sin preferencias, los de siempre (globals.css, .panel-nav-link).
 */
export function SideNav({ flags = PLATFORM_NAV_FLAGS, nav = null }: { flags?: PanelNavFlags; nav?: PanelNavPrefs | null }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {panelNavFor(flags, nav).map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={isActive(path, i.href) ? "page" : undefined}
          className="panel-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition"
        >
          <i.icon className="h-4 w-4" />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ flags = PLATFORM_NAV_FLAGS, nav = null }: { flags?: PanelNavFlags; nav?: PanelNavPrefs | null }) {
  const path = usePathname();
  const items = mobileNavFor(flags, nav);
  const moreActive = !items.slice(0, 4).some((m) => isActive(path, m.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map((i) => {
          const active = i.href === "/panel/mas" ? moreActive : isActive(path, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 py-2.5 text-[0.68rem] ${active ? "text-ink" : "text-faint"}`}
              // Con un acento propio, una rayita de su color encima de la sección activa.
              style={active ? { boxShadow: "inset 0 2px 0 var(--panel-accent, transparent)" } : undefined}
            >
              <i.icon className={`h-5 w-5 ${active ? "" : "opacity-80"}`} strokeWidth={active ? 2.2 : 1.8} />
              <span className="max-w-full truncate px-0.5">{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
