import { IntakeEditCard } from "@/components/booking/intake-edit-card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { CopyButton } from "@/components/ui/copy-button";
import { asksIntake, intakeAsText, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { deliverableOrder } from "@/lib/order-files";
import { tenantDb } from "@/lib/tenant";
import { clearIntake, setIntakeByOwner } from "../../reservas/actions";
import { DeliveryManager } from "./delivery-manager";

/** Datos para la lectura y «Entrega para …» de un pedido (venta o inscripción). */
export async function OrderExtras({ creatorId, orderId }: { creatorId: string; orderId: string }) {
  const db = tenantDb(creatorId);
  const o = await db.order.findFirst({ where: { id: orderId }, include: { product: { select: { intake: true, deliveryMode: true, groupSession: true, type: true } }, files: { orderBy: { createdAt: "asc" } } } });
  if (!o) return null;
  const cfg = readIntakeConfig(o.product.intake);
  const answers = readIntakeAnswers(o.intake);
  const name = (o.buyerName ?? o.buyerEmail).split(" ")[0];
  const showIntake = !!answers || asksIntake(o.product.type, o.product.deliveryMode, cfg);
  const deliverable = deliverableOrder(o);
  if (!showIntake && !deliverable) return null;
  return (
    <div className="mt-8 space-y-5">
      {showIntake && (
        <>
          <IntakeEditCard config={cfg} answers={answers} locked={false} action={setIntakeByOwner} hidden={{ orderId: o.id }} title="Datos para la lectura" forOwner />
          {answers && (
            <div className="-mt-2 flex flex-wrap gap-2">
              <CopyButton text={intakeAsText(answers)} label="Copiar" copiedLabel="Copiado" className="btn btn-outline btn-sm h-11" />
              <ConfirmForm action={clearIntake} message={`¿Borrar los datos para la lectura de ${name}? No se puede deshacer.`}>
                <input type="hidden" name="orderId" value={o.id} />
                <button className="btn btn-ghost btn-sm h-11 text-rose">Borrar datos</button>
              </ConfirmForm>
            </div>
          )}
        </>
      )}
      {deliverable && (
        <section id="entrega" className="card scroll-mt-24 space-y-3 p-5 sm:p-6">
          <h2 className="font-semibold">Entrega para {name}</h2>
          <p className="text-sm text-muted">
            {o.productType === "SESSION" ? "La grabación de la sesión o un resumen: lo verá en su área." : "Tu lectura (audio, vídeo, PDF o un enlace): la verá en su área."} Puedes subir vídeos desde el iPhone.
          </p>
          <DeliveryManager
            orderId={o.id}
            name={name}
            files={o.files.map((f) => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, durationSec: f.durationSec, url: f.url, sentAt: f.sentAt?.toISOString() ?? null }))}
            deliveredAt={o.deliveredAt?.toISOString() ?? null}
            message={o.deliveryMessage}
            messageFormat={o.deliveryMessageFormat}
          />
        </section>
      )}
    </div>
  );
}
