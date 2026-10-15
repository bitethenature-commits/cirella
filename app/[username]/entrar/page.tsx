import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { Flash } from "@/components/ui/flash";
import { getSession, safeNext } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { getPublicCreator } from "@/lib/public";

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
 * «crea tu página». Llegan aquí desde su página («Mi área»), desde un enlace caducado o cuando una
 * ruta de /cuenta les pide entrar.
 */
export default async function CreatorLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ next?: string; error?: string; motivo?: string }>;
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

  return (
    <CreatorShell username={data.creator.username} config={data.config} allowCustom={data.allowCustom} personal={data.personal}>
      <main className="mx-auto max-w-md px-5 pb-20 pt-12">
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
        <Link
          href={`/entrar?next=${encodeURIComponent(next)}&modo=contrasena`}
          className="cp-muted mt-6 inline-block text-sm underline-offset-4 hover:underline"
        >
          ¿Tienes contraseña? Entra con ella
        </Link>
      </main>
    </CreatorShell>
  );
}
