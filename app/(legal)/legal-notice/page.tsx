import type { Metadata } from "next";
import Link from "next/link";
import { LegalProse, Pending } from "@/components/legal-prose";
import { appHost } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { redirectToOwnerLegal } from "../personal-redirect";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Aviso legal") };
}
export const dynamic = "force-dynamic";

// BORRADOR: revisar con la asesoría antes de lanzar (README, «Cumplimiento legal»).
export default async function AvisoLegalPage() {
  const t = await getT();
  redirectToOwnerLegal("aviso");
  const s = await getSettings();
  const email = s.privacyEmail || s.supportEmail;
  return (
    <LegalProse title={t("Aviso legal")}>
      <h2><Tr s={"Titular del sitio"} /></h2>
      <p><Tr s={"En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI):"} /></p>
      <ul>
        <li><strong><Tr s={"Titular:"} /></strong> <Pending value={s.legalCompanyName} /></li>
        <li><strong><Tr s={"NIF/CIF:"} /></strong> <Pending value={s.legalTaxId} /></li>
        <li><strong><Tr s={"Domicilio:"} /></strong> <Pending value={s.legalAddress} /></li>
        <li><strong><Tr s={"Datos registrales:"} /></strong> <Pending value={s.legalRegistry} /></li>
        <li><strong><Tr s={"Email:"} /></strong> {email}</li>
      </ul>

      <h2><Tr s={"Qué es"} />{" "}<Tr s={s.platformName} /></h2>
      <p>
        <Tr s={s.platformName} /> ({appHost()}<Tr s={") es una herramienta para que creadoras y profesionales publiquen su página, vendan productos digitales, cursos, sesiones y membresías y atiendan a sus clientas."} />{" "}<Tr s={s.platformName} />{" "}<Tr s={"presta el servicio tecnológico y quien vende cada producto es su creadora."} /></p>

      <h2><Tr s={"Contenido de las creadoras"} /></h2>
      <p><Tr s={"Cada creadora es responsable de su página, sus productos y sus ventas;"} />{" "}<Tr s={s.platformName} />{" "}<Tr s={"actúa como prestadora de servicios de alojamiento (LSSI art. 16). Quién vende en cada página aparece en su propio aviso legal (enlace «Aviso legal» al pie de cada página). Si ves un contenido ilícito, escríbenos a"} />{" "}
        {email}{" "}<Tr s={"y lo revisaremos con diligencia."} /></p>

      <h2><Tr s={"Propiedad intelectual"} /></h2>
      <p><Tr s={"La marca, el diseño y el software de"} />{" "}<Tr s={s.platformName} />{" "}<Tr s={"son de su titular. Los textos, imágenes y materiales de cada página son de su creadora. No está permitido copiarlos ni distribuirlos sin permiso."} /></p>

      <h2><Tr s={"Privacidad y cookies"} /></h2>
      <p><Tr s={"Consulta la"} />{" "}<Link href="/privacy"><Tr s={"política de privacidad"} /></Link><Tr s={", que incluye la información sobre cookies, y los"} />{" "}
        <Link href="/terms"><Tr s={"términos del servicio"} /></Link>{" "}<Tr s={"para creadoras."} /></p>

      <h2><Tr s={"Ley aplicable"} /></h2>
      <p><Tr s={"Este sitio se rige por la ley española. Si eres consumidora, puedes acudir a los tribunales de tu domicilio."} /></p>
    </LegalProse>
  );
}
