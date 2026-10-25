"use client";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useMemo, useState } from "react";
import { IntakeFields } from "@/components/booking/intake-fields";
import { SlotPicker } from "@/components/booking/slot-picker";
import { TimezoneSelect } from "@/components/booking/timezone-select";
import { Flash } from "@/components/ui/flash";
import type { IntakeConfig } from "@/lib/intake";
import { giveManually, type GiveState } from "../actions";

type P = { id: string; title: string; kind: "session" | "workshop" | "reading"; intake: IntakeConfig };

function Radio({ name, value, checked, onChange, title, hint }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; hint?: string }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 text-sm transition ${checked ? "border-ink ring-1 ring-ink" : "border-line"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 accent-[#0E1024]" />
      <span>
        <span className="block font-semibold">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2.5 font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-xs text-cream">{n}</span> {title}
      </h2>
      {children}
    </section>
  );
}

export function GiveForm({
  products,
  customers,
  ownerTz,
  initialProductId,
  initialEmail,
}: {
  products: P[];
  customers: { name: string; email: string }[];
  ownerTz: string;
  initialProductId?: string;
  initialEmail?: string;
}) {
  const [state, action, pending] = useActionState<GiveState, FormData>(giveManually, undefined);
  // Un id por formulario: repetir el envío (doble toque, volver atrás) no da dos sesiones.
  const [requestId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const [productId, setProductId] = useState(products.find((p) => p.id === initialProductId)?.id ?? products[0].id);
  const product = products.find((p) => p.id === productId)!;
  const [email, setEmail] = useState(initialEmail ?? "");
  const [name, setName] = useState(customers.find((c) => c.email === initialEmail)?.name ?? "");
  const [payment, setPayment] = useState<"gift" | "paid_elsewhere">("gift");
  const [when, setWhen] = useState<"slot" | "custom" | "later">("slot");
  const [slot, setSlot] = useState("");
  const [clientTz, setClientTz] = useState("");
  const [intakeMode, setIntakeMode] = useState<"ask" | "write">("ask");
  const asks = product.intake.birth !== "off" || product.intake.questions.length > 0;
  const ownerIntake = useMemo<IntakeConfig>(() => ({ birth: "optional", questions: product.intake.questions.map((q) => ({ ...q, required: false })) }), [product]);
  let n = 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <Flash error={state?.error} />
      <Step n={++n} title="Clienta">
        <div>
          <label className="field-label" htmlFor="give-email">Email</label>
          <input
            id="give-email"
            name="email"
            type="email"
            required
            list="give-customers"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              const c = customers.find((x) => x.email === e.target.value.trim().toLowerCase());
              if (c?.name && !name) setName(c.name);
            }}
            className="input h-11"
          />
          <datalist id="give-customers">
            {customers.map((c) => (
              <option key={c.email} value={c.email}>{c.name}</option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="give-name">Nombre</label>
          <input id="give-name" name="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="input h-11" />
        </div>
      </Step>

      <Step n={++n} title="Qué le das">
        <label className="field-label" htmlFor="give-product">Sesión o lectura</label>
        <select id="give-product" name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} className="input h-11">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.kind === "workshop" ? " (taller)" : p.kind === "reading" ? " (lectura)" : ""}
            </option>
          ))}
        </select>
      </Step>

      <Step n={++n} title="Pago">
        <div className="grid gap-2 sm:grid-cols-2">
          <Radio name="payment" value="gift" checked={payment === "gift"} onChange={() => setPayment("gift")} title="Regalo" />
          <Radio name="payment" value="paid_elsewhere" checked={payment === "paid_elsewhere"} onChange={() => setPayment("paid_elsewhere")} title="Pagada fuera" hint="Bizum, transferencia, efectivo…" />
        </div>
        {payment === "paid_elsewhere" && (
          <div>
            <label className="field-label" htmlFor="give-note">Nota <span className="font-normal text-muted">(solo la ves tú)</span></label>
            <input id="give-note" name="paidNote" maxLength={120} placeholder="Bizum 60 €" className="input h-11" />
            <p className="field-hint">Si te la han pagado por Bizum o transferencia, emite tú la factura.</p>
          </div>
        )}
      </Step>

      {product.kind === "session" && (
        <Step n={++n} title="Fecha">
          <div className="grid gap-2">
            <Radio name="when" value="slot" checked={when === "slot"} onChange={() => setWhen("slot")} title="Elegir en mi agenda" />
            <Radio name="when" value="custom" checked={when === "custom"} onChange={() => setWhen("custom")} title="Otra fecha y hora" hint="Cualquier hora, aunque esté fuera de tu horario" />
            <Radio name="when" value="later" checked={when === "later"} onChange={() => setWhen("later")} title="Que la elija ella" hint="Le llega un enlace para elegir en tu agenda" />
          </div>
          {when === "slot" && (
            <div className="pt-2">
              <input type="hidden" name="slotStart" value={slot} />
              <SlotPicker key={productId} productId={productId} manual value={slot} onChange={setSlot} initialTz={ownerTz} viewer="owner" emptyText="No tienes huecos libres en tu horario. Elige «Otra fecha y hora»." />
            </div>
          )}
          {when === "custom" && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="field-label" htmlFor="give-date">Día</label>
                <input id="give-date" type="date" name="date" required className="input h-11" />
              </div>
              <div>
                <label className="field-label" htmlFor="give-time">Hora (la tuya)</label>
                <input id="give-time" type="time" step={300} name="time" required className="input h-11" />
              </div>
            </div>
          )}
          <div className="pt-2">
            <label className="field-label" htmlFor="give-tz">Zona horaria de la clienta <span className="font-normal text-muted">(opcional)</span></label>
            <TimezoneSelect id="give-tz" value={clientTz || ownerTz} onChange={setClientTz} />
            <input type="hidden" name="clientTimezone" value={clientTz} />
            <p className="field-hint">Sus emails le dirán la hora en su zona.</p>
          </div>
        </Step>
      )}

      {asks && (
        <Step n={++n} title="Datos para la lectura">
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio name="intakeMode" value="ask" checked={intakeMode === "ask"} onChange={() => setIntakeMode("ask")} title="Se los pido por email" />
            <Radio name="intakeMode" value="write" checked={intakeMode === "write"} onChange={() => setIntakeMode("write")} title="Ya los tengo" />
          </div>
          {intakeMode === "write" && <IntakeFields config={ownerIntake} theme="app" idPrefix="give-intake" forOwner />}
        </Step>
      )}

      <Step n={++n} title="Mensaje">
        <label className="field-label" htmlFor="give-message">Para {name.split(" ")[0] || "ella"} <span className="font-normal text-muted">(opcional)</span></label>
        <textarea id="give-message" name="message" rows={3} maxLength={1000} className="input" placeholder="¡Feliz cumpleaños! Te regalo tu lectura." />
      </Step>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-cream/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button className="btn btn-primary h-12 w-full" disabled={pending || (product.kind === "session" && when === "slot" && !slot)}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {product.kind === "reading" ? "Dar lectura" : "Dar sesión"}
        </button>
      </div>
    </form>
  );
}
