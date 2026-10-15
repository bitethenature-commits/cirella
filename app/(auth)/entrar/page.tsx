import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/auth";
import { isBuyerPath, sessionSatisfies } from "@/lib/auth-utils";
import { buyerLoginPath, type LoginMotivo } from "@/lib/buyer-access";
import { isDemoMode } from "@/lib/env";
import { homeFor } from "@/lib/home";
import { getSiteBrand } from "@/lib/site-brand";
import { ownerUsername } from "@/lib/site-mode";
import { demoSignIn } from "../demo-actions";
import { LoginForms } from "./login-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Entrar · ${(await getSiteBrand()).name}` };
}

const ERRORS: Record<string, string> = {
  enlace: "El enlace ha caducado o ya se usó. Pide uno nuevo.",
  caducado: "Este enlace personal ha caducado. Pide uno nuevo y te llegará al momento.",
  bloqueada: "Tu cuenta está bloqueada. Escríbenos si crees que es un error.",
  cerrado: "En esta web no se pueden crear páginas nuevas. Si ya tienes acceso a algún contenido, entra con tu email.",
};

const MOTIVOS: Record<string, string> = {
  completa: "Para ver todas tus compras, confirma que eres tú con un enlace a tu email.",
  confirmar: "Confirma tu email para continuar: te enviaremos un enlace.",
};

const DEMO = [
  { email: "ana@cirella.app", label: "Ana Luna", role: "Creadora · plan Pro" },
  { email: "laura@example.com", label: "Laura Martín", role: "Clienta de Ana" },
  { email: "admin@cirella.app", label: "Superadmin", role: "Plataforma" },
];

/** Modo personal (con la demo, la dueña es Ana): sin planes ni plataforma en las etiquetas. */
const DEMO_PERSONAL = [
  { email: "ana@cirella.app", label: "Ana Luna", role: "Dueña de la web" },
  { email: "laura@example.com", label: "Laura Martín", role: "Alumna" },
  { email: "admin@cirella.app", label: "Administración", role: "Envíos y ajustes" },
];

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; motivo?: string; modo?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  // Modo clienta: el destino es el área de cliente. Si la ruta dice de qué creadora es, su login con marca.
  const buyer = !!next && isBuyerPath(next);
  const motivo = sp.motivo && Object.hasOwn(MOTIVOS, sp.motivo) ? (sp.motivo as LoginMotivo) : undefined;
  if (buyer && sp.modo !== "contrasena") {
    const branded = await buyerLoginPath(next, { motivo });
    if (!branded.startsWith("/entrar")) redirect(`${branded}${sp.error ? `&error=${encodeURIComponent(sp.error)}` : ""}`);
  }
  const s = await getSession();
  // Sin bucles: solo se salta el login si la sesión ya basta para el destino.
  if (s && !sp.error && !sp.motivo) {
    const dest = next || (await homeFor(s.user.id));
    if (sessionSatisfies({ verified: s.verified, scoped: !!s.orderId }, dest)) redirect(dest);
  }
  const demo = isDemoMode();
  const personal = !!ownerUsername();
  return (
    <>
      <h1 className="display text-[2.6rem]">{buyer ? "Entra a tu área de cliente" : "Hola de nuevo"}</h1>
      <p className="mt-2 text-sm text-muted">{buyer ? "Te enviamos un enlace a tu email para entrar sin contraseña." : "Entra a tu panel o a tu área de cliente."}</p>
      <div className="mt-8">
        <LoginForms
          next={next || undefined}
          demo={demo}
          initialError={sp.error ? ERRORS[sp.error] : undefined}
          notice={motivo ? MOTIVOS[motivo] : undefined}
          defaultMode={(buyer && sp.modo !== "contrasena") || sp.modo === "enlace" || motivo === "confirmar" ? "magic" : "password"}
          defaultEmail={motivo === "confirmar" && s ? s.user.email : undefined}
        />
      </div>
      {!buyer && !personal && (
        <p className="mt-6 text-center text-sm text-muted">
          ¿Aún no tienes página?{" "}
          <Link href="/registro" className="font-semibold text-ink underline-offset-2 hover:underline">Créala gratis</Link>
        </p>
      )}
      {demo && (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-white/60 p-4">
          <p className="eyebrow">Accesos de demostración</p>
          <div className="mt-3 grid gap-2">
            {(personal ? DEMO_PERSONAL : DEMO).map((d) => (
              <form key={d.email} action={demoSignIn}>
                <input type="hidden" name="email" value={d.email} />
                <input type="hidden" name="next" value={next} />
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
