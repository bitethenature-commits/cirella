import type { Metadata } from "next";
import Link from "next/link";
import { LegalProse, Pending } from "@/components/legal-prose";
import { CHECKOUT_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { redirectToOwnerLegal } from "../personal-redirect";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Política de privacidad") };
}
export const dynamic = "force-dynamic";

// BORRADOR: revisar con la asesoría antes de lanzar (README, «Cumplimiento legal»). Los
// subencargados y sus regiones los decide la fundadora.
export default async function PrivacidadPage() {
  const t = await getT();
  redirectToOwnerLegal("privacidad");
  const s = await getSettings();
  const email = s.privacyEmail || s.supportEmail;
  return (
    <LegalProse title={t("Política de privacidad")}>
      <h2><Tr s={"Responsable"} /></h2>
      <p>
        <Pending value={s.legalCompanyName} />{" "}<Tr s={"(NIF"} />{" "}<Pending value={s.legalTaxId} />), <Pending value={s.legalAddress} /><Tr s={". Email:"} />{" "}{email}.
      </p>

      <h2><Tr s={"Cuándo somos responsables y cuándo encargados"} /></h2>
      <ul>
        <li>
          <strong><Tr s={"Responsables"} /></strong>{" "}<Tr s={"de los datos de las cuentas de las creadoras, de la cuenta con la que cada compradora entra en"} />{" "}<Tr s={s.platformName} />{" "}<Tr s={"(email, nombre y acceso) y de los registros de seguridad de la plataforma."} /></li>
        <li>
          <strong><Tr s={"Encargados"} /></strong>{" "}<Tr s={"de los datos de las clientas de cada creadora (compras, reservas, progreso y mensajes): los tratamos por encargo suyo. La responsable es la creadora; su política está en su página (/"} /><em><Tr s={"usuario"} /></em><Tr s={"/legal#privacidad)."} /></li>
      </ul>

      <h2><Tr s={"Para qué usamos los datos y con qué base"} /></h2>
      <ul>
        <li><Tr s={"Prestar el servicio a las creadoras y dar acceso a las compradoras: ejecución del contrato."} /></li>
        <li><Tr s={"Seguridad, prevención del fraude y avisos importantes del servicio: interés legítimo."} /></li>
        <li><Tr s={"Novedades de"} />{" "}<Tr s={s.platformName} />{" "}<Tr s={"a las creadoras: interés legítimo; puedes darte de baja en cada email."} /></li>
      </ul>

      <h2><Tr s={"Cuánto tiempo"} /></h2>
      <p><Tr s={"Mientras la cuenta esté activa y, después, durante los plazos de prescripción. Los datos de pedidos, 6 años (art. 30 del Código de Comercio)."} /></p>

      <h2><Tr s={"Con quién se comparten"} /></h2>
      <p><Tr s={"Con los proveedores que nos ayudan a prestar el servicio (alojamiento, base de datos, almacenamiento de archivos, envío de emails y, si se activa, monitorización de errores), con contrato de encargo y, si están fuera del Espacio Económico Europeo, con cláusulas contractuales tipo. Stripe trata los datos de pago como responsable independiente. El detalle está en el"} />{" "}<Link href="/terms#encargo"><Tr s={"encargo de tratamiento"} /></Link>.
      </p>

      <h2><Tr s={"Tus derechos"} /></h2>
      <p><Tr s={"Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus datos escribiendo a"} />{" "}{email}<Tr s={". Si eres clienta de una creadora, escríbele a ella (su email está en su aviso legal) o a nosotras y se lo trasladaremos. También puedes reclamar ante la Agencia Española de Protección de Datos ("} /><a href="https://www.aepd.es" target="_blank" rel="noopener"><Tr s={"www.aepd.es"} /></a>).
      </p>

      <h2 id="cookies"><Tr s={"Cookies"} /></h2>
      <p><Tr s={"Solo usamos cookies técnicas, necesarias para que el servicio funcione. No hace falta tu consentimiento para ellas y no las usamos para seguirte:"} /></p>
      <ul>
        <li><strong><Tr s={SESSION_COOKIE} /></strong><Tr s={": mantiene tu sesión cuando entras en tu cuenta (hasta 30 días o hasta que salgas)."} /></li>
        <li><strong><Tr s={CHECKOUT_COOKIE} /></strong><Tr s={": permite al navegador que hizo una compra abrirla sin contraseña (24 horas)."} /></li>
        <li><strong><Tr s={"cirella_signup"} /></strong><Tr s={": recuerda el nombre de usuario y la invitación mientras creas tu página (24 horas)."} /></li>
      </ul>
      <p><Tr s={"Las visitas de las páginas se miden sin cookies y sin guardar nada en tu navegador: con un resumen cifrado de la IP y del navegador que cambia cada día y no permite reconocerte de un día para otro."} /></p>
    </LegalProse>
  );
}
