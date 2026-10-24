import Link from "next/link";
import { cookies } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { dismissTwoFactorBanner } from "@/app/panel/ajustes/seguridad/actions";
import { isPersonalMode } from "@/lib/site-mode";
import { TWO_FACTOR_BANNER_COOKIE } from "@/lib/two-factor";

/**
 * Web personal: aviso del panel para que la dueña active la verificación en dos pasos. Nunca se
 * obliga (una dueña sin móvil a mano no debe quedarse fuera): «Ahora no» lo esconde 30 días.
 */
export async function TwoFactorBanner({ user }: { user: { totpEnabledAt: Date | null } }) {
  if (!isPersonalMode() || user.totpEnabledAt) return null;
  if ((await cookies()).get(TWO_FACTOR_BANNER_COOKIE)?.value) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
      <p className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0" /> Protege tu panel: activa la verificación en dos pasos.
      </p>
      <div className="flex items-center gap-2">
        <Link href="/panel/ajustes/seguridad" className="btn btn-primary btn-sm min-h-9">Activarla</Link>
        <form action={dismissTwoFactorBanner}>
          <button className="btn btn-ghost btn-sm min-h-9">Ahora no</button>
        </form>
      </div>
    </div>
  );
}
