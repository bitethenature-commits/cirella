import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { isPersonalMode } from "@/lib/site-mode";
import { PageHeader } from "../../panel/ui";
import { savePersonalSettings, saveSettings } from "../actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const t = await getT();
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  // Modo personal: la marca es la de su página (nombre, foto y diseño se cambian en «Mi página»).
  if (isPersonalMode())
    return (
      <div className="max-w-2xl">
        <PageHeader title={t("Ajustes de la web")} />
        <Flash ok={sp.ok} />
        <form action={savePersonalSettings} className="card space-y-5 p-6">
          <label className="block text-sm font-medium"><Tr s={"Email de contacto"} /><input name="supportEmail" type="email" defaultValue={s.supportEmail} className="input mt-1.5" />
            <span className="field-hint"><Tr s={"Para las incidencias técnicas (por ejemplo, si a alguien no le llega un email)."} /></span>
          </label>
          <SubmitButton><Tr s={"Guardar ajustes"} /></SubmitButton>
        </form>
        <div className="card mt-4 space-y-2 p-6 text-sm text-muted">
          <p><Tr s={"El nombre, la foto y el diseño de tu web se cambian en"} />{" "}<Link href="/panel/pagina" className="font-semibold text-ink underline-offset-2 hover:underline"><Tr s={"Mi página"} /></Link><Tr s={": es lo que se ve al entrar, en tu panel y en los emails."} /></p>
          <p><Tr s={"Tu aviso legal y tu privacidad, en"} />{" "}<Link href="/panel/ajustes/legal" className="font-semibold text-ink underline-offset-2 hover:underline"><Tr s={"Ajustes › Datos legales"} /></Link>.
          </p>
        </div>
      </div>
    );
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("Ajustes de la plataforma")} />
      <Flash ok={sp.ok} />
      <form action={saveSettings} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium"><Tr s={"Nombre de la plataforma"} /><input name="platformName" defaultValue={s.platformName} className="input mt-1.5" /></label>
          <label className="text-sm font-medium"><Tr s={"Email de soporte"} /><input name="supportEmail" defaultValue={s.supportEmail} className="input mt-1.5" /></label>
        </div>
        <fieldset className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold"><Tr s={"Programa de referidos"} /></legend>
          <p className="text-xs text-muted"><Tr s={"Recompensa para la creadora A cuando la creadora B que invitó publica su página."} /></p>
          <label className="block text-sm"><Tr s={"Tipo de recompensa"} /><select name="referralRewardType" defaultValue={s.referralRewardType} className="input mt-1.5">
              <option value="FREE_MONTH"><Tr s={"Meses gratis (valor = nº de meses)"} /></option>
              <option value="CREDIT"><Tr s={"Crédito (valor en céntimos)"} /></option>
              <option value="COMMISSION_DISCOUNT"><Tr s={"Reducción de comisión (valor en puntos básicos, 100 = 1 %)"} /></option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><Tr s={"Valor"} /><input name="referralRewardValue" defaultValue={s.referralRewardValue} inputMode="numeric" className="input mt-1.5" /></label>
            <label className="text-sm"><Tr s={"Meses de descuento de comisión"} /><input name="referralDiscountMonths" defaultValue={s.referralDiscountMonths} inputMode="numeric" className="input mt-1.5" /></label>
          </div>
        </fieldset>
        <fieldset className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold"><Tr s={"Datos legales de la plataforma"} /></legend>
          <p className="text-xs text-muted"><Tr s={"Aparecen en /legal-notice, /privacy y /terms."} /></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><Tr s={"Razón social"} /><input name="legalCompanyName" defaultValue={s.legalCompanyName} maxLength={200} className="input mt-1.5" /></label>
            <label className="text-sm"><Tr s={"NIF/CIF"} /><input name="legalTaxId" defaultValue={s.legalTaxId} maxLength={200} className="input mt-1.5" /></label>
          </div>
          <label className="block text-sm"><Tr s={"Domicilio social"} /><input name="legalAddress" defaultValue={s.legalAddress} maxLength={400} className="input mt-1.5" /></label>
          <label className="block text-sm"><Tr s={"Datos registrales (Registro Mercantil…)"} /><input name="legalRegistry" defaultValue={s.legalRegistry} maxLength={200} className="input mt-1.5" /></label>
          <label className="block text-sm"><Tr s={"Email de privacidad"} /><input name="privacyEmail" type="email" defaultValue={s.privacyEmail} maxLength={200} className="input mt-1.5" placeholder={t(s.supportEmail)} /></label>
        </fieldset>
        <SubmitButton><Tr s={"Guardar ajustes"} /></SubmitButton>
      </form>
    </div>
  );
}
