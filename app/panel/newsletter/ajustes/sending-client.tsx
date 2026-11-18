"use client";

import { askConfirm } from "@/components/ui/ask-confirm";
import { CheckCircle2, CircleAlert, Globe, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { DOMAIN_STATUS, RECORD_HELP, recordShortName, type SendingDomain } from "@/lib/sending-rules";
import { checkDomain, connectDomain, removeDomain, saveSender, sendSendingTest, type SendingResult } from "./actions";

function Note({ r }: { r: SendingResult | null }) {
  if (!r) return null;
  return (
    <p className={`mt-2 text-xs ${r.ok ? "text-[#2f6b4a]" : "text-rose"}`} role="status">
      {r.ok ? r.message : r.error}
    </p>
  );
}

function Pill({ tone, children }: { tone: "ok" | "wait" | "bad"; children: React.ReactNode }) {
  return <span className={`nl-rel ${tone === "ok" ? "nl-rel-real" : tone === "wait" ? "nl-rel-aprox" : "nl-rel-none"}`}>{children}</span>;
}

/** Conectar el dominio, ver los registros DNS para copiarlos y comprobarlo. */
export function DomainCard({ domain, demo, canEdit }: { domain: SendingDomain | null; demo: boolean; canEdit: boolean }) {
  const [name, setName] = useState("");
  const [res, setRes] = useState<SendingResult | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<SendingResult>) => start(async () => setRes(await fn()));

  if (!domain) {
    return (
      <div className="card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Tu dominio</p>
            <p className="mt-0.5 text-sm text-muted">Conecta tu dominio para que la newsletter salga desde una dirección tuya (por ejemplo hola@tudominio.es) y no acabe en spam.</p>
            {canEdit ? (
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => connectDomain(name));
                }}
              >
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="tudominio.es" className="input h-11 min-w-0 flex-1 text-base sm:text-sm" aria-label="Tu dominio" required />
                <button className="btn btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />} Conectar
                </button>
              </form>
            ) : (
              <p className="mt-2 text-xs text-muted">Solo quien administra la web puede conectarlo.</p>
            )}
            {demo && <p className="mt-2 text-xs text-muted">Modo demostración (sin Resend): verás registros de ejemplo, pero la comprobación mira tu DNS de verdad.</p>}
            <Note r={res} />
          </div>
        </div>
      </div>
    );
  }

  const st = DOMAIN_STATUS[domain.status] ?? { label: domain.status, tone: "wait" as const };
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Globe className="h-5 w-5 shrink-0 text-muted" />
        <p className="font-semibold">{domain.name}</p>
        <Pill tone={st.tone}>{st.label}</Pill>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(checkDomain)}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Comprobar ahora
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={pending}
              onClick={async () => (await askConfirm(`¿Quitar ${domain.name}? La newsletter volverá a salir desde la dirección de siempre.${domain.id ? " También se quita de Resend." : ""}`)) && run(removeDomain)}
            >
              <Trash2 className="h-4 w-4" /> Quitar
            </button>
          </div>
        )}
      </div>
      {domain.status === "verified" ? (
        <p className="mt-2 text-sm text-muted">Todo listo: Resend puede enviar en nombre de {domain.name}. Elige abajo la dirección.</p>
      ) : (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Entra en united-domains › tu dominio › <strong>Configuración DNS</strong>.</li>
          <li>Añade cada registro de la tabla: el tipo, el nombre y el valor (con el botón Copiar). En los MX, pon también la prioridad.</li>
          <li>Vuelve aquí y pulsa «Comprobar ahora». Puede tardar de unos minutos a unas horas; se mira solo cada 10 minutos.</li>
        </ol>
      )}
      {demo && <p className="mt-2 text-xs text-muted">Modo demostración: estos registros son de ejemplo. Con Resend configurado verás los tuyos.</p>}
      {domain.error && <p className="mt-2 text-xs text-rose">{domain.error}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Para qué</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 pr-3 font-medium">Nombre</th>
              <th className="py-2 pr-3 font-medium">Valor</th>
              <th className="py-2 pr-3 font-medium">Prioridad</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {domain.records.map((r, i) => {
              const ok = r.status === "verified";
              const short = recordShortName(r.name, domain.name);
              return (
                <tr key={i} className="align-top">
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold">{r.kind}</span>
                    {r.extra && <span className="ml-1 text-xs text-muted">(recomendado)</span>}
                    <p className="max-w-[12rem] text-xs text-muted">{RECORD_HELP[r.kind] ?? RECORD_HELP[r.type] ?? ""}</p>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.type}</td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      <code className="rounded bg-sand px-1.5 py-0.5 text-xs">{short}</code>
                      <CopyButton text={short} label="Copiar" className="btn btn-outline btn-sm" />
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      <code className="block max-w-[16rem] truncate rounded bg-sand px-1.5 py-0.5 text-xs" title={r.value}>{r.value}</code>
                      <CopyButton text={r.value} label="Copiar" className="btn btn-outline btn-sm" />
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{r.priority ?? "—"}</td>
                  <td className="py-2.5 text-xs">
                    {ok ? (
                      <span className="inline-flex items-center gap-1 text-[#2f6b4a]"><CheckCircle2 className="h-4 w-4" /> Bien</span>
                    ) : r.seen ? (
                      <span className="inline-flex items-center gap-1 text-[#8a6420]"><CircleAlert className="h-4 w-4" /> Visto, falta que Resend lo confirme</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#8a6420]"><CircleAlert className="h-4 w-4" /> {r.status === "failed" ? "No encontrado" : "Falta"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {domain.checkedAt && <p className="mt-2 text-xs text-muted">Última comprobación: {new Date(domain.checkedAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
      <Note r={res} />
    </div>
  );
}

/** Nombre que se ve, dirección de su dominio y a dónde llegan las respuestas. */
export function SenderForm(p: {
  initial: { name: string; address: string; replyTo: string };
  domain: string | null;
  verified: boolean;
  fallback: { name: string; address: string; replyTo: string };
  canEdit: boolean;
}) {
  const [name, setName] = useState(p.initial.name);
  const [local, setLocal] = useState(p.initial.address.split("@")[0] ?? "");
  const [replyTo, setReplyTo] = useState(p.initial.replyTo);
  const [res, setRes] = useState<SendingResult | null>(null);
  const [pending, start] = useTransition();
  const address = p.domain && local.trim() ? `${local.trim().toLowerCase()}@${p.domain}` : "";
  const shown = `${name.trim() || p.fallback.name} <${(p.verified && address) || p.fallback.address}>`;
  return (
    <form
      className="card space-y-3 p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await saveSender({ name, address, replyTo })));
      }}
    >
      <div>
        <p className="font-semibold">Remitente</p>
        <p className="mt-0.5 text-sm text-muted">Lo que ve quien recibe tu newsletter (y tus automatizaciones). Vacío = lo de siempre.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="snd-name">Nombre que se ve</label>
          <input id="snd-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={p.fallback.name} className="input h-11 text-base sm:text-sm" disabled={!p.canEdit} />
        </div>
        <div>
          <label className="field-label" htmlFor="snd-addr">Dirección</label>
          {p.domain ? (
            <div className="flex items-center gap-1.5">
              <input id="snd-addr" value={local} maxLength={64} onChange={(e) => setLocal(e.target.value.replace(/[\s@<>"]/g, ""))} placeholder="hola" className="input h-11 min-w-0 flex-1 text-base sm:text-sm" disabled={!p.canEdit} />
              <span className="text-sm text-muted">@{p.domain}</span>
            </div>
          ) : (
            <p className="text-xs text-muted">Conecta antes tu dominio. Ahora sale desde {p.fallback.address}.</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="snd-reply">Las respuestas llegan a</label>
          <input id="snd-reply" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder={p.fallback.replyTo} className="input h-11 text-base sm:text-sm" disabled={!p.canEdit} />
        </div>
      </div>
      <p className="rounded-xl bg-sand px-3 py-2 text-sm">
        Se verá así: <strong>{shown}</strong>
      </p>
      {p.domain && address && !p.verified && <p className="text-xs text-[#8a6420]">Hasta que {p.domain} esté verificado, sale desde {p.fallback.address}.</p>}
      {p.canEdit ? (
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar remitente
        </button>
      ) : (
        <p className="text-xs text-muted">Solo quien administra la web puede cambiarlo.</p>
      )}
      <Note r={res} />
    </form>
  );
}

/** Enviar un email de prueba con el remitente de la newsletter. */
export function TestEmail({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [res, setRes] = useState<SendingResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await sendSendingTest(to)));
      }}
    >
      <p className="font-semibold">Email de prueba</p>
      <p className="mt-0.5 text-sm text-muted">Te llega un email corto con el remitente de tu newsletter, para ver que todo sale bien.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="input h-11 min-w-0 flex-1 text-base sm:text-sm" aria-label="Enviar a" required />
        <button className="btn btn-primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar prueba
        </button>
      </div>
      <Note r={res} />
    </form>
  );
}
