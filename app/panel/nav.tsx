"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";
import type { PanelNavPrefs } from "@/lib/panel-prefs";
import { mobileNavFor, NAV_FOLDERS, panelNavFor, PANEL_NAV, PLATFORM_NAV_FLAGS, type PanelNavFlags, type PanelNavItem } from "./nav-items";

export { PANEL_NAV };

// Por tramos: «/panel/pagina» no se marca en «/panel/paginas».
const isActive = (path: string, href: string) => (href === "/panel" ? path === "/panel" : path === href || path.startsWith(`${href}/`));

/**
 * Barra lateral. Los colores salen de las variables del panel (--panel-*, «Personalizar mi panel»):
 * sin preferencias, los de siempre (globals.css, .panel-nav-link).
 */
export function SideNav({ flags = PLATFORM_NAV_FLAGS, nav = null }: { flags?: PanelNavFlags; nav?: PanelNavPrefs | null }) {
  const path = usePathname();
  const items = panelNavFor(flags, nav);
  // Las carpetas, en el sitio de su primera sección; sus secciones ya no salen sueltas.
  const rows: ({ kind: "item"; item: PanelNavItem } | { kind: "folder"; key: string; label: string; items: PanelNavItem[] })[] = [];
  const done = new Set<string>();
  for (const i of items) {
    const folder = NAV_FOLDERS.find((f) => f.hrefs.includes(i.href));
    if (!folder) {
      rows.push({ kind: "item", item: i });
      continue;
    }
    if (done.has(folder.key)) continue;
    done.add(folder.key);
    const inside = folder.hrefs.flatMap((h) => items.filter((x) => x.href === h));
    // Una carpeta con una sola sección no hace falta.
    if (inside.length < 2) inside.forEach((x) => rows.push({ kind: "item", item: x }));
    else rows.push({ kind: "folder", key: folder.key, label: folder.label, items: inside });
  }
  return (
    <nav className="space-y-0.5">
      {rows.map((r) =>
        r.kind === "item" ? (
          <NavLink key={r.item.href} item={r.item} active={isActive(path, r.item.href)} />
        ) : (
          <NavFolder key={r.key} label={r.label} items={r.items} path={path} />
        ),
      )}
    </nav>
  );
}

function NavLink({ item, active, nested = false }: { item: PanelNavItem; active: boolean; nested?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`panel-nav-link flex items-center gap-3 rounded-xl px-3 text-sm transition ${nested ? "py-2" : "py-2.5"}`}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

/** Una carpeta del menú: se abre y se cierra; abierta si estás en una de sus secciones. */
function NavFolder({ label, items, path }: { label: string; items: PanelNavItem[]; path: string }) {
  const inside = items.some((i) => isActive(path, i.href));
  const [open, setOpen] = useState(inside);
  // Al entrar en una de sus secciones (desde otra parte del menú), se abre sola.
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  const shown = open;
  const Icon = shown ? FolderOpen : Folder;
  return (
    <div data-nav-folder>
      <button
        type="button"
        onClick={() => setOpen(!shown)}
        aria-expanded={shown}
        className="panel-nav-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition"
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${shown ? "rotate-180" : ""}`} />
      </button>
      {shown && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-line pl-2">
          {items.map((i) => (
            <NavLink key={i.href} item={i} active={isActive(path, i.href)} nested />
          ))}
        </div>
      )}
    </div>
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
