import Link from "next/link";
import { Percent } from "lucide-react";
import type { Creator } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { creatorIssuer } from "@/lib/invoices/issuer";
import { asVatStatus, type TaxMode } from "@/lib/tax";
import { saveVatStatus } from "./vat-actions";
import { VatFields } from "./vat-fields";

/** Tarjeta «IVA» de los ajustes: situación de IVA de la creadora (los datos fiscales son los de «Datos legales»). */
export function VatCard({ creator, taxMode, platformName, personal = false }: { creator: Creator; taxMode: TaxMode; platformName: string; personal?: boolean }) {
  const status = asVatStatus(creator.vatStatus);
  const missingData = status !== "NONE" && creatorIssuer(creator) === null;
  return (
    <form id="iva" action={saveVatStatus} className="card scroll-mt-20 space-y-4 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Percent className="h-4 w-4" /> IVA</h2>
      <p className="text-sm text-muted">
        {personal
          ? "Tú eres la vendedora de todo lo que se cobra en tu web. Esto decide si los precios llevan IVA (siempre incluido en el precio) y, si lo llevan, tu web emite las facturas con tus datos fiscales."
          : taxMode === "PLATFORM_DIGITAL"
            ? `Tus productos digitales, cursos y membresías los vende ${platformName} a efectos de IVA: lo calcula según el país de cada clienta, lo ingresa y emite la factura. Esta opción solo afecta a tus sesiones en directo y a las facturas que te emite ${platformName}.`
            : `Tú eres la vendedora de tus productos. ${platformName} emite las facturas en tu nombre con estos datos.`}
      </p>
      <VatFields status={status} exemptionNote={creator.vatExemptionNote} personal={personal} />
      {missingData && (
        <p className="rounded-xl bg-gold-soft/50 px-4 py-3 text-sm">
          Completa tus datos fiscales (nombre o razón social, NIF{personal ? " o número fiscal de tu empresa (EIN)" : ""} y domicilio) para que tus clientas reciban factura.{" "}
          <Link href="/panel/ajustes/legal" className="font-medium underline underline-offset-2">Completar datos</Link>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Consulta con tu asesoría cuál es tu caso.</p>
        <SubmitButton pendingLabel="Guardando…">Guardar IVA</SubmitButton>
      </div>
    </form>
  );
}
