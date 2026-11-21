import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { magicLinkCreatorId, peekMagicLink } from "@/lib/auth";
import { maskEmail } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { confirmMagicLink } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar", robots: { index: false }, referrer: "no-referrer" };

/**
 * Pantalla del enlace mágico: el GET solo enseña el botón (nada se gasta) y «Entrar» lo gasta con
 * un POST. Con la marca de la creadora si el enlace se pidió desde su página.
 */
export default async function MagicLinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const link = await peekMagicLink(token);
  const creatorId = link ? link.creatorId : await magicLinkCreatorId(token);
  const creator = creatorId ? await prisma.creator.findUnique({ where: { id: creatorId }, select: { username: true } }) : null;
  if (!link) redirect(creator ? `/${creator.username}/entrar?error=enlace` : "/entrar?error=enlace");
  const masked = maskEmail(link.email);
  const verify = link.purpose === "VERIFY_SIGNUP";
  // Alta de alumna y cambio de email: un solo botón (POST), con su texto.
  const special =
    link.purpose === "REGISTER"
      ? { title: "Confirma tu email para entrar", text: <>Vas a crear tu área con <strong>{masked}</strong>.</>, button: "Confirmar y entrar" }
      : link.purpose === "CHANGE_EMAIL"
        ? { title: "Confirma tu nuevo email", text: <>Tu cuenta pasará a usar <strong>{masked}</strong>.</>, button: "Confirmar el cambio" }
        : null;

  return (
    <AuthFrame username={creator?.username}>
      {(branded) => (
        <form action={confirmMagicLink} className={branded ? "text-center" : ""}>
          <input type="hidden" name="token" value={token} />
          <h1 className={branded ? "cp-display text-[2.4rem] leading-tight" : "display text-[2.6rem] leading-tight"}>
            {special ? special.title : verify ? "¿Has creado tú esta cuenta?" : "Entra a tu cuenta"}
          </h1>
          <p className={`mt-3 ${branded ? "cp-muted" : "text-sm text-muted"}`}>
            {special ? (
              special.text
            ) : verify ? (
              <>Se ha creado una cuenta de Cirella con <strong>{masked}</strong>.</>
            ) : (
              <>Vas a entrar como <strong>{masked}</strong>.</>
            )}
          </p>
          {verify ? (
            <div className="mt-8 grid gap-3">
              <SubmitButton name="choice" value="yes" className={branded ? "cp-btn h-14 w-full text-base" : "btn btn-primary btn-lg w-full"} pendingLabel="Un momento…">
                Sí, he sido yo
              </SubmitButton>
              <SubmitButton name="choice" value="no" className={branded ? "cp-btn-ghost h-14 w-full text-base" : "btn btn-outline btn-lg w-full"} pendingLabel="Un momento…">
                No he sido yo
              </SubmitButton>
              <p className={`text-xs ${branded ? "cp-muted" : "text-muted"}`}>
                Si no has sido tú, cerraremos el acceso de quien la creó y entrarás tú con este email. Si la creaste en otro
                navegador o dispositivo, por seguridad te pediremos que elijas la contraseña de nuevo.
              </p>
            </div>
          ) : (
            <>
              <SubmitButton className={branded ? "cp-btn mt-8 h-14 w-full text-base" : "btn btn-primary btn-lg mt-8 w-full"} pendingLabel="Entrando…">
                {special ? special.button : "Entrar"}
              </SubmitButton>
              <p className={`mt-4 text-xs ${branded ? "cp-muted" : "text-muted"}`}>Este paso evita que los antivirus del correo gasten tu enlace.</p>
            </>
          )}
        </form>
      )}
    </AuthFrame>
  );
}
