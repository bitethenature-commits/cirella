import { IntakeEditCard } from "@/components/booking/intake-edit-card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { CopyButton } from "@/components/ui/copy-button";
import { asksIntake, intakeAsText, readIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { tenantDb } from "@/lib/tenant";
import { clearIntake, setIntakeByOwner } from "../../solicitudes/reservas-actions";

/** Datos para la lectura de un pedido (el material se envía por email, la web no lo guarda). */
export async function OrderExtras({ creatorId, orderId }: { creatorId: string; orderId: string }) {
  const db = tenantDb(creatorId);
  const o = await db.order.findFirst({ where: { id: orderId }, include: { product: { select: { intake: true, deliveryMode: true, groupSession: true, type: true } } } });
  if (!o) return null;
  const cfg = readIntakeConfig(o.product.intake);
  const answers = readIntakeAnswers(o.intake);
  const name = (o.buyerName ?? o.buyerEmail).split(" ")[0];
  const showIntake = !!answers || asksIntake(o.product.type, o.product.deliveryMode, cfg);
  if (!showIntake) return null;
  return (
    <div className="mt-8 space-y-5">
      {(
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
    </div>
  );
}
