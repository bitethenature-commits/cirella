import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  disableTwoFactorAction,
  forgetAllDevices,
  forgetDevice,
  regenerateCodes,
  startTwoFactorSetup,
} from "@/app/panel/ajustes/seguridad/actions";
import { listDevices, pendingSetup, remainingRecoveryCodes } from "@/lib/two-factor";
import { formatDate } from "@/lib/tz";
import { ReauthForm, SetupWizard } from "./two-factor-setup";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

const OK: Record<string, string> = {
  activada: "Verificación en dos pasos activada.",
  desactivada: "Verificación en dos pasos desactivada.",
  codigos: "Códigos de recuperación nuevos guardados.",
  olvidado: "Dispositivo olvidado.",
  olvidados: "Hemos olvidado todos tus dispositivos.",
};

/**
 * Contenido de «Verificación en dos pasos» (panel y administración): sin activar, configurando o
 * activada (códigos que quedan, dispositivos recordados, desactivar).
 */
export async function TwoFactorSettings({
  user,
  scope,
  sp,
}: {
  user: { id: string; passwordHash: string | null; totpEnabledAt: Date | null };
  scope: "panel" | "admin";
  sp: { paso?: string; ok?: string; aviso?: string };
}) {
  const t = await getT();
  const base = scope === "admin" ? "/admin/seguridad" : "/panel/ajustes/seguridad";
  const hasPassword = !!user.passwordHash;
  const ok = sp.ok && Object.hasOwn(OK, sp.ok) ? OK[sp.ok] : null;

  if (!user.totpEnabledAt) {
    const setup = sp.paso === "configurar" ? await pendingSetup(user.id) : null;
    return (
      <section className="card p-5 sm:p-6">
        <Flash ok={ok} />
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{" "}<Tr s={"Verificación en dos pasos"} /></h2>
        {setup ? (
          <div className="mt-4">
            <SetupWizard scope={scope} uri={setup.uri} qrSvg={setup.qrSvg} secretFormatted={setup.secretFormatted} doneHref={base} />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted"><Tr s={"Además de tu contraseña o del enlace por email, te pediremos un código de 6 cifras de una app de tu móvil (Contraseñas del iPhone, Google Authenticator…). Así, aunque alguien consiga tu contraseña o tu email, no podrá entrar en tu panel."} /></p>
            <form action={startTwoFactorSetup} className="mt-4">
              <input type="hidden" name="scope" value={scope} />
              <SubmitButton className="btn btn-primary min-h-11" pendingLabel={t("Un momento…")}><Tr s={"Empezar"} /></SubmitButton>
            </form>
          </>
        )}
      </section>
    );
  }

  const [remaining, devices] = await Promise.all([remainingRecoveryCodes(user.id), listDevices(user.id)]);
  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <Flash ok={ok} />
        {sp.aviso === "recuperacion" && (
          <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#efe0bd] bg-[#fbf5e6] px-4 py-3 text-sm text-[#7a5a1c]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><Tr s={"Has entrado con un código de recuperación. Te"} />{" "}<Tr s={remaining === 1 ? "queda" : "quedan"} /> {remaining}<Tr s={". Si has cambiado de móvil, configura la app de nuevo."} /></span>
          </div>
        )}
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{" "}<Tr s={"Verificación en dos pasos"} /></h2>
        <p className="mt-2 text-sm">
          <span className="inline-flex h-6 items-center rounded-full bg-[#e7f3ec] px-2.5 text-[0.7rem] font-semibold text-[#2f6b4a]"><Tr s={"Activada"} /></span>{" "}
          <span className="text-muted"><Tr s={"desde el"} />{" "}{formatDate(user.totpEnabledAt, { day: "numeric", month: "short", year: "numeric" })}</span>
        </p>
        <p className="mt-3 text-sm text-muted"><Tr s={"Al entrar te pediremos el código de tu app de códigos."} /></p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold"><Tr s={"Códigos de recuperación"} /></h2>
        <p className={`mt-2 text-sm ${remaining <= 3 ? "text-[#8a6420]" : "text-muted"}`}><Tr s={"Te"} />{" "}<Tr s={remaining === 1 ? "queda" : "quedan"} /> <strong data-testid="codes-left">{remaining}</strong>{" "}<Tr s={"de 10."} />{remaining <= 3 && t(" Genera códigos nuevos.")}
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium underline underline-offset-4"><Tr s={"Generar códigos nuevos"} /></summary>
          <ReauthForm scope={scope} action={regenerateCodes} hasPassword={hasPassword} submitLabel={t("Generar códigos nuevos")} doneHref={base} />
        </details>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold"><Tr s={"Dispositivos recordados"} /></h2>
        {devices.length === 0 ? (
          <p className="mt-2 text-sm text-muted"><Tr s={"Ninguno. Marca «Recordar este dispositivo 30 días» al escribir el código para no tener que escribirlo cada vez."} /></p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-line">
              {devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <Tr s={d.label} />
                    <span className="text-muted">{" "}<Tr s={"· último uso"} />{" "}{formatDate(d.lastUsedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  <form action={forgetDevice}>
                    <input type="hidden" name="scope" value={scope} />
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton className="btn btn-outline btn-sm min-h-11" pendingLabel="…"><Tr s={"Olvidar"} /></SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium underline underline-offset-4"><Tr s={"Olvidar todos los dispositivos"} /></summary>
              <ReauthForm scope={scope} action={forgetAllDevices} hasPassword={hasPassword} submitLabel={t("Olvidar todos")} doneHref={base} />
            </details>
          </>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold"><Tr s={"¿Móvil nuevo o quieres quitarla?"} /></h2>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium underline underline-offset-4"><Tr s={"Configurar de nuevo (móvil nuevo)"} /></summary>
          <p className="mt-2 text-sm text-muted"><Tr s={"Se desactiva y empiezas otra vez, con códigos de recuperación nuevos."} /></p>
          <ReauthForm scope={scope} action={disableTwoFactorAction} hasPassword={hasPassword} submitLabel={t("Configurar de nuevo")} then="configurar" doneHref={base} />
        </details>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium underline underline-offset-4"><Tr s={"Desactivar la verificación en dos pasos"} /></summary>
          <ReauthForm scope={scope} action={disableTwoFactorAction} hasPassword={hasPassword} submitLabel={t("Desactivar")} danger doneHref={base} />
        </details>
      </section>
    </div>
  );
}
