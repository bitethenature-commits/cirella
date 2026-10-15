import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { requireAdmin } from "@/lib/auth";
import { isPersonalMode } from "@/lib/site-mode";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const personal = isPersonalMode();
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="bg-ink px-4 pb-3 pt-4 text-cream lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <BrandLogo href="/admin" light />
          <span className="rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-semibold text-ink lg:mt-3 lg:inline-block">{personal ? "ADMINISTRACIÓN" : "SUPERADMIN"}</span>
        </div>
        <div className="mt-4 lg:mt-8 lg:flex-1">
          <AdminNav personal={personal} />
        </div>
        <form action="/auth/salir" method="post" className="hidden lg:block">
          <p className="mb-2 truncate px-3 text-xs text-cream/50">{admin.email}</p>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-cream/70 hover:bg-white/10"><LogOut className="h-4 w-4" /> Salir</button>
        </form>
      </aside>
      <main className="min-w-0 px-4 pb-16 pt-6 sm:px-8 lg:pt-10">{children}</main>
    </div>
  );
}
