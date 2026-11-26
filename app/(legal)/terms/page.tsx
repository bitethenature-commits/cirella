import type { Metadata } from "next";
import Link from "next/link";
import { LegalProse, Pending } from "@/components/legal-prose";
import { getSettings } from "@/lib/settings";
import { redirectToOwnerLegal } from "../personal-redirect";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Términos del servicio") };
}
export const dynamic = "force-dynamic";

// BORRADOR: revisar con la asesoría antes de lanzar (README, «Cumplimiento legal»). Si cambian,
// sube PLATFORM_TERMS_VERSION (lib/legal.ts) y avisa a las creadoras con 30 días de antelación.
export default async function TerminosPage() {
  const t = await getT();
  redirectToOwnerLegal("aviso");
  const s = await getSettings();
  const p = s.platformName;
  const email = s.privacyEmail || s.supportEmail;
  return (
    <LegalProse title={t("Términos del servicio para creadoras")}>
      <p><Tr s={"Estos términos regulan el uso de"} />{" "}<Tr s={p} />{" "}<Tr s={"por las creadoras que abren su página. Los presta"} />{" "}<Pending value={s.legalCompanyName} />{" "}<Tr s={"(NIF"} />{" "}
        <Pending value={s.legalTaxId} /><Tr s={"). Al crear tu página los aceptas, junto con el"} />{" "}<a href="#encargo"><Tr s={"encargo de tratamiento de datos"} /></a>.
      </p>

      <h2><Tr s={"1. Objeto"} /></h2>
      <p><Tr s={p} />{" "}<Tr s={"te da una página propia, un checkout y un área de cliente para vender productos digitales, cursos, sesiones y membresías."} /></p>

      <h2><Tr s={"2. Alta y cuenta"} /></h2>
      <p><Tr s={"Debes ser mayor de edad y dar datos veraces. Eres responsable de guardar tu contraseña y de lo que se haga con tu cuenta."} /></p>

      <h2><Tr s={"3. Planes y comisiones"} /></h2>
      <p><Tr s={"Cada plan tiene una cuota y una comisión por venta, que se muestran en"} />{" "}<Link href="/#precios"><Tr s={"precios"} /></Link><Tr s={". La comisión se descuenta de cada venta. Los cambios de precio se avisan con 30 días de antelación."} /></p>

      <h2><Tr s={"4. Cobros"} /></h2>
      <p><Tr s={"Los pagos se cobran con Stripe Connect en tu propia cuenta de cobro."} />{" "}<strong><Tr s={"Tú eres la vendedora"} /></strong><Tr s={": el contrato de cada venta es entre tú y tu clienta, y"} />{" "}<Tr s={p} />{" "}<Tr s={"no es parte de él."} /></p>

      <h2><Tr s={"5. Obligaciones de la creadora"} /></h2>
      <ul>
        <li><Tr s={"Completar tus datos legales con información veraz (aparecen en tu aviso legal y en cada recibo)."} /></li>
        <li><Tr s={"Cumplir la normativa de consumo: información previa, condiciones, desistimiento y reembolsos."} /></li>
        <li><Tr s={"Publicar solo contenido lícito y del que tengas los derechos."} /></li>
        <li><Tr s={"No afirmar que tus productos curan enfermedades ni presentarlos como sustitutos de un tratamiento sanitario."} /></li>
      </ul>

      <h2><Tr s={"6. Contenido y propiedad intelectual"} /></h2>
      <p><Tr s={"Tu contenido es tuyo. Nos das permiso para alojarlo, mostrarlo y entregarlo a tus clientas mientras uses"} />{" "}<Tr s={p} />.</p>

      <h2><Tr s={"7. Suspensión y baja"} /></h2>
      <p><Tr s={"Puedes darte de baja cuando quieras y descargar tus datos antes. Podemos suspender una cuenta que incumpla estos términos o la ley. Tras la baja borramos tus datos en un máximo de 30 días, salvo los que la ley obliga a conservar."} /></p>

      <h2><Tr s={"8. Responsabilidad"} /></h2>
      <p><Tr s={"Ponemos los medios razonables para que"} />{" "}<Tr s={p} />{" "}<Tr s={"funcione sin interrupciones, pero no respondemos de las ventas, los productos ni el contenido de las creadoras."} /></p>

      <h2><Tr s={"9. Cambios en los términos"} /></h2>
      <p><Tr s={"Te avisaremos por email con 30 días de antelación. Si no estás de acuerdo, puedes darte de baja antes de que entren en vigor."} /></p>

      <h2><Tr s={"10. Ley y jurisdicción"} /></h2>
      <p><Tr s={"Ley española. Juzgados y tribunales del domicilio del titular, salvo que la ley disponga otro fuero."} /></p>

      <h2 id="encargo"><Tr s={"Encargo de tratamiento (art. 28 RGPD)"} /></h2>
      <p><Tr s={"Tú eres la responsable de los datos de tus clientas y"} />{" "}<Tr s={p} />{" "}<Tr s={"trata esos datos por encargo tuyo, en estos términos:"} /></p>
      <h3><Tr s={"Objeto y duración"} /></h3>
      <p><Tr s={"Alojar tu página, gestionar las compras, reservas y accesos y enviar los emails de tu negocio, mientras uses"} />{" "}<Tr s={p} />.</p>
      <h3><Tr s={"Naturaleza y finalidad"} /></h3>
      <p><Tr s={"Almacenamiento, consulta, comunicación y supresión de datos, solo para prestarte el servicio."} /></p>
      <h3><Tr s={"Tipos de datos y de interesados"} /></h3>
      <p><Tr s={"Clientas y personas que compran o reservan: datos identificativos y de contacto, compras, reservas, progreso en cursos y mensajes."} /></p>
      <h3><Tr s={"Obligaciones de"} />{" "}<Tr s={p} /></h3>
      <ul>
        <li><Tr s={"Tratar los datos solo siguiendo tus instrucciones documentadas (estos términos y la configuración de tu cuenta)."} /></li>
        <li><Tr s={"Garantizar la confidencialidad de quien accede a ellos."} /></li>
        <li><Tr s={"Aplicar las medidas de seguridad del artículo 32 del RGPD."} /></li>
        <li><Tr s={"Avisarte de cualquier brecha de seguridad en un máximo de 48 horas."} /></li>
        <li><Tr s={"Ayudarte a atender los derechos de tus clientas y, si hace falta, con las evaluaciones de impacto."} /></li>
      </ul>
      <h3><Tr s={"Subencargados"} /></h3>
      <p><Tr s={"Autorizas a"} />{" "}<Tr s={p} />{" "}<Tr s={"a recurrir a estos proveedores, que firman las mismas obligaciones (te avisaremos antes de cambiarlos):"} /></p>
      <ul>
        <li><Tr s={"Alojamiento de la aplicación:"} />{" "}<Pending value="" /></li>
        <li><Tr s={"Base de datos:"} />{" "}<Pending value="" /></li>
        <li><Tr s={"Almacenamiento de archivos: Cloudflare R2"} /></li>
        <li><Tr s={"Envío de emails: Resend"} /></li>
        <li><Tr s={"Monitorización de errores (si se activa): Sentry"} /></li>
      </ul>
      <p><Tr s={"Stripe trata los datos de pago como responsable independiente, con su propia política."} /></p>
      <h3><Tr s={"Transferencias internacionales"} /></h3>
      <p><Tr s={"Si algún proveedor trata datos fuera del Espacio Económico Europeo, lo hace con cláusulas contractuales tipo de la Comisión Europea u otra garantía válida."} /></p>
      <h3><Tr s={"Fin del encargo"} /></h3>
      <p><Tr s={"Al darte de baja puedes descargar tus datos; después los suprimimos, salvo los que la ley obliga a conservar."} /></p>
      <h3><Tr s={"Auditoría"} /></h3>
      <p><Tr s={"Te daremos la información necesaria para demostrar que cumplimos este encargo. Escríbenos a"} />{" "}{email}.</p>
    </LegalProse>
  );
}
