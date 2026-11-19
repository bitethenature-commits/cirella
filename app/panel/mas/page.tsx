import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { readPanelPrefs } from "@/lib/panel-prefs";
import { NavBadge } from "../nav";
import { NAV_GROUPS, panelNavFor, type NavGroup, type PanelNavItem } from "../nav-items";
import { panelNavFlags } from "../nav-flags";
import { PageHeader } from "../ui";

/** Todas las secciones del panel (móvil): con el orden de siempre, por bloques; con el suyo, en su orden. */
export default async function MorePage() {
  const { creator, user } = await requireCreator();
  const flags = await panelNavFlags(creator.id);
  const nav = readPanelPrefs(creator.panelPrefs).nav;
  const items = panelNavFor(flags, nav);
  // Bloques seguidos: [título, secciones]. Sin título, las sueltas (Inicio, Ajustes…) o todas con su propio orden.
  const blocks: [string | null, PanelNavItem[]][] = [];
  for (const i of items) {
    const title = nav ? null : i.group ? NAV_GROUPS[i.group as NavGroup] : null;
    const last = blocks[blocks.length - 1];
    if (last && last[0] === title) last[1].push(i);
    else blocks.push([title, [i]]);
  }
  return (
    <div>
      <PageHeader title="Más" subtitle="Todas las secciones de tu panel." />
      <div className="space-y-6">
        {blocks.map(([title, list], k) => (
          <section key={k}>
            {title && <h2 className="eyebrow mb-3">{title}</h2>}
            <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
              {list.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="flex flex-col items-center gap-2 text-center">
                    <span className="panel-emblem relative h-16 w-16">
                      <i.icon className="h-7 w-7" strokeWidth={1.5} />
                      {!!flags.badges?.[i.href] && <NavBadge n={flags.badges[i.href]} className="absolute -right-1 -top-1" />}
                    </span>
                    <span className="text-[0.78rem] font-semibold leading-tight">{i.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="card mt-7 divide-y divide-line">
        {flags.personal ? (
          user.isAdmin && (
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3.5 text-sm">
              <span className="flex-1 font-medium">Administración</span>
              <ChevronRight className="h-4 w-4 text-faint" />
            </Link>
          )
        ) : (
          <Link href="/cuenta" className="flex items-center gap-3 px-4 py-3.5 text-sm">
            <span className="flex-1 font-medium">Mis compras como clienta</span>
            <ChevronRight className="h-4 w-4 text-faint" />
          </Link>
        )}
      </div>
      <form action="/auth/salir" method="post" className="mt-4">
        <button className="btn btn-outline w-full"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
      </form>
    </div>
  );
}
