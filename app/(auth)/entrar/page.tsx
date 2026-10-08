import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { homeFor } from "@/lib/home";
import { demoSignIn } from "../actions";
import { LoginForms } from "./login-forms";

export const metadata: Metadata = { title: "Entrar · Cirella" };

const ERRORS: Record<string, string> = {
  enlace: "El enlace ha caducado o ya se usó. Pide uno nuevo.",
  bloqueada: "Tu cuenta está bloqueada. Escríbenos si crees que es un error.",
};

const DEMO = [
  { email: "ana@cirella.app", label: "Ana Luna", role: "Creadora · plan Pro" },
  { email: "laura@example.com", label: "Laura Martín", role: "Clienta de Ana" },
  { email: "admin@cirella.app", label: "Superadmin", role: "Plataforma" },
];

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user && !sp.error) redirect(sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : await homeFor(user.id));
  const demo = isDemoMode();
  return (
    <>
      <h1 className="display text-[2.6rem]">Hola de nuevo</h1>
      <p className="mt-2 text-sm text-muted">Entra a tu panel o a tu área de cliente.</p>
      <div className="mt-8">
        <LoginForms next={sp.next} demo={demo} initialError={sp.error ? ERRORS[sp.error] : undefined} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Aún no tienes página?{" "}
        <Link href="/registro" className="font-semibold text-ink underline-offset-2 hover:underline">Créala gratis</Link>
      </p>
      {demo && (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-white/60 p-4">
          <p className="eyebrow">Accesos de demostración</p>
          <div className="mt-3 grid gap-2">
            {DEMO.map((d) => (
              <form key={d.email} action={demoSignIn}>
                <input type="hidden" name="email" value={d.email} />
                <button className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5 text-left text-sm transition hover:border-ink/30">
                  <span>
                    <span className="font-semibold">{d.label}</span>
                    <span className="block text-xs text-muted">{d.role}</span>
                  </span>
                  <span className="text-xs text-muted">Entrar →</span>
                </button>
              </form>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Contraseña de todas las cuentas: <code className="rounded bg-sand px-1">demo1234</code></p>
        </div>
      )}
    </>
  );
}
