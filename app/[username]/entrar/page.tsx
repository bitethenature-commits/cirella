import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { Flash } from "@/components/ui/flash";
import { getSession, safeNext } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { getPublicCreator } from "@/lib/public";
import { turnstileSiteKey } from "@/lib/turnstile";
import { StudentSignupForm } from "./student-signup-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entra a tu área", robots: { index: false } };

const ERRORS: Record<string, string> = {
  enlace: "Ese enlace ya se usó o ha caducado. Pide uno nuevo.",
  caducado: "Este enlace personal ha caducado. Pide uno nuevo y te llegará al momento.",
};

const MOTIVOS: Record<string, string> = {
  completa: "Para ver todas tus compras, confirma que eres tú con un enlace a tu email.",
  confirmar: "Confirma tu email para ver tus compras.",
};

/** Web personal: aquí no se compra nada (la gente se apunta o recibe el acceso). */
const MOTIVOS_PERSONAL: Record<string, string> = {
  completa: "Para ver todo lo tuyo, confirma que eres tú con un enlace a tu email.",
  confirmar: "Confirma tu email para ver tu contenido.",
};

/**
 * Login de las compradoras con la marca de la creadora: solo enlace por email, sin contraseñas ni
 * «crea tu página». Llegan aquí desde su página («Entrar» / «Mi área»), desde un enlace caducado o
 * cuando una ruta de /cuenta les pide entrar. En la web personal, una segunda pestaña «Crear mi
 * cuenta» (?modo=alta): son enlaces, así funciona sin JavaScript y con «Atrás».
 */
export default async function CreatorLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ next?: string; error?: string; motivo?: string; modo?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const next = safeNext(sp.next, "/cuenta");
  const data = await getPublicCreator(username);
  if (!data) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  const s = await getSession();
  if (s?.verified && !s.orderId && !sp.error && !sp.motivo) redirect(next);
  const error = sp.error && Object.hasOwn(ERRORS, sp.error) ? ERRORS[sp.error] : null;
  const motivos = data.personal ? MOTIVOS_PERSONAL : MOTIVOS;
  const notice = sp.motivo && Object.hasOwn(motivos, sp.motivo) ? motivos[sp.motivo] : null;
  const signup = data.personal && sp.modo === "alta";
  const q = (modo?: string) => `/${data.creator.username}/entrar?next=${encodeURIComponent(next)}${modo ? `&modo=${modo}` : ""}`;

  return (
    <CreatorShell username={data.creator.username} config={data.config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} showAccount={false}>
      <main className="mx-auto max-w-md px-5 pb-20 pt-12">
        {data.personal && (
          <nav aria-label="Entrar o crear cuenta" className="cp-card mb-8 grid grid-cols-2 p-1 text-sm" style={{ borderRadius: 999 }}>
            {[
              { href: q(), label: "Entrar", active: !signup },
              { href: q("alta"), label: "Crear mi cuenta", active: signup },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-full font-medium transition ${t.active ? "cp-btn" : "cp-muted"}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        {signup ? (
          <>
            <h1 className="cp-display text-[2.6rem] leading-tight">Crea tu cuenta</h1>
            <p className="cp-muted mt-3 text-[1.02rem]">
              Tu área con todo lo que consigas de {data.config.displayName}: cursos, sesiones, archivos y novedades.
            </p>
            <div className="cp-card mt-8 p-5">
              <StudentSignupForm username={data.creator.username} ownerName={data.config.displayName} turnstileSiteKey={turnstileSiteKey()} demo={isDemoMode()} />
            </div>
            <Link href={q()} className="cp-muted mt-6 inline-block text-sm underline-offset-4 hover:underline">
              ¿Ya tienes cuenta? Entra
            </Link>
          </>
        ) : (
          <>
            <h1 className="cp-display text-[2.6rem] leading-tight">Entra a tu área</h1>
            <p className="cp-muted mt-3 text-[1.02rem]">
              Te enviamos un enlace a tu email para ver {data.personal ? "tu contenido de" : "lo que compraste a"} {data.config.displayName}. Sin contraseñas.
            </p>
            <div className="cp-card mt-8 p-5">
              <Flash error={error} ok={error ? null : notice} />
              <MagicLinkForm
                variant="creator"
                creatorUsername={data.creator.username}
                next={next}
                demo={isDemoMode()}
                defaultEmail={sp.motivo === "confirmar" && s && !s.orderId ? s.user.email : undefined}
              />
            </div>
            <div className="mt-6 flex flex-col items-start gap-2 text-sm">
              <Link href={`/entrar?next=${encodeURIComponent(next)}&modo=contrasena`} className="cp-muted underline-offset-4 hover:underline">
                ¿Tienes contraseña? Entra con ella
              </Link>
              {data.personal && (
                <Link href={q("alta")} className="cp-muted underline-offset-4 hover:underline">
                  ¿Aún no tienes cuenta? Créala
                </Link>
              )}
            </div>
          </>
        )}
      </main>
    </CreatorShell>
  );
}
