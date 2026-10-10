import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Store } from "lucide-react";
import { Logo } from "@/components/logo";
import { getBuyerSession } from "@/lib/buyer-access";
import { AccountNav } from "./nav";
import { ScopeBanner } from "./scope-banner";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

/**
 * El layout no redirige: cada página aplica su guarda (lib/buyer-access.ts) con su ruta exacta,
 * para que el login lleve la marca de la creadora y vuelva al mismo sitio.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const b = await getBuyerSession();
  return (
    <div className="min-h-dvh bg-paper">
      {b && (
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
            <Logo href="/cuenta" />
            <div className="flex items-center gap-1">
              {!b.scope && b.user.creator && (
                <Link href="/panel" className="btn btn-ghost btn-sm" title="Ir a mi panel de creadora">
                  <Store className="h-4 w-4" /> <span className="hidden sm:inline">Mi panel</span>
                </Link>
              )}
              <form action="/auth/salir" method="post">
                <button className="btn btn-ghost btn-sm" aria-label="Cerrar sesión">
                  <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Salir</span>
                </button>
              </form>
            </div>
          </div>
          <div className="mx-auto max-w-4xl px-5 pb-2.5">{b.scope ? <ScopeBanner creatorId={b.creatorId} /> : <AccountNav />}</div>
        </header>
      )}
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8 animate-fade-in">{children}</main>
    </div>
  );
}
