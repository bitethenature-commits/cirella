import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/creator-page/product-art";
import { CopyButton } from "@/components/ui/copy-button";
import { requireCreator } from "@/lib/auth";
import { appHost, appUrl } from "@/lib/env";
import { readPageConfig } from "@/lib/page-config";
import { BottomNav, SideNav } from "./nav";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { creator } = await requireCreator();
  const cfg = readPageConfig(creator.pageDraft, creator.displayName);
  const url = `${appUrl()}/${creator.username}`;
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-cream/40 px-4 py-5 lg:flex">
        <Logo href="/panel" />
        <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-line bg-white p-2.5" style={{ ["--c-accent" as string]: "#0E1024", ["--c-accent-text" as string]: "#F6F1E7" }}>
          <Avatar src={cfg.avatarUrl} name={cfg.displayName} className="h-9 w-9 text-xs" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{cfg.displayName}</p>
            <p className="truncate text-xs text-muted">Plan {creator.plan.name}</p>
          </div>
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">
          <SideNav />
        </div>
        <form action="/auth/salir" method="post">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-sand hover:text-ink">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="lg:hidden">
              <Logo href="/panel" />
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
              <span className={`h-2 w-2 rounded-full ${creator.published ? "bg-success" : "bg-gold"}`} />
              <span className="text-muted">{creator.published ? "Publicada en" : "Borrador ·"}</span>
              <span className="truncate font-medium">{appHost()}/{creator.username}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CopyButton text={url} label="Copiar enlace" className="btn btn-outline btn-sm hidden sm:inline-flex" />
              <Link href={`/${creator.username}`} target="_blank" className="btn btn-primary btn-sm">
                <ExternalLink className="h-3.5 w-3.5" /> Ver página
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16 lg:pt-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
