"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { LinkInput, type LinkTarget } from "@/components/panel/blocks/link-input";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  BUBBLES_MAX,
  NEWSLETTER_FORM_DEFAULTS,
  READINGS_DEFAULTS,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  STEPS_MAX,
  SYSTEMS_MAX,
  type PageConfig,
} from "@/lib/page-config";
import { SITE_TEXT_MAX, SITE_TEXTS, type SiteTextKey } from "@/lib/site-texts";

/**
 * Los campos de cada parte de la portada (accesos, «Sobre mí», sistemas, lecturas, botones, redes, contacto,
 * newsletter, testimonios, preguntas y los textos fijos). Los usan el editor de «Mi página» (sus pestañas) y las
 * ventanitas del Canva (app/panel/canva), que abren solo la parte que se pulsa.
 */

export type SetCfg = <K extends keyof PageConfig>(k: K, v: PageConfig[K]) => void;
type Props = { cfg: PageConfig; set: SetCfg };
type WithLinks = Props & { linkTargets: LinkTarget[] };

export const uid = () => Math.random().toString(36).slice(2, 10);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/** Elegir una de pocas opciones con botones. */
function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(options) as T[]).map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} className={`rounded-full border px-3 py-1.5 text-xs transition ${value === o ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}>
            {options[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Subir, bajar y quitar una fila de una lista. */
function RowTools<T>({ list, i, onChange, label }: { list: T[]; i: number; onChange: (next: T[]) => void; label: string }) {
  const swap = (j: number) => {
    const a = [...list];
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" disabled={i === 0} onClick={() => swap(i - 1)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" disabled={i === list.length - 1} onClick={() => swap(i + 1)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => onChange(list.filter((_, n) => n !== i))} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label={label}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function BubblesFields({ cfg, set, linkTargets }: WithLinks) {
  const all = cfg.bubbles ?? [];
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="ed-bubbles">
      <h3 id="ed-bubbles" className="font-semibold">Accesos</h3>
      <p className="text-xs text-muted">Burbujas redondas con foto bajo tu presentación, en una fila (de 1 a {BUBBLES_MAX}). Por ejemplo: Sobre mí, Cursos, Hacerte miembro.</p>
      <div className="mt-4 space-y-2.5">
        {all.map((b, i) => (
          <div key={b.id} className="grid items-center gap-4 rounded-xl border border-line bg-white p-3 sm:grid-cols-[104px_1fr]">
            <ImageUpload shape="circle" small value={b.image} onChange={(v) => set("bubbles", all.map((x) => (x.id === b.id ? { ...x, image: v } : x)))} label="Foto" />
            <div className="space-y-2">
              <input className="input h-10 text-sm" placeholder="Texto (p. ej. Sobre mí)" maxLength={30} value={b.label} aria-label="Texto de la burbuja" onChange={(e) => set("bubbles", all.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))} />
              <LinkInput value={b.url} ariaLabel="Enlace de la burbuja" targets={linkTargets} onChange={(v) => set("bubbles", all.map((x) => (x.id === b.id ? { ...x, url: v } : x)))} />
              <RowTools list={all} i={i} onChange={(next) => set("bubbles", next)} label="Quitar burbuja" />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => set("bubbles", [...all, { id: uid(), label: "", url: "", image: null }])} disabled={all.length >= BUBBLES_MAX} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir burbuja</button>
    </section>
  );
}

export function AboutFields({ cfg, set, linkTargets, personal }: WithLinks & { personal: boolean }) {
  return (
    <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="ed-about">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="ed-about" className="font-semibold">Tarjeta «Sobre mí»</h3>
          <p className="text-xs text-muted">Tu foto a la derecha y un texto corto a la izquierda. Toda la tarjeta lleva a tu página «Sobre mí».</p>
        </div>
        {cfg.about ? (
          <button type="button" onClick={() => set("about", null)} className="btn btn-ghost btn-sm shrink-0">Quitar</button>
        ) : (
          <button type="button" onClick={() => set("about", { eyebrow: "Sobre mí", title: `Hola, soy ${cfg.displayName.split(" ")[0]}`, text: "", url: personal ? "/sobre-mi" : "", image: cfg.avatarUrl, linkLabel: "Conoce mi historia" })} className="btn btn-outline btn-sm shrink-0"><Plus className="h-4 w-4" /> Añadir</button>
        )}
      </div>
      {cfg.about && (
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-2">
            <input className="input h-10 text-sm" placeholder="Antetítulo (p. ej. Sobre mí)" maxLength={40} aria-label="Antetítulo de la tarjeta Sobre mí" value={cfg.about.eyebrow ?? ""} onChange={(e) => set("about", { ...cfg.about!, eyebrow: e.target.value })} />
            <input className="input h-10 text-sm" placeholder="Título (p. ej. Hola, soy Cirella)" maxLength={80} aria-label="Título de la tarjeta Sobre mí" value={cfg.about.title} onChange={(e) => set("about", { ...cfg.about!, title: e.target.value })} />
            <textarea className="input text-sm" rows={3} placeholder="Texto corto" maxLength={400} aria-label="Texto de la tarjeta Sobre mí" value={cfg.about.text} onChange={(e) => set("about", { ...cfg.about!, text: e.target.value })} />
            <LinkInput value={cfg.about.url} ariaLabel="Enlace de la tarjeta Sobre mí" targets={linkTargets} onChange={(v) => set("about", { ...cfg.about!, url: v })} />
            <input className="input h-10 text-sm" placeholder="Texto del enlace (Conoce mi historia)" maxLength={40} aria-label="Texto del enlace de Sobre mí" value={cfg.about.linkLabel} onChange={(e) => set("about", { ...cfg.about!, linkLabel: e.target.value })} />
          </div>
          <ImageUpload value={cfg.about.image} onChange={(v) => set("about", { ...cfg.about!, image: v })} label="Foto" />
        </div>
      )}
      {cfg.about && (
        <div className="space-y-3">
          <Pills
            label="Tamaño de la foto"
            value={cfg.about.imageSize ?? "tall"}
            options={{ tall: "Alta", portrait: "Retrato", square: "Cuadrada" }}
            onChange={(v) => set("about", { ...cfg.about!, imageSize: v })}
          />
          <Pills
            label="Lado de la foto (en el ordenador)"
            value={cfg.about.imageSide ?? "right"}
            options={{ right: "Derecha", left: "Izquierda" }}
            onChange={(v) => set("about", { ...cfg.about!, imageSide: v })}
          />
          <p className="field-hint">La forma de la foto (arco, óvalo, círculo…) y su marco, en Diseño › Fotos.</p>
        </div>
      )}
    </section>
  );
}

export function SystemsFields({ cfg, set, linkTargets }: WithLinks) {
  const all = cfg.systems ?? [];
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="ed-systems">
      <h3 id="ed-systems" className="font-semibold">Sistemas con los que trabajo</h3>
      <p className="text-xs text-muted">Cada sistema con su nombre (el dibujo sale solo según el nombre: Human Design, Astrología, Gene Keys, Luna…) y el enlace a la página de ese método.</p>
      <div className="mt-4 space-y-2.5">
        {all.map((sys, i) => (
          <div key={sys.id} className="grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-[140px_1fr]">
            <ImageUpload value={sys.image} onChange={(v) => set("systems", all.map((x) => (x.id === sys.id ? { ...x, image: v } : x)))} label="Foto" />
            <div className="space-y-2">
              <input className="input h-10 text-sm" placeholder="Título (p. ej. Human Design)" maxLength={60} aria-label="Título del sistema" value={sys.title} onChange={(e) => set("systems", all.map((x) => (x.id === sys.id ? { ...x, title: e.target.value } : x)))} />
              <input className="input h-10 text-sm" placeholder="Texto corto" maxLength={200} aria-label="Texto del sistema" value={sys.text} onChange={(e) => set("systems", all.map((x) => (x.id === sys.id ? { ...x, text: e.target.value } : x)))} />
              <LinkInput value={sys.url} ariaLabel="Enlace del sistema" targets={linkTargets} onChange={(v) => set("systems", all.map((x) => (x.id === sys.id ? { ...x, url: v } : x)))} />
              <RowTools list={all} i={i} onChange={(next) => set("systems", next)} label="Quitar sistema" />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => set("systems", [...all, { id: uid(), title: "", text: "", url: "", image: null }])} disabled={all.length >= SYSTEMS_MAX} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir sistema</button>
    </section>
  );
}

export function ReadingsFields({ cfg, set }: Props) {
  return (
    <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="ed-readings">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="ed-readings" className="font-semibold">Lecturas, sesiones y círculos</h3>
          <p className="text-xs text-muted">Dos tarjetas que explican cómo funciona cada cosa; cada una abre su página con los pasos y tus productos. Debajo salen tus próximos círculos de la luna (talleres marcados como círculo).</p>
        </div>
        {cfg.readings ? (
          <button type="button" onClick={() => set("readings", null)} className="btn btn-ghost btn-sm shrink-0">Quitar</button>
        ) : (
          <button type="button" onClick={() => set("readings", { reading: { ...READINGS_DEFAULTS.reading }, session: { ...READINGS_DEFAULTS.session }, circlesTitle: READINGS_DEFAULTS.circlesTitle })} className="btn btn-outline btn-sm shrink-0"><Plus className="h-4 w-4" /> Añadir</button>
        )}
      </div>
      {cfg.readings &&
        (["reading", "session"] as const).map((k) => {
          const card = cfg.readings![k];
          const put = (patch: Partial<typeof card>) => set("readings", { ...cfg.readings!, [k]: { ...card, ...patch } });
          return (
            <div key={k} className="space-y-2 rounded-xl border border-line bg-white p-3">
              <p className="text-sm font-semibold">{k === "reading" ? "Lectura (te la preparo yo)" : "Sesión (en directo)"}</p>
              <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <input className="input h-10 text-sm" placeholder={READINGS_DEFAULTS[k].eyebrow} maxLength={30} aria-label="Etiqueta" value={card.eyebrow} onChange={(e) => put({ eyebrow: e.target.value })} />
                <input className="input h-10 text-sm" placeholder={READINGS_DEFAULTS[k].title} maxLength={60} aria-label="Título" value={card.title} onChange={(e) => put({ title: e.target.value })} />
              </div>
              <input className="input h-10 text-sm" placeholder={READINGS_DEFAULTS[k].text} maxLength={240} aria-label="Texto" value={card.text} onChange={(e) => put({ text: e.target.value })} />
              <label className="field-label !mb-0 !mt-1">Pasos para reservar (uno por línea, hasta {STEPS_MAX})</label>
              <textarea className="input text-sm" rows={4} aria-label="Pasos" value={card.steps.join("\n")} onChange={(e) => put({ steps: e.target.value.split("\n").slice(0, STEPS_MAX) })} />
            </div>
          );
        })}
      {cfg.readings && (
        <Field label="Título de los círculos de la luna">
          <input className="input h-10 text-sm" placeholder={READINGS_DEFAULTS.circlesTitle} maxLength={80} value={cfg.readings.circlesTitle} onChange={(e) => set("readings", { ...cfg.readings!, circlesTitle: e.target.value })} />
        </Field>
      )}
      {cfg.readings && <TextsFields cfg={cfg} set={set} keys={["readings.steps", "circles.free", "circles.paid"]} />}
    </section>
  );
}

export function LinksFields({ cfg, set, linkTargets }: WithLinks) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="font-semibold">Botones principales</h3>
      <p className="text-xs text-muted">Enlaces destacados bajo tu presentación: podcast, newsletter, un producto concreto…</p>
      <div className="mt-4 space-y-2.5">
        {cfg.links.map((l, i) => (
          <div key={l.id} className="rounded-xl border border-line bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input h-10 text-sm" placeholder="Texto del botón" value={l.label} onChange={(e) => set("links", cfg.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
              <LinkInput value={l.url} ariaLabel="Enlace del botón principal" placeholder="https://… o elige una de tus páginas" targets={linkTargets} onChange={(v) => set("links", cfg.links.map((x) => (x.id === l.id ? { ...x, url: v } : x)))} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!l.highlight} onChange={(e) => set("links", cfg.links.map((x) => (x.id === l.id ? { ...x, highlight: e.target.checked } : x)))} className="accent-[#0E1024]" /> Destacado
              </label>
              <span className="flex-1" />
              <RowTools list={cfg.links} i={i} onChange={(next) => set("links", next)} label="Quitar botón" />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => set("links", [...cfg.links, { id: uid(), label: "", url: "" }])} disabled={cfg.links.length >= 12} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir botón</button>
    </section>
  );
}

export function SocialsFields({ cfg, set }: Props) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="font-semibold">Redes sociales</h3>
      <p className="text-xs text-muted">Escribe las que quieras que salgan bajo tu presentación. Vacía una para quitarla. Para cambiar su orden, pasa por encima de una en la web y usa sus flechas.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[...new Set([...(cfg.socialOrder ?? []), ...SOCIAL_KEYS])].map((k) => (
          <Field key={k} label={SOCIAL_LABEL[k]}>
            <input
              className="input h-10 text-sm"
              placeholder={k === "email" ? "tu@email.com" : k === "website" ? "tuweb.com" : "@usuario"}
              value={cfg.socials[k] ?? ""}
              onChange={(e) => {
                const next = { ...cfg.socials };
                if (e.target.value) next[k] = e.target.value;
                else delete next[k];
                set("socials", next);
              }}
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

export function ContactFields({ cfg, set }: Props) {
  return (
    <section className="card space-y-3 p-5 sm:p-6">
      <h3 className="font-semibold">Contacto («Hablemos»)</h3>
      <Field label="Mensaje">
        <textarea className="input text-sm" rows={2} placeholder="¿Tienes alguna pregunta? Escríbeme." maxLength={300} value={cfg.contact.message ?? ""} onChange={(e) => set("contact", { ...cfg.contact, message: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email de contacto" hint="Sin email, la sección no sale.">
          <input className="input h-10 text-sm" placeholder="tu@email.com" value={cfg.contact.email ?? ""} onChange={(e) => set("contact", { ...cfg.contact, email: e.target.value })} />
        </Field>
      </div>
      <TextsFields cfg={cfg} set={set} keys={["contact.email"]} />
    </section>
  );
}

export function NewsletterFields({ cfg, set }: Props) {
  const nl = { ...NEWSLETTER_FORM_DEFAULTS, footer: false, ...cfg.newsletter };
  return (
    <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="nl-form-title">
      <div>
        <h3 id="nl-form-title" className="font-semibold">Formulario de la newsletter</h3>
        <p className="text-xs text-muted">Sale debajo de «Hablemos» (si tienes tu email de contacto) y, si quieres, en el pie de todas tus páginas. Quien se apunta recibe un email para confirmarlo y se le abre el Portal de Noticias.</p>
      </div>
      <Field label="Texto">
        <textarea className="input min-h-20 text-base sm:text-sm" maxLength={300} value={nl.text} onChange={(e) => set("newsletter", { ...nl, text: e.target.value })} />
      </Field>
      <Field label="Texto del botón">
        <input className="input text-base sm:text-sm" maxLength={30} value={nl.button} onChange={(e) => set("newsletter", { ...nl, button: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[#0E1024]" checked={!!cfg.newsletter?.footer} onChange={(e) => set("newsletter", { ...nl, footer: e.target.checked })} />
        También en el pie de todas mis páginas
      </label>
      <TextsFields cfg={cfg} set={set} keys={["nl.footerTitle", "nl.name", "nl.email", "nl.consent", "nl.privacy", "nl.portal", "nl.doneTitle"]} />
    </section>
  );
}

export function TestimonialsFields({ cfg, set }: Props) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="font-semibold">Testimonios</h3>
      <p className="text-xs text-muted">Lo que dice la gente de ti. Salen uno detrás de otro.</p>
      <div className="mt-4 space-y-2.5">
        {cfg.testimonials.map((t, i) => (
          <div key={t.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
            <textarea className="input text-sm" rows={2} placeholder="Lo que dijo tu clienta" maxLength={500} value={t.quote} onChange={(e) => set("testimonials", cfg.testimonials.map((x) => (x.id === t.id ? { ...x, quote: e.target.value } : x)))} />
            <div className="flex gap-2">
              <input className="input h-10 flex-1 text-sm" placeholder="Nombre" maxLength={80} value={t.author} onChange={(e) => set("testimonials", cfg.testimonials.map((x) => (x.id === t.id ? { ...x, author: e.target.value } : x)))} />
              <input className="input h-10 flex-1 text-sm" placeholder="Detalle (opcional)" maxLength={80} value={t.role ?? ""} onChange={(e) => set("testimonials", cfg.testimonials.map((x) => (x.id === t.id ? { ...x, role: e.target.value } : x)))} />
            </div>
            <RowTools list={cfg.testimonials} i={i} onChange={(next) => set("testimonials", next)} label="Quitar testimonio" />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => set("testimonials", [...cfg.testimonials, { id: uid(), author: "", quote: "" }])} disabled={cfg.testimonials.length >= 12} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir testimonio</button>
    </section>
  );
}

export function FaqFields({ cfg, set }: Props) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="font-semibold">Preguntas frecuentes</h3>
      <div className="mt-4 space-y-2.5">
        {cfg.faqs.map((f, i) => (
          <div key={f.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
            <input className="input h-10 text-sm" placeholder="Pregunta" maxLength={200} value={f.q} onChange={(e) => set("faqs", cfg.faqs.map((x) => (x.id === f.id ? { ...x, q: e.target.value } : x)))} />
            <textarea className="input text-sm" rows={2} placeholder="Respuesta" maxLength={1000} value={f.a} onChange={(e) => set("faqs", cfg.faqs.map((x) => (x.id === f.id ? { ...x, a: e.target.value } : x)))} />
            <RowTools list={cfg.faqs} i={i} onChange={(next) => set("faqs", next)} label="Quitar pregunta" />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => set("faqs", [...cfg.faqs, { id: uid(), q: "", a: "" }])} disabled={cfg.faqs.length >= 20} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir pregunta</button>
    </section>
  );
}

/** Para qué es cada texto fijo (su etiqueta en las ventanitas). */
const TEXT_LABEL: Partial<Record<SiteTextKey, string>> = {
  "readings.steps": "Enlace de las tarjetas («Ver los pasos»)",
  "circles.free": "Botón de un círculo gratis",
  "circles.paid": "Botón de un círculo de pago",
  "contact.email": "Botón del email",
  "nl.footerTitle": "Título del formulario",
  "nl.name": "Etiqueta del nombre",
  "nl.email": "Etiqueta del email",
  "nl.consent": "Letra pequeña ({nombre} es tu nombre)",
  "nl.privacy": "Nombre del enlace a la privacidad (siempre sale)",
  "nl.portal": "Aviso del Portal de Noticias",
  "nl.doneTitle": "Título al apuntarse",
  "legal.aviso": "Aviso legal",
  "legal.condiciones": "Condiciones",
  "legal.privacidad": "Privacidad",
  "legal.cookies": "Cookies",
  "footer.signature": "Firma ({titular} es quien vende y {año}, el año)",
  "account.enter": "Botón de arriba sin sesión",
  "account.mine": "Botón de arriba con sesión",
  "account.footerIn": "Pie, con sesión",
  "account.footerPersonal": "Pie, sin sesión",
  "account.footer": "Pie, sin sesión (plataforma)",
  "account.signup": "Pie, crear cuenta",
};

/** Textos fijos de la web (lib/site-texts.ts): valen para todas las páginas. Vacío = el de siempre. */
export function TextsFields({ cfg, set, keys, title }: Props & { keys: SiteTextKey[]; title?: string }) {
  return (
    <div className="space-y-2.5">
      {title && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>}
      {keys.map((k) => {
        const long = SITE_TEXTS[k].length > 60;
        const value = cfg.texts?.[k] ?? "";
        // Tal cual se escribe (con sus espacios): se recorta al leerlo (siteText) y al guardarlo.
        const change = (v: string) => {
          const next = { ...(cfg.texts ?? {}) };
          if (v) next[k] = v.slice(0, SITE_TEXT_MAX);
          else delete next[k];
          set("texts", next);
        };
        return (
          <Field key={k} label={TEXT_LABEL[k] ?? k}>
            {long ? (
              <textarea className="input text-sm" rows={3} maxLength={SITE_TEXT_MAX} placeholder={SITE_TEXTS[k]} value={value} onChange={(e) => change(e.target.value)} />
            ) : (
              <input className="input h-10 text-sm" maxLength={SITE_TEXT_MAX} placeholder={SITE_TEXTS[k]} value={value} onChange={(e) => change(e.target.value)} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
