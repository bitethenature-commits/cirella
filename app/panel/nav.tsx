"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNav, panelNav, PANEL_NAV, PLATFORM_NAV_FLAGS, type PanelNavFlags } from "./nav-items";

export { PANEL_NAV };

const isActive = (path: string, href: string) => (href === "/panel" ? path === "/panel" : path.startsWith(href));

export function SideNav({ flags = PLATFORM_NAV_FLAGS }: { flags?: PanelNavFlags }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {panelNav(flags).map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            isActive(path, i.href) ? "bg-ink text-cream" : "text-ink/75 hover:bg-sand hover:text-ink"
          }`}
        >
          <i.icon className="h-4 w-4" />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ flags = PLATFORM_NAV_FLAGS }: { flags?: PanelNavFlags }) {
  const path = usePathname();
  const items = mobileNav(flags);
  const moreActive = !items.slice(0, 4).some((m) => isActive(path, m.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map((i) => {
          const active = i.href === "/panel/mas" ? moreActive : isActive(path, i.href);
          return (
            <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-1 py-2.5 text-[0.68rem] ${active ? "text-ink" : "text-faint"}`}>
              <i.icon className={`h-5 w-5 ${active ? "" : "opacity-80"}`} strokeWidth={active ? 2.2 : 1.8} />
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
