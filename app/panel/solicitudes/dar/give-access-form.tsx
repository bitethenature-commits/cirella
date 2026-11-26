"use client";

import { ArrowRight, CalendarClock, GraduationCap, Loader2, MessagesSquare, Package, UserPlus } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import type { AccessEndChoice } from "@/lib/access-end";
import { grantAccess, type ActionState } from "../../productos/actions";
import { AccessEndFields } from "../../productos/[id]/access-manager";
import { Tr, useT } from "@/lib/i18n/client";

export type GiveProduct = {
  id: string;
  title: string;
  /** session/reading: se dan desde «Dar una sesión o lectura» (con su fecha); el resto, aquí. */
  kind: "course" | "membership" | "digital" | "session" | "reading";
  published: boolean;
  /** Membresía: «month» | «year». */
  billingInterval?: string | null;
};

const GROUPS: { kind: GiveProduct["kind"]; label: string; icon: typeof Package }[] = [
  { kind: "course", label: "Cursos", icon: GraduationCap },
  { kind: "membership", label: "Membresías", icon: MessagesSquare },
  { kind: "digital", label: "Productos digitales", icon: Package },
  { kind: "reading", label: "Lecturas", icon: CalendarClock },
  { kind: "session", label: "Sesiones y talleres", icon: CalendarClock },
];

/**
 * «Dar acceso»: a cualquiera que haya hablado contigo, sin formulario previo. Eliges qué (curso,
 * membresía, producto digital, sesión o lectura), escribes su nombre y su email, y le llega el
 * email para entrar. Las sesiones y lecturas siguen en «Dar una sesión o lectura» (piden fecha).
 */
export function GiveAccessForm({ products, customers, timeZone, initialEmail }: { products: GiveProduct[]; customers: { name: string; email: string }[]; timeZone: string; initialEmail?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(grantAccess, undefined);
  const [productId, setProductId] = useState(products.find((p) => p.kind !== "session" && p.kind !== "reading")?.id ?? products[0]?.id ?? "");
  const known = customers.find((c) => c.email === initialEmail);
  const [name, setName] = useState(known?.name ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const periodChoice = (p: GiveProduct | undefined): AccessEndChoice => (p?.kind === "membership" ? (p.billingInterval === "year" ? "1y" : "1m") : "none");
  const [choice, setChoice] = useState<AccessEndChoice>(() => periodChoice(products.find((p) => p.id === productId)));
  const [date, setDate] = useState("");
  const chosen = products.find((p) => p.id === productId) ?? null;
  const dated = chosen?.kind === "session" || chosen?.kind === "reading";

  const pickEmail = (v: string) => {
    setEmail(v);
    const c = customers.find((x) => x.email === v.trim().toLowerCase());
    if (c && !name) setName(c.name);
  };

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold"><Tr s={"1 · ¿Qué le das?"} /></h2>
        {GROUPS.map((g) => {
          const items = products.filter((p) => p.kind === g.kind);
          if (!items.length) return null;
          return (
            <div key={g.kind}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <g.icon className="h-3.5 w-3.5" /> <Tr s={g.label} />
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((p) => {
                  const on = p.id === productId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProductId(p.id);
                        setChoice(periodChoice(p));
                      }}
                      aria-pressed={on}
                      className={`rounded-2xl border px-3 py-2.5 text-left text-sm transition ${on ? "border-ink bg-ink text-cream" : "border-line hover:border-ink/40"}`}
                    >
                      <span className="block font-medium leading-snug">{p.title}</span>
                      {!p.published && <span className={`text-xs ${on ? "text-cream/70" : "text-muted"}`}><Tr s={"Borrador"} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {chosen && dated ? (
        <section className="card space-y-3 p-5 sm:p-6">
          <h2 className="font-semibold"><Tr s={"2 · Su fecha y sus datos"} /></h2>
          <p className="text-sm text-muted">
            {chosen.kind === "session" ? t("Una sesión lleva día y hora") : t("Una lectura lleva sus datos de nacimiento")}<Tr s={": se da desde «Dar una sesión o lectura», con «"} />{chosen.title}<Tr s={"» ya elegida."} /></p>
          <Link href={`/panel/solicitudes/dar/sesion?producto=${chosen.id}${email ? `&email=${encodeURIComponent(email)}` : ""}`} className="btn btn-primary"><Tr s={"Continuar"} />{" "}<ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : chosen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
          className="card space-y-4 p-5 sm:p-6"
        >
          <h2 className="font-semibold"><Tr s={"2 · ¿A quién?"} /></h2>
          <Flash ok={state?.ok} error={state?.error} />
          <input type="hidden" name="productId" value={chosen.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="give-email"><Tr s={"Email"} /></label>
              <input id="give-email" name="email" type="email" required list="give-customers" value={email} onChange={(e) => pickEmail(e.target.value)} className="input" placeholder={t("su@email.com")} autoComplete="off" />
              <datalist id="give-customers">
                {customers.map((c) => (
                  <option key={c.email} value={c.email}>{c.name}</option>
                ))}
              </datalist>
            </div>
            <div>
              <label className="field-label" htmlFor="give-name"><Tr s={"Nombre"} /></label>
              <input id="give-name" name="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("Su nombre")} />
            </div>
          </div>
          <AccessEndFields timeZone={timeZone} idPrefix="give" choice={choice} setChoice={setChoice} date={date} setDate={setDate} />
          <p className="text-xs text-muted"><Tr s={"Le llega un email con el enlace para entrar a «"} />{chosen.title}<Tr s={"». No necesita contraseña ni rellenar nada."} /></p>
          {chosen.kind === "membership" && (
            <p className="rounded-xl bg-sand px-3 py-2 text-xs text-muted"><Tr s={"5 días antes de que venza le llega un email para renovar. Ese día se bloquea sola. En Membresía › Miembros ves la cuenta atrás y renuevas con el tick verde cuando pague."} /></p>
          )}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{" "}<Tr s={"Dar acceso"} /></button>
        </form>
      ) : null}
    </div>
  );
}
