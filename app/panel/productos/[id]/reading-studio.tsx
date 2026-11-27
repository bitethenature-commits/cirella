"use client";
import { startTransition, useActionState, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, Clock, ExternalLink, Heart, ImagePlus, Loader2, Mail, Plus, Sparkles, Users, Video, X } from "lucide-react";
import { CategoryIcons } from "@/components/creator-page/category-icons";
import { MoonCircleArt } from "@/components/creator-page/moon-circle-art";
import { ProductImage } from "@/components/creator-page/product-art";
import { FlowerOfLife } from "@/components/creator-page/sacred-button";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { COURSE_CATEGORIES, COURSE_CATEGORY_LABEL, type CourseCategory } from "@/lib/course-categories";
import { MOON_KIND_ICON, MOON_KIND_LABEL, MOON_KINDS, moonCircleSky, moonPhrase, moonSkyFor, type MoonKind } from "@/lib/moon-circle-sky";
import { SIGNS, SIGN_GLYPHS } from "@/lib/astro-calendar";
import { PRODUCT_TESTIMONIALS_MAX, type ProductTestimonial } from "@/lib/product-testimonials";
import { CARD_CTA_MAX, PERK_ICON_KEYS, type PageTexts, type StudioKind } from "@/lib/product-texts";
import { PERK_ICONS, perkIcon } from "@/components/creator-page/perk-icons";
import { OracleSide } from "@/components/creator-page/oracle-card";
import { updateProduct, type ActionState } from "../actions";
import { PostCardBody, PostCover, type CardPost } from "@/app/area/membership/post-card";
import { KindBadge, kindStyle, ka } from "@/app/area/membership/kind-style";
import { Ornament, SacredFlower } from "@/app/area/membership/vip";
import { formatDate, formatSessionDate, labelToMinutes, zonedTimeToUtc } from "@/lib/tz";
import { tzCity } from "@/lib/timezones";
import { Tr, useT } from "@/lib/i18n/client";

/** Su publicación en la membresía (círculo de la luna). */
export type StudioCirclePost = {
  tier: string | null;
  body: string;
  joinLabel: string;
  publishedAt: string | null;
  likes: number;
  comments: number;
  timeZone: string;
};

const TOPICS = COURSE_CATEGORIES.filter((c) => c !== "ESPECIAL");

export type StudioProduct = {
  id: string;
  kind: StudioKind;
  title: string;
  summary: string;
  description: string;
  descriptionFormat: string | null;
  imageUrl: string | null;
  emoji: string;
  price: string;
  ctaLabel: string;
  /** El texto del botón tal como sale en la web. */
  cta: string;
  status: string;
  featured: boolean;
  instructions: string;
  deliveryMode: string;
  slug: string;
  /** Sus sistemas (uno o varios, como «Astrología + Mi energía»). */
  topics: CourseCategory[];
  testimonials: ProductTestimonial[];
  texts: PageTexts;
  durationMin: number;
  bufferMin: number;
  // Sesión 1:1: lo que no se toca aquí viaja tal cual.
  notice: { name: "minNoticeDays" | "minNoticeHours"; value: number };
  horizonDays: string;
  meetingUrl: string;
  // Círculo: su fecha y sus plazas.
  moonCircle: boolean;
  eventDate: string;
  eventTime: string;
  capacity: string;
};

const ROMAN = ["I", "II", "III", "IV"];

function GoldStar({ className = "", left = false }: { className?: string; left?: boolean }) {
  return (
    <div aria-hidden className={`flex max-w-[13rem] items-center gap-3 ${left ? "" : "mx-auto"} ${className}`} style={{ color: "var(--c-gold)" }}>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
      <span className="text-xs">✦</span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
    </div>
  );
}

function Step({ n, title, hint, children, id }: { n: number; title: string; hint: string; children: ReactNode; id: string }) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-t`}>
      <div className="text-center">
        <p className="cp-eyebrow !tracking-[0.4em]" style={{ color: "var(--c-gold)" }}><Tr s={"Paso"} />{" "}<Tr s={ROMAN[n - 1]} />
        </p>
        <h2 id={`${id}-t`} className="cp-display cp-thin mt-2 text-[2.1rem] italic">
          {title}
        </h2>
        <GoldStar className="mt-3" />
        <p className="cp-muted mx-auto mt-3 max-w-md text-sm"><Tr s={hint} /></p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}


/** Lo que se escribe directamente sobre la web: sin caja, con una línea dorada suave al pasar o escribir. */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[color-mix(in_oklab,var(--c-gold)_14%,transparent)] transition placeholder:opacity-40 hover:ring-[color-mix(in_oklab,var(--c-gold)_40%,transparent)] focus:ring-[color-mix(in_oklab,var(--c-gold)_75%,transparent)]";
/** Campos de fecha, hora y números del círculo: con su caja fina dorada, sobre la noche. */
const field = `${inline} h-11 w-full px-3 [color-scheme:dark]`;
/** Ancho justo para lo escrito (el precio, los minutos): crece con cada cifra. */
const fit = (v: string, min = 2) => ({ width: `${Math.max(min, v.length) + 0.6}ch` });

/** El botón de la web con su texto escrito encima. */
function EditableButton({ value, onChange, className = "", label }: { value: string; onChange: (v: string) => void; className?: string; label: string }) {
  return (
    <span className={`cp-sacred-btn ${className}`}>
      <span className="cp-sacred-label w-full">
        <Mail className="h-5 w-5 shrink-0" strokeWidth={1.3} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={CARD_CTA_MAX}
          aria-label={label}
          className={`${inline} min-w-0 flex-1 px-1 text-center [font:inherit]`}
        />
      </span>
    </span>
  );
}

/**
 * Estudio de una lectura, una sesión 1:1 o un círculo: se edita sobre la propia web, en cuatro pasos.
 * I, el tipo (el sistema) o, en un círculo, cuándo es; II, la carta tal como sale en la web (foto,
 * título, texto breve y precio); III, las dos burbujas de su ficha, con sus frases y sus pasos; IV, sus
 * opiniones. Guarda con la misma acción que el formulario de siempre (updateProduct).
 */
export function ReadingStudio({
  product,
  themeStyle,
  themeCard,
  template,
  circlePost = { tier: null, body: "", joinLabel: "Enlace a Zoom", publishedAt: null, likes: 0, comments: 0, timeZone: "Europe/Madrid" },
}: {
  product: StudioProduct;
  themeStyle: CSSProperties;
  themeCard: string;
  template: string;
  circlePost?: StudioCirclePost;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProduct, undefined);
  const kind = product.kind;
  const session = kind === "session";
  const circle = kind === "circle";
  const [topics, setTopics] = useState<CourseCategory[]>(product.topics);
  const topic = topics[0] ?? null;
  const toggleTopic = (c: CourseCategory) => setTopics((l) => (l.includes(c) ? l.filter((x) => x !== c) : TOPICS.filter((x) => x === c || l.includes(x))));
  const topicsLabel = topics.map((c) => COURSE_CATEGORY_LABEL[c]).join(" + ");
  const [image, setImage] = useState(product.imageUrl);
  const [title, setTitle] = useState(product.title);
  const [summary, setSummary] = useState(product.summary);
  const [price, setPrice] = useState(product.price);
  const [duration, setDuration] = useState(String(product.durationMin));
  const [perks, setPerks] = useState(product.texts.perks);
  const [icons, setIcons] = useState(product.texts.icons);
  const [iconOpen, setIconOpen] = useState<number | null>(null);
  const [cta, setCta] = useState(product.cta);
  const [cardCta, setCardCta] = useState(product.texts.cardCta);
  const [steps, setSteps] = useState(product.texts.steps);
  const [eventDate, setEventDate] = useState(product.eventDate);
  const [eventTime, setEventTime] = useState(product.eventTime);
  const [capacity, setCapacity] = useState(product.capacity);
  const [meetingUrl, setMeetingUrl] = useState(product.meetingUrl);
  const [status, setStatus] = useState(product.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
  const [quotes, setQuotes] = useState<ProductTestimonial[]>(product.testimonials);
  const [newQuote, setNewQuote] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [upload, setUpload] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const word = circle ? (product.moonCircle ? "Círculo" : "Taller") : topic ? COURSE_CATEGORY_LABEL[topic] : session ? "Sesión" : "Lectura";
  const kindWord = circle ? (product.moonCircle ? "Círculo de la luna" : "Taller en directo") : session ? (topics.length ? `Sesión · ${topicsLabel}` : "Sesión") : topics.length ? `Lectura de ${topicsLabel}` : "Lectura";
  const ready = circle || topics.length > 0;
  // Círculo con fecha: en su ficha sale la luna de ese día (nueva o llena) en lugar de la foto.
  const sky = useMemo(() => (circle && product.moonCircle && eventDate ? moonCircleSky(new Date(`${eventDate}T${eventTime || "19:00"}:00`)) : null), [circle, product.moonCircle, eventDate, eventTime]);
  // Círculo de la luna: en su ficha no hay foto, sino su luna (nueva o llena) en su signo, elegida aquí.
  const moonMode = circle && product.moonCircle;
  const [moonPhase, setMoonPhase] = useState<MoonKind>(product.texts.moon?.phase ?? sky?.phase ?? "new");
  const [moonSign, setMoonSign] = useState<string>(product.texts.moon?.sign ?? sky?.sign ?? "Aries");
  const [moonText, setMoonText] = useState(product.texts.moon?.phrase || moonPhrase(product.texts.moon?.phase ?? sky?.phase ?? "new", product.texts.moon?.sign ?? sky?.sign ?? "Aries"));
  // Al cambiar la luna o el signo, si la frase es la de siempre, pasa a la nueva de siempre.
  const pickMoon = (phase: MoonKind, sign: string) => {
    if (moonText.trim() === moonPhrase(moonPhase, moonSign) || !moonText.trim()) setMoonText(moonPhrase(phase, sign));
    setMoonPhase(phase);
    setMoonSign(sign);
  };
  const chosenSky = moonSkyFor(moonPhase, moonSign, moonText, eventDate ? new Date(`${eventDate}T${eventTime || "19:00"}:00`) : null);
  // Su publicación en la membresía (lib/circle-post.ts): su texto y el botón del enlace.
  const [postBody, setPostBody] = useState(circlePost.body);
  const [joinLabel, setJoinLabel] = useState(circlePost.joinLabel);
  const ks = kindStyle("CIRCULO_LUNAR");
  const eventAt = eventDate && /^\d{2}:\d{2}$/.test(eventTime) ? zonedTimeToUtc(eventDate, labelToMinutes(eventTime), circlePost.timeZone) : null;
  const publishedAt = circlePost.publishedAt ? new Date(circlePost.publishedAt) : new Date();
  const publishedLine = formatDate(publishedAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, circlePost.timeZone);
  const cardPost: CardPost = {
    id: "vista",
    productId: "vista",
    title: title || "Tu círculo",
    body: postBody,
    bodyFormat: null,
    kind: "CIRCULO_LUNAR",
    publishedAt,
    eventAt,
    mediaUrl: meetingUrl && /^https:\/\//i.test(meetingUrl) ? meetingUrl : null,
    moon: { phase: moonPhase, sign: moonSign, phrase: moonText },
    joinLabel,
    state: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    likedByMe: false,
    files: [],
    _count: { likes: circlePost.likes, comments: circlePost.comments },
  };
  const dateLine = eventDate
    ? `${new Date(`${eventDate}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}${eventTime ? ` · ${eventTime}` : ""}`
    : "";
  const perkIcons = circle ? [Video] : session ? [Video, CalendarDays, Mail] : [Mail, Sparkles, Heart];
  const iconOf = (i: number) => perkIcon(icons[i], perkIcons[i] ?? Sparkles);

  const pickPhoto = () => fileInput.current?.click();
  const onPhoto = async (f: File) => {
    setUpload(0);
    setUploadError(null);
    try {
      const img = await uploadImageInfo(f, { onProgress: setUpload });
      setImage(img.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No se ha podido subir la foto");
    } finally {
      setUpload(null);
    }
  };
  const photoOverlay = (
    <span className="absolute inset-0 z-[3] grid place-items-center bg-black/0 text-white opacity-0 transition hover:bg-black/40 hover:opacity-100">
      <span className="flex flex-col items-center gap-1.5 text-sm font-semibold">
        <ImagePlus className="h-6 w-6" /> {image ? t("Cambiar la foto") : t("Subir la foto")}
      </span>
    </span>
  );
  const busy = upload !== null && (
    <span className="absolute inset-0 z-[4] grid place-items-center bg-black/60 text-sm text-white">
      <span className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> {upload < 100 ? `${upload} %` : t("Optimizando…")}
      </span>
    </span>
  );
  const addQuote = () => {
    if (!newQuote.trim() || quotes.length >= PRODUCT_TESTIMONIALS_MAX) return;
    setQuotes((q) => [...q, { id: `t${Date.now().toString(36)}`, quote: newQuote.trim(), author: newAuthor.trim() || "Anónima" }]);
    setNewQuote("");
    setNewAuthor("");
  };
  const setAt = (list: string[], i: number, v: string) => list.map((x, k) => (k === i ? v : x));
  const priceInput = () => (
    <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, "").slice(0, 7))} inputMode="decimal" placeholder="79" style={fit(price)} className={`px-0.5 text-right ${inline}`} aria-label={t("Precio en euros")} />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="cp relative overflow-hidden rounded-[2rem] border border-[color-mix(in_oklab,var(--c-gold)_30%,transparent)]"
      style={themeStyle}
      data-card={themeCard}
      data-template={template}
    >
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="imageUrl" value={image ?? ""} />
      <input type="hidden" name="emoji" value={moonMode ? MOON_KIND_ICON[moonPhase] : product.emoji} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="price" value={price} />
      <input type="hidden" name="ctaLabel" value={cta} />
      <input type="hidden" name="status" value={status} />
      {product.featured && <input type="hidden" name="featured" value="on" />}
      <input type="hidden" name="instructions" value={product.instructions} />
      <input type="hidden" name="deliveryMode" value={product.deliveryMode} />
      <input type="hidden" name="slug" value={product.slug} />
      {!circle && <input type="hidden" name="courseCategory" value={topics.join("+")} />}
      <input type="hidden" name="testimonialsField" value="1" />
      <input type="hidden" name="testimonials" value={JSON.stringify(quotes)} />
      <input type="hidden" name="pageTextsField" value="1" />
      {moonMode && (
        <>
          <input type="hidden" name="circlePostField" value="1" />
          <input type="hidden" name="postBody" value={postBody} />
          <input type="hidden" name="joinLabel" value={joinLabel} />
        </>
      )}
      <input type="hidden" name="pageTexts" value={JSON.stringify({ perks, icons, steps, cardCta, ...(moonMode ? { moon: { phase: moonPhase, sign: moonSign, phrase: moonText.trim() === moonPhrase(moonPhase, moonSign) ? "" : moonText.trim() } } : {}) })} />
      {kind !== "reading" && (
        <>
          <input type="hidden" name="groupSession" value={circle ? "on" : ""} />
          <input type="hidden" name="durationMin" value={duration} />
          <input type="hidden" name="bufferMin" value={product.bufferMin} />
          <input type="hidden" name="meetingUrl" value={meetingUrl} />
        </>
      )}
      {session && (
        <>
          <input type="hidden" name={product.notice.name} value={product.notice.value} />
          <input type="hidden" name="horizonDays" value={product.horizonDays} />
        </>
      )}
      {circle && (
        <>
          <input type="hidden" name="moonCircle" value={product.moonCircle ? "on" : ""} />
          <input type="hidden" name="minNoticeHours" value={0} />
          <input type="hidden" name="eventDate" value={eventDate} />
          <input type="hidden" name="eventTime" value={eventTime} />
          <input type="hidden" name="capacity" value={capacity} />
        </>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-label={t("Subir la foto")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPhoto(f);
        }}
      />

      <div className="cp-luxe relative mx-auto max-w-5xl space-y-20 px-4 pb-36 pt-10 sm:px-8">
        {/* I · El tipo (o, en un círculo, cuándo es) */}
        {circle ? (
          <Step n={1} id="cuando" title={product.moonCircle ? t("¿Cuándo es el círculo?") : t("¿Cuándo es el taller?")} hint={product.moonCircle ? t("El día y la hora salen en su página, en la comunidad y en tu portada.") : t("El día y la hora salen en su ficha.")}>
            <div className="cp-card mx-auto grid max-w-2xl gap-4 p-6 sm:grid-cols-2">
              <label className="block">
                <span className="cp-eyebrow mb-1.5 block !text-[0.6rem]"><Tr s={"Día"} /></span>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="cp-eyebrow mb-1.5 block !text-[0.6rem]"><Tr s={"Hora"} /></span>
                <input type="time" step={300} value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="cp-eyebrow mb-1.5 block !text-[0.6rem]"><Tr s={"Plazas (vacío = sin límite)"} /></span>
                <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="12" className={field} />
              </label>
              <label className="block">
                <span className="cp-eyebrow mb-1.5 block !text-[0.6rem]"><Tr s={"Enlace de Zoom"} /></span>
                <input type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://us02web.zoom.us/j/…" className={field} />
              </label>
            </div>
          </Step>
        ) : (
          <Step n={1} id="tipo" title={session ? t("¿De qué es la sesión?") : t("¿De qué es la lectura?")} hint={t("Elige uno o varios sistemas. En la carta sale el primero; en la ficha, todos (por ejemplo «Lectura de Astrología + Mi energía»).")}>
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label={t("Sistemas")}>
              {TOPICS.map((c) => {
                const on = topics.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleTopic(c)}
                    className="cp-card flex flex-col items-center gap-3 px-2 py-5 text-center transition hover:-translate-y-0.5"
                    style={on ? { boxShadow: "inset 0 0 0 1px var(--c-gold), 0 0 28px -8px color-mix(in oklab, var(--c-gold) 60%, transparent)" } : undefined}
                  >
                    <CategoryIcons categories={[c]} size={2.4} className={on ? "cp-gold" : "cp-muted"} />
                    <span className={`cp-display text-[1.1rem] ${on ? "cp-gold" : ""}`}><Tr s={COURSE_CATEGORY_LABEL[c]} /></span>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {!ready ? (
          <p className="cp-muted text-center text-sm italic"><Tr s={"Elige al menos un sistema y aparece la carta para rellenarla."} /></p>
        ) : (
          <>
            {/* II · Su luna (círculo de la luna: no tiene carta ni foto) o la carta */}
            {moonMode ? (
              <Step n={2} id="luna" title={t("Su luna")} hint={t("En su página, en lugar de una foto, sale su luna: nueva, llena o eclipse, en su signo, con una frase. Así sale en tu web.")}>
                <div className="grid gap-10 md:grid-cols-[minmax(0,330px)_1fr] md:items-start">
                  <div className="mx-auto w-full max-w-[330px] md:mx-0">
                    <div className="cp-show-photo">
                      <MoonCircleArt sky={chosenSky} />
                    </div>
                  </div>
                  <div className="space-y-7">
                    <div>
                      <p className="cp-eyebrow mb-3 !text-[0.65rem]"><Tr s={"La luna"} /></p>
                      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={t("La luna")}>
                        {MOON_KINDS.map((v) => [v, MOON_KIND_LABEL[v], MOON_KIND_ICON[v]] as const).map(([v, label, icon]) => {
                          const on = moonPhase === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => pickMoon(v, moonSign)}
                              className="cp-card flex flex-col items-center justify-center gap-2 px-2 py-4 transition hover:-translate-y-0.5 sm:flex-row sm:gap-3"
                              style={on ? { boxShadow: "inset 0 0 0 1px var(--c-gold), 0 0 28px -8px color-mix(in oklab, var(--c-gold) 60%, transparent)" } : undefined}
                            >
                              <span className="text-[1.6rem] leading-none" aria-hidden>
                                <Tr s={icon} />
                              </span>
                              <span className={`cp-display text-[1.3rem] ${on ? "cp-gold" : ""}`}><Tr s={label} /></span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="cp-eyebrow mb-3 !text-[0.65rem]"><Tr s={"El signo"} /></p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={t("El signo")}>
                        {SIGNS.map((s, i) => {
                          const on = moonSign === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => pickMoon(moonPhase, s)}
                              className="cp-card flex flex-col items-center gap-1 px-1 py-3 transition hover:-translate-y-0.5"
                              style={on ? { boxShadow: "inset 0 0 0 1px var(--c-gold), 0 0 22px -8px color-mix(in oklab, var(--c-gold) 60%, transparent)" } : undefined}
                            >
                              <span className={`text-[1.5rem] leading-none ${on ? "cp-gold" : "cp-muted"}`} aria-hidden>
                                <Tr s={SIGN_GLYPHS[i]} />
                                {"︎"}
                              </span>
                              <span className={`text-[0.72rem] ${on ? "cp-gold font-semibold" : ""}`}><Tr s={s} /></span>
                            </button>
                          );
                        })}
                      </div>
                      {sky && (sky.phase !== moonPhase || sky.sign !== moonSign) && (
                        <button type="button" onClick={() => pickMoon(sky.phase, sky.sign)} className="cp-gold mt-3 inline-flex items-center gap-1.5 text-sm underline underline-offset-4">
                          <Sparkles className="h-4 w-4" />{" "}<Tr s={"Poner la de su fecha:"} />{" "}{sky.title}
                        </button>
                      )}
                    </div>
                    <label className="block">
                      <span className="cp-eyebrow mb-2 block !text-[0.65rem]"><Tr s={"La frase de su luna"} /></span>
                      <textarea value={moonText} onChange={(e) => setMoonText(e.target.value)} maxLength={240} rows={3} className={`cp-thin-text w-full resize-none px-3 py-2 text-[1rem] italic leading-relaxed ${inline}`} aria-label={t("La frase de su luna")} />
                    </label>
                  </div>
                </div>
              </Step>
            ) : (
            <Step n={2} id="carta" title={t("La carta")} hint={t("Así sale en tu web: la foto, el título, el texto breve y el precio. Toca la foto para subirla y escribe encima.")}>
              <div className="mx-auto max-w-[16rem]">
                <article className="cp-oracle-card">
                  <FlowerOfLife className="cp-oracle-geo" strokeWidth={0.18} />
                  <div className="cp-oracle-top">
                    <button type="button" onClick={pickPhoto} className="cp-oracle-photo relative block text-left" aria-label={image ? t("Cambiar la foto") : t("Subir la foto")}>
                      <ProductImage src={image} emoji={product.emoji} title={title} sizes="300px" />
                      {photoOverlay}
                      {busy}
                    </button>
                    <OracleSide topics={topics} word={word} />
                  </div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required placeholder={t("Lectura de carta natal")} className={`cp-oracle-title relative z-[2] block w-full px-2 ${inline}`} aria-label={t("Título de la carta")} />
                  <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={240} rows={3} placeholder={t("Un texto breve: qué es y para quién.")} className={`cp-oracle-text relative z-[2] w-full resize-none px-2 ${inline}`} aria-label={t("Texto breve de la carta")} />
                  <div className="cp-oracle-rule" aria-hidden>
                    <span>✦</span>
                  </div>
                  <p className="cp-oracle-price relative z-[2]">
                    <span className="inline-flex items-baseline gap-1">
                      {priceInput()}
                      <span>€</span>
                    </span>
                  </p>
                  <EditableButton value={cardCta} onChange={setCardCta} label={t("Texto del botón de la carta")} />
                </article>
                {uploadError && <p className="mt-3 text-center text-sm text-rose"><Tr s={uploadError} /></p>}
              </div>
            </Step>
            )}

            {/* III · La ficha */}
            <Step
              n={3}
              id="ficha"
              title={t("Su página")}
              hint={moonMode ? t("Su página tal como sale en tu web: todo lo que ves se puede cambiar. La luna se cambia en el paso II.") : t("Las dos burbujas de su ficha: todo lo que ves se puede cambiar. Aquí va el título; el texto breve y el precio son los mismos de la carta.")}
            >
              <div className="grid gap-10 md:grid-cols-[minmax(0,330px)_1fr] md:items-start">
                <div className="mx-auto w-full max-w-[330px] md:mx-0">
                  {moonMode ? (
                    <a href="#luna" className="cp-show-photo block" aria-label={t("Cambiar la luna")}>
                      <MoonCircleArt sky={chosenSky} />
                    </a>
                  ) : (
                    <button type="button" onClick={pickPhoto} className="cp-show-photo relative block w-full text-left" aria-label={image ? t("Cambiar la foto") : t("Subir la foto")}>
                      <ProductImage src={image} emoji={product.emoji} title={title} sizes="330px" />
                      {photoOverlay}
                      {busy}
                    </button>
                  )}
                </div>
                <section className="cp-show-panel" aria-label={t("Burbuja de arriba")}>
                  <FlowerOfLife className="cp-show-geo" strokeWidth={0.25} />
                  <div className="flex items-center gap-3">
                    <span className="cp-show-icon">{topics.length ? <CategoryIcons categories={topics} size={topics.length > 2 ? 1.8 : 2.6} gap={0.2} /> : <Sparkles className="h-9 w-9" strokeWidth={1.1} />}</span>
                    <span className="cp-eyebrow !tracking-[0.32em]" style={{ color: "var(--c-gold)" }}>
                      <Tr s={kindWord} />
                    </span>
                  </div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required placeholder={t("Lectura de carta natal")} className={`cp-display cp-thin relative z-[2] mt-5 w-full px-1 text-[2.5rem] leading-[1.05] ${inline}`} aria-label={t("Título")} />
                  <GoldStar left className="mt-4" />
                  {circle && dateLine && (
                    <p className="mt-4 flex items-center gap-2.5 text-[1.05rem] first-letter:uppercase">
                      <CalendarDays className="cp-gold h-5 w-5" strokeWidth={1.4} /> <span className="first-letter:uppercase"><Tr s={dateLine} /></span>
                    </p>
                  )}
                  <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={240} rows={3} placeholder={t("Un texto breve: qué es y para quién.")} className={`cp-muted cp-thin-text relative z-[2] mt-4 w-full resize-none px-1 text-[1.05rem] leading-relaxed ${inline}`} aria-label={t("Texto breve")} />
                  <ul className="cp-show-perks relative z-[2] mt-6">
                    {kind !== "reading" && (
                      <li>
                        <Clock className="h-[1.1rem] w-[1.1rem] shrink-0" strokeWidth={1.4} />
                        <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" style={fit(duration)} className={`shrink-0 px-0.5 text-right ${inline}`} aria-label={t("Duración en minutos")} />{" "}<Tr s={"minutos"} /></li>
                    )}
                    {perks.map((text, i) => {
                      const Icon = iconOf(i);
                      return (
                        <li key={i} className="relative">
                          <button
                            type="button"
                            onClick={() => setIconOpen((o) => (o === i ? null : i))}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-[color-mix(in_oklab,var(--c-gold)_30%,transparent)] transition hover:ring-[var(--c-gold)]"
                            aria-label={`Cambiar el icono de la frase ${i + 1}`}
                            aria-expanded={iconOpen === i}
                          >
                            <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.4} />
                          </button>
                          <input value={text} onChange={(e) => setPerks((l) => setAt(l, i, e.target.value))} maxLength={80} className={`min-w-0 flex-1 px-1 ${inline}`} aria-label={`Frase ${i + 1}`} />
                          {iconOpen === i && (
                            <div className="absolute left-0 top-10 z-30 grid w-[17rem] grid-cols-6 gap-1 rounded-2xl p-2 shadow-2xl ring-1 ring-[color-mix(in_oklab,var(--c-gold)_40%,transparent)]" style={{ background: "color-mix(in oklab, var(--c-bg) 96%, #000)" }} role="listbox" aria-label={t("Iconos")}>
                              {PERK_ICON_KEYS.map((k) => {
                                const I = PERK_ICONS[k];
                                const on = icons[i] === k;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    role="option"
                                    aria-selected={on}
                                    onClick={() => {
                                      setIcons((l) => setAt(l, i, k));
                                      setIconOpen(null);
                                    }}
                                    className={`grid h-10 w-10 place-items-center rounded-xl transition hover:bg-[color-mix(in_oklab,var(--c-gold)_16%,transparent)] ${on ? "bg-[color-mix(in_oklab,var(--c-gold)_22%,transparent)]" : ""}`}
                                    aria-label={t(k)}
                                  >
                                    <I className="h-5 w-5" strokeWidth={1.4} />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </li>
                      );
                    })}
                    {circle && capacity && (
                      <li className="opacity-70">
                        <Users className="h-[1.1rem] w-[1.1rem] shrink-0" strokeWidth={1.4} />{" "}<Tr s={"Quedan"} />{" "}<Tr s={capacity} />{" "}<Tr s={"plazas"} />{" "}<span className="text-xs"><Tr s={"(se cuenta sola)"} /></span>
                      </li>
                    )}
                  </ul>
                  <EditableButton value={cta} onChange={setCta} className="!mt-7 w-full" label={t("Texto del botón de la ficha")} />
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <ol className="grid min-w-0 flex-1 gap-1.5">
                      {steps.map((s, i) => (
                        <li key={i} className="flex items-baseline gap-3 text-[0.9rem]">
                          <span className="cp-roman !w-6 shrink-0 !text-[1.05rem]"><Tr s={ROMAN[i]} /></span>
                          <input value={s} onChange={(e) => setSteps((l) => setAt(l, i, e.target.value))} maxLength={80} className={`cp-thin-text cp-muted relative z-[2] min-w-0 flex-1 px-1 ${inline}`} aria-label={`Paso ${ROMAN[i]}`} />
                        </li>
                      ))}
                    </ol>
                    <p className="cp-show-price relative z-[2] flex shrink-0 items-baseline gap-1">
                      {priceInput()}
                      <span>€</span>
                    </p>
                  </div>
                </section>
              </div>

              <div className="mx-auto mt-16 max-w-3xl">
                <div className="text-center">
                  <p className="cp-eyebrow !tracking-[0.4em]" style={{ color: "var(--c-gold)" }}><Tr s={"Para ti"} /></p>
                  <p className="cp-display cp-thin mt-2 text-[2.4rem] italic"><Tr s={"Qué incluye"} /></p>
                  <GoldStar className="mt-3" />
                </div>
                <div className="cp-include-panel mt-8">
                  <FlowerOfLife className="cp-include-geo" strokeWidth={0.22} />
                  <div className="studio-rte relative z-[2]">
                    <RichTextEditor
                      id="studio-description"
                      name="description"
                      formatName="descriptionFormat"
                      defaultValue={product.description}
                      initialFormat={product.descriptionFormat}
                      maxLength={5000}
                      tools="full"
                      tone="page"
                      headingLevel={3}
                      listMarker="star"
                      legacy="description"
                      rows={8}
                      ariaLabel="Qué incluye"
                      placeholder={t("Qué es y cómo es.\n\nIncluye:\n- Primer punto\n- Segundo punto")}
                    />
                  </div>
                </div>
              </div>
            </Step>

            {/* IV · Círculo de la luna: su publicación en la membresía (la tarjeta del feed y su página) */}
            {moonMode && (
              <Step
                n={4}
                id="membresia"
                title={t("En la membresía")}
                hint={
                  circlePost.tier
                    ? `Así lo ven las de «${circlePost.tier}»: su tarjeta en el feed y su página. El título, la luna y la fecha son los de arriba; aquí escribes su texto y el botón del enlace.`
                    : t("Cuando tengas una membresía, este círculo saldrá también dentro de ella, así.")
                }
              >
                <div className="acc-root acc-preview space-y-12 overflow-hidden rounded-[2rem] p-4 text-left sm:p-8">
                  {/* La tarjeta del feed */}
                  <div>
                    <p className="mb-3 text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold"><Tr s={"✦ Su tarjeta en el feed ✦"} /></p>
                    <div
                      className="vip-glass vip-post relative min-h-11 overflow-hidden rounded-[1.6rem] p-4 sm:p-6"
                      style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${ka(ks.color, "2e")}, transparent 55%), linear-gradient(160deg, rgb(36 31 78 / .78), rgb(18 16 44 / .86))` }}
                    >
                      <span aria-hidden className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ka(ks.light, "aa")}, transparent)` }} />
                      <div className="flex gap-4 sm:gap-6">
                        <PostCover post={cardPost} />
                        <div className="min-w-0 flex-1">
                          <PostCardBody post={cardPost} timeZone={circlePost.timeZone} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Su página */}
                  <div>
                    <p className="mb-3 text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold"><Tr s={"✦ Su página ✦"} /></p>
                    <div className="relative overflow-hidden rounded-[2rem]" style={{ boxShadow: `0 0 0 1px ${ka(ks.light, "33")}, 0 40px 80px -40px ${ks.color}` }}>
                      <a href="#luna" className="relative block aspect-[4/3] w-full sm:aspect-[16/10]" aria-label={t("Cambiar la luna")}>
                        <MoonCircleArt sky={chosenSky} />
                      </a>
                    </div>
                    <header
                      className="vip-hero relative isolate mx-3 -mt-16 overflow-hidden rounded-[2rem] px-6 py-9 text-center sm:mx-8 sm:-mt-24 sm:px-10 sm:py-12"
                      style={{ backgroundImage: `radial-gradient(90% 80% at 50% 0%, ${ka(ks.color, "40")}, transparent 65%), linear-gradient(180deg, rgb(30 26 66 / .85), rgb(13 12 34 / .92))` }}
                    >
                      <SacredFlower className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 opacity-25" />
                      <div className="flex justify-center">
                        <KindBadge kind="CIRCULO_LUNAR" big />
                      </div>
                      <p className="mt-3 text-[0.7rem] uppercase tracking-[0.24em] text-muted"><Tr s={publishedLine} /></p>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        aria-label={t("Título")}
                        className={`vip-gold display mx-auto mt-3 block w-full max-w-2xl px-2 text-center text-[2.3rem] leading-[1.05] sm:text-[3rem] ${inline}`}
                      />
                      <Ornament className="mt-5" />
                    </header>
                    {cardPost.eventAt && (
                      <p className="mt-6 flex w-fit items-center gap-1.5 rounded-full px-4 py-2 font-semibold" style={{ background: ks.soft, color: ks.light }}>
                        <CalendarDays className="h-4 w-4" /> {formatSessionDate(cardPost.eventAt, circlePost.timeZone)}{" "}<Tr s={"(hora de"} />{" "}{tzCity(circlePost.timeZone)})
                      </p>
                    )}
                    <div className="mt-4">
                      <span
                        className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${ks.color}, ${ka(ks.color, "bb")})`, boxShadow: `0 0 0 1px ${ka(ks.light, "88")}, 0 10px 30px -8px ${ks.color}` }}
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        <input
                          value={joinLabel}
                          onChange={(e) => setJoinLabel(e.target.value)}
                          maxLength={40}
                          aria-label={t("Texto del botón del enlace")}
                          style={fit(joinLabel, 8)}
                          className={`px-1 text-white ${inline}`}
                        />
                      </span>
                      {!meetingUrl && <p className="mt-2 text-xs text-muted"><Tr s={"Pon el enlace de Zoom en el paso I para que el botón salga."} /></p>}
                    </div>
                    <textarea
                      value={postBody}
                      onChange={(e) => setPostBody(e.target.value)}
                      maxLength={20000}
                      rows={6}
                      placeholder={t("Nos vemos en el círculo para vivir esta luna juntas…")}
                      aria-label={t("Texto de la publicación")}
                      className={`vip-article mt-10 w-full px-3 py-2 font-serif text-[1.22rem] leading-[1.85] text-ink/90 [field-sizing:content] ${inline}`}
                    />
                    <Ornament className="mt-12" />
                  </div>
                </div>
              </Step>
            )}

            {/* Opiniones */}
            <Step n={moonMode ? 5 : 4} id="opiniones" title={t("Lo que dicen")} hint={t("Sus opiniones. Salen bajo su ficha, una cada vez. Sin ninguna, salen las de tu portada.")}>
              <div className="mx-auto max-w-2xl space-y-8">
                {quotes.map((q) => (
                  <figure key={q.id} className="relative text-center">
                    <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.6rem]">“<Tr s={q.quote} />”</blockquote>
                    <figcaption className="mt-2 text-sm font-semibold"><Tr s={q.author} /></figcaption>
                    <button type="button" onClick={() => setQuotes((l) => l.filter((x) => x.id !== q.id))} className="cp-muted absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-[color-mix(in_oklab,var(--c-gold)_40%,transparent)] hover:text-[var(--c-gold)]" aria-label={`Borrar la opinión de ${q.author}`}>
                      <X className="h-4 w-4" />
                    </button>
                    <GoldStar className="mt-6" />
                  </figure>
                ))}
                {quotes.length < PRODUCT_TESTIMONIALS_MAX && (
                  <div className="cp-card space-y-3 p-5">
                    <textarea value={newQuote} onChange={(e) => setNewQuote(e.target.value)} maxLength={500} rows={3} placeholder={t("«Por fin entiendo mi carta sin perderme…»")} className={`cp-display w-full px-2 text-center text-[1.3rem] ${inline}`} aria-label={t("Opinión")} />
                    <input value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} maxLength={80} placeholder={t("Nombre (por ejemplo, Marta)")} className={`w-full px-2 py-1 text-center text-sm ${inline}`} aria-label={t("Quién lo dice")} />
                    <div className="flex justify-center">
                      <button type="button" onClick={addQuote} disabled={!newQuote.trim()} className="cp-btn !mt-0 disabled:opacity-40">
                        <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir opinión"} /></button>
                    </div>
                  </div>
                )}
              </div>
            </Step>
          </>
        )}
      </div>

      {/* Guardar: siempre a la vista. */}
      <div className="sticky bottom-0 z-20 border-t border-[color-mix(in_oklab,var(--c-gold)_30%,transparent)] px-4 py-3 backdrop-blur-xl" style={{ background: "color-mix(in oklab, var(--c-bg) 88%, transparent)" }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="radiogroup" aria-label={t("Estado")}>
            {(
              [
                ["DRAFT", "Borrador"],
                ["PUBLISHED", "Visible en la web"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={status === v} onClick={() => setStatus(v)} className={`rounded-full border px-3.5 py-1.5 text-sm transition ${status === v ? "border-[var(--c-gold)] text-[var(--c-gold)]" : "cp-muted border-transparent"}`}>
                <Tr s={label} />
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <Flash ok={state?.ok} error={state?.error} />
          </div>
          <button type="submit" disabled={pending || upload !== null || !ready} className="cp-btn !mt-0 disabled:opacity-50">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {pending ? t("Guardando…") : t("Guardar")}
          </button>
        </div>
      </div>
    </form>
  );
}
