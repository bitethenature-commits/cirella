import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flash } from "@/components/ui/flash";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Crea tu contraseña · Cirella", robots: { index: false } };

export default async function CreatePasswordPage({ searchParams }: { searchParams: Promise<{ next?: string; motivo?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user?.sessionVerified) redirect("/entrar?motivo=confirmar");
  const next = safeNext(sp.next, "");
  return (
    <>
      <h1 className="display text-[2.6rem]">Crea tu contraseña</h1>
      <p className="mt-2 text-sm text-muted">Así podrás entrar con tu email y contraseña. También puedes seguir entrando con un enlace por email.</p>
      <div className="mt-8">
        {sp.motivo === "seguridad" && (
          <Flash error="Por seguridad hemos borrado la contraseña anterior de esta cuenta: se creó antes de confirmar el email. Crea una nueva." />
        )}
        <PasswordForm next={next} email={user.email} />
      </div>
    </>
  );
}
