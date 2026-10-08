import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Store } from "lucide-react";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { AccountNav } from "./nav";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/cuenta");
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <Logo href="/cuenta" />
          <div className="flex items-center gap-1">
            {user.creator && (
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
        <div className="mx-auto max-w-4xl px-5 pb-2.5">
          <AccountNav />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8 animate-fade-in">{children}</main>
    </div>
  );
}
