import type { Metadata } from "next";
import Link from "next/link";
import { LegalProse, Pending } from "@/components/legal-prose";
import { getSettings } from "@/lib/settings";
import { asTaxMode } from "@/lib/tax";
import { redirectToOwnerLegal } from "../personal-redirect";

export const metadata: Metadata = { title: "Términos del servicio" };
export const dynamic = "force-dynamic";

// BORRADOR: revisar con la asesoría antes de lanzar (README, «Cumplimiento legal»). Si cambian,
// sube PLATFORM_TERMS_VERSION (lib/legal.ts) y avisa a las creadoras con 30 días de antelación.
export default async function TerminosPage() {
  redirectToOwnerLegal("aviso");
  const s = await getSettings();
  const p = s.platformName;
  const email = s.privacyEmail || s.supportEmail;
  // Política de IVA de la plataforma (/admin/impuestos): con la opción por defecto, Cirella vende lo
  // digital a efectos del IVA y los términos tienen que decirlo (quién cobra, factura y declara).
  const platformSellsDigital = asTaxMode(s.taxMode) === "PLATFORM_DIGITAL";
  return (
    <LegalProse title="Términos del servicio para creadoras">
      <p>
        Estos términos regulan el uso de {p} por las creadoras que abren su página. Los presta <Pending value={s.legalCompanyName} /> (NIF{" "}
        <Pending value={s.legalTaxId} />). Al crear tu página los aceptas, junto con el <a href="#encargo">encargo de tratamiento de datos</a>.
      </p>

      <h2>1. Objeto</h2>
      <p>{p} te da una página propia, un checkout y un área de cliente para vender productos digitales, cursos, sesiones y membresías.</p>

      <h2>2. Alta y cuenta</h2>
      <p>Debes ser mayor de edad y dar datos veraces. Eres responsable de guardar tu contraseña y de lo que se haga con tu cuenta.</p>

      <h2>3. Planes, comisiones y facturación</h2>
      <p>
        Cada plan tiene una cuota y una comisión por venta, que se muestran en <Link href="/#precios">precios</Link>. La comisión se descuenta de cada venta. Los
        cambios de precio se avisan con 30 días de antelación.
        {platformSellsDigital && (
          <>
            {" "}
            En los productos digitales, cursos y membresías que se entregan solos, además de la comisión se descuenta el IVA de la venta, que cobra y declara{" "}
            {p} (apartado 4).
          </>
        )}
      </p>

      <h2>4. Cobros</h2>
      <p>
        Los pagos se cobran con Stripe Connect en tu propia cuenta de cobro. <strong>Tú eres la vendedora</strong>: el contrato de cada venta es entre tú y tu
        clienta, y {p} no es parte de él.
      </p>
      {platformSellsDigital && (
        <p>
          <strong>IVA de los productos digitales, cursos y membresías.</strong> En estas ventas {p} actúa como proveedora a efectos del IVA (art. 9 bis del
          Reglamento de Ejecución (UE) 282/2011): calcula el IVA según el país de la compradora, lo descuenta del cobro junto con la comisión, lo declara
          (régimen de ventanilla única, OSS) y emite la factura a la compradora. Tú no repercutes ni declaras el IVA de esas ventas. Las sesiones en directo y
          los productos que preparas tú a mano («Lo preparo yo») los vendes tú también a efectos del IVA, según tu situación fiscal.
        </p>
      )}

      <h2>5. Obligaciones de la creadora</h2>
      <ul>
        <li>Completar tus datos legales con información veraz (aparecen en tu aviso legal y en cada recibo).</li>
        <li>Cumplir la normativa de consumo: información previa, condiciones, desistimiento y reembolsos.</li>
        <li>
          {platformSellsDigital
            ? "Cumplir tus obligaciones fiscales, incluido el IVA de lo que vendes tú (sesiones, productos preparados a mano y tu propio negocio); el de los productos digitales, cursos y membresías lo declara " +
              p +
              " (apartado 4)."
            : "Cumplir tus obligaciones fiscales, incluido el IVA."}
        </li>
        <li>Publicar solo contenido lícito y del que tengas los derechos.</li>
        <li>No afirmar que tus productos curan enfermedades ni presentarlos como sustitutos de un tratamiento sanitario.</li>
      </ul>

      <h2>6. Contenido y propiedad intelectual</h2>
      <p>Tu contenido es tuyo. Nos das permiso para alojarlo, mostrarlo y entregarlo a tus clientas mientras uses {p}.</p>

      <h2>7. Suspensión y baja</h2>
      <p>
        Puedes darte de baja cuando quieras y descargar tus datos antes. Podemos suspender una cuenta que incumpla estos términos o la ley. Tras la baja borramos
        tus datos en un máximo de 30 días, salvo los que la ley obliga a conservar.
      </p>

      <h2>8. Responsabilidad</h2>
      <p>
        Ponemos los medios razonables para que {p} funcione sin interrupciones, pero no respondemos de las ventas, los productos ni el contenido de las
        creadoras.
      </p>

      <h2>9. Cambios en los términos</h2>
      <p>Te avisaremos por email con 30 días de antelación. Si no estás de acuerdo, puedes darte de baja antes de que entren en vigor.</p>

      <h2>10. Ley y jurisdicción</h2>
      <p>Ley española. Juzgados y tribunales del domicilio del titular, salvo que la ley disponga otro fuero.</p>

      <h2 id="encargo">Encargo de tratamiento (art. 28 RGPD)</h2>
      <p>Tú eres la responsable de los datos de tus clientas y {p} trata esos datos por encargo tuyo, en estos términos:</p>
      <h3>Objeto y duración</h3>
      <p>Alojar tu página, gestionar las compras, reservas y accesos y enviar los emails de tu negocio, mientras uses {p}.</p>
      <h3>Naturaleza y finalidad</h3>
      <p>Almacenamiento, consulta, comunicación y supresión de datos, solo para prestarte el servicio.</p>
      <h3>Tipos de datos y de interesados</h3>
      <p>Clientas y personas que compran o reservan: datos identificativos y de contacto, compras, reservas, progreso en cursos y mensajes.</p>
      <h3>Obligaciones de {p}</h3>
      <ul>
        <li>Tratar los datos solo siguiendo tus instrucciones documentadas (estos términos y la configuración de tu cuenta).</li>
        <li>Garantizar la confidencialidad de quien accede a ellos.</li>
        <li>Aplicar las medidas de seguridad del artículo 32 del RGPD.</li>
        <li>Avisarte de cualquier brecha de seguridad en un máximo de 48 horas.</li>
        <li>Ayudarte a atender los derechos de tus clientas y, si hace falta, con las evaluaciones de impacto.</li>
      </ul>
      <h3>Subencargados</h3>
      <p>Autorizas a {p} a recurrir a estos proveedores, que firman las mismas obligaciones (te avisaremos antes de cambiarlos):</p>
      <ul>
        <li>Alojamiento de la aplicación: <Pending value="" /></li>
        <li>Base de datos: <Pending value="" /></li>
        <li>Almacenamiento de archivos: Cloudflare R2</li>
        <li>Envío de emails: Resend</li>
        <li>Monitorización de errores (si se activa): Sentry</li>
      </ul>
      <p>Stripe trata los datos de pago como responsable independiente, con su propia política.</p>
      <h3>Transferencias internacionales</h3>
      <p>Si algún proveedor trata datos fuera del Espacio Económico Europeo, lo hace con cláusulas contractuales tipo de la Comisión Europea u otra garantía válida.</p>
      <h3>Fin del encargo</h3>
      <p>Al darte de baja puedes descargar tus datos; después los suprimimos, salvo los que la ley obliga a conservar.</p>
      <h3>Auditoría</h3>
      <p>Te daremos la información necesaria para demostrar que cumplimos este encargo. Escríbenos a {email}.</p>
    </LegalProse>
  );
}
