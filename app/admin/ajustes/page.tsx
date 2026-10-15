import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "../../panel/ui";
import { saveSettings } from "../actions";

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Ajustes de la plataforma" />
      <Flash ok={sp.ok} />
      <form action={saveSettings} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Nombre de la plataforma<input name="platformName" defaultValue={s.platformName} className="input mt-1.5" /></label>
          <label className="text-sm font-medium">Email de soporte<input name="supportEmail" defaultValue={s.supportEmail} className="input mt-1.5" /></label>
        </div>
        <fieldset className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Programa de referidos</legend>
          <p className="text-xs text-muted">Recompensa para la creadora A cuando la creadora B que invitó publica su página.</p>
          <label className="block text-sm">Tipo de recompensa
            <select name="referralRewardType" defaultValue={s.referralRewardType} className="input mt-1.5">
              <option value="FREE_MONTH">Meses gratis (valor = nº de meses)</option>
              <option value="CREDIT">Crédito (valor en céntimos)</option>
              <option value="COMMISSION_DISCOUNT">Reducción de comisión (valor en puntos básicos, 100 = 1 %)</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Valor<input name="referralRewardValue" defaultValue={s.referralRewardValue} inputMode="numeric" className="input mt-1.5" /></label>
            <label className="text-sm">Meses de descuento de comisión<input name="referralDiscountMonths" defaultValue={s.referralDiscountMonths} inputMode="numeric" className="input mt-1.5" /></label>
          </div>
        </fieldset>
        <fieldset className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Datos legales de la plataforma</legend>
          <p className="text-xs text-muted">Aparecen en /aviso-legal, /privacidad y /terminos.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Razón social<input name="legalCompanyName" defaultValue={s.legalCompanyName} maxLength={200} className="input mt-1.5" /></label>
            <label className="text-sm">NIF/CIF<input name="legalTaxId" defaultValue={s.legalTaxId} maxLength={200} className="input mt-1.5" /></label>
          </div>
          <label className="block text-sm">Domicilio social<input name="legalAddress" defaultValue={s.legalAddress} maxLength={400} className="input mt-1.5" /></label>
          <label className="block text-sm">Datos registrales (Registro Mercantil…)<input name="legalRegistry" defaultValue={s.legalRegistry} maxLength={200} className="input mt-1.5" /></label>
          <label className="block text-sm">Email de privacidad<input name="privacyEmail" type="email" defaultValue={s.privacyEmail} maxLength={200} className="input mt-1.5" placeholder={s.supportEmail} /></label>
        </fieldset>
        <SubmitButton>Guardar ajustes</SubmitButton>
      </form>
    </div>
  );
}
