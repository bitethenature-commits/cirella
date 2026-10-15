import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { demoSignIn } from "@/app/(auth)/demo-actions";
import { BrandLogo } from "@/components/brand-logo";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Lo que ve en /dev/correo quien no es administradora: el buzón expone los enlaces de acceso de
 * todas las cuentas. En la demo ofrece entrar como administradora y volver (`next`).
 */
export function AdminOnly({ next }: { next: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper px-4 py-6">
      <BrandLogo />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <div className="card p-6">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h1 className="display mt-4 text-3xl">Buzón de demostración</h1>
          <p className="mt-2 text-sm text-muted">
            Este buzón muestra los emails de todas las cuentas, incluidos sus enlaces de acceso. Por eso solo puede abrirlo la administradora.
          </p>
          <form action={demoSignIn} className="mt-6">
            <input type="hidden" name="email" value="admin@cirella.app" />
            <input type="hidden" name="next" value={next} />
            <SubmitButton className="btn btn-primary w-full" pendingLabel="Entrando…">Entrar como administradora (demo)</SubmitButton>
          </form>
          <Link href="/" className="btn btn-ghost mt-2 w-full">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
