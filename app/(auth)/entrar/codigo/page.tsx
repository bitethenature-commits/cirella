import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TWO_FACTOR_COOKIE } from "@/lib/auth";
import { maskEmail } from "@/lib/auth-utils";
import { readChallenge } from "@/lib/two-factor";
import { cancelChallenge } from "./actions";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Código de verificación", robots: { index: false } };

/**
 * Segundo paso del login con la verificación en dos pasos: la contraseña o el enlace ya son
 * correctos (paso en la cookie cirella_2fa) y falta el código de la app.
 */
export default async function CodePage() {
  const ch = await readChallenge((await cookies()).get(TWO_FACTOR_COOKIE)?.value);
  if (!ch) redirect("/entrar?error=codigo");
  return (
    <>
      <h1 className="display text-[2.6rem] leading-tight">Verificación en dos pasos</h1>
      <p className="mt-2 text-sm text-muted">
        Escribe el código de 6 cifras de tu app de códigos para entrar como <strong>{maskEmail(ch.email)}</strong>.
      </p>
      <div className="mt-8">
        <CodeForm rememberDefault={ch.method !== "DEMO"} />
      </div>
      <form action={cancelChallenge} className="mt-6 text-center">
        <button className="text-sm text-muted underline underline-offset-4">Volver a empezar</button>
      </form>
      <details className="mt-8 rounded-2xl border border-line bg-white/60 p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-ink">¿Has perdido el móvil y los códigos?</summary>
        <p className="mt-2">
          Con un código de recuperación puedes entrar y volver a configurar la app. Si tampoco los tienes, quien gestiona tu servidor
          puede desactivar la verificación (docs/seguridad-dos-pasos.md) y después entras con tu contraseña o con un enlace.
        </p>
      </details>
    </>
  );
}
