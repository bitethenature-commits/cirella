import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/home";
import { isPersonalMode } from "@/lib/site-mode";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Crea tu página · Cirella" };

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ ref?: string; username?: string; plan?: string }> }) {
  // Modo personal: la web es de una sola dueña; nadie más crea páginas aquí.
  if (isPersonalMode()) redirect("/entrar");
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    // Una clienta con sesión (p. ej. tras comprar) que quiere crear su página: continúa al
    // onboarding conservando el código de referido y el plan elegido.
    if (!user.creator && !user.isAdmin) {
      const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
      redirect(`/auth/crear-pagina${q.size ? `?${q}` : ""}`);
    }
    redirect(await homeFor(user.id));
  }
  return (
    <>
      <p className="eyebrow">Paso 1 de 10</p>
      <h1 className="display mt-2 text-[2.6rem]">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-muted">En 5 minutos tendrás tu página lista para compartir en tu bio.</p>
      {sp.ref && <p className="mt-4 rounded-xl bg-sand px-3 py-2 text-xs text-ink">✦ Te ha invitado una creadora: tu código <strong>{sp.ref.toUpperCase()}</strong> queda aplicado.</p>}
      <div className="mt-8">
        <SignupForm refCode={sp.ref} username={sp.username} plan={sp.plan} />
      </div>
    </>
  );
}
