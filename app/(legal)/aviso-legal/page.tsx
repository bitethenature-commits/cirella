import type { Metadata } from "next";
import Link from "next/link";
import { LegalProse, Pending } from "@/components/legal-prose";
import { appHost } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { redirectToOwnerLegal } from "../personal-redirect";

export const metadata: Metadata = { title: "Aviso legal" };
export const dynamic = "force-dynamic";

// BORRADOR: revisar con la asesoría antes de lanzar (README, «Cumplimiento legal»).
export default async function AvisoLegalPage() {
  redirectToOwnerLegal("aviso");
  const s = await getSettings();
  const email = s.privacyEmail || s.supportEmail;
  return (
    <LegalProse title="Aviso legal">
      <h2>Titular del sitio</h2>
      <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI):</p>
      <ul>
        <li><strong>Titular:</strong> <Pending value={s.legalCompanyName} /></li>
        <li><strong>NIF/CIF:</strong> <Pending value={s.legalTaxId} /></li>
        <li><strong>Domicilio:</strong> <Pending value={s.legalAddress} /></li>
        <li><strong>Datos registrales:</strong> <Pending value={s.legalRegistry} /></li>
        <li><strong>Email:</strong> {email}</li>
      </ul>

      <h2>Qué es {s.platformName}</h2>
      <p>
        {s.platformName} ({appHost()}) es una herramienta para que creadoras y profesionales publiquen su página, vendan productos digitales, cursos, sesiones
        y membresías y atiendan a sus clientas. {s.platformName} presta el servicio tecnológico y quien vende cada producto es su creadora.
      </p>

      <h2>Contenido de las creadoras</h2>
      <p>
        Cada creadora es responsable de su página, sus productos y sus ventas; {s.platformName} actúa como prestadora de servicios de alojamiento (LSSI art.
        16). Quién vende en cada página aparece en su propio aviso legal (enlace «Aviso legal» al pie de cada página). Si ves un contenido ilícito, escríbenos a{" "}
        {email} y lo revisaremos con diligencia.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        La marca, el diseño y el software de {s.platformName} son de su titular. Los textos, imágenes y materiales de cada página son de su creadora. No está
        permitido copiarlos ni distribuirlos sin permiso.
      </p>

      <h2>Privacidad y cookies</h2>
      <p>
        Consulta la <Link href="/privacidad">política de privacidad</Link>, que incluye la información sobre cookies, y los{" "}
        <Link href="/terminos">términos del servicio</Link> para creadoras.
      </p>

      <h2>Ley aplicable</h2>
      <p>Este sitio se rige por la ley española. Si eres consumidora, puedes acudir a los tribunales de tu domicilio.</p>
    </LegalProse>
  );
}
