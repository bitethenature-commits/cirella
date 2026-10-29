import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { readPanelPrefs } from "@/lib/panel-prefs";
import { panelNavFor } from "../nav-items";
import { panelNavFlags } from "../nav-flags";

export default async function MorePage() {
  const { creator, user } = await requireCreator();
  const flags = await panelNavFlags(creator.id);
  return (
    <div>
      <h1 className="display text-[2.4rem]">Más</h1>
      <div className="card mt-6 divide-y divide-line">
        {panelNavFor(flags, readPanelPrefs(creator.panelPrefs).nav).map((i) => (
          <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-3.5 text-sm">
            <i.icon className="h-4 w-4 text-muted" />
            <span className="flex-1 font-medium">{i.label}</span>
            <ChevronRight className="h-4 w-4 text-faint" />
          </Link>
        ))}
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
